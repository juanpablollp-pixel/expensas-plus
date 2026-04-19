import React, { useState, useEffect } from 'react'
import { db } from '../db'
import { periodoLabel, formatCurrency } from '../utils/helpers'

function diasHasta(fechaStr) {
  if (!fechaStr) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaStr + 'T00:00:00')
  return Math.ceil((fecha - hoy) / 86400000)
}

function calcMoraImporte(periodo, alquiler, tem) {
  if (!periodo || !alquiler) return 0
  const [year, month] = periodo.split('-').map(Number)
  const dia11 = new Date(year, month, 11, 0, 0, 0, 0)
  const ahora = new Date()
  if (ahora < dia11) return 0
  const ms = ahora - dia11
  return (ms / (24 * 60 * 60 * 1000)) * ((alquiler * (tem / 100)) / 30)
}

function periodoEstado(periodo, pago) {
  if (pago) return 'pagado'
  if (!periodo) return 'pendiente'
  const [year, month] = periodo.split('-').map(Number)
  const dia11 = new Date(year, month, 11, 0, 0, 0, 0)
  return new Date() >= dia11 ? 'impago' : 'pendiente'
}

// ── Íconos ───────────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function IconServices() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/>
    </svg>
  )
}

function IconMoney() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Inicio({ onNavigate }) {
  const [stats, setStats] = useState(null)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const [todosInquilinos, todosGastos, todosServicios, todosPagos, configTEM] = await Promise.all([
      db.inquilinos.toArray(),
      db.gastos.toArray(),
      db.servicios.toArray(),
      db.pagos.toArray(),
      db.config.get('tem_mora'),
    ])

    const tem = configTEM?.valor ?? 0
    const inquilinosActivos = todosInquilinos.filter(i => i.estadoContrato === 'Activo')
    const countActivos = inquilinosActivos.length || 1

    // Período actual (el más reciente con gastos)
    const gastoPeriodoKeys = [...new Set(todosGastos.map(g => g.periodo).filter(Boolean))]
    gastoPeriodoKeys.sort((a, b) => b.localeCompare(a))
    const periodoActual = gastoPeriodoKeys[0] ?? null

    const gastosDelPeriodo = periodoActual
      ? todosGastos.filter(g => g.periodo === periodoActual)
      : []
    const totalGastosPeriodo = gastosDelPeriodo.reduce((s, g) => s + Number(g.importe || 0), 0)

    // Expensas por inquilino en período actual
    const totalGenerales = gastosDelPeriodo
      .filter(g => g.tipo === 'general')
      .reduce((s, g) => s + Number(g.importe || 0), 0)

    // Helper: busca el pago de un inquilino para el período actual
    // Usa comparación explícita con Number() para evitar problemas de tipos
    const pagoDeInquilino = (inqId) =>
      todosPagos.find(
        p => Number(p.inquilinoId) === Number(inqId) && p.periodo === periodoActual
      ) ?? null

    const expensasDeInquilino = (inqId) => {
      const particulares = gastosDelPeriodo
        .filter(g => g.tipo === 'particular' && Number(g.inquilinoId) === Number(inqId))
        .reduce((s, g) => s + Number(g.importe || 0), 0)
      return (totalGenerales / countActivos) + particulares
    }

    // Card: Inquilinos — detalle por inquilino activo
    const inquilinoRows = inquilinosActivos.map(inq => {
      const expensas = expensasDeInquilino(inq.id)
      const alquiler = Number(inq.precioAlquiler || 0)
      const pago = pagoDeInquilino(inq.id)
      const mora = pago
        ? (pago.importeMora || 0)
        : calcMoraImporte(periodoActual, alquiler, tem)
      const total = expensas + alquiler + mora

      const dias = diasHasta(inq.fechaProximaActualizacion)
      const showPill = dias !== null && dias <= 30
      const pillOverdue = dias !== null && dias <= 0

      return {
        id: inq.id,
        nombre: `${inq.nombre} ${inq.apellido}`,
        departamento: inq.departamento,
        expensas,
        alquiler,
        mora,
        total,
        showPill,
        pillOverdue,
        diasActualizacion: dias,
      }
    })

    // Card: Servicios — total por servicio en período actual
    const servicioRows = todosServicios.map(s => ({
      id: s.id,
      nombre: s.nombre,
      total: gastosDelPeriodo
        .filter(g => Number(g.servicioId) === Number(s.id))
        .reduce((sum, g) => sum + Number(g.importe || 0), 0),
    })).filter(s => s.total > 0)

    // Card: Pagos — estado por inquilino activo en período actual
    const pagosRows = inquilinosActivos.map(inq => {
      const pago = pagoDeInquilino(inq.id)
      const expensas = expensasDeInquilino(inq.id)
      const alquiler = Number(inq.precioAlquiler || 0)
      const total = pago ? pago.total : (expensas + alquiler)
      return {
        id: inq.id,
        nombre: `${inq.apellido}, ${inq.nombre}`,
        departamento: inq.departamento,
        total,
        estado: periodoEstado(periodoActual, pago),
      }
    })

    setStats({
      periodoActual,
      periodoLabelStr: periodoActual ? periodoLabel(periodoActual) : 'Sin datos',
      totalGastosPeriodo,
      inquilinoRows,
      servicioRows,
      pagosRows,
    })
  }

  if (!stats) {
    return (
      <div className="inicio-loading">
        <div className="inicio-spinner" />
      </div>
    )
  }

  const { periodoLabelStr, totalGastosPeriodo, inquilinoRows, servicioRows, pagosRows } = stats

  return (
    <div className="inicio-screen">

      <div className="inicio-header">
        <h1 className="inicio-title">Bienvenido</h1>
        <p className="inicio-subtitle">Resumen del edificio</p>
      </div>

      <div className="dashboard-grid">

        {/* 1 — Período actual */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-success"><IconCalendar /></div>
          <div className="dash-card-body">
            <span className="dash-card-label">Período actual</span>
            <span className="dash-card-value dash-card-value--md">{periodoLabelStr}</span>
          </div>
        </div>

        {/* 2 — Inquilinos */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <div className="dash-card-icon dash-icon-accent"><IconPeople /></div>
            <span className="dash-section-title">Inquilinos</span>
            <span className="dash-section-badge">{inquilinoRows.length} activos</span>
          </div>

          {inquilinoRows.length === 0 ? (
            <p className="dash-empty">Sin inquilinos activos</p>
          ) : (
            inquilinoRows.map(inq => (
              <div key={inq.id} className="dash-inq-row">
                <div className="dash-inq-top">
                  <span className="dash-inq-depto">{inq.departamento || '—'}</span>
                  <span className="dash-inq-nombre">{inq.nombre}</span>
                  {inq.showPill && (
                    <span className={`dash-pill${inq.pillOverdue ? ' dash-pill--danger' : ' dash-pill--warning'}`}>
                      {inq.pillOverdue
                        ? 'Actualizar precio'
                        : `Actualizar en ${inq.diasActualizacion}d`}
                    </span>
                  )}
                </div>
                <div className="dash-inq-amounts">
                  <div className="dash-amount-item">
                    <span className="dash-amount-label">Expensas</span>
                    <span className="dash-amount-value">{formatCurrency(inq.expensas)}</span>
                  </div>
                  <div className="dash-amount-item">
                    <span className="dash-amount-label">Alquiler</span>
                    <span className="dash-amount-value">{formatCurrency(inq.alquiler)}</span>
                  </div>
                  <div className="dash-amount-item">
                    <span className="dash-amount-label">Mora</span>
                    <span className="dash-amount-value">{inq.mora > 0 ? formatCurrency(inq.mora) : '—'}</span>
                  </div>
                  <div className="dash-amount-item">
                    <span className="dash-amount-label">Total</span>
                    <span className="dash-amount-value dash-amount-value--total">{formatCurrency(inq.total)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 3 — Servicios */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <div className="dash-card-icon dash-icon-muted"><IconServices /></div>
            <span className="dash-section-title">Servicios</span>
            <span className="dash-section-badge">{servicioRows.length} con gastos</span>
          </div>

          {servicioRows.length === 0 ? (
            <p className="dash-empty">Sin gastos en este período</p>
          ) : (
            servicioRows.map(s => (
              <div key={s.id} className="dash-svc-row">
                <span className="dash-svc-nombre">{s.nombre}</span>
                <span className="dash-svc-total">{formatCurrency(s.total)}</span>
              </div>
            ))
          )}
        </div>

        {/* 4 — Total gastos */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-accent"><IconMoney /></div>
          <div className="dash-card-body">
            <span className="dash-card-label">Total gastos</span>
            <span className="dash-card-value dash-card-value--md">{formatCurrency(totalGastosPeriodo)}</span>
          </div>
        </div>

        {/* 5 — Pagos registrados */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <div className="dash-card-icon dash-icon-warning"><IconCheck /></div>
            <span className="dash-section-title">Pagos registrados</span>
            <span className="dash-section-badge">
              {pagosRows.filter(p => p.estado === 'pagado').length}/{pagosRows.length}
            </span>
          </div>

          {pagosRows.length === 0 ? (
            <p className="dash-empty">Sin inquilinos activos</p>
          ) : (
            pagosRows.map(p => (
              <div key={p.id} className="dash-pago-row">
                <span className="dash-inq-depto">{p.departamento || '—'}</span>
                <span className="dash-pago-nombre">{p.nombre}</span>
                <span className="dash-pago-total">{formatCurrency(p.total)}</span>
                <span className={`dash-pago-estado dash-pago-estado--${p.estado}`}>
                  {p.estado === 'pagado' ? 'Pagado' : p.estado === 'impago' ? 'Impago' : 'Pendiente'}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
