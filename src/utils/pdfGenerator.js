import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_FOOTER as PDF_FOOTER_DEFAULT } from '../pdfConfig'
import { getAdminConfig } from '../db'
import { periodoLabel, formatCurrency } from './helpers'

// ── Paleta de colores (light / slate) ───────────────────────────────────────
const C = {
  dark:        [30,  41,  59],   // slate-800  #1e293b
  medium:      [100, 116, 139],  // slate-500  #64748b
  muted:       [148, 163, 184],  // slate-400  #94a3b8
  bg:          [248, 249, 250],  // slate-50   #f8f9fa
  bgCard:      [241, 245, 249],  // slate-100  #f1f5f9
  white:       [255, 255, 255],
  textDark:    [30,  41,  59],
  textSec:     [100, 116, 139],
  border:      [226, 232, 240],  // slate-200  #e2e8f0
  accent:      [108, 99,  255],  // #6c63ff
  success:     [34,  197, 94],
  successSoft: [220, 252, 231],
  danger:      [239, 68,  68],
  dangerSoft:  [254, 226, 226],
  warning:     [245, 158, 11],
  warningSoft: [254, 243, 199],
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function resolveFooter() {
  const saved = await getAdminConfig()
  if (saved && saved.administrador) return saved
  return PDF_FOOTER_DEFAULT
}

async function loadImageWithDimensions(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const blob = await r.blob()
    const b64 = await new Promise(resolve => {
      const fr = new FileReader()
      fr.onload  = () => resolve(fr.result)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
    if (!b64) return null
    const dims = await new Promise(resolve => {
      const img = new Image()
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 100, h: 100 })
      img.src = b64
    })
    return { b64, dims }
  } catch {
    return null
  }
}

async function circularCrop(b64, size = 200) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()
        const srcMin = Math.min(img.naturalWidth, img.naturalHeight)
        const srcX   = (img.naturalWidth  - srcMin) / 2
        const srcY   = (img.naturalHeight - srcMin) / 2
        ctx.drawImage(img, srcX, srcY, srcMin, srcMin, 0, 0, size, size)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(b64)
      }
    }
    img.onerror = () => resolve(b64)
    img.src = b64
  })
}

// ── Bloques visuales ─────────────────────────────────────────────────────────

/**
 * Encabezado: "Expensas Plus+" a la izquierda, tipo de doc + período + fecha a la derecha.
 * Separado del contenido por una línea horizontal.
 * Retorna Y del contenido siguiente.
 */
function addHeader(doc, pageWidth, docType, periodLine, dateLine) {
  const HX = 14, HY = 12

  // Izquierda: nombre + subtítulo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...C.dark)
  doc.text('Expensas Plus+', HX, HY + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.medium)
  doc.text('Gestión de Consorcios', HX, HY + 15)

  // Derecha: tipo de documento
  const RX = pageWidth - HX
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.dark)
  doc.text(docType.toUpperCase(), RX, HY + 7, { align: 'right' })

  // Grid período / emisión
  const labelX = RX - 46
  doc.setFontSize(7.5)

  if (periodLine) {
    const sep = periodLine.indexOf(': ')
    const lbl = sep >= 0 ? periodLine.slice(0, sep) : periodLine
    const val = sep >= 0 ? periodLine.slice(sep + 2) : ''
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.dark)
    doc.text(lbl + ':', labelX, HY + 14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medium)
    doc.text(val, RX, HY + 14, { align: 'right' })
  }

  if (dateLine) {
    const sep = dateLine.indexOf(': ')
    const lbl = sep >= 0 ? dateLine.slice(0, sep) : dateLine
    const val = sep >= 0 ? dateLine.slice(sep + 2) : ''
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.dark)
    doc.text(lbl + ':', labelX, HY + 21)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medium)
    doc.text(val, RX, HY + 21, { align: 'right' })
  }

  // Línea separadora
  const lineY = HY + 28
  doc.setDrawColor(...C.dark)
  doc.setLineWidth(0.6)
  doc.line(HX, lineY, pageWidth - HX, lineY)

  return lineY + 8
}

