import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '../db'
import ConfirmDialog from '../components/ConfirmDialog'
import Popup from '../components/Popup'
import { generateEstadoCuentaPDF } from '../utils/pdfGenerator'
import { periodoLabel, formatCurrency } from '../utils/helpers'
import { TrendingUp, TrendingDown, Clock, Bell, ChevronRight, Users } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────

function calcEstado(periodo, precioAlquiler, tem, pagoRegistrado) {
  if (pagoRegistrado) return { estado: 'pagado', mora: pagoRegistrado.importeMora, tiempoMora: pagoRegistrado.tiempoMora }

  const [year, month] = periodo.split('-').map(Number)
  const dia1  = new Date(year, month,  1, 0, 0, 0, 0)
  const dia11 = new Date(year, month, 11, 0, 0, 0, 0)
  const ahora = new Date()

  if (ahora < dia1)  return { estado: 'futuro',    mora: 0, tiempoMora: null }
  if (ahora < dia11) return { estado: 'pendiente', mora: 0, tiempoMora: null }

  const msTranscurridos = ahora - dia11
  const moraTotal = (msTranscurridos / (24 * 60 * 60 * 1000)) * ((Number(precioAlquiler) * (Number(tem) / 100)) / 30)

  const totalMinutos = Math.floor(msTranscurridos / 60000)
  const dias  = Math.floor(totalMinutos / 1440)
  const horas = Math.floor((totalMinutos % 1440) / 60)
  const mins  = totalMinutos % 60

  let tiempoMora
  if (dias > 0)       tiempoMora = `${dias} día${dias !== 1 ? 's' : ''}, ${horas} hora${horas !== 1 ? 's' : ''}, ${mins} min`
  else if (horas > 0) tiempoMora = `${horas} hora${horas !== 1 ? 's' : ''}, ${mins} min`
  else                tiempoMora = `${mins} min`

  return { estado: 'impago', mora: moraTotal, tiempoMora }
}

