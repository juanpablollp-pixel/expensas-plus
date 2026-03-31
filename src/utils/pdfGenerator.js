import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_FOOTER as PDF_FOOTER_DEFAULT } from '../pdfConfig'
import { getAdminConfig } from '../db'

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

function addFooter(doc, pageWidth, pageHeight, footer) {
  const footerY = pageHeight - 52
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.5)
  doc.line(14, footerY, pageWidth - 14, footerY)

  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)

  const col1X = 14
  const col2X = pageWidth / 2 + 10

  doc.setFont('helvetica', 'bold')
  doc.text('Datos de pago:', col1X, footerY + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`Administrador: ${footer.administrador}`, col1X, footerY + 12)
  doc.text(`CUIT: ${footer.cuit}`, col1X, footerY + 18)
  doc.text(`Tel: ${footer.telefono}`, col1X, footerY + 24)
  doc.text(`Email: ${footer.email}`, col1X, footerY + 30)

  doc.text(`CBU: ${footer.cbu}`, col2X, footerY + 12)
  doc.text(`Alias: ${footer.alias}`, col2X, footerY + 18)
  doc.text(`Medios de pago: ${footer.mediosDePago}`, col2X, footerY + 24)
}

function addHeader(doc, pageWidth, inquilino, periodo) {
  // LOGO: Para agregar un logo, descomentá las siguientes líneas
  // y reemplazá 'BASE64_IMAGE_DATA' con el base64 de tu imagen:
  // const logoBase64 = 'BASE64_IMAGE_DATA'
  // doc.addImage(logoBase64, 'PNG', 14, 10, 40, 20)

  // Caja de encabezado
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 32, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('ExpensasPlus', 14, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Liquidación de Expensas', 14, 22)

  doc.setFontSize(10)
  doc.text(`Período: ${formatPeriodo(periodo)}`, pageWidth - 14, 14, { align: 'right' })
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 14, 22, { align: 'right' })

  // Datos del inquilino
  const BOX_TOP = 38
  const LINE_H = 5.5  // mm entre líneas de texto
  const col2 = pageWidth / 2 + 14
  const col2MaxWidth = pageWidth - 18 - col2  // hasta el borde derecho (margen 14 + padding 4)

  // Pre-calcular el wrap del domicilio ANTES de dibujar el recuadro
  doc.setFontSize(9)
  const domicilioLines = inquilino.domicilio
    ? doc.splitTextToSize(`Domicilio Fiscal: ${inquilino.domicilio}`, col2MaxWidth)
    : []

  // Altura dinámica: base para título + nombre + DNI (3 filas = ~21mm + 3 padding)
  // Cada línea extra de domicilio suma LINE_H
  const extraLines = Math.max(0, domicilioLines.length - 1)
  const BOX_HEIGHT = 24 + extraLines * LINE_H

  // Dibujar recuadro con altura ajustada
  doc.setFillColor(239, 246, 255)
  doc.rect(14, BOX_TOP, pageWidth - 28, BOX_HEIGHT, 'F')
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.3)
  doc.rect(14, BOX_TOP, pageWidth - 28, BOX_HEIGHT)

  // Columna izquierda: INQUILINO
  doc.setFontSize(9)
  doc.setTextColor(37, 99, 235)
  doc.setFont('helvetica', 'bold')
  doc.text('INQUILINO', 18, BOX_TOP + 8)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.text(`${inquilino.nombre} ${inquilino.apellido}`, 18, BOX_TOP + 15)
  doc.text(`DNI/CUIT: ${inquilino.dni}`, 18, BOX_TOP + 21)

  // Columna derecha: UNIDAD
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text('UNIDAD', col2, BOX_TOP + 8)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.text(`Depto: ${inquilino.departamento}`, col2, BOX_TOP + 15)
  if (domicilioLines.length > 0) {
    doc.text(domicilioLines, col2, BOX_TOP + 21)
  }

  // Retornar la Y donde debe comenzar el contenido siguiente
  return BOX_TOP + BOX_HEIGHT + 8
}