/**
 * Barra horizontal de datos del inquilino/unidad.
 * fields: [{ label, value, bold? }]
 * Retorna Y del contenido siguiente.
 */
function addInquilinoBar(doc, pageWidth, startY, fields) {
  const BX = 14, BW = pageWidth - 28, BH = 17

  doc.setFillColor(...C.bg)
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(BX, startY, BW, BH, 3, 3, 'FD')

  const colW = BW / fields.length
  fields.forEach((field, i) => {
    const x = BX + i * colW + 5

    if (i > 0) {
      doc.setDrawColor(...C.border)
      doc.setLineWidth(0.3)
      doc.line(BX + i * colW, startY + 2, BX + i * colW, startY + BH - 2)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...C.muted)
    doc.text(field.label.toUpperCase(), x, startY + 6)

    doc.setFont('helvetica', field.bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...C.dark)
    const maxW = colW - 10
    const lines = doc.splitTextToSize(String(field.value || '-'), maxW)
    doc.text(lines[0] || '-', x, startY + 13)
  })

  return startY + BH + 6
}

/**
 * Encabezado de sección con barra de acento a la izquierda y fondo slate-100.
 * Retorna Y del contenido siguiente.
 */
function addSectionTitle(doc, pageWidth, y, title, strong = true) {
  const BX = 14, BW = pageWidth - 28, BH = 10

  doc.setFillColor(...C.bgCard)
  doc.rect(BX, y, BW, BH, 'F')

  doc.setFillColor(...(strong ? C.dark : C.medium))
  doc.rect(BX, y, 3, BH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.dark)
  doc.text(title.toUpperCase(), BX + 8, y + 7)

  return y + BH + 3
}

/**
 * Caja de totales con borde acento (para historial y estado de cuenta).
 * lines: [{ label, value, big? }]
 * Retorna Y del contenido siguiente.
 */
function addTotalBox(doc, pageWidth, startY, lines) {
  const BX = 14, BW = pageWidth - 28, BH = 8 + lines.length * 8

  doc.setFillColor(...C.white)
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.4)
  doc.roundedRect(BX, startY, BW, BH, 6, 6, 'FD')

  const boxCenter  = startY + BH / 2
  const totalTextH = (lines.length - 1) * 8
  lines.forEach((line, i) => {
    const y = boxCenter - totalTextH / 2 + i * 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(line.big ? 11 : 8.5)
    doc.setTextColor(...(line.big ? C.dark : C.medium))
    doc.text(line.label, BX + 6, y)
    doc.setFontSize(line.big ? 12 : 8.5)
    doc.setTextColor(...C.dark)
    doc.text(line.value, BX + BW - 6, y, { align: 'right' })
  })

  return startY + BH + 6
}

/**
 * Pie de página: línea superior, info del administrador a la izquierda.
 * Si se pasa totalData, muestra Total a Pagar en la mitad derecha.
 * totalData: { amount, vencimiento? } | null
 */
