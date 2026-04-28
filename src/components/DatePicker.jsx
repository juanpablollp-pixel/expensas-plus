import React, { useState, useEffect, useRef } from 'react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function daysInMonth(month, year) {
  if (!month || !year) return 31
  return new Date(year, month, 0).getDate()
}

function buildYears() {
  const current = new Date().getFullYear()
  const years = []
  for (let y = current - 5; y <= current + 5; y++) years.push(y)
  return years
}

function parseValue(v) {
  if (!v) return { year: '', month: '', day: '' }
  const parts = v.split('-')
  return {
    year:  parts[0] ? parseInt(parts[0]) : '',
    month: parts[1] ? parseInt(parts[1]) : '',
    day:   parts[2] ? parseInt(parts[2]) : '',
  }
}

export default function DatePicker({ value, onChange }) {
  const [fields, setFields] = useState(() => parseValue(value))
  const lastEmitted = useRef(value ?? '')

  // Sync from parent only when the parent changes value externally
  // (e.g., form reset or loading an existing record), not in response
  // to our own onChange calls.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setFields(parseValue(value))
      lastEmitted.current = value ?? ''
    }
  }, [value])

  const { year, month, day } = fields
  const maxDay = daysInMonth(month || 1, year || new Date().getFullYear())

  function emit(y, m, d) {
    const result = (!y || !m || !d)
      ? ''
      : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    lastEmitted.current = result
    onChange(result)
  }

  function handleDay(e) {
    const d = e.target.value ? parseInt(e.target.value) : ''
    setFields(f => ({ ...f, day: d }))
    emit(year, month, d)
  }

  function handleMonth(e) {
    const m = e.target.value ? parseInt(e.target.value) : ''
    const clampedDay = day && m
      ? Math.min(day, daysInMonth(m, year || new Date().getFullYear()))
      : day
    setFields(f => ({ ...f, month: m, day: clampedDay }))
    emit(year, m, clampedDay)
  }

  function handleYear(e) {
    const y = e.target.value ? parseInt(e.target.value) : ''
    setFields(f => ({ ...f, year: y }))
    emit(y, month, day)
  }

  return (
    <div className="month-picker">
      <select className="month-picker-select" value={day} onChange={handleDay} style={{ flex: '0 0 auto', width: '72px' }}>
        <option value="">Día</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className="month-picker-select" value={month} onChange={handleMonth}>
        <option value="">Mes</option>
        {MESES.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <select className="month-picker-select" value={year} onChange={handleYear} style={{ flex: '0 0 auto', width: '86px' }}>
        <option value="">Año</option>
        {buildYears().map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
