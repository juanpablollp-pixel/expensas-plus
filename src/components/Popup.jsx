import React, { useEffect } from 'react'

export default function Popup({ message, onClose, autoClose = true }) {
  useEffect(() => {
    if (autoClose) {
      const t = setTimeout(onClose, 2200)
      return () => clearTimeout(t)
    }
  }, [autoClose, onClose])

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={e => e.stopPropagation()}>
        <div className="popup-check">✓</div>
        <p>{message}</p>
      </div>
    </div>
  )
}
