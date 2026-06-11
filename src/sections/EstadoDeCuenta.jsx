import React, { useState, useEffect, useCallback } from 'react'
import { db } from '../db'
import Popup from '../components/Popup'
import { generateEstadoCuentaPDF } from '../utils/pdfGenerator'
import { periodoLabel, formatCurrency } from '../utils/helpers'

// ── helpers ──────────────────────────────────────────────────────────────

// Calcula el estado y mora de un período para un inquilino dado
function calcEstado(periodo, precioAlquiler, tem, pagoRegistrado) {
  if (pagoRegistrado) {
    const totalPagado = pagoRegistrado.totalPagado ?? pagoRegistrado.total
    const estado = totalPagado < pagoRegistrado.total ? 'parcial' : 'pagado'
    return { estado, mora: pagoRegistrado.importeMora ?? 0, tiempoMora: pagoRegistrado.tiempoMora }
  }

  // Las expensas se liquidan por adelantado: el mes de vencimiento es el
  // siguiente al período (ej: período Marzo → vence en Abril)
  // month sin -1 = siguiente mes en JS Date (0-indexed)
  const [year, month] = periodo.split('-').map(Number)
  const dia1  = new Date(year, month,  1, 0, 0, 0, 0)  // 1° del mes de vencimiento
  const dia11 = new Date(year, month, 11, 0, 0, 0, 0)  // 11° del mes de vencimiento
  const ahora = new Date()

  // Antes del día 1: período todavía no visible
  if (ahora < dia1)  return { estado: 'futuro',    mora: 0, tiempoMora: null }
  // Días 1-10: pendiente, botón visible, sin mora
  if (ahora < dia11) return { estado: 'pendiente', mora: 0, tiempoMora: null }

  // Mora acumulada desde el día 11
  const msTranscurridos = ahora - dia11
  const moraTotal = (msTranscurridos / (24 * 60 * 60 * 1000)) * ((Number(precioAlquiler) * (Number(tem) / 100)) / 30)

  const totalMinutos = Math.floor(msTranscurridos / 60000)
  const dias = Math.floor(totalMinutos / 1440)
  const horas = Math.floor((totalMinutos % 1440) / 60)
  const minutos = totalMinutos % 60

  let tiempoMora
  if (dias > 0) tiempoMora = `${dias} día${dias !== 1 ? 's' : ''}, ${horas} hora${horas !== 1 ? 's' : ''}, ${minutos} min`
  else if (horas > 0) tiempoMora = `${horas} hora${horas !== 1 ? 's' : ''}, ${minutos} min`
  else tiempoMora = `${minutos} min`

  return { estado: 'impago', mora: moraTotal, tiempoMora }
}

