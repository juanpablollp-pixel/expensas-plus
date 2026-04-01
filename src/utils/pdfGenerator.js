import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_FOOTER as PDF_FOOTER_DEFAULT } from '../pdfConfig'
import { getAdminConfig } from '../db'

// ── Paleta de colores ────────────────────────────────────────────────────────
const C = {
  dark:        [26,  31,  54],   // #1a1f36  encabezado / sección / table header
  accent:      [108, 99,  255],  // #6c63ff  acento violeta
  white:       [255, 255, 255],
  textDark:    [26,  31,  54],   // texto sobre fondo claro
  textSec:     [102, 102, 102],  // #666666  texto secundario
  border:      [224, 224, 224],  // #e0e0e0
  rowAlt:      [245, 245, 245],  // #f5f5f5  fila alterna
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

function formatCurrency(n) {
  return `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPeriodo(periodo) {
  if (!periodo) return ''
  const [year, month] = periodo.split('-')
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[parseInt(month) - 1]} ${year}`
}

/**
 * Carga imagen como base64 + dimensiones en px.
 * Retorna { b64, dims: { w, h } } o null si falla.
 */
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

/**
 * Recorta una imagen en círculo usando canvas del navegador.
 * Retorna data URL de la imagen recortada.
 */
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

/**
 * Calcula dimensiones en mm que caben en maxW×maxH manteniendo proporción.
 */
function fitInBounds(imgW, imgH, maxW, maxH) {
  const byW = { w: maxW, h: maxW / (imgW / imgH) }
  return byW.h <= maxH ? byW : { w: maxH * (imgW / imgH), h: maxH }
}

// ── Bloques visuales ─────────────────────────────────────────────────────────

/**
 * Encabezado: rectángulo navy, logo a la izquierda, texto a la derecha.
 * logoExpensas: { b64, dims } | null
 * Retorna Y del contenido siguiente.
 */
function addHeader(doc, pageWidth, logoExpensas, docType, periodLine, dateLine) {
  const HX = 14, HY = 10, HW = pageWidth - 28, HH = 35

  doc.setFillColor(...C.dark)
  doc.roundedRect(HX, HY, HW, HH, 8, 8, 'F')

  // Logo de la app a la izquierda (logo-expensas.png).
  // Reemplazá la carga por la imagen definitiva cuando esté disponible.
  if (logoExpensas) {
    const fit    = fitInBounds(logoExpensas.dims.w, logoExpensas.dims.h, 90, 32)
    const logoX  = HX + 6
    const logoY  = HY + (HH - fit.h) / 2
    try { doc.addImage(logoExpensas.b64, 'PNG', logoX, logoY, fit.w, fit.h) }
    catch { /* omitir si falla */ }
  }

  // Texto derecho centrado verticalmente: tipo de documento, período, fecha
  const midY = HY + HH / 2
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(docType, HX + HW - 6, midY - 7, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  if (periodLine) doc.text(periodLine, HX + HW - 6, midY,     { align: 'right' })
  if (dateLine)   doc.text(dateLine,   HX + HW - 6, midY + 7, { align: 'right' })

  return HY + HH + 7
}

/**
 * Sección de datos del inquilino: fondo navy, dos columnas, texto blanco.
 * Retorna Y del contenido siguiente.
 */
function addInquilinoBox(doc, pageWidth, startY, leftLabel, leftLines, rightLabel, rightLines) {
  const BX = 14, BW = pageWidth - 28
  const LINE_H = 5.5
  const rows = Math.max(leftLines.length, rightLines.length)
  const BH   = 10 + rows * LINE_H + 4

  doc.setFillColor(...C.dark)
  doc.roundedRect(BX, startY, BW, BH, 6, 6, 'F')

  const col2   = BX + BW / 2 + 10
  const labelY = startY + 8

  function drawColumn(label, lines, x) {
    // Etiqueta de sección en violeta
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.accent)
    doc.text(label, x, labelY)

    lines.forEach((line, i) => {
      const y = labelY + 5 + i * LINE_H
      if (i === 0) {
        // Primera línea: nombre/depto en bold 10
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
      } else {
        // Resto: texto normal 9
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
      }
      doc.setTextColor(...C.white)
      doc.text(line, x, y)
    })
  }

  drawColumn(leftLabel,  leftLines,  BX + 6)
  drawColumn(rightLabel, rightLines, col2)

  return startY + BH + 7
}

/**
 * Caja de total: borde violeta 1.5pt, fondo blanco.
 * lines: [{ label, value, big? }]
 * Retorna Y del contenido siguiente.
 */
function addTotalBox(doc, pageWidth, startY, lines) {
  const BX = 14, BW = pageWidth - 28, BH = 8 + lines.length * 8

  doc.setFillColor(...C.white)
  doc.roundedRect(BX, startY, BW, BH, 8, 8, 'F')
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.4)
  doc.roundedRect(BX, startY, BW, BH, 8, 8)

  const boxCenter  = startY + BH / 2
  const totalTextH = (lines.length - 1) * 8
  lines.forEach((line, i) => {
    const y = boxCenter - totalTextH / 2 + i * 8
    doc.setTextColor(...C.accent)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(line.big ? 12 : 9)
    doc.text(line.label, BX + 6, y)
    doc.setFontSize(line.big ? 13 : 9)
    doc.text(line.value, BX + BW - 6, y, { align: 'right' })
  })

  return startY + BH + 6
}

