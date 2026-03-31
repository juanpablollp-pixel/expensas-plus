import React, { useState, useEffect } from 'react'
import { db } from '../db'
import { generateHistorialPDF } from '../utils/pdfGenerator'
import ConfirmDialog from '../components/ConfirmDialog'
import Popup from '../components/Popup'

function periodoLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[parseInt(m)-1]} ${y}`
}

function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Historial() {
  const [periodos, setPeriodos] = useState([])
  const [selected, setSelected] = useState(null)
  const [detalle, setDetalle] = useState(null)   // { gastos, inquilinos, serviciosMap }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [popup, setPopup] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { loadPeriodos() }, [])

  async function loadPeriodos() {
    const gastos = await db.gastos.toArray()
    const set = [...new Set(gastos.map(g => g.periodo))].sort((a, b) => b.localeCompare(a))
    setPeriodos(set)
  }

  async function selectPeriodo(p) {
    setSelected(p)
    const gastos = await db.gastos.where('periodo').equals(p).toArray()
    const inquilinos = await db.inquilinos.toArray()
    const servicios = await db.servicios.toArray()
    const serviciosMap = {}
    servicios.forEach(s => { serviciosMap[s.id] = s.nombre })
    setDetalle({ gastos, inquilinos, serviciosMap })
  }

  async function handleExport() {
    if (!selected || !detalle) return
    setGenerating(true)
    try {
      await generateHistorialPDF(selected, detalle.gastos, detalle.inquilinos, detalle.serviciosMap)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete() {
    await db.gastos.where('periodo').equals(selected).delete()
    setConfirmDelete(false)
    setSelected(null)
    setDetalle(null)
    setPopup('Período eliminado correctamente.')
    loadPeriodos()
  }

  return (
    <div className="section-container">
      <h2>Historial</h2>

      <div className="historial-layout">
        {/* Lista de períodos */}
        <div className="inq-list-panel">
          <h3>Períodos</h3>
          {periodos.length === 0 && <p className="empty-hint">No hay gastos registrados aún.</p>}
          {periodos.map(p => (
            <button
              key={p}
              className={`inq-list-item ${selected === p ? 'active' : ''}`}
              onClick={() => selectPeriodo(p)}
            >
              {periodoLabel(p)}
            </button>
          ))}
        </div>

        {/* Detalle */}
        <div className="preview-panel">
          {!selected && (
            <div className="empty-state"><p>Seleccioná un período para ver el detalle.</p></div>
          )}

          {selected && detalle && (
            <div className="pdf-preview">
              <div className="pdf-preview-header">
                <div>
                  <h3>Detalle — {periodoLabel(selected)}</h3>
                  <p>{detalle.gastos.length} cargo(s) registrado(s)</p>
                </div>
                <div className="preview-actions">
                  <button className="btn-primary" onClick={handleExport} disabled={generating}>
                    {generating ? 'Generando...' : '⬇ Exportar PDF'}
                  </button>
                  <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
                    Eliminar período
                  </button>
                </div>
              </div>

              {/* Generales */}
              {detalle.gastos.filter(g => g.tipo === 'general').length > 0 && (
                <>
                  <h4 className="table-section-title general">Cargos Generales</h4>
                  <div className="table-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr><th>Servicio</th><th>Empresa</th><th>Factura</th><th>Vencimiento</th><th>Importe Total</th><th>Por Unidad</th></tr>
                      </thead>
                      <tbody>
                        {detalle.gastos.filter(g => g.tipo === 'general').map(g => (
                          <tr key={g.id}>
                            <td>{detalle.serviciosMap[g.servicioId] || '?'}</td>
                            <td>{g.empresa}</td>
                            <td>{g.numeroFactura || '-'}</td>
                            <td>{g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-'}</td>
                            <td>{formatCurrency(g.importe)}</td>
                            <td><strong>{formatCurrency(g.importe / (detalle.inquilinos.length || 1))}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Particulares */}
              {detalle.gastos.filter(g => g.tipo === 'particular').length > 0 && (
                <>
                  <h4 className="table-section-title particular">Cargos Particulares</h4>
                  <div className="table-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr><th>Inquilino</th><th>Servicio</th><th>Empresa</th><th>Factura</th><th>Vencimiento</th><th>Importe</th></tr>
                      </thead>
                      <tbody>
                        {detalle.gastos.filter(g => g.tipo === 'particular').map(g => {
                          const inq = detalle.inquilinos.find(i => i.id === g.inquilinoId)
                          return (
                            <tr key={g.id}>
                              <td>{inq ? `${inq.apellido}, ${inq.nombre}` : 'Desconocido'}</td>
                              <td>{detalle.serviciosMap[g.servicioId] || '?'}</td>
                              <td>{g.empresa}</td>
                              <td>{g.numeroFactura || '-'}</td>
                              <td>{g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-'}</td>
                              <td><strong>{formatCurrency(g.importe)}</strong></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Totales */}
              <div className="total-box">
                <div className="totals-subtext">
                  <small>Generales: {formatCurrency(detalle.gastos.filter(g=>g.tipo==='general').reduce((s,g)=>s+Number(g.importe),0))}</small>
                  <small>Particulares: {formatCurrency(detalle.gastos.filter(g=>g.tipo==='particular').reduce((s,g)=>s+Number(g.importe),0))}</small>
                </div>
                <strong>Total: {formatCurrency(detalle.gastos.reduce((s,g)=>s+Number(g.importe),0))}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`¿Eliminar todos los gastos del período ${periodoLabel(selected)}? Esta acción no se puede deshacer.`}
          cancelLabel="Cancelar"
          confirmLabel="Eliminar período"
          confirmDanger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
