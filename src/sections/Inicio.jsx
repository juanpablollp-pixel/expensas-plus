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

    const periodoKeys = [...new Set(todosGastos.map(g => g.periodo).filter(Boolean))]
    periodoKeys.sort((a, b) => b.localeCompare(a))
    const periodoActual = periodoKeys[0] ?? null

    const gastosDelPeriodo = periodoActual
      ? todosGastos.filter(g => g.periodo === periodoActual)
      : []
    const totalGastosPeriodo = gastosDelPeriodo.reduce((sum, g) => sum + Number(g.importe || 0), 0)

    const pagosDelPeriodo = periodoActual
      ? todosPagos.filter(p => p.periodo === periodoActual)
      : []

    setStats({
      inquilinosActivos,
      totalInquilinos,
      periodoActual,
      periodoLabelStr: periodoActual ? periodoLabel(periodoActual) : 'Sin datos',
      totalGastosPeriodo,
      pagosCount: pagosDelPeriodo.length,
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
        <img src="/expensas-plus/logo-expensas.png" alt="ExpensasPlus" className="inicio-logo" />
        <div>
          <h1 className="inicio-title">Bienvenido</h1>
          <p className="inicio-subtitle">Resumen del edificio</p>
        </div>
      </div>

      <div className="dashboard-grid">

        {/* Inquilinos activos */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Inquilinos activos</span>
            <span className="dash-card-value">{stats.inquilinosActivos}</span>
            <span className="dash-card-sub">de {stats.totalInquilinos} total</span>
          </div>
        </div>

        {/* Período actual */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-success">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
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
            <span className="dash-card-sub">
              {stats.periodoActual ? `${stats.totalInquilinos} inquilino${stats.totalInquilinos !== 1 ? 's' : ''}` : 'Sin gastos cargados'}
            </span>
          </div>
        </div>

        {/* Total gastos — card con acento */}
        <div className="dash-card dash-card--accent">
          <div className="dash-card-icon dash-icon-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label dash-card-label--white">Total gastos</span>
            <span className="dash-card-value dash-card-value--white dash-card-value--md">
              {formatCurrency(stats.totalGastosPeriodo)}
            </span>
            <span className="dash-card-sub dash-card-sub--white">período actual</span>
          </div>
        </div>

        {/* Pagos registrados */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-warning">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Pagos registrados</span>
            <span className="dash-card-value">{stats.pagosCount}</span>
            <span className="dash-card-sub">de {stats.inquilinosActivos} activos</span>
          </div>
        </div>

        {/* Servicios */}
        <div className="dash-card">
          <div className="dash-card-icon dash-icon-muted">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/>
            </svg>
          </div>
          <div className="dash-card-body">
            <span className="dash-card-label">Servicios</span>
            <span className="dash-card-value">{stats.serviciosCount}</span>
            <span className="dash-card-sub">registrados</span>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="dash-card dash-card--quicklinks">
          <span className="dash-card-label">Accesos rápidos</span>
          <div className="dash-quicklinks">
            <button className="dash-quicklink-btn" onClick={() => onNavigate('gastos')}>
              <span className="dash-ql-icon">📋</span>
              <span>Cargar Gastos</span>
            </button>
            <button className="dash-quicklink-btn" onClick={() => onNavigate('expensas')}>
              <span className="dash-ql-icon">📄</span>
              <span>Generar Expensas</span>
            </button>
            <button className="dash-quicklink-btn" onClick={() => onNavigate('estadocuenta')}>
              <span className="dash-ql-icon">📊</span>
              <span>Estado de Cuenta</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
