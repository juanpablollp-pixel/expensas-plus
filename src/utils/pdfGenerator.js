import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_FOOTER as PDF_FOOTER_DEFAULT } from '../pdfConfig'
import { getAdminConfig } from '../db'
import { periodoLabel, formatCurrency } from './helpers'

// Tailwind slate palette — exact hex values
const S = {
  s900: [15,  23,  42],
  s800: [30,  41,  59],
  s700: [51,  65,  85],
  s600: [71,  85, 105],
  s500: [100, 116, 139],
  s400: [148, 163, 184],
  s300: [203, 213, 225],
  s200: [226, 232, 240],
  s100: [241, 245, 249],
  s50:  [248, 250, 252],
  white:[255, 255, 255],
  // status colors
  successText: [22,  163,  74],
  successFill: [220, 252, 231],
  dangerText:  [220,  38,  38],
  dangerFill:  [254, 226, 226],
  warningText: [217, 119,   6],
  warningFill: [254, 243, 199],
}

const toTitleCase = str =>
  str ? str.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : str

async function resolveFooter() {
  const saved = await getAdminConfig()
  if (saved && saved.administrador) return saved
  return PDF_FOOTER_DEFAULT
}

// ── ENCABEZADO ───────────────────────────────────────────────────────────────
// HTML: flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-8
//   Left:  h1.text-3xl.font-black.text-slate-900 + p.text-sm.text-slate-500
//   Right: h2.text-2xl.font-bold.text-slate-800.uppercase
//          + grid 2-cols: labels font-semibold slate-800 / values slate-600
function addHeader(doc, pageWidth, docType, periodLine, dateLine) {
  const X = 14, Y = 12, RX = pageWidth - 14

  // Izquierda
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...S.s900)
  doc.text('Expensas Plus+', X, Y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...S.s500)
  doc.text('Gestión de Consorcios', X, Y + 15)

  // Derecha: tipo de doc
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...S.s800)
  doc.text(docType.toUpperCase(), RX, Y + 7, { align: 'right' })

  // Grid período / emisión (font-semibold slate-800 + normal slate-600)
  const labelX = RX - 50
  const parse  = str => {
    const i = str.indexOf(': ')
    return i >= 0 ? [str.slice(0, i), str.slice(i + 2)] : [str, '']
  }

  if (periodLine) {
    const [lbl, val] = parse(periodLine)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...S.s800)
    doc.text(lbl + ':', labelX, Y + 14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...S.s600)
    doc.text(val, RX, Y + 14, { align: 'right' })
  }

  if (dateLine) {
    const [lbl, val] = parse(dateLine)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...S.s800)
    doc.text(lbl + ':', labelX, Y + 21)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...S.s600)
    doc.text(val, RX, Y + 21, { align: 'right' })
  }

  // border-b-2 border-slate-800
  const lineY = Y + 27
  doc.setDrawColor(...S.s800)
  doc.setLineWidth(0.7)
  doc.line(X, lineY, pageWidth - X, lineY)

  return lineY + 7
}

// ── BARRA INQUILINO ──────────────────────────────────────────────────────────
// HTML: bg-slate-50 border border-slate-200 rounded px-6 py-3
//   Divisores:  w-px bg-slate-300
//   Etiquetas:  text-[10px] font-bold uppercase tracking-widest text-slate-400
//   Valores:    font-bold text-slate-900 (Inquilino/Unidad) | text-slate-700 (otros)
function addInquilinoBar(doc, pageWidth, startY, fields) {
  const BX = 14, BW = pageWidth - 28, BH = 16
  const colW = BW / fields.length

  doc.setFillColor(...S.s50)
  doc.setDrawColor(...S.s200)
  doc.setLineWidth(0.3)
  doc.roundedRect(BX, startY, BW, BH, 2, 2, 'FD')

  fields.forEach((f, i) => {
    const x = BX + i * colW + 5

    // Divisor (w-px bg-slate-300)
    if (i > 0) {
      doc.setDrawColor(...S.s300)
      doc.setLineWidth(0.3)
      doc.line(BX + i * colW, startY + 3, BX + i * colW, startY + BH - 3)
    }

    // Etiqueta: text-[10px] font-bold uppercase text-slate-400
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...S.s400)
    doc.text(f.label.toUpperCase(), x, startY + 6)

    // Valor
    const isBold = f.bold === true
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')
    doc.setFontSize(isBold ? 9 : 8.5)
    doc.setTextColor(...(isBold ? S.s900 : S.s700))
    const wrapped = doc.splitTextToSize(String(f.value || '-'), colW - 10)
    doc.text(wrapped[0] || '-', x, startY + 13)
  })

  return startY + BH + 6
}

