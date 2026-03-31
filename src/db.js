import Dexie from 'dexie'

export const db = new Dexie('ExpensasPlus')

db.version(1).stores({
  inquilinos: '++id, nombre, apellido, dni, departamento, email',
  servicios: '++id, nombre',
  gastos: '++id, periodo, servicioId, tipo, inquilinoId, fechaVencimiento, empresa, importe, numeroFactura',
  periodos: '++id, periodo'
})

db.version(2).stores({
  inquilinos: '++id, nombre, apellido, dni, departamento, email',
  servicios: '++id, nombre',
  gastos: '++id, periodo, servicioId, tipo, inquilinoId, fechaVencimiento, empresa, importe, numeroFactura',
  periodos: '++id, periodo',
  config: 'clave'
})

db.version(3).stores({
  inquilinos: '++id, nombre, apellido, dni, departamento, email',
  servicios: '++id, nombre',
  gastos: '++id, periodo, servicioId, tipo, inquilinoId, fechaVencimiento, empresa, importe, numeroFactura',
  periodos: '++id, periodo',
  config: 'clave',
  pagos: '++id, inquilinoId, periodo, fechaPago'
})

// Helper para leer los datos del administrador guardados en config
export async function getAdminConfig() {
  const row = await db.config.get('admin')
  return row?.valor ?? null
}

// Seed servicios por defecto si no existen
db.on('ready', async () => {
  const count = await db.servicios.count()
  if (count === 0) {
    await db.servicios.bulkAdd([
      { nombre: 'AGUA' },
      { nombre: 'DGRM' },
      { nombre: 'ELECTRICIDAD' },
      { nombre: 'INTERNET' },
      { nombre: 'ORDENANZA' }
    ])
  }
})