function addFooter(doc, pageWidth, pageHeight, footer, totalData) {
  const FX = 14
  const FY = pageHeight - 58

  doc.setDrawColor(...C.dark)
  doc.setLineWidth(0.5)
  doc.line(FX, FY, pageWidth - FX, FY)

  const infoY  = FY + 8
  const rightX = pageWidth - FX
  const leftMaxX = totalData ? pageWidth * 0.58 : rightX

  // Administrador
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.dark)
  doc.text('Administrador: ', FX, infoY)
  doc.setFont('helvetica', 'normal')
  doc.text(footer.administrador || '', FX + doc.getTextWidth('Administrador: '), infoY)

  // CUIT
  let ly = infoY + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CUIT: ', FX, ly)
  doc.setFont('helvetica', 'normal')
  doc.text(footer.cuit || '', FX + doc.getTextWidth('CUIT: '), ly)

  // Contacto
  const contacto = [footer.telefono, footer.email].filter(Boolean).join(' | ')
  if (contacto) {
    ly += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Contacto: ', FX, ly)
    doc.setFont('helvetica', 'normal')
    const maxW = leftMaxX - FX - doc.getTextWidth('Contacto: ') - 4
    doc.text(doc.splitTextToSize(contacto, maxW)[0] || '', FX + doc.getTextWidth('Contacto: '), ly)
  }

  // Transferencia bancaria
  ly += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...C.medium)
  doc.text('TRANSFERENCIA BANCARIA', FX, ly)

  ly += 5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text('CBU: ', FX, ly)
  doc.setFont('helvetica', 'normal')
  doc.text(footer.cbu || '', FX + doc.getTextWidth('CBU: '), ly)

  ly += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Alias: ', FX, ly)
  doc.setFont('helvetica', 'normal')
  doc.text(footer.alias || '', FX + doc.getTextWidth('Alias: '), ly)

  if (footer.mediosDePago) {
    ly += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.medium)
    doc.text(`* ${footer.mediosDePago}`, FX, ly)
  }

  // Derecha: total a pagar
  if (totalData) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.medium)
    doc.text('TOTAL A PAGAR', rightX, infoY, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...C.dark)
    doc.text(totalData.amount, rightX, infoY + 16, { align: 'right' })

    if (totalData.vencimiento) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.medium)
      doc.text(`Vencimiento: ${totalData.vencimiento}`, rightX, infoY + 24, { align: 'right' })
    }
  }
}

/** Opciones comunes de tabla para los 3 PDFs. */
function tableOptions(extraOpts = {}) {
  return {
    theme: 'plain',
    headStyles: {
      fillColor:   C.bgCard,
      textColor:   C.medium,
      fontStyle:   'bold',
      fontSize:    7,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineColor:   C.border,
      lineWidth:   0.3,
    },
    bodyStyles: {
      fillColor:   C.white,
      textColor:   C.textDark,
      fontSize:    7.5,
      lineColor:   C.border,
      lineWidth:   0.1,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    tableLineColor:  C.border,
    tableLineWidth:  0.1,
    ...extraOpts,
  }
}

// ── PDF Inquilino ─────────────────────────────────────────────────────────────
export async function generateInquilinoPDF(inquilino, periodo, gastosGenerales, gastosParticulares, totalInquilinos) {
  const footer = await resolveFooter()

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 62

  let currentY = addHeader(
    doc, pageWidth,
    'Liquidación',
    `Período: ${periodoLabel(periodo)}`,
    `Emisión: ${new Date().toLocaleDateString('es-AR')}`
  )

  currentY = addInquilinoBar(doc, pageWidth, currentY, [
    { label: 'Inquilino',       value: `${inquilino.nombre} ${inquilino.apellido}`, bold: true },
    { label: 'DNI / CUIT',      value: inquilino.dni },
    { label: 'Domicilio Fiscal', value: inquilino.domicilio || '-' },
    { label: 'Unidad',          value: inquilino.departamento, bold: true },
  ])

  const opts = tableOptions()

  // ── Cargos generales
  if (gastosGenerales.length > 0) {
    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Generales (Prorrateo)', true)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Venc.', 'Total', 'Su Parte']],
      body: gastosGenerales.map(g => [
        g.servicio,
        g.empresa,
        g.numeroFactura || '-',
        g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
        formatCurrency(g.importe),
        formatCurrency(g.importe / totalInquilinos),
      ]),
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 36 },
        2: { cellWidth: 26 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: C.dark },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // ── Cargos particulares
  if (gastosParticulares.length > 0) {
    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Particulares', false)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Venc.', 'Importe']],
      body: gastosParticulares.map(g => [
        g.servicio,
        g.empresa,
        g.numeroFactura || '-',
        g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
        formatCurrency(g.importe),
      ]),
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 62 },
        2: { cellWidth: 26 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 34, halign: 'right', fontStyle: 'bold', textColor: C.dark },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
  }

  // Calcular total y vencimiento más lejano
  const totGen = gastosGenerales.reduce((s, g)   => s + Number(g.importe) / totalInquilinos, 0)
  const totPar = gastosParticulares.reduce((s, g) => s + Number(g.importe), 0)

  const allVencimientos = [...gastosGenerales, ...gastosParticulares]
    .map(g => g.fechaVencimiento)
    .filter(Boolean)
    .sort()
  const vencimientoGeneral = allVencimientos.length
    ? new Date(allVencimientos.at(-1) + 'T00:00:00').toLocaleDateString('es-AR')
    : null

  addFooter(doc, pageWidth, pageHeight, footer, {
    amount: formatCurrency(totGen + totPar),
    vencimiento: vencimientoGeneral,
  })

  doc.save(`Expensas_${inquilino.apellido}_${inquilino.nombre}_${periodo}.pdf`)
}

