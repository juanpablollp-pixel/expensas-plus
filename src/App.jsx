import React, { useState } from 'react'
import CargarGastos from './sections/CargarGastos'
import GenerarExpensas from './sections/GenerarExpensas'
import Inquilinos from './sections/Inquilinos'
import Historial from './sections/Historial'
import Configuracion from './sections/Configuracion'
import EstadoDeCuenta from './sections/EstadoDeCuenta'
import './App.css'

const SECTIONS = [
  { id: 'gastos',         label: 'Cargar Gastos',    icon: '📋' },
  { id: 'expensas',       label: 'Generar Expensas', icon: '📄' },
  { id: 'inquilinos',     label: 'Inquilinos',        icon: '👥' },
  { id: 'historial',      label: 'Historial',         icon: '🗂️' },
  { id: 'estadocuenta',   label: 'Estado de Cuenta',  icon: '📊' },
  { id: 'configuracion',  label: 'Configuración',     icon: '⚙️' }
]

export default function App() {
  const [active, setActive] = useState(null)

  function renderSection() {
    switch (active) {
      case 'gastos':        return <CargarGastos />
      case 'expensas':      return <GenerarExpensas />
      case 'inquilinos':    return <Inquilinos />
      case 'historial':     return <Historial />
      case 'estadocuenta':  return <EstadoDeCuenta />
      case 'configuracion': return <Configuracion />
      default:              return null
    }
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏢</span>
          <span className="brand-name">ExpensasPlus</span>
        </div>
        <ul className="nav-list">
          {SECTIONS.map(s => (
            <li key={s.id}>
              <button
                className={`nav-item ${active === s.id ? 'active' : ''}`}
                onClick={() => setActive(s.id)}
              >
                <span className="nav-icon">{s.icon}</span>
                <span className="nav-label">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <span>v1.0 · Offline Ready</span>
        </div>
      </nav>

      <main className="main-content">
        {!active ? (
          <div className="home-screen">
            <div className="home-header">
              {/* LOGO: reemplazá este div por <img src="logo.png" className="app-logo" alt="Logo" />
                  cuando tengas la imagen definitiva */}
              <div className="logo-placeholder">LOGO</div>
              <p className="home-slogan">Sistema de gestión de expensas</p>
            </div>
            <div className="home-grid">
              {SECTIONS.map(s => (
                <button key={s.id} className="home-card" onClick={() => setActive(s.id)}>
                  <span className="home-card-icon">{s.icon}</span>
                  <h3>{s.label}</h3>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="section-wrapper">
            <button className="back-to-home" onClick={() => setActive(null)}>
              ← Menú principal
            </button>
            {renderSection()}
          </div>
        )}
      </main>

      {/* Barra de navegación inferior — solo visible en móvil */}
      <nav className="bottom-nav">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`bottom-nav-item ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            <span className="bottom-nav-icon">{s.icon}</span>
            <span className="bottom-nav-label">{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
