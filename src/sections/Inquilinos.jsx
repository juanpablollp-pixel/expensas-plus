import React, { useState, useEffect } from 'react'
import { db } from '../db'
import ConfirmDialog from '../components/ConfirmDialog'
import Popup from '../components/Popup'

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

  useEffect(() => { loadInquilinos() }, [])

  async function loadInquilinos() {
    const data = await db.inquilinos.orderBy('apellido').toArray()
    setInquilinos(data)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(inq) {
    setForm({ ...inq })
    setEditingId(inq.id)
    setShowForm(true)
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
      .filter(i => i.departamento?.trim() === trimmedForm.departamento && i.id !== editingId)
      .first()
    if (duplicado) {
      setPopup(`El departamento "${trimmedForm.departamento}" ya está asignado a ${duplicado.apellido}, ${duplicado.nombre}.`)
      return
    }
    if (editingId) {
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

  const field = (label, key, type = 'text', opts = {}) => (
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