/**
 * Pie de página: línea navy, logo admin circular a la izquierda,
 * datos del administrador en dos columnas.
 * logoAdminB64: string base64 (circular cropped) | null
 */
function addFooter(doc, pageWidth, pageHeight, footer, logoAdminB64) {
  const FY = pageHeight - 50
  const FX = 14

  // Línea separadora
  doc.setDrawColor(...C.dark)
  doc.setLineWidth(0.5)
  doc.line(FX, FY + 5, pageWidth - FX, FY + 5)

  const LOGO_SIZE = 22
  let col1X = FX + 6

  // Logo administrador circular a la izquierda.
  // Colocá logo-admin.png en public/ para que aparezca aquí.
  if (logoAdminB64) {
    try {
      doc.addImage(logoAdminB64, 'PNG', FX + 6, FY + 9, LOGO_SIZE, LOGO_SIZE, '', 'FAST')
      col1X = FX + 6 + LOGO_SIZE + 6
    } catch { /* omitir si falla */ }
  }

  const col2X = pageWidth / 2 + 8

  // Nombre del administrador
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.textDark)
  doc.text(footer.administrador || '', col1X, FY + 14)

  // Columna 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const left = [
    ['CUIT',  footer.cuit],
    ['Tel',   footer.telefono],
    ['Email', footer.email],
  ]
  left.forEach(([lbl, val], i) => {
    const y = FY + 22 + i * 7
    doc.setTextColor(...C.textSec)
    doc.text(`${lbl}: `, col1X, y)
    doc.setTextColor(...C.textDark)
    doc.text(val || '', col1X + doc.getTextWidth(`${lbl}: `), y)
  })

  // Columna 2
  const right = [
    ['CBU',   footer.cbu],
    ['Alias', footer.alias],
    ['Pago',  footer.mediosDePago],
  ]
  right.forEach(([lbl, val], i) => {
    const y = FY + 22 + i * 7
    doc.setTextColor(...C.textSec)
    doc.text(`${lbl}: `, col2X, y)
    doc.setTextColor(...C.textDark)
    const maxW = pageWidth - FX - col2X - doc.getTextWidth(`${lbl}: `) - 4
    const wrapped = doc.splitTextToSize(val || '', maxW)
    doc.text(wrapped[0] || '', col2X + doc.getTextWidth(`${lbl}: `), y)
  })
}

/** Opciones comunes de tabla para los 3 PDFs. */
function tableOptions(extraOpts = {}) {
  return {
    theme: 'plain',
    headStyles: {
      fillColor:   C.dark,
      textColor:   C.white,
      fontStyle:   'bold',
      fontSize:    7,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor:   C.white,
      textColor:   C.textDark,
      fontSize:    7.5,
      lineColor:   C.border,
      lineWidth:   0.1,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: C.rowAlt },
    tableLineColor:  C.border,
    tableLineWidth:  0.1,
    ...extraOpts,
  }
}

