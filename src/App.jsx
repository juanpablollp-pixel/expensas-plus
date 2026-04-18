import React, { useState } from 'react'
import { LayoutDashboard, Receipt, FileText, Users, History, Settings } from 'lucide-react'
import CargarGastos    from './sections/CargarGastos'
import GenerarExpensas from './sections/GenerarExpensas'
import Inquilinos      from './sections/Inquilinos'
import Historial       from './sections/Historial'
import Configuracion   from './sections/Configuracion'
import EstadoDeCuenta  from './sections/EstadoDeCuenta'
import './App.css'

const TABS = [
  { id: 'gastos',       label: 'Gastos',     Icon: Receipt         },
  { id: 'expensas',     label: 'Expensas',   Icon: FileText        },
  { id: 'estadocuenta', label: 'Cuenta',     Icon: LayoutDashboard },
  { id: 'inquilinos',   label: 'Inquilinos', Icon: Users           },
  { id: 'historial',    label: 'Historial',  Icon: History         },
]

export default function App() {
  const [active,     setActive]     = useState('estadocuenta')
  const [showConfig, setShowConfig] = useState(false)

  function nav(id) {
    setActive(id)
    setShowConfig(false)
  }

  function renderSection() {
    if (showConfig) return <Configuracion />
    switch (active) {
      case 'gastos':       return <CargarGastos />
      case 'expensas':     return <GenerarExpensas />
      case 'inquilinos':   return <Inquilinos />
      case 'historial':    return <Historial />
      case 'estadocuenta': return <EstadoDeCuenta />
      default:             return <EstadoDeCuenta />
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white flex justify-center">
      <div className="relative w-full max-w-[480px] bg-[#0F0F0F] min-h-screen flex flex-col border-x border-[#1E1E1E]">

        {/* ── Sticky top header ─────────────────────────── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 bg-[#0F0F0F]/80 backdrop-blur-md border-b border-white/5 flex-shrink-0">
          <img
            src="/expensas-plus/logo-expensas.png"
            alt="ExpensasPlus"
            className="h-8 w-auto"
          />
          <button
            onClick={() => setShowConfig(c => !c)}
            aria-label="Configuración"
            className={`p-2 rounded-full transition-colors ${
              showConfig
                ? 'bg-[#4B5EF7] text-white'
                : 'text-[#757575] hover:text-white hover:bg-[#1E1E1E]'
            }`}
          >
            <Settings size={20} />
          </button>
        </header>

        {/* ── Main scrollable content ────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
          {renderSection()}
        </main>

        {/* ── Bottom Tab Bar ─────────────────────────────── */}
        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-[#0F0F0F]/90 backdrop-blur-lg border-t border-white/10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
        >
          <div className="flex justify-around items-center px-1 pt-1 pb-1">
            {TABS.map(({ id, label, Icon }) => {
              const on = active === id && !showConfig
              return (
                <button
                  key={id}
                  onClick={() => nav(id)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl transition-all min-w-[56px] ${
                    on ? 'text-[#4B5EF7]' : 'text-[#757575] hover:text-white'
                  }`}
                >
                  <div className={`p-1.5 rounded-full transition-all ${on ? 'bg-[#4B5EF7]/15' : ''}`}>
                    <Icon size={20} strokeWidth={on ? 2.5 : 1.5} />
                  </div>
                  <span className={`text-[10px] leading-none ${on ? 'font-bold' : 'font-medium'}`}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

      </div>
    </div>
  )
}
