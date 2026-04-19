import React, { useState } from 'react'
import CargarGastos    from './sections/CargarGastos'
import GenerarExpensas from './sections/GenerarExpensas'
import Inquilinos      from './sections/Inquilinos'
import Historial       from './sections/Historial'
import Configuracion   from './sections/Configuracion'
import EstadoDeCuenta  from './sections/EstadoDeCuenta'
import Inicio          from './sections/Inicio'

import IconCargarGastos    from './components/icons/IconCargarGastos'
import IconGenerarExpensas from './components/icons/IconGenerarExpensas'
import IconInquilinos      from './components/icons/IconInquilinos'
import IconHistorial       from './components/icons/IconHistorial'
import IconEstadoCuenta    from './components/icons/IconEstadoCuenta'

import './App.css'

const NAV_ITEMS = [
  { id: 'gastos',       label: 'Gastos',     Icon: IconCargarGastos    },
  { id: 'expensas',     label: 'Expensas',   Icon: IconGenerarExpensas },
  { id: 'inquilinos',   label: 'Inquilinos', Icon: IconInquilinos      },
  { id: 'estadocuenta', label: 'Cuenta',     Icon: IconEstadoCuenta    },
  { id: 'historial',    label: 'Historial',  Icon: IconHistorial       },
]

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

export default function App() {
  const [active, setActive] = useState(null)

  function handleNav(id) { setActive(id) }
  function goHome()       { setActive(null) }

  const sectionLabel = NAV_ITEMS.find(n => n.id === active)?.label
    ?? (active === 'configuracion' ? 'Configuración' : null)

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

      {/* ── Topbar ─────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-inner">
          <button className="topbar-brand" onClick={goHome} aria-label="Ir al inicio">
            <img
              src="/expensas-plus/logo-expensas.png"
              alt="ExpensasPlus"
              className="topbar-logo"
            />
          </button>

          {active && (
            <span className="topbar-section-label">{sectionLabel}</span>
          )}

          <button
            className={`topbar-gear${active === 'configuracion' ? ' active' : ''}`}
            onClick={() => setActive('configuracion')}
            aria-label="Configuración"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────── */}
      <main className="main-content">
        {!active ? (
          <Inicio onNavigate={handleNav} />
        ) : (
          <div className="section-wrapper">
            {renderSection()}
          </div>
        )}
      </main>

      {/* ── Bottom navigation ──────────────────── */}
      <nav className="bottom-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`bottom-nav-item${active === id ? ' active' : ''}`}
            onClick={() => handleNav(id)}
            aria-label={label}
          >
            <div className="bottom-nav-icon"><Icon /></div>
            <span className="bottom-nav-label">{label}</span>
          </button>
        ))}
      </nav>

    </div>
  )
}
