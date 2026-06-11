import React, { useState, useEffect } from 'react'
import { db } from '../db'
import Popup from '../components/Popup'
import ConfirmDialog from '../components/ConfirmDialog'
import { periodoLabel, formatCurrency } from '../utils/helpers'
import MonthPicker from '../components/MonthPicker'
import DatePicker from '../components/DatePicker'

const EMPTY_GASTO = { fechaEmision: '', fechaVencimiento: '', empresa: '', importe: '', numeroFactura: '', inquilinoId: '' }

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function CargarGastos() {
  const [step, setStep] = useState('periodo')       // periodo | servicios | tipoCargoMenu | formGeneral | formParticular | editServicio
  const [periodo, setPeriodo] = useState('')
  const [servicios, setServicios] = useState([])
  const [selectedServicio, setSelectedServicio] = useState(null)
  const [gastosEnServicio, setGastosEnServicio] = useState([])
  const [inquilinos, setInquilinos] = useState([])
  const [form, setForm] = useState(EMPTY_GASTO)
  const [editingGastoId, setEditingGastoId] = useState(null)

  // Nuevos / editar servicios
  const [nuevoServicio, setNuevoServicio] = useState('')
  const [editandoServicio, setEditandoServicio] = useState(null) // { id, nombre }
  const [showNuevoServicio, setShowNuevoServicio] = useState(false)

  // Dialogs / popups
  const [popup, setPopup] = useState(null)
  const [deleteGastoId, setDeleteGastoId] = useState(null)
  const [deleteServicioId, setDeleteServicioId] = useState(null)

  useEffect(() => { db.servicios.toArray().then(setServicios) }, [step])
  useEffect(() => { db.inquilinos.orderBy('apellido').toArray().then(setInquilinos) }, [])

  // Historial de cargos anteriores del mismo servicio y tipo, para precargar el formulario
  const [historialCargos, setHistorialCargos] = useState([])
  useEffect(() => {
    if ((step === 'formGeneral' || step === 'formParticular') && selectedServicio) {
      const tipo = step === 'formParticular' ? 'particular' : 'general'
      db.gastos.where({ servicioId: selectedServicio.id }).toArray().then(gs => {
        const previos = gs
          .filter(g => g.tipo === tipo && g.periodo !== periodo)
          .sort((a, b) => b.periodo.localeCompare(a.periodo))
        // Uno por empresa (+inquilino si es particular), el más reciente
        const vistos = new Set()
        const unicos = []
        for (const g of previos) {
          const key = `${(g.empresa || '').toLowerCase()}|${g.inquilinoId ?? ''}`
          if (!vistos.has(key)) { vistos.add(key); unicos.push(g) }
        }
        setHistorialCargos(unicos)
      })
    }
  }, [step, selectedServicio, periodo])

  async function loadGastosServicio(svcId, per) {
    const g = await db.gastos.where({ servicioId: svcId, periodo: per }).toArray()
    setGastosEnServicio(g)
  }

  // ── PASO: período ──
  if (step === 'periodo') {
    return (
      <div className="section-container">
        <h2>Cargar Gastos</h2>
        <div className="form-card centered">
          <div className="form-group">
            <label>Seleccioná el Período</label>
            <MonthPicker value={periodo} onChange={setPeriodo} />
          </div>
          <button
            className="btn-primary full-width"
            disabled={!periodo}
            onClick={() => setStep('servicios')}
          >Continuar →</button>
        </div>
      </div>
    )
  }

  // ── PASO: lista de servicios ──
  if (step === 'servicios') {
    return (
      <div className="section-container">
        <div className="section-header">
          <h2>Servicios — {periodoLabel(periodo)}</h2>
          <button className="btn-secondary" onClick={() => setStep('periodo')}>← Período</button>
        </div>

        <div className="chips-grid">
          {servicios.map(svc => (
            <button
              key={svc.id}
              className="chip-service"
              onClick={async () => {
                setSelectedServicio(svc)
                await loadGastosServicio(svc.id, periodo)
                setStep('tipoCargoMenu')
              }}
            >{svc.nombre}</button>
          ))}
        </div>

        <div className="service-mgmt-bar">
          <button className="btn-secondary" onClick={() => { setShowNuevoServicio(true); setStep('editServicio') }}>
            + Agregar nuevo servicio
          </button>
          <button className="btn-secondary" onClick={() => { setShowNuevoServicio(false); setStep('editServicio') }}>
            Modificar servicios
          </button>
        </div>
      </div>
    )
  }

  // ── PASO: editar/agregar servicios ──
  if (step === 'editServicio') {
    return (
      <div className="section-container">
        <div className="section-header">
          <h2>Gestión de Servicios</h2>
          <button className="btn-secondary" onClick={() => { setStep('servicios'); setEditandoServicio(null); setNuevoServicio(''); setShowNuevoServicio(false) }}>← Volver</button>
        </div>

        {showNuevoServicio && (
          <div className="form-card">
            <h3>Nuevo Servicio</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre del servicio</label>
                <input value={nuevoServicio} onChange={e => setNuevoServicio(e.target.value)} placeholder="Ej: SEGUROS" />
              </div>
              <div className="btn-align-end">
                <button className="btn-primary" disabled={!nuevoServicio.trim()} onClick={async () => {
                  await db.servicios.add({ nombre: nuevoServicio.trim().toUpperCase() })
                  setNuevoServicio('')
                  setShowNuevoServicio(false)
                  const updated = await db.servicios.toArray()
                  setServicios(updated)
                  setPopup('¡Servicio agregado!')
                }}>Agregar</button>
              </div>
            </div>
          </div>
        )}

        <div className="edit-services-list">
          {servicios.map(svc => (
            <div key={svc.id} className="edit-service-row">
              {editandoServicio?.id === svc.id ? (
                <>
                  <input
                    className="inline-input"
                    value={editandoServicio.nombre}
                    onChange={e => setEditandoServicio({ ...editandoServicio, nombre: e.target.value })}
                  />
                  <button className="btn-primary btn-sm" onClick={async () => {
                    await db.servicios.update(svc.id, { nombre: editandoServicio.nombre.toUpperCase() })
                    setEditandoServicio(null)
                    const updated = await db.servicios.toArray()
                    setServicios(updated)
                  }}>Guardar</button>
                  <button className="btn-secondary btn-sm" onClick={() => setEditandoServicio(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="svc-name">{svc.nombre}</span>
                  <button className="btn-secondary btn-sm" onClick={() => setEditandoServicio({ ...svc })}>Editar</button>
                  <button className="btn-danger btn-sm" onClick={() => setDeleteServicioId(svc.id)}>Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>

        {deleteServicioId && (
          <ConfirmDialog
            message="¿Eliminar este servicio?"
            confirmDanger
            cancelLabel="Cancelar"
            confirmLabel="Eliminar"
            onCancel={() => setDeleteServicioId(null)}
            onConfirm={async () => {
              await db.servicios.delete(deleteServicioId)
              setDeleteServicioId(null)
              const updated = await db.servicios.toArray()
              setServicios(updated)
            }}
          />
        )}

        {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
      </div>
    )
  }

  // ── PASO: menú de tipo de cargo ──
  if (step === 'tipoCargoMenu') {
    return (
      <div className="section-container">
        <div className="section-header">
          <h2>{selectedServicio?.nombre} — {periodoLabel(periodo)}</h2>
          <button className="btn-secondary" onClick={() => setStep('servicios')}>← Servicios</button>
        </div>

        <div className="tipo-cargo-grid">
          <button className="tipo-card" onClick={() => { setForm(EMPTY_GASTO); setEditingGastoId(null); setStep('formGeneral') }}>
            <span className="tipo-icon">👥</span>
            <h3>Cargo General</h3>
            <p>Divide el importe en partes iguales entre todos los inquilinos</p>
          </button>
          <button className="tipo-card" onClick={() => { setForm(EMPTY_GASTO); setEditingGastoId(null); setStep('formParticular') }}>
            <span className="tipo-icon">👤</span>
            <h3>Cargo Particular</h3>
            <p>Asigna el importe completo a un inquilino específico</p>
          </button>
        </div>

        {/* Gastos ya cargados en este servicio/período */}
        {gastosEnServicio.length > 0 && (
          <div className="gastos-cargados">
            <h3>Gastos cargados en este servicio</h3>
            {gastosEnServicio.map(g => {
              const inq = inquilinos.find(i => i.id === g.inquilinoId)
              return (
                <div key={g.id} className="gasto-card">
                  <div className="gasto-info">
                    <span className={`tipo-badge tipo-${g.tipo}`}>{g.tipo === 'general' ? 'General' : 'Particular'}</span>
                    <strong>{g.empresa}</strong>
                    <span>${Number(g.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    {inq && <span className="inq-chip">{inq.apellido}, {inq.nombre}</span>}
                    {g.numeroFactura && <span className="factura-chip">F#{g.numeroFactura}</span>}
                  </div>
                  <div className="card-actions">
                    <button className="btn-secondary btn-sm" onClick={() => {
                      setForm({ ...g, importe: String(g.importe) })
                      setEditingGastoId(g.id)
                      setStep(g.tipo === 'general' ? 'formGeneral' : 'formParticular')
                    }}>Editar</button>
                    <button className="btn-danger btn-sm" onClick={() => setDeleteGastoId(g.id)}>Eliminar</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="form-actions">
          <button className="btn-primary" onClick={() => setStep('servicios')}>✓ Listo</button>
        </div>

        {deleteGastoId && (
          <ConfirmDialog
            message="¿Eliminar este gasto?"
            confirmDanger
            cancelLabel="Cancelar"
            confirmLabel="Eliminar"
            onCancel={() => setDeleteGastoId(null)}
            onConfirm={async () => {
              await db.gastos.delete(deleteGastoId)
              setDeleteGastoId(null)
              await loadGastosServicio(selectedServicio.id, periodo)
            }}
          />
        )}

        {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
      </div>
    )
  }

  // ── Formulario compartido (general / particular) ──
  const isParticular = step === 'formParticular'
  if (step === 'formGeneral' || step === 'formParticular') {
    async function submitGasto(e) {
      e.preventDefault()
      if (form.fechaEmision && form.fechaVencimiento && form.fechaVencimiento < form.fechaEmision) {
        setPopup('La fecha de vencimiento no puede ser anterior a la fecha de emisión.')
        return
      }
      const data = {
        periodo,
        servicioId: selectedServicio.id,
        tipo: isParticular ? 'particular' : 'general',
        empresa: form.empresa.trim(),
        importe: parseFloat(form.importe),
        fechaEmision: form.fechaEmision,
        fechaVencimiento: form.fechaVencimiento,
        numeroFactura: form.numeroFactura,
        inquilinoId: isParticular ? parseInt(form.inquilinoId) : null
      }
      if (editingGastoId) {
        await db.gastos.update(editingGastoId, data)
      } else {
        await db.gastos.add(data)
      }
      setForm(EMPTY_GASTO)
      setEditingGastoId(null)
      await loadGastosServicio(selectedServicio.id, periodo)
      setPopup(editingGastoId ? '¡Cambios guardados!' : '¡Gasto agregado!')
      setStep('tipoCargoMenu')
    }

    return (
      <div className="section-container">
        <div className="section-header">
          <h2>{isParticular ? 'Cargo Particular' : 'Cargo General'} — {selectedServicio?.nombre}</h2>
          <button className="btn-secondary" onClick={() => { setEditingGastoId(null); setForm(EMPTY_GASTO); setStep('tipoCargoMenu') }}>← Volver</button>
        </div>

        <form className="form-card" onSubmit={submitGasto}>
          {!editingGastoId && historialCargos.length > 0 && (
            <div className="form-group">
              <label>Precargar desde historial (opcional)</label>
              <select
                value=""
                onChange={e => {
                  const g = historialCargos.find(h => h.id === Number(e.target.value))
                  if (g) setForm(f => ({
                    ...f,
                    empresa: g.empresa || '',
                    importe: String(g.importe ?? ''),
                    numeroFactura: g.numeroFactura || '',
                    inquilinoId: g.inquilinoId ? String(g.inquilinoId) : f.inquilinoId
                  }))
                }}
              >
                <option value="">— Elegí un cargo anterior para completar el formulario —</option>
                {historialCargos.map(g => {
                  const inq = inquilinos.find(i => i.id === g.inquilinoId)
                  return (
                    <option key={g.id} value={g.id}>
                      {g.empresa} — {formatCurrency(g.importe)} ({periodoLabel(g.periodo)}{inq ? ` · ${inq.apellido}` : ''})
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Período</label>
            <input type="text" value={periodoLabel(periodo)} readOnly className="readonly-input" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha de Emisión</label>
              <DatePicker value={form.fechaEmision} onChange={v => setForm(f => ({ ...f, fechaEmision: v }))} />
            </div>
            <div className="form-group">
              <label>Fecha de Vencimiento</label>
              <DatePicker value={form.fechaVencimiento} onChange={v => setForm(f => ({ ...f, fechaVencimiento: v }))} />
            </div>
          </div>

          <div className="form-group">
            <label>Empresa Prestadora</label>
            <input type="text" value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Importe Total ($)</label>
              <input type="number" step="0.01" min="0" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Número de Factura</label>
              <input type="text" value={form.numeroFactura} onChange={e => setForm(f => ({ ...f, numeroFactura: e.target.value }))} />
            </div>
          </div>

          {isParticular && (
            <div className="form-group">
              <label>Inquilino *</label>
              <select value={form.inquilinoId} onChange={e => setForm(f => ({ ...f, inquilinoId: e.target.value }))} required>
                <option value="">— Seleccioná un inquilino —</option>
                {inquilinos.map(i => (
                  <option key={i.id} value={i.id}>{i.apellido}, {i.nombre} ({i.departamento})</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => { setEditingGastoId(null); setForm(EMPTY_GASTO); setStep('tipoCargoMenu') }}>Cancelar</button>
            <button type="submit" className="btn-primary">{editingGastoId ? 'Guardar Cambios' : 'Agregar Gasto'}</button>
          </div>
        </form>

        {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
      </div>
    )
  }

  return null
}
