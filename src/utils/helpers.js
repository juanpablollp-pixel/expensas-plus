export function periodoLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[parseInt(m) - 1]} ${y}`
}

export function formatCurrency(n) {
  return `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Divisor de un cargo general: la cantidad personalizada cargada en el gasto,
// o la cantidad de inquilinos activos como valor por defecto
export function divisorGasto(gasto, totalActivos) {
  const d = Number(gasto?.divisor)
  return d > 0 ? d : (totalActivos || 1)
}