// ── TÍTULO DE SECCIÓN ────────────────────────────────────────────────────────
// HTML: bg-slate-100 p-2 border-l-4 border-slate-800 (generales) / border-slate-500 (particulares)
//       text-sm font-bold uppercase tracking-widest text-slate-900
function addSectionTitle(doc, pageWidth, y, title, strong = true) {
  const BX = 14, BW = pageWidth - 28, BH = 10

  doc.setFillColor(...S.s100)
  doc.rect(BX, y, BW, BH, 'F')

  // border-l-4 ≈ 1.1mm
  doc.setFillColor(...(strong ? S.s800 : S.s500))
  doc.rect(BX, y, 1.1, BH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...S.s900)
  doc.text(title.toUpperCase(), BX + 6, y + 7)

  return y + BH + 2
}

// ── TABLA ────────────────────────────────────────────────────────────────────
// HTML: thead border-b border-slate-300 text-slate-600 font-semibold (sin fondo)
//       tbody divide-y divide-slate-100 text-slate-700
function tableOptions(extraOpts = {}) {
  return {
    theme: 'plain',
    headStyles: {
      fillColor:   S.white,
      textColor:   S.s600,
      fontStyle:   'bold',
      fontSize:    7,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor:   S.s300,
      lineWidth:   0.25,
    },
    bodyStyles: {
      fillColor:   S.white,
      textColor:   S.s700,
      fontSize:    7.5,
      lineColor:   S.s100,
      lineWidth:   0.25,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: {},
    tableLineColor: S.s200,
    tableLineWidth: 0.1,
    ...extraOpts,
  }
}

// ── PIE DE PÁGINA ────────────────────────────────────────────────────────────
// HTML: border-t-2 border-slate-800 pt-6
//   Izquierda (3/5): h4 "Información de Pago" + datos admin + Transferencia Bancaria
//   Derecha   (2/5): "TOTAL A PAGAR" + importe grande + vencimiento (opcional)
function addFooter(doc, pageWidth, pageHeight, footer, totalData) {
  const FX = 14, RX = pageWidth - 14
  const FY = pageHeight - 60

  // border-t-2 border-slate-800
  doc.setDrawColor(...S.s800)
  doc.setLineWidth(0.7)
  doc.line(FX, FY, RX, FY)

  // — Izquierda —
  let ly = FY + 8

  // h4: "Información de Pago" — text-xs font-bold uppercase tracking-widest text-slate-900
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...S.s900)
  doc.text('INFORMACIÓN DE PAGO', FX, ly)
  ly += 6

  // Dibuja un campo etiqueta: valor
  const kv = (label, value) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...S.s800)
    const lw = doc.getTextWidth(label + ' ')
    doc.text(label, FX, ly)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...S.s600)
    doc.text(String(value || ''), FX + lw, ly)
    ly += 5.5
  }

  kv('Administrador:', footer.administrador)
  kv('CUIT:', footer.cuit)
  const contacto = [footer.telefono, footer.email].filter(Boolean).join(' | ')
  if (contacto) kv('Contacto:', contacto)

  ly += 2

  // "Transferencia Bancaria" — font-bold text-slate-900 text-xs uppercase
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...S.s900)
  doc.text('TRANSFERENCIA BANCARIA', FX, ly)
  ly += 5

  doc.setFontSize(8)
  kv('CBU:', footer.cbu)
  kv('Alias:', footer.alias)

  if (footer.mediosDePago) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...S.s500)
    doc.text(`* ${footer.mediosDePago}`, FX, ly)
  }

  // — Derecha: Total a Pagar —
  if (totalData) {
    // "Total a Pagar" — text-sm font-bold text-slate-500 uppercase tracking-widest
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...S.s500)
    doc.text('TOTAL A PAGAR', RX, FY + 10, { align: 'right' })

    // Importe — text-3xl font-black text-slate-900
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...S.s900)
    doc.text(totalData.amount, RX, FY + 25, { align: 'right' })

    // Vencimiento — text-xs text-slate-500
    if (totalData.vencimiento) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...S.s500)
      doc.text(`Vencimiento general: ${totalData.vencimiento}`, RX, FY + 32, { align: 'right' })
    }
  }
}