// ── PDF Inquilino ─────────────────────────────────────────────────────────────
export async function generateInquilinoPDF(inquilino, periodo, gastosGenerales, gastosParticulares, totalInquilinos) {
  const [footer, logoExpensas, logoAdminRaw] = await Promise.all([
    resolveFooter(),
    loadImageWithDimensions('/expensas-plus/logo-expensas.png'),
    loadImageWithDimensions('/expensas-plus/logo-admin.png'),
  ])
  const logoAdminB64 = logoAdminRaw
    ? await circularCrop(logoAdminRaw.b64)
    : null

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 55

  let currentY = addHeader(
    doc, pageWidth, logoExpensas,
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
      inquilino.departamento,
      ...domLines,
    ]
  )

  const opts = tableOptions()

  // ── Cargos generales
  if (gastosGenerales.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('CARGOS GENERALES', 14, currentY)
    currentY += 5

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['SERVICIO', 'EMPRESA', 'FACTURA N°', 'VENCIMIENTO', 'TOTAL', 'SU PARTE']],
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

  // ── Cargos particulares
  if (gastosParticulares.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('CARGOS PARTICULARES', 14, currentY)
    currentY += 5

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['SERVICIO', 'EMPRESA', 'FACTURA N°', 'VENCIMIENTO', 'IMPORTE']],
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

  // ── Total
  const totGen = gastosGenerales.reduce((s, g)    => s + Number(g.importe) / totalInquilinos, 0)
  const totPar = gastosParticulares.reduce((s, g)  => s + Number(g.importe), 0)
  addTotalBox(doc, pageWidth, currentY, [
    { label: 'TOTAL A PAGAR', value: formatCurrency(totGen + totPar), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, logoAdminB64)
  doc.save(`Expensas_${inquilino.apellido}_${inquilino.nombre}_${periodo}.pdf`)
}

// ── PDF Historial ─────────────────────────────────────────────────────────────
export async function generateHistorialPDF(periodo, gastos, inquilinos, serviciosMap) {
  const [footer, logoExpensas, logoAdminRaw] = await Promise.all([
    resolveFooter(),
    loadImageWithDimensions('/expensas-plus/logo-expensas.png'),
    loadImageWithDimensions('/expensas-plus/logo-admin.png'),
  ])
  const logoAdminB64 = logoAdminRaw
    ? await circularCrop(logoAdminRaw.b64)
    : null

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 55
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED

  let currentY = addHeader(
    doc, pageWidth, logoExpensas,
    'Detalle Completo de Período',
    `Período: ${formatPeriodo(periodo)}`,
    `Fecha: ${new Date().toLocaleDateString('es-AR')}`
  )

  const opts        = tableOptions()
  const generales   = gastos.filter(g => g.tipo === 'general')
  const particulares = gastos.filter(g => g.tipo === 'particular')
  const suParte      = importe => formatCurrency(importe / (inquilinos.length || 1))

  // ── Cargos generales
  if (generales.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('CARGOS GENERALES', 14, currentY)
    currentY += 5

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['SERVICIO', 'EMPRESA', 'FACTURA N°', 'VENCIMIENTO', 'IMPORTE TOTAL', 'INQUILINO', 'SU PARTE']],
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

  // ── Cargos particulares
  if (particulares.length > 0) {
    if (currentY + 20 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text('CARGOS PARTICULARES', 14, currentY)
    currentY += 5

    autoTable(doc, {
      ...opts,
      startY: currentY,
      head: [['INQUILINO', 'SERVICIO', 'EMPRESA', 'FACTURA N°', 'VENCIMIENTO', 'IMPORTE']],
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

  // ── Totales
  if (currentY + 34 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

  const totGen = generales.reduce((s, g)    => s + Number(g.importe), 0)
  const totPar = particulares.reduce((s, g)  => s + Number(g.importe), 0)
  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total Cargos Generales',    value: formatCurrency(totGen) },
    { label: 'Total Cargos Particulares', value: formatCurrency(totPar) },
    { label: 'TOTAL PERÍODO',             value: formatCurrency(totGen + totPar), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, logoAdminB64)
  doc.save(`Historial de Expensas_${formatPeriodo(periodo).replace(' ', '_')}.pdf`)
}

// ── PDF Estado de Cuenta ──────────────────────────────────────────────────────
// filas: [{ periodo, expensas, alquiler, mora, tiempoMora, estado, total, fechaPago }]
export async function generateEstadoCuentaPDF(inquilino, filas) {
  const [footer, logoExpensas, logoAdminRaw] = await Promise.all([
    resolveFooter(),
    loadImageWithDimensions('/expensas-plus/logo-expensas.png'),
    loadImageWithDimensions('/expensas-plus/logo-admin.png'),
  ])
  const logoAdminB64 = logoAdminRaw
    ? await circularCrop(logoAdminRaw.b64)
    : null

  const doc        = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 55
  const CONTENT_BOTTOM  = pageHeight - FOOTER_RESERVED
  const fc = n => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  let currentY = addHeader(
    doc, pageWidth, logoExpensas,
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
        ? `$${Number(inquilino.precioAlquiler).toLocaleString('es-AR')}`
        : '-',
      inquilino.cicloActualizacion ? `Ciclo: ${inquilino.cicloActualizacion}` : '',
    ].filter(Boolean)
  )

  // Tabla con badges de estado coloreados
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
    head: [['PERÍODO', 'EXPENSAS', 'ALQUILER', 'MORA', 'TOTAL', 'ESTADO', 'FECHA PAGO']],
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
  if (currentY + 38 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }

  addTotalBox(doc, pageWidth, currentY, [
    { label: 'Total expensas', value: fc(filas.reduce((s, f) => s + f.expensas, 0)) },
    { label: 'Total alquiler', value: fc(filas.reduce((s, f) => s + f.alquiler, 0)) },
    { label: 'Total mora',     value: fc(filas.reduce((s, f) => s + f.mora,     0)) },
    { label: 'TOTAL',          value: fc(filas.reduce((s, f) => s + f.total,    0)), big: true },
  ])

  addFooter(doc, pageWidth, pageHeight, footer, logoAdminB64)

  const hoy = new Date()
  const mes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'][hoy.getMonth()]
  doc.save(`Estado de Cuenta_${inquilino.apellido}_${inquilino.nombre}_${mes}_${hoy.getFullYear()}.pdf`)
}
