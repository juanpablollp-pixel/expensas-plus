import React, { useState, useEffect, useRef } from 'react'
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
import IconConfiguracion   from './components/icons/IconConfiguracion'

import './App.css'

const SECTIONS = [
  { id: 'gastos',        label: 'Cargar Gastos',    Icon: IconCargarGastos    },
  { id: 'expensas',      label: 'Generar Expensas', Icon: IconGenerarExpensas },
  { id: 'inquilinos',    label: 'Inquilinos',        Icon: IconInquilinos      },
  { id: 'estadocuenta',  label: 'Estado de Cuenta',  Icon: IconEstadoCuenta    },
  { id: 'historial',     label: 'Historial',         Icon: IconHistorial       },
  { id: 'configuracion', label: 'Configuración',     Icon: IconConfiguracion   },
]

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="19" y2="6"/>
      <line x1="3" y1="11" x2="19" y2="11"/>
      <line x1="3" y1="16" x2="19" y2="16"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="15" y1="5" x2="5"  y2="15"/>
      <line x1="5"  y1="5" x2="15" y2="15"/>
    </svg>
  )
}

export default function App() {
  const [active,   setActive]   = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [menuOpen])

  function handleNav(id) {
    setActive(id)
    setMenuOpen(false)
  }

  function goHome() {
    setActive(null)
    setMenuOpen(false)
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

      {/* ── Topbar ─────────────────────────────── */}
      <header className="topbar" ref={menuRef}>
        <div className="topbar-inner">

          <button className="topbar-brand" onClick={goHome} aria-label="Ir al inicio">
            <img
              src="/expensas-plus/logo-expensas.png"
              alt="ExpensasPlus"
              className="topbar-logo"
            />
          </button>

          {active && (
            <span className="topbar-section-label">
              {SECTIONS.find(s => s.id === active)?.label}
            </span>
          )}

          <button
            className={`topbar-hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menú de navegación"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

        {menuOpen && (
          <nav className="topbar-dropdown" role="navigation">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`topbar-nav-item ${active === s.id ? 'active' : ''}`}
                onClick={() => handleNav(s.id)}
              >
                <div className="topbar-nav-icon"><s.Icon /></div>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ── Main content ───────────────────────── */}
      <main className="main-content">
        {!active ? (
          <Inicio onNavigate={handleNav} />
        ) : (
          <div className="section-wrapper">
            <button className="back-to-home" onClick={goHome}>
              ← Menú principal
            </button>
            {renderSection()}
          </div>
        )}
      </main>

    </div>
  )
}
