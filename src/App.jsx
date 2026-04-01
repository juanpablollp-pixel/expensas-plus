import React, { useState } from 'react'
import CargarGastos    from './sections/CargarGastos'
import GenerarExpensas from './sections/GenerarExpensas'
import Inquilinos      from './sections/Inquilinos'
import Historial       from './sections/Historial'
import Configuracion   from './sections/Configuracion'
import EstadoDeCuenta  from './sections/EstadoDeCuenta'

import IconCargarGastos    from './components/icons/IconCargarGastos'
import IconGenerarExpensas from './components/icons/IconGenerarExpensas'
import IconInquilinos      from './components/icons/IconInquilinos'
import IconHistorial       from './components/icons/IconHistorial'
import IconEstadoCuenta    from './components/icons/IconEstadoCuenta'
import IconConfiguracion   from './components/icons/IconConfiguracion'

import './App.css'

const SECTIONS = [
  { id: 'gastos',        label: 'Cargar Gastos',    Icon: IconCargarGastos    },
  { id: 'expensas',      label: 'Generar Expensas', Icon: IconGenerarExpensas },
  { id: 'inquilinos',    label: 'Inquilinos',        Icon: IconInquilinos      },
  { id: 'historial',     label: 'Historial',         Icon: IconHistorial       },
  { id: 'estadocuenta',  label: 'Estado de Cuenta',  Icon: IconEstadoCuenta    },
  { id: 'configuracion', label: 'Configuración',     Icon: IconConfiguracion   },
]

function FabDotsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <circle cx="12" cy="5"  r="1.8"/>
      <circle cx="12" cy="12" r="1.8"/>
      <circle cx="12" cy="19" r="1.8"/>
    </svg>
  )
}

function FabCloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6"  x2="6"  y2="18"/>
      <line x1="6"  y1="6"  x2="18" y2="18"/>
    </svg>
  )
}

export default function App() {
  const [active,   setActive]   = useState(null)
  const [fabOpen,  setFabOpen]  = useState(false)

  function handleNav(id) {
    setActive(id)
    setFabOpen(false)
  }

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

      {/* ── Sidebar (desktop) ───────────────────── */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          {/* LOGO: reemplazá este div por <img src="logo.png" className="sidebar-logo-img" alt="Logo" /> */}
          <div className="sidebar-logo-mark">E</div>
          <span className="brand-name">ExpensasPlus</span>
        </div>

        <ul className="nav-list">
          {SECTIONS.map(s => (
            <li key={s.id}>
              <button
                className={`nav-item ${active === s.id ? 'active' : ''}`}
                onClick={() => handleNav(s.id)}
              >
                <div className="nav-icon-wrap"><s.Icon /></div>
                <span className="nav-label">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <span>v1.0 · Offline Ready</span>
        </div>
      </nav>

      {/* ── Main content ────────────────────────── */}
      <main className="main-content">
        {!active ? (
          <div className="home-screen">
            <div className="home-header">
              <img
                src="/expensas-plus/icon-512.png"
                alt="ExpensasPlus"
                style={{ width: '80px', height: '80px', borderRadius: '20px' }}
              />
              <h1 className="home-title">ExpensasPlus</h1>
              <p className="home-slogan">Sistema de gestión de expensas</p>
            </div>

            <div className="home-grid">
              {SECTIONS.map(s => (
                <button key={s.id} className="home-card" onClick={() => handleNav(s.id)}>
                  <div className="home-card-icon-wrap"><s.Icon /></div>
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

      {/* ── FAB (móvil) ─────────────────────────── */}
      {fabOpen && (
        <div className="fab-overlay" onClick={() => setFabOpen(false)} />
      )}

      {fabOpen && (
        <nav className="fab-menu">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`fab-item ${active === s.id ? 'active' : ''}`}
              onClick={() => handleNav(s.id)}
            >
              <div className="fab-item-icon"><s.Icon /></div>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
      )}

      <button
        className={`fab-btn ${fabOpen ? 'open' : ''}`}
        onClick={() => setFabOpen(o => !o)}
        aria-label="Navegación"
      >
        {fabOpen ? <FabCloseIcon /> : <FabDotsIcon />}
      </button>

    </div>
  )
}