export async function generateInquilinoPDF(inquilino, periodo, gastosGenerales, gastosParticulares, totalInquilinos) {
  const footer = await resolveFooter()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let currentY = addHeader(doc, pageWidth, inquilino, periodo)

  // Tabla de cargos generales
  if (gastosGenerales.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 99, 235)
    doc.text('Cargos Generales', 14, currentY)
    currentY += 4

    const generalRows = gastosGenerales.map(g => [
      g.servicio,
      g.empresa,
      g.numeroFactura || '-',
      g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
      formatCurrency(g.importe),
      formatCurrency(g.importe / totalInquilinos)
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Total', 'Su parte']],
      body: generalRows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 36 },
        2: { cellWidth: 26 },
        3: { cellWidth: 28 },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Tabla de cargos particulares
  if (gastosParticulares.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('Cargos Particulares', 14, currentY)
    currentY += 4

    const particularRows = gastosParticulares.map(g => [
      g.servicio,
      g.empresa,
      g.numeroFactura || '-',
      g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
      formatCurrency(g.importe)
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Importe']],
      body: particularRows,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 62 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Total
  const totalGeneral = gastosGenerales.reduce((sum, g) => sum + Number(g.importe) / totalInquilinos, 0)
  const totalParticular = gastosParticulares.reduce((sum, g) => sum + Number(g.importe), 0)
  const totalAPagar = totalGeneral + totalParticular

  doc.setFillColor(37, 99, 235)
  doc.rect(pageWidth - 80, currentY - 2, 66, 14, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL A PAGAR:', pageWidth - 76, currentY + 5)
  doc.setFontSize(12)
  doc.text(formatCurrency(totalAPagar), pageWidth - 14, currentY + 5, { align: 'right' })

  addFooter(doc, pageWidth, pageHeight, footer)

  doc.save(`Expensas_${inquilino.apellido}_${inquilino.nombre}_${periodo}.pdf`)
}

export async function generateHistorialPDF(periodo, gastos, inquilinos, serviciosMap) {
  const footer = await resolveFooter()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Espacio reservado para el pie de página (52mm de alto + 8mm de margen)
  const FOOTER_RESERVED = 60
  const CONTENT_BOTTOM = pageHeight - FOOTER_RESERVED

  // Encabezado
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 32, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('ExpensasPlus', 14, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Detalle Completo de Período', 14, 22)
  doc.text(`Período: ${formatPeriodo(periodo)}`, pageWidth - 14, 14, { align: 'right' })
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 14, 22, { align: 'right' })

  let currentY = 42

  // Cargos Generales
  const generales = gastos.filter(g => g.tipo === 'general')
  if (generales.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 99, 235)
    doc.text('Cargos Generales', 14, currentY)
    currentY += 4

    const suParte = (importe) => formatCurrency(importe / (inquilinos.length || 1))
    const generalRows = generales.flatMap(g =>
      inquilinos.map(inq => [
        serviciosMap[g.servicioId] || g.servicioId,
        g.empresa,
        g.numeroFactura || '-',
        g.fechaVencimiento ? new Date(g.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-',
        formatCurrency(g.importe),
        `${inq.apellido}, ${inq.nombre}`,
        suParte(g.importe)
      ])
    )

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio', 'Empresa', 'Factura N°', 'Vencimiento', 'Importe Total', 'Inquilino', 'Su Parte']],
      body: generalRows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 38 },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED }
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Cargos Particulares
  const particulares = gastos.filter(g => g.tipo === 'particular')
  if (particulares.length > 0) {
    // Salto de página si no hay espacio para el título + al menos una fila
    if (currentY + 20 > CONTENT_BOTTOM) {
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('Cargos Particulares', 14, currentY)
    currentY += 4

    autoTable(doc, {
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
          formatCurrency(g.importe)
        ]
      }),
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVED }
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Totales finales — salto de página si no hay espacio (caja de 24mm + margen)
  if (currentY + 28 > CONTENT_BOTTOM) {
    doc.addPage()
    currentY = 20
  }

  const totalGenerales = generales.reduce((s, g) => s + Number(g.importe), 0)
  const totalParticulares = particulares.reduce((s, g) => s + Number(g.importe), 0)

  doc.setFillColor(245, 245, 245)
  doc.rect(14, currentY, pageWidth - 28, 20, 'F')
  doc.setDrawColor(200, 200, 200)
  doc.rect(14, currentY, pageWidth - 28, 20)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Total Cargos Generales: ${formatCurrency(totalGenerales)}`, 20, currentY + 7)
  doc.text(`Total Cargos Particulares: ${formatCurrency(totalParticulares)}`, 20, currentY + 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(37, 99, 235)
  doc.text(`TOTAL PERÍODO: ${formatCurrency(totalGenerales + totalParticulares)}`, pageWidth - 18, currentY + 11, { align: 'right' })

  addFooter(doc, pageWidth, pageHeight, footer)

  // Nombre: "Historial de Expensas_Mes_Año" — ej: "Historial de Expensas_Abril_2026"
  const nombrePeriodo = formatPeriodo(periodo).replace(' ', '_')
  doc.save(`Historial de Expensas_${nombrePeriodo}.pdf`)
}

// ── Estado de Cuenta ──────────────────────────────────────────────────────
// filas: [{ periodo, expensas, alquiler, mora, tiempoMora, estado, total, fechaPago }]
export async function generateEstadoCuentaPDF(inquilino, filas) {
  const footer = await resolveFooter()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const FOOTER_RESERVED = 60
  const CONTENT_BOTTOM = pageHeight - FOOTER_RESERVED

  const fc = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Encabezado
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 32, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('ExpensasPlus', 14, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Estado de Cuenta', 14, 22)
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 14, 22, { align: 'right' })

  // Datos del inquilino
  let currentY = 40
  doc.setFillColor(239, 246, 255)
  doc.rect(14, currentY, pageWidth - 28, 22, 'F')
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.3)
  doc.rect(14, currentY, pageWidth - 28, 22)

  doc.setFontSize(9)
  doc.setTextColor(37, 99, 235)
  doc.setFont('helvetica', 'bold')
  doc.text('INQUILINO', 18, currentY + 7)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.text(`${inquilino.apellido}, ${inquilino.nombre}`, 18, currentY + 13)
  doc.text(`Depto: ${inquilino.departamento}`, 18, currentY + 19)

  const col2 = pageWidth / 2 + 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text('ALQUILER', col2, currentY + 7)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'normal')
  if (inquilino.precioAlquiler) doc.text(`Precio: $${Number(inquilino.precioAlquiler).toLocaleString('es-AR')}`, col2, currentY + 13)
  if (inquilino.cicloActualizacion) doc.text(`Ciclo: ${inquilino.cicloActualizacion}`, col2, currentY + 19)

  currentY += 30

  // Tabla de períodos
  const rows = filas.map(f => [
    formatPeriodo(f.periodo),
    fc(f.expensas),
    fc(f.alquiler),
    f.mora > 0 ? `${fc(f.mora)}${f.tiempoMora ? `\n${f.tiempoMora}` : ''}` : '—',
    fc(f.total),
    f.estado === 'pagado' ? 'Pagado' : f.estado === 'impago' ? 'Impago' : 'Pendiente',
    f.fechaPago ? new Date(f.fechaPago).toLocaleDateString('es-AR') : '—'
  ])

  autoTable(doc, {
    startY: currentY,
    head: [['Período', 'Expensas', 'Alquiler', 'Mora', 'Total', 'Estado', 'Fecha Pago']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 26, halign: 'right' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 24, halign: 'center' }
    },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const val = data.cell.raw
        if (val === 'Pagado') data.cell.styles.textColor = [22, 163, 74]
        else if (val === 'Impago') data.cell.styles.textColor = [220, 38, 38]
        else data.cell.styles.textColor = [100, 116, 139]
      }
    },
    margin: { left: 14, right: 14, bottom: FOOTER_RESERVED }
  })
  currentY = doc.lastAutoTable.finalY + 8

  // Totales
  if (currentY + 20 > CONTENT_BOTTOM) { doc.addPage(); currentY = 20 }
  const totExp = filas.reduce((s, f) => s + f.expensas, 0)
  const totAlq = filas.reduce((s, f) => s + f.alquiler, 0)
  const totMora = filas.reduce((s, f) => s + f.mora, 0)
  const totTotal = filas.reduce((s, f) => s + f.total, 0)

  doc.setFillColor(245, 245, 245)
  doc.rect(14, currentY, pageWidth - 28, 18, 'F')
  doc.setDrawColor(200, 200, 200)
  doc.rect(14, currentY, pageWidth - 28, 18)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Total expensas: ${fc(totExp)}`, 18, currentY + 7)
  doc.text(`Total alquiler: ${fc(totAlq)}`, 18, currentY + 13)
  doc.text(`Total mora: ${fc(totMora)}`, pageWidth / 2, currentY + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(37, 99, 235)
  doc.text(`TOTAL: ${fc(totTotal)}`, pageWidth - 18, currentY + 11, { align: 'right' })

  addFooter(doc, pageWidth, pageHeight, footer)

  // Nombre: "Estado de Cuenta_NombreApellido_Mes_Año"
  const hoy = new Date()
  const mesActual = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'][hoy.getMonth()]
  doc.save(`Estado de Cuenta_${inquilino.apellido}_${inquilino.nombre}_${mesActual}_${hoy.getFullYear()}.pdf`)
}
