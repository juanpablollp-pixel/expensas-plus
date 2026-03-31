import React, { useState, useEffect, useRef } from 'react'
import { db } from '../db'
import Popup from '../components/Popup'
import ConfirmDialog from '../components/ConfirmDialog'

const EMPTY_ADMIN = {
  administrador: '',
  cuit: '',
  telefono: '',
  email: '',
  cbu: '',
  alias: '',
  mediosDePago: ''
}

const EMPTY_TEM = { tem: '' }

export default function Configuracion() {
  const [tab, setTab] = useState('datos')           // 'datos' | 'backup'
  const [form, setForm] = useState(EMPTY_ADMIN)
  const [tem, setTem] = useState(EMPTY_TEM)
  const [popup, setPopup] = useState(null)
  const [confirmImport, setConfirmImport] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [importError, setImportError] = useState(null)
  const fileInputRef = useRef(null)

  // Cargar datos guardados al montar
  useEffect(() => {
    db.config.get('admin').then(row => { if (row?.valor) setForm(row.valor) })
    db.config.get('tem_mora').then(row => { if (row?.valor !== undefined) setTem({ tem: row.valor }) })
  }, [])

  // ── Guardar datos del administrador y TEM ──
  async function handleSave(e) {
    e.preventDefault()
    await Promise.all([
      db.config.put({ clave: 'admin', valor: form }),
      db.config.put({ clave: 'tem_mora', valor: parseFloat(tem.tem) || 0 })
    ])
    setPopup('¡Datos guardados!')
  }

  // ── Exportar backup ──
  async function handleExport() {
    const [inquilinos, servicios, gastos, periodos, pagos, configRows] = await Promise.all([
      db.inquilinos.toArray(),
      db.servicios.toArray(),
      db.gastos.toArray(),
      db.periodos.toArray(),
      db.pagos.toArray(),
      db.config.toArray()
    ])

    const backup = { inquilinos, servicios, gastos, periodos, pagos, config: configRows }
    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const hoy = new Date()
    const dd = String(hoy.getDate()).padStart(2, '0')
    const mm = String(hoy.getMonth() + 1).padStart(2, '0')
    const aaaa = hoy.getFullYear()
    const nombreArchivo = `ExpensasPlus_Backup_${dd}-${mm}-${aaaa}.json`

    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    a.click()
    URL.revokeObjectURL(url)

    setPopup('¡Backup exportado correctamente!')
  }

  // ── Importar backup — paso 1: seleccionar archivo ──
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportError(null)
    setPendingFile(file)
    setConfirmImport(true)
    // Resetear el input para permitir re-seleccionar el mismo archivo
    e.target.value = ''
  }

  // ── Importar backup — paso 2: confirmar y restaurar ──
  async function handleConfirmImport() {
    setConfirmImport(false)
    if (!pendingFile) return

    try {
      const text = await pendingFile.text()
      const data = JSON.parse(text)

      // Validación básica: debe tener al menos una de las tablas esperadas
      const tablas = ['inquilinos', 'servicios', 'gastos', 'periodos']
      const valido = tablas.some(t => Array.isArray(data[t]))
      if (!valido) throw new Error('estructura inválida')

      // Borrar y reimportar cada tabla
      await Promise.all([
        db.inquilinos.clear(),
        db.servicios.clear(),
        db.gastos.clear(),
        db.periodos.clear(),
        db.pagos.clear(),
        db.config.clear()
      ])

      await Promise.all([
        data.inquilinos?.length ? db.inquilinos.bulkAdd(data.inquilinos) : Promise.resolve(),
        data.servicios?.length  ? db.servicios.bulkAdd(data.servicios)   : Promise.resolve(),
        data.gastos?.length     ? db.gastos.bulkAdd(data.gastos)         : Promise.resolve(),
        data.periodos?.length   ? db.periodos.bulkAdd(data.periodos)     : Promise.resolve(),
        data.pagos?.length      ? db.pagos.bulkAdd(data.pagos)           : Promise.resolve(),
        data.config?.length     ? db.config.bulkAdd(data.config)         : Promise.resolve()
      ])

      // Recargar datos en el formulario
      const row = await db.config.get('admin')
      if (row?.valor) setForm(row.valor)
      const rowTem = await db.config.get('tem_mora')
      if (rowTem?.valor !== undefined) setTem({ tem: rowTem.valor })

      setPopup('¡Datos importados correctamente!')
    } catch {
      setImportError('El archivo seleccionado no es válido')
    }

    setPendingFile(null)
  }

  // ─────────────────────────────────────────────
  return (
    <div className="section-container">
      <h2>Configuración</h2>

      {/* Tabs */}
      <div className="config-tabs">
        <button
          className={`config-tab ${tab === 'datos' ? 'active' : ''}`}
          onClick={() => setTab('datos')}
        >Mis Datos</button>
        <button
          className={`config-tab ${tab === 'backup' ? 'active' : ''}`}
          onClick={() => setTab('backup')}
        >Copia de Seguridad</button>
      </div>

      {/* ── Tab: Mis Datos ── */}
      {tab === 'datos' && (
        <form className="form-card" onSubmit={handleSave}>
          <p className="config-hint">
            Estos datos aparecen en el pie de página de todos los PDFs generados.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>Nombre y Apellido</label>
              <input
                type="text"
                value={form.administrador}
                onChange={e => setForm(f => ({ ...f, administrador: e.target.value }))}
                placeholder="Ej: Juan García"
              />
            </div>
            <div className="form-group">
              <label>CUIT</label>
              <input
                type="text"
                value={form.cuit}
                onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))}
                placeholder="Ej: 20-12345678-9"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="Ej: +54 11 1234-5678"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Ej: admin@ejemplo.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>CBU</label>
              <input
                type="text"
                value={form.cbu}
                onChange={e => setForm(f => ({ ...f, cbu: e.target.value }))}
                placeholder="22 dígitos"
              />
            </div>
            <div className="form-group">
              <label>Alias</label>
              <input
                type="text"
                value={form.alias}
                onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
                placeholder="Ej: ALIAS.PAGO"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Medios de Pago</label>
            <input
              type="text"
              value={form.mediosDePago}
              onChange={e => setForm(f => ({ ...f, mediosDePago: e.target.value }))}
              placeholder="Ej: Transferencia bancaria / Efectivo"
            />
          </div>

          <div className="form-section-title">Configuración de Mora</div>
          <div className="form-row">
            <div className="form-group">
              <label>TEM de mora (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tem.tem}
                onChange={e => setTem({ tem: e.target.value })}
                placeholder="Ej: 5.5"
              />
            </div>
            <div className="form-group">
              <p className="tem-hint">
                La mora diaria se calcula como:<br />
                <strong>(Alquiler × TEM%) ÷ 30</strong>
              </p>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">Guardar datos</button>
          </div>
        </form>
      )}

      {/* ── Tab: Copia de Seguridad ── */}
      {tab === 'backup' && (
        <div className="backup-section">
          <div className="backup-card">
            <div className="backup-card-icon">📤</div>
            <div className="backup-card-body">
              <h3>Exportar datos</h3>
              <p>Descargá un archivo JSON con todos tus datos: inquilinos, servicios, gastos e historial.</p>
              <button className="btn-primary" onClick={handleExport}>
                Exportar datos
              </button>
            </div>
          </div>

          <div className="backup-card">
            <div className="backup-card-icon">📥</div>
            <div className="backup-card-body">
              <h3>Importar datos</h3>
              <p>Restaurá los datos desde un archivo de backup previamente exportado. <strong>Reemplazará todos los datos actuales.</strong></p>
              <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                Seleccionar archivo...
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {importError && <p className="import-error">{importError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de importación */}
      {confirmImport && (
        <ConfirmDialog
          message="Esta acción reemplazará todos los datos actuales. ¿Deseás continuar?"
          cancelLabel="Cancelar"
          confirmLabel="Confirmar importación"
          confirmDanger
          onCancel={() => { setConfirmImport(false); setPendingFile(null) }}
          onConfirm={handleConfirmImport}
        />
      )}

      {popup && <Popup message={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
