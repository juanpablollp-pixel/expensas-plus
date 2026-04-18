import React, { useState, useEffect } from 'react'
import { db } from '../db'
import { generateInquilinoPDF } from '../utils/pdfGenerator'
import { periodoLabel, formatCurrency } from '../utils/helpers'

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

  async function selectInquilino(inq) {
    setSelected(inq)
    const allGastos = await db.gastos.where('periodo').equals(periodo).toArray()
    const totalInqs = await db.inquilinos.filter(i => i.estadoContrato === 'Activo').count() || 1
    const generales = allGastos
      .filter(g => g.tipo === 'general')
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

  const totalGeneral = preview ? preview.generales.reduce((s, g) => s + Number(g.importe) / preview.totalInqs, 0) : 0
  const totalParticular = preview ? preview.particulares.reduce((s, g) => s + Number(g.importe), 0) : 0

  return (
    <div className="section-container">
      <h2>Generar Expensas</h2>

      <div className="periodo-selector-bar">
        <label>Período:</label>
        <input type="month" value={periodo} onChange={e => { setPeriodo(e.target.value); setSelected(null); setPreview(null) }} />
      </div>

      <div className="generar-layout">
        {/* Lista de inquilinos */}
        <div className="inq-list-panel">
          <h3>Inquilinos</h3>
          {inquilinos.length === 0 && <p className="empty-hint">No hay inquilinos registrados.</p>}
          {inquilinos.map(inq => (
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
                  <div className="table-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr><th>Servicio</th><th>Empresa</th><th>Total</th><th>Unidades</th><th>Su parte</th></tr>
                      </thead>
                      <tbody>
                        {preview.generales.map(g => (
                          <tr key={g.id}>
                            <td>{g.servicio}</td>
                            <td>{g.empresa}</td>
                            <td>{formatCurrency(g.importe)}</td>
                            <td>{preview.totalInqs}</td>
                            <td><strong>{formatCurrency(g.importe / preview.totalInqs)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {preview.particulares.length > 0 && (
                <>
                  <h4 className="table-section-title particular">Cargos Particulares</h4>
                  <div className="table-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr><th>Servicio</th><th>Empresa</th><th>Importe</th></tr>
                      </thead>
                      <tbody>
                        {preview.particulares.map(g => (
                          <tr key={g.id}>
                            <td>{g.servicio}</td>
                            <td>{g.empresa}</td>
                            <td><strong>{formatCurrency(g.importe)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
