import React, { useState, useEffect } from 'react'
import { db } from '../db'
import { generateInquilinoPDF } from '../utils/pdfGenerator'
import { periodoLabel, formatCurrency, divisorGasto, activoEnPeriodo, aplicaAInquilino } from '../utils/helpers'
import MonthPicker from '../components/MonthPicker'

export default function GenerarExpensas() {
  const [inquilinos, setInquilinos] = useState([])
  const [serviciosMap, setServiciosMap] = useState({})
  const [selected, setSelected] = useState(null)
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [preview, setPreview] = useState(null)  // { generales, particulares }
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    db.inquilinos.orderBy('apellido').toArray().then(setInquilinos)
    db.servicios.toArray().then(svcs => {
      const map = {}
      svcs.forEach(s => { map[s.id] = s.nombre })
      setServiciosMap(map)
    })
  }, [])

  // Sólo inquilinos activos con contrato vigente en el período: a los demás no se les liquida
  const inquilinosPeriodo = inquilinos.filter(i => activoEnPeriodo(i, periodo))

  async function selectInquilino(inq) {
    setSelected(inq)
    const allGastos = await db.gastos.where('periodo').equals(periodo).toArray()
    const totalInqs = await db.inquilinos.filter(i => activoEnPeriodo(i, periodo)).count() || 1
    const generales = allGastos
      .filter(g => g.tipo === 'general' && aplicaAInquilino(g, inq.id))
      .map(g => ({ ...g, servicio: serviciosMap[g.servicioId] || '?' }))
    const particulares = allGastos
      .filter(g => g.tipo === 'particular' && g.inquilinoId === inq.id)
      .map(g => ({ ...g, servicio: serviciosMap[g.servicioId] || '?' }))
    setPreview({ generales, particulares, totalInqs })
  }

  async function handleExport() {
    if (!selected || !preview) return
    setGenerating(true)
    try {
      await generateInquilinoPDF(selected, periodo, preview.generales, preview.particulares, preview.totalInqs)
    } finally {
      setGenerating(false)
    }
  }

  // Recalculate preview when periodo changes
  useEffect(() => {
    if (selected) selectInquilino(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  const totalGeneral = preview ? preview.generales.reduce((s, g) => s + Number(g.importe) / divisorGasto(g, preview.totalInqs), 0) : 0
  const totalParticular = preview ? preview.particulares.reduce((s, g) => s + Number(g.importe), 0) : 0

  return (
    <div className="section-container">
      <h2>Generar Expensas</h2>

      <div className="periodo-selector-bar">
        <label>Período:</label>
        <MonthPicker value={periodo} onChange={v => { setPeriodo(v); setSelected(null); setPreview(null) }} />
      </div>

      <div className="generar-layout">
        {/* Lista de inquilinos */}
        <div className="inq-list-panel">
          <h3>Inquilinos</h3>
          {inquilinosPeriodo.length === 0 && <p className="empty-hint">No hay inquilinos para este período.</p>}
          {inquilinosPeriodo.map(inq => (
            <button
              key={inq.id}
              className={`inq-list-item ${selected?.id === inq.id ? 'active' : ''}`}
              onClick={() => selectInquilino(inq)}
            >
              <span className="inq-dept">{inq.departamento || '?'}</span>
              <span>{inq.apellido}, {inq.nombre}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="preview-panel">
          {!selected && (
            <div className="empty-state">
              <p>Seleccioná un inquilino para previsualizar sus expensas.</p>
            </div>
          )}

          {selected && preview && (
            <div className="pdf-preview">
              <div className="pdf-preview-header">
                <div>
                  <h3>Expensas — {periodoLabel(periodo)}</h3>
                  <p>{selected.apellido}, {selected.nombre} · Depto {selected.departamento}</p>
                </div>
                <button className="btn-primary" onClick={handleExport} disabled={generating}>
                  {generating ? 'Generando...' : '⬇ Exportar PDF'}
                </button>
              </div>

              {preview.generales.length === 0 && preview.particulares.length === 0 && (
                <div className="empty-state"><p>No hay gastos cargados para este período.</p></div>
              )}

              {preview.generales.length > 0 && (
                <>
                  <h4 className="table-section-title general">Cargos Generales</h4>
                  <div className="cargo-list">
                    {preview.generales.map(g => (
                      <div key={g.id} className="cargo-row">
                        <span className="cargo-svc">{g.servicio}</span>
                        <span className="cargo-amt">{formatCurrency(g.importe / divisorGasto(g, preview.totalInqs))}</span>
                        <span className="cargo-emp">{g.empresa}</span>
                      </div>
                    ))}
                    <div className="cargo-subtotal">
                      <span>Subtotal generales</span>
                      <strong>{formatCurrency(totalGeneral)}</strong>
                    </div>
                  </div>
                </>
              )}

              {preview.particulares.length > 0 && (
                <>
                  <h4 className="table-section-title particular">Cargos Particulares</h4>
                  <div className="cargo-list">
                    {preview.particulares.map(g => (
                      <div key={g.id} className="cargo-row">
                        <span className="cargo-svc">{g.servicio}</span>
                        <span className="cargo-amt">{formatCurrency(g.importe)}</span>
                        <span className="cargo-emp">{g.empresa}</span>
                      </div>
                    ))}
                    <div className="cargo-subtotal">
                      <span>Subtotal particulares</span>
                      <strong>{formatCurrency(totalParticular)}</strong>
                    </div>
                  </div>
                </>
              )}

              {(preview.generales.length > 0 || preview.particulares.length > 0) && (
                <div className="total-box">
                  <span>Total a pagar</span>
                  <strong>{formatCurrency(totalGeneral + totalParticular)}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
