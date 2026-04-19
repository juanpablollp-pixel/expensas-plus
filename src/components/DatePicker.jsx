import React from 'react'

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

export default function DatePicker({ value, onChange }) {
  const parts = value ? value.split('-') : ['', '', '']
  const selectedYear  = parts[0] ? parseInt(parts[0]) : ''
  const selectedMonth = parts[1] ? parseInt(parts[1]) : ''
  const selectedDay   = parts[2] ? parseInt(parts[2]) : ''

  const maxDay = daysInMonth(selectedMonth || 1, selectedYear || new Date().getFullYear())

  function emit(y, m, d) {
    if (!y || !m || !d) { onChange(''); return }
    onChange(
      `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    )
  }

  function handleDay(e) {
    emit(selectedYear, selectedMonth, e.target.value)
  }
  function handleMonth(e) {
    const m = e.target.value
    const clampedDay = selectedDay && m
      ? Math.min(selectedDay, daysInMonth(parseInt(m), selectedYear || new Date().getFullYear()))
      : selectedDay
    emit(selectedYear, m, clampedDay)
  }
  function handleYear(e) {
    emit(e.target.value, selectedMonth, selectedDay)
  }

  return (
    <div className="month-picker">
      <select className="month-picker-select" value={selectedDay} onChange={handleDay} style={{ flex: '0 0 auto', width: '72px' }}>
        <option value="">Día</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className="month-picker-select" value={selectedMonth} onChange={handleMonth}>
        <option value="">Mes</option>
        {MESES.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <select className="month-picker-select" value={selectedYear} onChange={handleYear} style={{ flex: '0 0 auto', width: '86px' }}>
        <option value="">Año</option>
        {buildYears().map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
