import React, { useState, useEffect } from 'react'
import { db } from '../db'
import ConfirmDialog from '../components/ConfirmDialog'
import Popup from '../components/Popup'
import DatePicker from '../components/DatePicker'
import { periodoLabel, formatCurrency } from '../utils/helpers'

const EMPTY_FORM = {
  nombre: '', apellido: '', dni: '', domicilio: '',
  departamento: '', periodoContrato: '', estadoContrato: 'Activo',
  telefono: '', email: '',
  precioAlquiler: '', fechaInicioContrato: '',
  fechaProximaActualizacion: '', cicloActualizacion: '6 meses'
}

export default function Inquilinos() {
  const [inquilinos, setInquilinos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState(null)
  const [popup, setPopup] = useState(null)

  const [tempPeriodo, setTempPeriodo] = useState('')
  const [tempPrecio, setTempPrecio] = useState('')

  async function loadInquilinos() {
    const data = await db.inquilinos.orderBy('apellido').toArray()
    setInquilinos(data)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga async de DB
  useEffect(() => { loadInquilinos() }, [])

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setTempPeriodo('')
    setTempPrecio('')
    setShowForm(true)
  }

  function openEdit(inq) {
    setForm({ ...inq })
    setEditingId(inq.id)
    setTempPeriodo('')
    setTempPrecio('')
    setShowForm(true)
  }

  function handleAddPeriodPrice() {
    if (!tempPeriodo || !tempPrecio) {
      setPopup('Completá el período y el precio del alquiler.')
      return
    }
    const precio = parseFloat(tempPrecio)
    if (isNaN(precio) || precio < 0) {
      setPopup('Ingresá un precio de alquiler válido.')
      return
    }
    setForm(f => {
      const precios = { ...(f.preciosAlquiler || {}) }
      precios[tempPeriodo] = precio
      return { ...f, preciosAlquiler: precios }
    })
    setTempPeriodo('')
    setTempPrecio('')
  }

  function handleRemovePeriodPrice(per) {
    setForm(f => {
      const precios = { ...(f.preciosAlquiler || {}) }
      delete precios[per]
      return { ...f, preciosAlquiler: precios }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    const trimmedForm = {
      ...form,
      nombre:       form.nombre.trim(),
      apellido:     form.apellido.trim(),
      departamento: form.departamento.trim(),
    }
    if (!trimmedForm.nombre || !trimmedForm.apellido || !trimmedForm.departamento) {
      setPopup('Completá los campos obligatorios: Nombre, Apellido y Departamento.')
      return
    }
    const duplicado = await db.inquilinos
      .filter(i => i.departamento?.trim().toLowerCase() === trimmedForm.departamento.toLowerCase() && i.id !== editingId)
      .first()
    if (duplicado) {
      setPopup(`El departamento "${trimmedForm.departamento}" ya está asignado a ${duplicado.apellido}, ${duplicado.nombre}.`)
      return
    }
    if (editingId) {
      // Si cambió el precio base, congelar el precio anterior en los períodos
      // impagos previos al mes actual (los pagados ya guardan su importe histórico)
      const original = inquilinos.find(i => i.id === editingId)
      const precioViejo = Number(original?.precioAlquiler || 0)
      const precioNuevo = Number(trimmedForm.precioAlquiler || 0)
      if (precioViejo > 0 && precioViejo !== precioNuevo) {
        const [gastos, pagos, periodosDb] = await Promise.all([
          db.gastos.toArray(),
          db.pagos.where({ inquilinoId: editingId }).toArray(),
          db.periodos.toArray()
        ])
        const pagados = new Set(pagos.map(p => p.periodo))
        const hoy = new Date()
        const perActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
        const desde = trimmedForm.fechaInicioContrato ? trimmedForm.fechaInicioContrato.slice(0, 7) : null
        const precios = { ...(trimmedForm.preciosAlquiler || {}) }
        const periodosInq = new Set([
          ...gastos.filter(g => g.tipo === 'general' || g.inquilinoId === editingId).map(g => g.periodo),
          ...periodosDb.map(p => p.periodo)
        ])
        periodosInq.forEach(per => {
          if (per && per < perActual && !pagados.has(per) && precios[per] === undefined && (!desde || per >= desde)) {
            precios[per] = precioViejo
          }
        })
        trimmedForm.preciosAlquiler = precios
      }
      await db.inquilinos.update(editingId, trimmedForm)
      setPopup('¡Inquilino actualizado!')
    } else {
      await db.inquilinos.add(trimmedForm)
      setPopup('¡Inquilino agregado!')
    }
    setShowForm(false)
    loadInquilinos()
  }

  async function handleDelete() {
    await db.inquilinos.delete(deleteId)
    setDeleteId(null)
    setPopup('Inquilino eliminado.')
    loadInquilinos()
  }

  const field = (label, key, type = 'text', opts = {}) => {
    if (type === 'date') {
      return (
        <div className="form-group">
          <label>{label}</label>
          <DatePicker value={form[key] || ''} onChange={v => setForm(f => ({ ...f, [key]: v }))} />
        </div>
      )
    }
    return (
      <div className="form-group">
        <label>{label}</label>
        <input
          type={type}
          value={form[key] || ''}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          required={opts.required}
        />
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="section-container">
        <h2>{editingId ? 'Modificar Inquilino' : 'Agregar Inquilino'}</h2>
        <form className="form-card" onSubmit={handleSave}>
          <div className="form-row">
            {field('Nombre', 'nombre', 'text', { required: true })}
            {field('Apellido', 'apellido', 'text', { required: true })}
          </div>
          <div className="form-row">
            {field('DNI / CUIT', 'dni', 'text', { required: true })}
            {field('Teléfono', 'telefono')}
          </div>
          {field('Domicilio Fiscal', 'domicilio')}
          {field('Email', 'email', 'email')}
          <div className="form-row">
            {field('Departamento Asignado', 'departamento', 'text', { required: true })}
            {field('Período de Contrato', 'periodoContrato')}
          </div>
          <div className="form-group">
            <label>Estado de Contrato</label>
            <select value={form.estadoContrato} onChange={e => setForm(f => ({ ...f, estadoContrato: e.target.value }))}>
              <option>Activo</option>
              <option>Inactivo</option>
              <option>Finalizado</option>
            </select>
          </div>

          <div className="form-section-title">Datos de Alquiler</div>
          <div className="form-row">
            {field('Precio del Alquiler ($)', 'precioAlquiler', 'number')}
            <div className="form-group">
              <label>Ciclo de Actualización</label>
              <select value={form.cicloActualizacion} onChange={e => setForm(f => ({ ...f, cicloActualizacion: e.target.value }))}>
                <option>2 meses</option>
                <option>3 meses</option>
                <option>6 meses</option>
                <option>12 meses</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            {field('Fecha de Inicio del Contrato', 'fechaInicioContrato', 'date')}
            {field('Fecha de Próxima Actualización', 'fechaProximaActualizacion', 'date')}
          </div>

          <div className="form-section-title">Precios de Alquiler por Período (Opcional)</div>
          
          <div className="form-row" style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'flex-end', marginBottom: '14px' }}>
            <div className="form-group" style={{ flex: '1', marginBottom: 0 }}>
              <label>Período</label>
              <input 
                type="month" 
                value={tempPeriodo} 
                onChange={e => setTempPeriodo(e.target.value)} 
                style={{ minHeight: '44px' }} 
              />
            </div>
            <div className="form-group" style={{ flex: '1', marginBottom: 0 }}>
              <label>Precio ($)</label>
              <input 
                type="number" 
                value={tempPrecio} 
                onChange={e => setTempPrecio(e.target.value)} 
                placeholder="Ej: 180000" 
                style={{ minHeight: '44px' }} 
              />
            </div>
            <button 
              type="button" 
              className="btn-primary" 
              style={{ minHeight: '44px', padding: '0 16px', flex: '0 0 auto' }} 
              onClick={handleAddPeriodPrice}
            >
              Añadir
            </button>
          </div>

          {form.preciosAlquiler && Object.keys(form.preciosAlquiler).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.08em' }}>
                Precios Específicos Configurados
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(form.preciosAlquiler)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([per, price]) => (
                    <div key={per} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{periodoLabel(per)}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{formatCurrency(price)}</span>
                      <button 
                        type="button" 
                        className="btn-danger btn-sm" 
                        style={{ minHeight: '32px', height: '32px', padding: '0 10px' }} 
                        onClick={() => handleRemovePeriodPrice(per)}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
        {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
      </div>
    )
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h2>Inquilinos</h2>
        <button className="btn-primary" onClick={openAdd}>+ Agregar Inquilino</button>
      </div>

      {inquilinos.length === 0 && (
        <div className="empty-state">
          <p>No hay inquilinos registrados.</p>
          <p>Agregá el primero con el botón de arriba.</p>
        </div>
      )}

      <div className="cards-grid">
        {inquilinos.map(inq => (
          <div className="inquilino-card" key={inq.id}>
            <div className="inq-badge">{inq.departamento || '?'}</div>
            <h3>{inq.apellido}, {inq.nombre}</h3>
            <div className="inq-details">
              <span className={`estado-badge estado-${inq.estadoContrato?.toLowerCase()}`}>{inq.estadoContrato}</span>
              {inq.dni && <p><strong>DNI/CUIT:</strong> {inq.dni}</p>}
              {inq.domicilio && <p><strong>Domicilio:</strong> {inq.domicilio}</p>}
              {inq.telefono && <p><strong>Tel:</strong> {inq.telefono}</p>}
              {inq.email && <p><strong>Email:</strong> {inq.email}</p>}
              {inq.periodoContrato && <p><strong>Contrato:</strong> {inq.periodoContrato}</p>}
              {inq.precioAlquiler && <p><strong>Alquiler:</strong> ${Number(inq.precioAlquiler).toLocaleString('es-AR')}</p>}
              {inq.cicloActualizacion && <p><strong>Ciclo:</strong> {inq.cicloActualizacion}</p>}
              {inq.fechaProximaActualizacion && <p><strong>Próx. actualización:</strong> {new Date(inq.fechaProximaActualizacion + 'T00:00:00').toLocaleDateString('es-AR')}</p>}
            </div>
            <div className="card-actions">
              <button className="btn-secondary btn-sm" onClick={() => openEdit(inq)}>Modificar</button>
              <button className="btn-danger btn-sm" onClick={() => setDeleteId(inq.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {deleteId && (
        <ConfirmDialog
          message="¿Eliminar este inquilino? Esta acción no se puede deshacer."
          cancelLabel="Cancelar acción"
          confirmLabel="Continuar con la eliminación"
          confirmDanger
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDelete}
        />
      )}

      {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
