import React from 'react'

export default function ConfirmDialog({ message, onCancel, onConfirm, cancelLabel = 'Cancelar', confirmLabel = 'Confirmar', confirmDanger = false }) {
  return (
    <div className="popup-overlay">
      <div className="confirm-box">
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={confirmDanger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
