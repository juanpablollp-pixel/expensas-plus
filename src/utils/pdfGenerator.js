import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_FOOTER as PDF_FOOTER_DEFAULT } from '../pdfConfig'
import { getAdminConfig } from '../db'

// ── Paleta de colores (fondo claro) ─────────────────────────────────────────
const C = {
  bg:          [255, 255, 255],  // #ffffff  fondo general
  card:        [248, 248, 248],  // #f8f8f8  secciones / footer
  card2:       [243, 243, 243],  // #f3f3f3  filas alternas
  border:      [224, 224, 224],  // #e0e0e0  bordes sutiles
  accent:      [108, 99,  255],  // #6c63ff  violeta principal
  accentSoft:  [240, 238, 255],  // #f0eeff  fondo totales
  text:        [26,  26,  26],   // #1a1a1a  texto principal
  textSec:     [102, 102, 102],  // #666666  texto secundario
  white:       [255, 255, 255],
  success:     [34,  197, 94],   // #22c55e
  successSoft: [220, 252, 231],  // #dcfce7  verde suave
  danger:      [239, 68,  68],   // #ef4444
  dangerSoft:  [254, 226, 226],  // #fee2e2  rojo suave
  warning:     [245, 158, 11],   // #f59e0b
  warningSoft: [254, 243, 199],  // #fef3c7  amarillo suave
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function resolveFooter() {
  const saved = await getAdminConfig()
  if (saved && saved.administrador) return saved
  return PDF_FOOTER_DEFAULT
}

function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPeriodo(periodo) {
  if (!periodo) return ''
  const [year, month] = periodo.split('-')
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[parseInt(month) - 1]} ${year}`
}

/** Carga una imagen pública como base64. Devuelve null si falla o no existe. */
async function loadImageAsBase64(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const blob = await r.blob()
    return new Promise(resolve => {
      const fr = new FileReader()
      fr.onload  = () => resolve(fr.result)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Encabezado: banda violeta redondeada.
 * Izquierda: logo de la app (icon-512.png).
 * Centro: "ExpensasPlus" bold 18pt.
 * Derecha: tipo de documento, período y fecha.
 * Retorna la Y donde empieza el contenido siguiente.
 */
function addHeader(doc, pageWidth, logoApp, docType, periodLine, dateLine) {
  const HX = 14, HY = 10, HW = pageWidth - 28, HH = 42

  doc.setFillColor(...C.accent)
  doc.roundedRect(HX, HY, HW, HH, 8, 8, 'F')

  // Logo de la app a la izquierda (icon-512.png).
  // Si falla la carga, se omite silenciosamente.
  if (logoApp) {
    try {
      doc.addImage(logoApp, 'PNG', HX + 5, HY + 3, 16, 16)
    } catch { /* omitir */ }
  }

  // "ExpensasPlus" centrado
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.white)
  doc.text('ExpensasPlus', HX + HW / 2, HY + 16, { align: 'center' })

  // Columna derecha: tipo de doc, período y fecha
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(docType,    HX + HW - 5, HY + 14, { align: 'right' })
  if (periodLine) doc.text(periodLine, HX + HW - 5, HY + 22, { align: 'right' })
  if (dateLine)   doc.text(dateLine,   HX + HW - 5, HY + 30, { align: 'right' })

  return HY + HH + 8
}

/**
 * Recuadro de datos del inquilino (fondo claro).
 * Retorna la Y siguiente.
 */
function addInquilinoBox(doc, pageWidth, startY, leftLabel, leftLines, rightLabel, rightLines) {
  const BX = 14, BW = pageWidth - 28
  const LINE_H = 5.5
  const rows = Math.max(leftLines.length, rightLines.length)
  const BH = 10 + rows * LINE_H + 4

  doc.setFillColor(...C.card)
  doc.roundedRect(BX, startY, BW, BH, 6, 6, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(BX, startY, BW, BH, 6, 6)

  const col2   = BX + BW / 2 + 10
  const labelY = startY + 8

  function drawLabeledLines(lines, x) {
    lines.forEach((line, i) => {
      const y = labelY + 5 + i * LINE_H
      const colonIdx = line.indexOf(': ')
      if (colonIdx > 0) {
        const lbl = line.slice(0, colonIdx + 2)
        const val = line.slice(colonIdx + 2)
        doc.setTextColor(...C.textSec)
        doc.text(lbl, x, y)
        doc.setTextColor(...C.text)
        doc.text(val, x + doc.getTextWidth(lbl), y)
      } else {
        doc.setTextColor(...C.text)
        doc.text(line, x, y)
      }
    })
  }

  doc.setFontSize(8)

  // Columna izquierda
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.accent)
  doc.text(leftLabel, BX + 6, labelY)
  doc.setFont('helvetica', 'normal')
  drawLabeledLines(leftLines, BX + 6)

  // Columna derecha
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.accent)
  doc.text(rightLabel, col2, labelY)
  doc.setFont('helvetica', 'normal')
  drawLabeledLines(rightLines, col2)

  return startY + BH + 7
}

/**
 * Recuadro de totales: fondo #f0eeff, borde violeta.
 */
function addTotalBox(doc, pageWidth, startY, lines) {
  // lines: [{ label, value, big? }]
  const BX = 14, BW = pageWidth - 28, BH = 8 + lines.length * 7

  doc.setFillColor(...C.accentSoft)
  doc.roundedRect(BX, startY, BW, BH, 6, 6, 'F')
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.4)
  doc.roundedRect(BX, startY, BW, BH, 6, 6)

  lines.forEach((line, i) => {
    const y = startY + 7 + i * 7
    doc.setTextColor(...C.textSec)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(line.big ? 9 : 8)
    doc.text(line.label, BX + 6, y)

    doc.setTextColor(...C.accent)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(line.big ? 12 : 9)
    doc.text(line.value, BX + BW - 6, y, { align: 'right' })
  })

  return startY + BH + 6
}

/**
 * Pie de página: fondo #f8f8f8, línea superior violeta.
 * Muestra logo del administrador a la izquierda y datos en dos columnas.
 */
function addFooter(doc, pageWidth, pageHeight, footer, logoAdmin) {
  const FH = 54
  const FY = pageHeight - FH - 8
  const FX = 14, FW = pageWidth - 28

  // Fondo claro
  doc.setFillColor(...C.card)
  doc.roundedRect(FX, FY, FW, FH, 6, 6, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.2)
  doc.roundedRect(FX, FY, FW, FH, 6, 6)

  // Línea superior violeta 2px
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.7)
  doc.line(FX, FY, FX + FW, FY)

  let textStartX = FX + 6

  // Logo del administrador a la izquierda.
  // Colocá el archivo logo-admin.png en public/ para que aparezca aquí.
  if (logoAdmin) {
    try {
      // Máximo 25x12mm proporcional
      doc.addImage(logoAdmin, 'PNG', FX + 6, FY + 6, 25, 12, '', 'FAST')
      textStartX = FX + 36
    } catch { /* omitir si falla */ }
  }

  const col1X = textStartX
  const col2X = pageWidth / 2 + 8

  doc.setFontSize(8)

  // Nombre administrador en bold
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.text)
  doc.text(footer.administrador || '', col1X, FY + 12)

  // Columna izquierda
  doc.setFont('helvetica', 'normal')
  const leftFields = [
    ['CUIT',  footer.cuit],
    ['Tel',   footer.telefono],
    ['Email', footer.email],
  ]
  leftFields.forEach(([lbl, val], i) => {
    const y = FY + 20 + i * 7
    doc.setTextColor(...C.textSec)
    doc.text(`${lbl}: `, col1X, y)
    doc.setTextColor(...C.text)
    doc.text(val || '', col1X + doc.getTextWidth(`${lbl}: `), y)
  })

  // Columna derecha
  const rightFields = [
    ['CBU',   footer.cbu],
    ['Alias', footer.alias],
    ['Pago',  footer.mediosDePago],
  ]
  rightFields.forEach(([lbl, val], i) => {
    const y = FY + 20 + i * 7
    doc.setTextColor(...C.textSec)
    doc.text(`${lbl}: `, col2X, y)
    doc.setTextColor(...C.text)
    const maxW = FX + FW - col2X - doc.getTextWidth(`${lbl}: `) - 4
    const wrapped = doc.splitTextToSize(val || '', maxW)
    doc.text(wrapped[0] || '', col2X + doc.getTextWidth(`${lbl}: `), y)
  })
}

/** Opciones comunes de tabla (tema claro). */
function tableOptions(extraOpts = {}) {
  return {
    theme: 'plain',
    headStyles: {
      fillColor:   C.accent,
      textColor:   C.white,
      fontStyle:   'bold',
      fontSize:    8,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor:   C.bg,
      textColor:   C.text,
      fontSize:    8,
      lineColor:   C.border,
      lineWidth:   0.1,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: C.card2 },
    tableLineColor: C.border,
    tableLineWidth: 0.1,
    ...extraOpts,
  }
}

// ── PDF Inquilino ─────────────────────────────────────────────────────────────
export async function generateInquilinoPDF(inquilino, periodo, gastosGenerales, gastosParticulares, totalInquilinos) {
  const [footer, logoApp, logoAdmin] = await Promise.all([
    resolveFooter(),
    loadImageAsBase64('/expensas-plus/icon-512.png'),
    loadImageAsBase64('/expensas-plus/logo-admin.png'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 65

  let currentY = addHeader(
    doc, pageWidth, logoApp,
    'Liquidación de Expensas',
    `Período: ${formatPeriodo(periodo)}`,
    `Fecha: ${new Date().toLocaleDateString('es-AR')}`
  )

  // Datos del inquilino
  doc.setFontSize(8)
  const domMaxW = (pageWidth - 28) / 2 - 16
  const domLines = inquilino.domicilio
    ? doc.splitTextToSize(inquilino.domicilio, domMaxW)
    : ['-']

  currentY = addInquilinoBox(
    doc, pageWidth, currentY,
    'INQUILINO',
    [
      `${inquilino.nombre} ${inquilino.apellido}`,
      `DNI/CUIT: ${inquilino.dni}`,
    ],
    'UNIDAD',
    [
      `Depto: ${inquilino.departamento}`,
      ...domLines.map((l, i) => (i === 0 ? `Domicilio: ${l}` : l)),
    ]
  )

  const opts = tableOptions()

  // Cargos generales
  if (gastosGenerales.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('Cargos Generales', 14, currentY)
    currentY += 4

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Total', 'Su parte']],
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
        3: { cellWidth: 28 },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Cargos particulares
  if (gastosParticulares.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.danger)
    doc.text('Cargos Particulares', 14, currentY)
    currentY += 4

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Importe']],
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
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Total
  const totalGeneral    = gastosGenerales.reduce((s, g)   => s + Number(g.importe) / totalInquilinos, 0)
  const totalParticular = gastosParticulares.reduce((s, g) => s + Number(g.importe), 0)
  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total a pagar', value: formatCurrency(totalGeneral + totalParticular), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, logoAdmin)
  doc.save(`Expensas_${inquilino.apellido}_${inquilino.nombre}_${periodo}.pdf`)
}

// ── PDF Historial ─────────────────────────────────────────────────────────────
export async function generateHistorialPDF(periodo, gastos, inquilinos, serviciosMap) {
  const [footer, logoApp, logoAdmin] = await Promise.all([
    resolveFooter(),
    loadImageAsBase64('/expensas-plus/icon-512.png'),
    loadImageAsBase64('/expensas-plus/logo-admin.png'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 65
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED

  let currentY = addHeader(
    doc, pageWidth, logoApp,
    'Detalle Completo de Período',
    `Período: ${formatPeriodo(periodo)}`,
    `Fecha: ${new Date().toLocaleDateString('es-AR')}`
  )

  const opts       = tableOptions()
  const generales   = gastos.filter(g => g.tipo === 'general')
  const particulares = gastos.filter(g => g.tipo === 'particular')

  // Cargos generales
  if (generales.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('Cargos Generales', 14, currentY)
    currentY += 4

    const suParte = importe => formatCurrency(importe / (inquilinos.length || 1))

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Importe Total', 'Inquilino', 'Su Parte']],
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
        3: { cellWidth: 22 },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 38 },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Cargos particulares
  if (particulares.length > 0) {
    if (currentY + 20 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.danger)
    doc.text('Cargos Particulares', 14, currentY)
    currentY += 4

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

  // Totales
  if (currentY + 32 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

  const totGen = generales.reduce((s, g)    => s + Number(g.importe), 0)
  const totPar = particulares.reduce((s, g)  => s + Number(g.importe), 0)
  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total Cargos Generales',    value: formatCurrency(totGen) },
    { label: 'Total Cargos Particulares', value: formatCurrency(totPar) },
    { label: 'TOTAL PERÍODO',             value: formatCurrency(totGen + totPar), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, logoAdmin)
  doc.save(`Historial de Expensas_${formatPeriodo(periodo).replace(' ', '_')}.pdf`)
}

// ── PDF Estado de Cuenta ──────────────────────────────────────────────────────
// filas: [{ periodo, expensas, alquiler, mora, tiempoMora, estado, total, fechaPago }]
export async function generateEstadoCuentaPDF(inquilino, filas) {
  const [footer, logoApp, logoAdmin] = await Promise.all([
    resolveFooter(),
    loadImageAsBase64('/expensas-plus/icon-512.png'),
    loadImageAsBase64('/expensas-plus/logo-admin.png'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 65
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED
  const fc = n => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  let currentY = addHeader(
    doc, pageWidth, logoApp,
    'Estado de Cuenta',
    '',
    `Fecha: ${new Date().toLocaleDateString('es-AR')}`
  )

  // Datos del inquilino
  currentY = addInquilinoBox(
    doc, pageWidth, currentY,
    'INQUILINO',
    [
      `${inquilino.apellido}, ${inquilino.nombre}`,
      `Depto: ${inquilino.departamento}`,
    ],
    'ALQUILER',
    [
      inquilino.precioAlquiler
        ? `Precio: $${Number(inquilino.precioAlquiler).toLocaleString('es-AR')}`
        : '-',
      inquilino.cicloActualizacion ? `Ciclo: ${inquilino.cicloActualizacion}` : '',
    ].filter(Boolean)
  )

  // Tabla de períodos con badges de estado coloreados
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
      formatPeriodo(f.periodo),
      fc(f.expensas),
      fc(f.alquiler),
      f.mora > 0 ? `${fc(f.mora)}${f.tiempoMora ? `\n${f.tiempoMora}` : ''}` : '—',
      fc(f.total),
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

  // Totales
  if (currentY + 36 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

  const totExp  = filas.reduce((s, f) => s + f.expensas, 0)
  const totAlq  = filas.reduce((s, f) => s + f.alquiler, 0)
  const totMora = filas.reduce((s, f) => s + f.mora,     0)
  const totTot  = filas.reduce((s, f) => s + f.total,    0)

  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total expensas', value: fc(totExp)  },
    { label: 'Total alquiler', value: fc(totAlq)  },
    { label: 'Total mora',     value: fc(totMora) },
    { label: 'TOTAL',          value: fc(totTot),  big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, logoAdmin)

  const hoy = new Date()
  const mesActual = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'][hoy.getMonth()]
  doc.save(`Estado de Cuenta_${inquilino.apellido}_${inquilino.nombre}_${mesActual}_${hoy.getFullYear()}.pdf`)
}