// ── PDF Historial ─────────────────────────────────────────────────────────────
export async function generateHistorialPDF(periodo, gastos, inquilinos, serviciosMap, activeCount) {
  const divisor = activeCount || inquilinos.length || 1
  const footer  = await resolveFooter()

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 62
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED

  let currentY = addHeader(
    doc, pageWidth,
    'Detalle de Período',
    `Período: ${periodoLabel(periodo)}`,
    `Emisión: ${new Date().toLocaleDateString('es-AR')}`
  )

  const opts        = tableOptions()
  const generales   = gastos.filter(g => g.tipo === 'general')
  const particulares = gastos.filter(g => g.tipo === 'particular')
  const suParte      = importe => formatCurrency(importe / divisor)

  if (generales.length > 0) {
    currentY = addSectionTitle(doc, pageWidth, currentY, 'Cargos Generales (Prorrateo)', true)

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Total', 'Inquilino', 'Su Parte']],
      body: generales.flatMap(g =>
        inquilinos.map(inq => [
          serviciosMap[g.servicioId] || g.servicioId,
          g.empresa,
          g.numeroFactura || '-',
          g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
          formatCurrency(g.importe),
          `${inq.apellido}, ${inq.nombre}`,
          suParte(g.importe),
        ])
      ),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 38 },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
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
          g.empresa,
          g.numeroFactura || '-',
          g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
          formatCurrency(g.importe),
        ]
      }),
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
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

// ── PDF Estado de Cuenta ──────────────────────────────────────────────────────
export async function generateEstadoCuentaPDF(inquilino, filas) {
  const footer = await resolveFooter()

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 62
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED

  let currentY = addHeader(
    doc, pageWidth,
    'Estado de Cuenta',
    '',
    `Emisión: ${new Date().toLocaleDateString('es-AR')}`
  )

  currentY = addInquilinoBar(doc, pageWidth, currentY, [
    { label: 'Inquilino',   value: `${inquilino.apellido}, ${inquilino.nombre}`, bold: true },
    { label: 'Departamento', value: inquilino.departamento, bold: true },
    { label: 'Alquiler',    value: inquilino.precioAlquiler ? formatCurrency(Number(inquilino.precioAlquiler)) : '-' },
    { label: 'Ciclo',       value: inquilino.cicloActualizacion || '-' },
  ])

  const opts = tableOptions({
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const val = data.cell.raw
        if (val === 'Pagado') {
          data.cell.styles.textColor = C.success
          data.cell.styles.fillColor = C.successSoft
        } else if (val === 'Impago') {
          data.cell.styles.textColor = C.danger
          data.cell.styles.fillColor = C.dangerSoft
        } else {
          data.cell.styles.textColor = C.warning
          data.cell.styles.fillColor = C.warningSoft
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
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
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