// Días hasta una fecha
function diasHasta(fechaStr) {
  if (!fechaStr) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaStr + 'T00:00:00')
  return Math.ceil((fecha - hoy) / 86400000)
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function EstadoDeCuenta() {
  const [screen, setScreen] = useState('lista')        // 'lista' | 'detalle'
  const [inquilinos, setInquilinos] = useState([])
  const [selected, setSelected] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [gastos, setGastos] = useState([])
  const [pagosMap, setPagosMap] = useState({})          // { periodo: pago }
  const [tem, setTem] = useState(0)
  const [tick, setTick] = useState(0)                  // fuerza re-render cada minuto
  const [confirmPago, setConfirmPago] = useState(null)  // periodo a marcar pagado
  const [montoPago, setMontoPago] = useState('')
  const [fechaPagoInput, setFechaPagoInput] = useState('')
  const [popup, setPopup] = useState(null)
  const [generando, setGenerando] = useState(false)

  // Pre-fill inputs when the payment modal is opened
  useEffect(() => {
    if (confirmPago && selected) {
      const expensas = expensasPeriodo(confirmPago)
      const alquiler = alquilerDe(confirmPago)
      const pago = pagosMap[confirmPago]

      const expensasHistorico = pago ? (pago.importeExpensas ?? expensas) : expensas
      const alquilerHistorico = pago ? (pago.importeAlquiler ?? alquiler) : alquiler
      const { mora } = calcEstado(confirmPago, alquilerHistorico, tem, pago)
      const total = pago ? (pago.total ?? (expensasHistorico + alquilerHistorico + mora)) : (expensasHistorico + alquilerHistorico + mora)
      const totalPagado = pago ? (pago.totalPagado ?? pago.total) : 0
      const saldo = total - totalPagado
      
      setMontoPago(String(saldo))
      
      const hoy = new Date()
      const yyyy = hoy.getFullYear()
      const mm = String(hoy.getMonth() + 1).padStart(2, '0')
      const dd = String(hoy.getDate()).padStart(2, '0')
      setFechaPagoInput(`${yyyy}-${mm}-${dd}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPago])

  // Ticker cada 60 segundos para actualizar mora en tiempo real
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // Cargar inquilinos y TEM al montar
  useEffect(() => {
    db.inquilinos.orderBy('apellido').toArray().then(setInquilinos)
    db.config.get('tem_mora').then(row => setTem(row?.valor ?? 0))
  }, [])

  // Cargar datos del inquilino seleccionado
  const loadDetalle = useCallback(async (inq) => {
    const [todosGastos, todosPagos, todosPeriodos] = await Promise.all([
      db.gastos.where('periodo').between('0000-00', '9999-99').toArray(),
      db.pagos.where({ inquilinoId: inq.id }).toArray(),
      db.periodos.orderBy('periodo').toArray()
    ])
    // Períodos con gastos asignados a este inquilino
    const periodosConGastos = [...new Set(todosGastos
      .filter(g => g.tipo === 'general' || g.inquilinoId === inq.id)
      .map(g => g.periodo)
    )].sort().reverse()

    // Períodos únicos: los de la DB de períodos + los que tienen gastos.
    // Se excluyen períodos anteriores al inicio del contrato del inquilino.
    const desde = inq.fechaInicioContrato ? inq.fechaInicioContrato.slice(0, 7) : null
    const todosPeriodosStr = [...new Set([
      ...todosPeriodos.map(p => p.periodo),
      ...periodosConGastos
    ])].filter(p => !desde || p >= desde).sort().reverse()

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

  // Alquiler vigente para un período (precio específico o base)
  function alquilerDe(periodo) {
    return selected?.preciosAlquiler?.[periodo] ?? Number(selected?.precioAlquiler || 0)
  }

  // Calcula expensas de un período para el inquilino
  function expensasPeriodo(periodo) {
    const totalInqs = inquilinos.filter(i => i.estadoContrato === 'Activo').length || 1
    const generales = gastos
      .filter(g => g.periodo === periodo && g.tipo === 'general')
      .reduce((s, g) => s + Number(g.importe) / totalInqs, 0)
    const particulares = gastos
      .filter(g => g.periodo === periodo && g.tipo === 'particular' && g.inquilinoId === selected?.id)
      .reduce((s, g) => s + Number(g.importe), 0)
    return generales + particulares
  }

  // Registrar pago (total o parcial) del período
  async function handleMarcarPagado(periodo) {
    const monto = parseFloat(montoPago)
    if (isNaN(monto) || monto <= 0) {
      setPopup('Ingresá un monto válido.')
      return
    }
    const fechaPago = fechaPagoInput
      ? new Date(fechaPagoInput + 'T' + new Date().toTimeString().slice(0, 8)).toISOString()
      : new Date().toISOString()

    const pagoPrevio = pagosMap[periodo]
    if (pagoPrevio) {
      // Completa (o suma a) un pago parcial existente
      const pagadoPrevio = pagoPrevio.totalPagado ?? pagoPrevio.total
      await db.pagos.update(pagoPrevio.id, { totalPagado: pagadoPrevio + monto, fechaPago })
    } else {
      const expensas = expensasPeriodo(periodo)
      const alquiler = alquilerDe(periodo)
      const { mora, tiempoMora } = calcEstado(periodo, alquiler, tem, null)
      await db.pagos.add({
        inquilinoId: selected.id,
        periodo,
        fechaPago,
        importeExpensas: expensas,
        importeAlquiler: alquiler,
        tiempoMora: tiempoMora || '—',
        importeMora: mora,
        total: expensas + alquiler + mora,
        totalPagado: monto
      })
    }

    await loadDetalle(selected)
    setConfirmPago(null)
    setPopup('¡Pago registrado!')
  }

  // Datos de una fila de período: usa los importes históricos del pago si existe
  function filaPeriodo(p) {
    const pago = pagosMap[p]
    const expensas = pago ? (pago.importeExpensas ?? expensasPeriodo(p)) : expensasPeriodo(p)
    const alquiler = pago ? (pago.importeAlquiler ?? alquilerDe(p)) : alquilerDe(p)
    const { estado, mora, tiempoMora } = calcEstado(p, alquiler, tem, pago)
    const total = pago ? (pago.total ?? (expensas + alquiler + mora)) : (expensas + alquiler + mora)
    const totalPagado = pago ? (pago.totalPagado ?? pago.total) : 0
    return { periodo: p, expensas, alquiler, mora, tiempoMora, estado, total, totalPagado, saldo: total - totalPagado, fechaPago: pago?.fechaPago }
  }

  async function handleExportPDF() {
    if (!selected) return
    setGenerando(true)
    try {
      const filas = periodos.map(filaPeriodo)
      await generateEstadoCuentaPDF(selected, filas)
    } finally {
      setGenerando(false)
    }
  }

  // ── PANTALLA 1: lista ────────────────────────────────────────────────────
  if (screen === 'lista') {
    return (
      <div className="section-container">
        <h2>Estado de Cuenta</h2>
        {inquilinos.length === 0 && (
          <div className="empty-state"><p>No hay inquilinos registrados.</p></div>
        )}
        <div className="ec-list">
          {inquilinos.map(inq => {
            const dias = diasHasta(inq.fechaProximaActualizacion)
            return (
              <button key={inq.id} className="ec-list-item" onClick={() => handleSelectInq(inq)}>
                <div className="ec-list-main">
                  <span className="ec-depto">{inq.departamento}</span>
                  <span className="ec-nombre">{inq.apellido}, {inq.nombre}</span>
                  {inq.precioAlquiler && <span className="ec-alquiler">{formatCurrency(inq.precioAlquiler)}</span>}
                </div>
                {dias !== null && dias <= 10 && (
                  <span className="ec-alerta-mini">⚠️ Actualización en {dias} día{dias !== 1 ? 's' : ''}</span>
                )}
              </button>
            )
          })}
        </div>
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
                const pago = pagosMap[p]
                const { expensas, alquiler, mora, tiempoMora, estado, total, saldo } = filaPeriodo(p)
                void tick // lee tick para re-render automático

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
                    <td>
                      <strong>{formatCurrency(total)}</strong>
                      {estado === 'parcial' && (
                        <span className="ec-mora-tiempo" style={{ display: 'block' }}>Resta {formatCurrency(saldo)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`estado-badge ${
                        estado === 'pagado'   ? 'estado-pagado'   :
                        estado === 'impago'   ? 'estado-impago'   : 'estado-pendiente'
                      }`}>
                        {estado === 'pagado' ? 'Pagado' : estado === 'parcial' ? 'Parcial' : estado === 'impago' ? 'Impago' : 'Pendiente'}
                      </span>
                    </td>
                    <td>
                      {(estado === 'pendiente' || estado === 'impago' || estado === 'parcial') && (
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
        <div className="popup-overlay">
          <div className="confirm-box">
            <p>Registrar pago de <strong>{periodoLabel(confirmPago)}</strong>. Podés modificar el monto para registrar un pago parcial.</p>
            <div className="form-group">
              <label>Monto ($)</label>
              <input type="number" step="0.01" min="0" value={montoPago} onChange={e => setMontoPago(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Fecha de pago</label>
              <input type="date" value={fechaPagoInput} onChange={e => setFechaPagoInput(e.target.value)} />
            </div>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setConfirmPago(null)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleMarcarPagado(confirmPago)}>Confirmar pago</button>
            </div>
          </div>
        </div>
      )}

      {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