// ── CAJA DE TOTALES ─────────────────────────────────────────────────────────
// Para Historial y Estado de Cuenta (sin inquilino específico).
// Diseño limpio: fondo blanco, borde slate-200.
function addTotalBox(doc, pageWidth, startY, lines) {
  const BX = 14, BW = pageWidth - 28, BH = 8 + lines.length * 7.5

  doc.setFillColor(...S.white)
  doc.setDrawColor(...S.s200)
  doc.setLineWidth(0.3)
  doc.roundedRect(BX, startY, BW, BH, 4, 4, 'FD')

  const center = startY + BH / 2
  const totalH = (lines.length - 1) * 7.5
  lines.forEach((line, i) => {
    const y = center - totalH / 2 + i * 7.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(line.big ? 10.5 : 8)
    doc.setTextColor(...(line.big ? S.s900 : S.s500))
    doc.text(line.label, BX + 6, y)
    doc.setFontSize(line.big ? 11 : 8)
    doc.setTextColor(...S.s900)
    doc.text(line.value, BX + BW - 6, y, { align: 'right' })
  })

  return startY + BH + 6
}

// ── PDF LIQUIDACIÓN INQUILINO ─────────────────────────────────────────────────
export async function generateInquilinoPDF(inquilino, periodo, gastosGenerales, gastosParticulares, totalInquilinos) {
  const footer = await resolveFooter()

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 64

  let currentY = addHeader(
    doc, pageWidth, 'Liquidación',
    `Período: ${periodoLabel(periodo)}`,
    `Emisión: ${new Date().toLocaleDateString('es-AR')}`
  )

  currentY = addInquilinoBar(doc, pageWidth, currentY, [
    { label: 'Inquilino',        value: `${inquilino.nombre} ${inquilino.apellido}`, bold: true },
    { label: 'DNI / CUIT',       value: inquilino.dni },
    { label: 'Domicilio Fiscal', value: (inquilino.domicilio || '').replace(/[\s,]+$/, '') || '-' },
    { label: 'Unidad',           value: inquilino.departamento, bold: true },
  ])

  const opts = tableOptions()

  // Cargos Generales
  if (gastosGenerales.length > 0) {
    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Generales (Prorrateo)', true)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Venc.', 'Total', 'Su Parte']],
      body: gastosGenerales.map(g => [
        g.servicio,
        toTitleCase(g.empresa),
        g.numeroFactura || '-',
        g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
        formatCurrency(g.importe),
        formatCurrency(g.importe / totalInquilinos),
      ]),
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold', textColor: S.s900 },
        1: { cellWidth: 30 },
        2: { cellWidth: 32 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: S.s900 },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Cargos Particulares
  if (gastosParticulares.length > 0) {
    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Particulares', false)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Venc.', 'Importe']],
      body: gastosParticulares.map(g => [
        g.servicio,
        toTitleCase(g.empresa),
        g.numeroFactura || '-',
        g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
        formatCurrency(g.importe),
      ]),
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold', textColor: S.s900 },
        1: { cellWidth: 56 },
        2: { cellWidth: 32 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: S.s900 },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
  }

  // Total + vencimiento más lejano para el pie
  const totGen = gastosGenerales.reduce((s, g)   => s + Number(g.importe) / totalInquilinos, 0)
  const totPar = gastosParticulares.reduce((s, g) => s + Number(g.importe), 0)

  const allVenc = [...gastosGenerales, ...gastosParticulares]
    .map(g => g.fechaVencimiento).filter(Boolean).sort()
  const vencGeneral = allVenc.length
    ? new Date(allVenc.at(-1) + 'T00:00:00').toLocaleDateString('es-AR')
    : null

  addFooter(doc, pageWidth, pageHeight, footer, {
    amount:      formatCurrency(totGen + totPar),
    vencimiento: vencGeneral,
  })

  doc.save(`Expensas_${inquilino.apellido}_${inquilino.nombre}_${periodo}.pdf`)
}

