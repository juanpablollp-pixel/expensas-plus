import React from 'react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function buildYears() {
  const current = new Date().getFullYear()
  const years = []
  for (let y = current - 2; y <= current + 2; y++) years.push(y)
  return years
}

export default function MonthPicker({ value, onChange, placeholder = 'Seleccioná…' }) {
  const [yearStr, monthStr] = value ? value.split('-') : ['', '']
  const selectedYear  = yearStr  ? parseInt(yearStr)  : ''
  const selectedMonth = monthStr ? parseInt(monthStr) : ''

  function handleYear(e) {
    const y = e.target.value
    if (!y) { onChange(''); return }
    const m = selectedMonth ? String(selectedMonth).padStart(2, '0') : '01'
    onChange(`${y}-${m}`)
  }

  function handleMonth(e) {
    const m = e.target.value
    if (!m) { onChange(''); return }
    const y = selectedYear || new Date().getFullYear()
    onChange(`${y}-${String(m).padStart(2, '0')}`)
  }

  return (
    <div className="month-picker">
      <select className="month-picker-select" value={selectedMonth} onChange={handleMonth}>
        <option value="">Mes</option>
        {MESES.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <select className="month-picker-select" value={selectedYear} onChange={handleYear}>
        <option value="">Año</option>
        {buildYears().map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