function diasHasta(fechaStr) {
  if (!fechaStr) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaStr + 'T00:00:00')
  return Math.ceil((fecha - hoy) / 86400000)
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function EstadoDeCuenta() {
  const [screen,      setScreen]      = useState('lista')
  const [inquilinos,  setInquilinos]  = useState([])
  const [selected,    setSelected]    = useState(null)
  const [periodos,    setPeriodos]    = useState([])
  const [gastos,      setGastos]      = useState([])
  const [pagosMap,    setPagosMap]    = useState({})
  const [tem,         setTem]         = useState(0)
  const [tick,        setTick]        = useState(0)
  const [confirmPago, setConfirmPago] = useState(null)
  const [popup,       setPopup]       = useState(null)
  const [generando,   setGenerando]   = useState(false)
  const [dashStats,   setDashStats]   = useState({
    activos: 0, totalGastos: 0, cobrado: 0, pagados: 0, pendiente: 0, alertas: 0
  })

  const currentPeriodo = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    db.inquilinos.orderBy('apellido').toArray().then(setInquilinos)
    db.config.get('tem_mora').then(row => setTem(row?.valor ?? 0))
  }, [])

  useEffect(() => {
    if (screen === 'lista' && inquilinos.length >= 0) loadDashStats()
  }, [screen, inquilinos, currentPeriodo])

  async function loadDashStats() {
    const [todosGastos, todosPagos] = await Promise.all([
      db.gastos.where('periodo').equals(currentPeriodo).toArray(),
      db.pagos.where('periodo').equals(currentPeriodo).toArray()
    ])
    const activos     = inquilinos.filter(i => i.estadoContrato === 'Activo')
    const totalGastos = todosGastos.reduce((s, g) => s + Number(g.importe), 0)
    const cobrado     = todosPagos.reduce((s, p) => s + Number(p.total || 0), 0)
    const pagadosCount = todosPagos.length
    const pagadosIds  = new Set(todosPagos.map(p => p.inquilinoId))
    const pendiente   = activos
      .filter(i => !pagadosIds.has(i.id))
      .reduce((s, i) => s + Number(i.precioAlquiler || 0), 0)
    const hoy = new Date()
    const alertas = inquilinos.filter(i => {
      if (!i.fechaProximaActualizacion) return false
      const fecha = new Date(i.fechaProximaActualizacion + 'T00:00:00')
      const d = Math.ceil((fecha - hoy) / 86400000)
      return d >= 0 && d <= 30
    }).length
    setDashStats({ activos: activos.length, totalGastos, cobrado, pagados: pagadosCount, pendiente, alertas })
  }

  const loadDetalle = useCallback(async (inq) => {
    const [todosGastos, todosPagos, todosPeriodos] = await Promise.all([
      db.gastos.where('periodo').between('0000-00', '9999-99').toArray(),
      db.pagos.where({ inquilinoId: inq.id }).toArray(),
      db.periodos.orderBy('periodo').toArray()
    ])
    const periodosConGastos = [...new Set(todosGastos
      .filter(g => g.tipo === 'general' || g.inquilinoId === inq.id)
      .map(g => g.periodo)
    )].sort().reverse()
    const todosPeriodosStr = [...new Set([
      ...todosPeriodos.map(p => p.periodo),
      ...periodosConGastos
    ])].sort().reverse()
    setPeriodos(todosPeriodosStr)
    setGastos(todosGastos)
    const map = {}
    todosPagos.forEach(p => { map[p.periodo] = p })
    setPagosMap(map)
  }, [])

  async function handleSelectInq(inq) {
    setSelected(inq)
    await loadDetalle(inq)
    setScreen('detalle')
  }

  function expensasPeriodo(periodo) {
    const totalInqs = inquilinos.filter(i => i.estadoContrato === 'Activo').length || 1
    const generales   = gastos
      .filter(g => g.periodo === periodo && g.tipo === 'general')
      .reduce((s, g) => s + Number(g.importe) / totalInqs, 0)
    const particulares = gastos
      .filter(g => g.periodo === periodo && g.tipo === 'particular' && g.inquilinoId === selected?.id)
      .reduce((s, g) => s + Number(g.importe), 0)
    return generales + particulares
  }

  async function handleMarcarPagado(periodo) {
    const expensas = expensasPeriodo(periodo)
    const alquiler = Number(selected.precioAlquiler || 0)
    const { mora, tiempoMora } = calcEstado(periodo, alquiler, tem, null)
    await db.pagos.add({
      inquilinoId:    selected.id,
      periodo,
      fechaPago:      new Date().toISOString(),
      importeExpensas: expensas,
      importeAlquiler: alquiler,
      tiempoMora:     tiempoMora || '—',
      importeMora:    mora,
      total:          expensas + alquiler + mora
    })
    await loadDetalle(selected)
    setConfirmPago(null)
    setPopup('¡Pago registrado!')
  }

  async function handleExportPDF() {
    if (!selected) return
    setGenerando(true)
    try {
      const filas = periodos.map(p => {
        const expensas = expensasPeriodo(p)
        const alquiler = Number(selected.precioAlquiler || 0)
        const pago     = pagosMap[p]
        const { estado, mora, tiempoMora } = calcEstado(p, alquiler, tem, pago)
        return { periodo: p, expensas, alquiler, mora, tiempoMora, estado, total: expensas + alquiler + mora, fechaPago: pago?.fechaPago }
      })
      await generateEstadoCuentaPDF(selected, filas)
    } finally {
      setGenerando(false)
    }
  }

  // ── PANTALLA 1: Dashboard (Bento Box) ────────────────────────────────────
  if (screen === 'lista') {
    return (
      <div className="px-4 pt-5 pb-4">

        {/* Greeting */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-['Manrope'] text-2xl font-bold text-white mb-0.5">¡Hola!</h2>
            <p className="text-[#757575] text-sm">{periodoLabel(currentPeriodo)}</p>
          </div>
        </div>

        {/* Main card — Recaudado con glow */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1E1E1E] to-[#0F0F0F] border border-[#4B5EF7]/30 rounded-3xl px-5 py-4 mb-4 shadow-lg">
          <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 bg-[#4B5EF7]/20 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#4B5EF7]" />
              <p className="text-[11px] font-bold text-[#757575] uppercase tracking-wider">Recaudado este período</p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#4B5EF7]/10 text-[#4B5EF7] px-2 py-0.5 rounded-full border border-[#4B5EF7]/20">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {dashStats.pagados}/{dashStats.activos} pagados
              </span>
            </div>
          </div>
          <h3 className="font-['Manrope'] text-4xl font-bold text-white relative z-10 mt-2 mb-0">
            {formatCurrency(dashStats.cobrado)}
          </h3>
        </div>

        {/* Bento 2×2 */}
        <div className="grid grid-cols-2 gap-3 mb-5">

          {/* Gastos del período */}
          <div className="bg-[#1E1E1E] border border-white/5 rounded-2xl p-3.5 hover:border-red-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Gastos</p>
              <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                <TrendingDown size={14} strokeWidth={2.5} />
              </div>
            </div>
            <p className="font-['Manrope'] text-base font-bold text-white leading-none">{formatCurrency(dashStats.totalGastos)}</p>
            <p className="text-[#757575] text-[10px] mt-1">{periodoLabel(currentPeriodo)}</p>
          </div>

          {/* Por cobrar */}
          <div className="bg-[#1E1E1E] border border-white/5 rounded-2xl p-3.5 hover:border-orange-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Por cobrar</p>
              <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400">
                <Clock size={14} strokeWidth={2.5} />
              </div>
            </div>
            <p className="font-['Manrope'] text-base font-bold text-white leading-none">{formatCurrency(dashStats.pendiente)}</p>
            <p className="text-[#757575] text-[10px] mt-1">{dashStats.activos - dashStats.pagados} inquilinos</p>
          </div>

          {/* Cobrado */}
          <div className="bg-[#1E1E1E] border border-white/5 rounded-2xl p-3.5 hover:border-green-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Cobrado</p>
              <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                <TrendingUp size={14} strokeWidth={2.5} />
              </div>
            </div>
            <p className="font-['Manrope'] text-base font-bold text-white leading-none">{formatCurrency(dashStats.cobrado)}</p>
            <p className="text-[#757575] text-[10px] mt-1">{dashStats.pagados} pagados</p>
          </div>

          {/* Alertas */}
          <div className="bg-[#1E1E1E] border border-white/5 rounded-2xl p-3.5 hover:border-orange-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Alertas</p>
              <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400">
                <Bell size={14} strokeWidth={2.5} />
              </div>
            </div>
            <p className="font-['Manrope'] text-4xl font-bold text-white leading-none">{dashStats.alertas}</p>
            <p className="text-[#757575] text-[10px] mt-1">actualizaciones próximas</p>
          </div>

        </div>

        {/* Lista de inquilinos */}
        {inquilinos.length === 0 ? (
          <div className="text-center py-10 text-[#757575]">
            <p className="text-sm">No hay inquilinos registrados.</p>
            <p className="text-xs mt-1">Agregá inquilinos desde la sección Inquilinos.</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold text-[#757575] uppercase tracking-wider mb-3">Inquilinos</p>
            <div className="flex flex-col gap-2">
              {inquilinos.map(inq => {
                const dias = diasHasta(inq.fechaProximaActualizacion)
                return (
                  <button
                    key={inq.id}
                    onClick={() => handleSelectInq(inq)}
                    className="bg-[#1E1E1E] border border-white/5 rounded-2xl px-4 py-3 text-left flex items-center gap-3 hover:border-[#4B5EF7]/30 transition-colors w-full"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#4B5EF7]/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#4B5EF7] text-xs font-bold">{inq.departamento}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{inq.apellido}, {inq.nombre}</p>
                      {inq.precioAlquiler && (
                        <p className="text-xs text-[#757575]">{formatCurrency(inq.precioAlquiler)}/mes</p>
                      )}
                    </div>
                    {dias !== null && dias <= 10 && (
                      <span className="text-[10px] text-orange-400 font-bold flex-shrink-0">⚠ {dias}d</span>
                    )}
                    <ChevronRight size={16} className="text-[#757575] flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── PANTALLA 2: detalle ──────────────────────────────────────────────────
  const diasAlerta = diasHasta(selected?.fechaProximaActualizacion)

  return (
    <div className="section-container">
      <div className="section-header">
        <h2>Estado de Cuenta</h2>
        <button className="btn-secondary" onClick={() => setScreen('lista')}>← Volver</button>
      </div>

      {/* Encabezado inquilino */}
      <div className="ec-header-card">
        <div className="ec-header-row">
          <div>
            <p className="ec-header-name">{selected?.apellido}, {selected?.nombre}</p>
            <p className="ec-header-sub">Depto: {selected?.departamento}</p>
          </div>
          <div className="ec-header-right">
            {selected?.precioAlquiler && <p className="ec-header-alquiler">{formatCurrency(selected.precioAlquiler)}<span>/mes</span></p>}
            {selected?.cicloActualizacion && <p className="ec-header-ciclo">Ciclo: {selected.cicloActualizacion}</p>}
            {selected?.fechaProximaActualizacion && (
              <p className="ec-header-ciclo">
                Próx. actualización: {new Date(selected.fechaProximaActualizacion + 'T00:00:00').toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
        </div>
        {diasAlerta !== null && diasAlerta <= 10 && (
          <div className="ec-alerta">
            ⚠️ La actualización del alquiler vence en <strong>{diasAlerta} día{diasAlerta !== 1 ? 's' : ''}</strong>
          </div>
        )}
      </div>

      {/* Tabla de períodos */}
      {periodos.length === 0 ? (
        <div className="empty-state"><p>No hay períodos registrados para este inquilino.</p></div>
      ) : (
        <div className="table-scroll">
          <table className="preview-table ec-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Expensas</th>
                <th>Alquiler</th>
                <th>Mora</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map(p => {
                const expensas = expensasPeriodo(p)
                const alquiler = Number(selected?.precioAlquiler || 0)
                const pago     = pagosMap[p]
                const { estado, mora, tiempoMora } = calcEstado(p, alquiler, tem, pago)
                const total = expensas + alquiler + mora
                void tick

                return (
                  <tr key={p}>
                    <td><strong>{periodoLabel(p)}</strong></td>
                    <td>{formatCurrency(expensas)}</td>
                    <td>{formatCurrency(alquiler)}</td>
                    <td>
                      {estado === 'impago' && mora > 0 ? (
                        <span className="ec-mora-cell">
                          {formatCurrency(mora)}
                          <span className="ec-mora-tiempo">{tiempoMora}</span>
                        </span>
                      ) : estado === 'pagado' && mora > 0 ? (
                        <span className="ec-mora-pagada">{formatCurrency(mora)}</span>
                      ) : '—'}
                    </td>
                    <td><strong>{formatCurrency(total)}</strong></td>
                    <td>
                      <span className={`estado-badge ${
                        estado === 'pagado'   ? 'estado-pagado'   :
                        estado === 'impago'   ? 'estado-impago'   : 'estado-pendiente'
                      }`}>
                        {estado === 'pagado' ? 'Pagado' : estado === 'impago' ? 'Impago' : 'Pendiente'}
                      </span>
                    </td>
                    <td>
                      {(estado === 'pendiente' || estado === 'impago') && (
                        <button className="btn-primary btn-sm" onClick={() => setConfirmPago(p)}>
                          Marcar Pagado
                        </button>
                      )}
                      {estado === 'pagado' && pago?.fechaPago && (
                        <span className="ec-fecha-pago">
                          {new Date(pago.fechaPago).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Exportar PDF */}
      <div className="ec-pdf-bar">
        <button className="btn-primary" onClick={handleExportPDF} disabled={generando}>
          {generando ? 'Generando...' : '📄 Exportar PDF'}
        </button>
      </div>

      {confirmPago && (
        <ConfirmDialog
          message={`¿Registrar el pago de ${periodoLabel(confirmPago)}? Se guardará la fecha, hora y mora acumulada hasta este momento.`}
          cancelLabel="Cancelar"
          confirmLabel="Confirmar pago"
          onCancel={() => setConfirmPago(null)}
          onConfirm={() => handleMarcarPagado(confirmPago)}
        />
      )}

      {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