// ── PDF HISTORIAL DE PERÍODO ──────────────────────────────────────────────────
export async function generateHistorialPDF(periodo, gastos, inquilinos, serviciosMap, activeCount) {
  const divisor = activeCount || inquilinos.length || 1
  const footer  = await resolveFooter()

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 64
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED

  let currentY = addHeader(
    doc, pageWidth, 'Detalle de Período',
    `Período: ${periodoLabel(periodo)}`,
    `Emisión: ${new Date().toLocaleDateString('es-AR')}`
  )

  const opts         = tableOptions()
  const generales    = gastos.filter(g => g.tipo === 'general')
  const particulares = gastos.filter(g => g.tipo === 'particular')

  if (generales.length > 0) {
    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Generales (Prorrateo)', true)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Total', 'Inquilino', 'Su Parte']],
      body: generales.flatMap(g =>
        inquilinos.map(inq => [
          serviciosMap[g.servicioId] || g.servicioId,
          toTitleCase(g.empresa),
          g.numeroFactura || '-',
          g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
          formatCurrency(g.importe),
          `${inq.apellido}, ${inq.nombre}`,
          formatCurrency(g.importe / divisor),
        ])
      ),
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold', textColor: S.s900 },
        1: { cellWidth: 28 },
        2: { cellWidth: 30 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 30 },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: S.s900 },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  if (particulares.length > 0) {
    if (currentY + 20 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Particulares', false)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Inquilino', 'Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Importe']],
      body: particulares.map(g => {
        const inq = inquilinos.find(i => i.id === g.inquilinoId)
        return [
          inq ? `${inq.apellido}, ${inq.nombre}` : 'Desconocido',
          serviciosMap[g.servicioId] || g.servicioId,
          toTitleCase(g.empresa),
          g.numeroFactura || '-',
          g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
          formatCurrency(g.importe),
        ]
      }),
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 28, fontStyle: 'bold', textColor: S.s900 },
        2: { cellWidth: 26 },
        3: { cellWidth: 32 },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 36, halign: 'right', fontStyle: 'bold', textColor: S.s900 },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  if (currentY + 34 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

  const totGen = generales.reduce((s, g)    => s + Number(g.importe), 0)
  const totPar = particulares.reduce((s, g) => s + Number(g.importe), 0)
  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total Cargos Generales',    value: formatCurrency(totGen) },
    { label: 'Total Cargos Particulares', value: formatCurrency(totPar) },
    { label: 'TOTAL PERÍODO',             value: formatCurrency(totGen + totPar), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, null)
  doc.save(`Historial_${periodoLabel(periodo).replace(' ', '_')}.pdf`)
}

// ── PDF ESTADO DE CUENTA ──────────────────────────────────────────────────────
export async function generateEstadoCuentaPDF(inquilino, filas) {
  const footer = await resolveFooter()

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 64
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED

  let currentY = addHeader(
    doc, pageWidth, 'Estado de Cuenta',
    '',
    `Emisión: ${new Date().toLocaleDateString('es-AR')}`
  )

  currentY = addInquilinoBar(doc, pageWidth, currentY, [
    { label: 'Inquilino',    value: `${inquilino.apellido}, ${inquilino.nombre}`, bold: true },
    { label: 'Departamento', value: inquilino.departamento, bold: true },
    { label: 'Alquiler',     value: inquilino.precioAlquiler ? formatCurrency(Number(inquilino.precioAlquiler)) : '-' },
    { label: 'Ciclo',        value: inquilino.cicloActualizacion || '-' },
  ])

  const opts = tableOptions({
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const v = data.cell.raw
        if (v === 'Pagado') {
          data.cell.styles.textColor = S.successText
          data.cell.styles.fillColor = S.successFill
        } else if (v === 'Impago') {
          data.cell.styles.textColor = S.dangerText
          data.cell.styles.fillColor = S.dangerFill
        } else {
          data.cell.styles.textColor = S.warningText
          data.cell.styles.fillColor = S.warningFill
        }
      }
    },
  })

  autoTable(doc, {
    ...opts,
    startY: currentY,
    head: [['Período', 'Expensas', 'Alquiler', 'Mora', 'Total', 'Estado', 'Fecha Pago']],
    body: filas.map(f => [
      periodoLabel(f.periodo),
      formatCurrency(f.expensas),
      formatCurrency(f.alquiler),
      f.mora > 0 ? `${formatCurrency(f.mora)}${f.tiempoMora ? `\n${f.tiempoMora}` : ''}` : '—',
      formatCurrency(f.total),
      f.estado === 'pagado' ? 'Pagado' : f.estado === 'impago' ? 'Impago' : 'Pendiente',
      f.fechaPago ? new Date(f.fechaPago).toLocaleDateString('es-AR') : '—',
    ]),
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 26, halign: 'right' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: S.s900 },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 26, halign: 'center' },
    },
    margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
  })
  currentY = doc.lastAutoTable.finalY + 8

  if (currentY + 38 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total expensas', value: formatCurrency(filas.reduce((s, f) => s + f.expensas, 0)) },
    { label: 'Total alquiler', value: formatCurrency(filas.reduce((s, f) => s + f.alquiler, 0)) },
    { label: 'Total mora',     value: formatCurrency(filas.reduce((s, f) => s + f.mora,     0)) },
    { label: 'TOTAL',          value: formatCurrency(filas.reduce((s, f) => s + f.total,    0)), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, null)

  const hoy = new Date()
  const mes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'][hoy.getMonth()]
  doc.save(`Estado_de_Cuenta_${inquilino.apellido}_${inquilino.nombre}_${mes}_${hoy.getFullYear()}.pdf`)
}
