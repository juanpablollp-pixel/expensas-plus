import React, { useState, useEffect } from 'react'
import { db } from '../db'
import { periodoLabel, formatCurrency } from '../utils/helpers'

export default function Inicio({ onNavigate }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const [todosInquilinos, todosGastos, todosServicios, todosPagos] = await Promise.all([
      db.inquilinos.toArray(),
      db.gastos.toArray(),
      db.servicios.toArray(),
      db.pagos.toArray(),
    ])

    const inquilinosActivos = todosInquilinos.filter(i => i.estadoContrato === 'Activo').length
    const totalInquilinos = todosInquilinos.length

    // Período actual derivado de gastos
    const gastoPeriodoKeys = [...new Set(todosGastos.map(g => g.periodo).filter(Boolean))]
    gastoPeriodoKeys.sort((a, b) => b.localeCompare(a))
    const periodoActual = gastoPeriodoKeys[0] ?? null

    const gastosDelPeriodo = periodoActual
      ? todosGastos.filter(g => g.periodo === periodoActual)
      : []
    const totalGastosPeriodo = gastosDelPeriodo.reduce((sum, g) => sum + Number(g.importe || 0), 0)

    // Pagos: usa el período más reciente propio de pagos
    // (evita falsos 0 si el período de pagos no coincide con el de gastos)
    const pagosPeriodoKeys = [...new Set(todosPagos.map(p => p.periodo).filter(Boolean))]
    pagosPeriodoKeys.sort((a, b) => b.localeCompare(a))
    const pagosPeriodoReciente = pagosPeriodoKeys[0] ?? null
    const pagosCount = pagosPeriodoReciente
      ? todosPagos.filter(p => p.periodo === pagosPeriodoReciente).length
      : todosPagos.length

    setStats({
      inquilinosActivos,
      totalInquilinos,
      periodoActual,
      periodoLabelStr: periodoActual ? periodoLabel(periodoActual) : 'Sin datos',
      totalGastosPeriodo,
      pagosCount,
      serviciosCount: todosServicios.length,
    })
  }

  if (!stats) {
    return (
      <div className="inicio-loading">
        <div className="inicio-spinner" />
      </div>
    )
  }

  return (
    <div className="inicio-screen">

      <div className="inicio-header">
        <h1 className="inicio-title">Bienvenido</h1>
        <p className="inicio-subtitle">Resumen del edificio</p>
      </div>

      <div className="dashboard-grid">

        {/* 1 — Período actual */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Período actual</span>
            <span className="dash-card-value dash-card-value--md">{stats.periodoLabelStr}</span>
          </div>
        </div>

        {/* 2 — Inquilinos activos */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Inquilinos activos</span>
            <span className="dash-card-value">{stats.inquilinosActivos}</span>
          </div>
        </div>

        {/* 3 — Servicios */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Servicios</span>
            <span className="dash-card-value">{stats.serviciosCount}</span>
          </div>
        </div>

        {/* 4 — Pagos registrados */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Pagos registrados</span>
            <span className="dash-card-value">{stats.pagosCount}</span>
          </div>
        </div>

        {/* 5 — Total gastos */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Total gastos</span>
            <span className="dash-card-value dash-card-value--md">{formatCurrency(stats.totalGastosPeriodo)}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
