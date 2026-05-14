import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from 'docx'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const PUBLIC     = join(__dirname, '..', 'public')

const FONT       = 'Calibri'
const SZ         = 20   // 10pt
const SZ_SM      = 16   // 8pt
const SZ_LG      = 24   // 12pt
const SZ_TITLE   = 32   // 16pt

const C_HEADER   = '1A3A6B'   // azul oscuro cabeceras
const C_SUBHEAD  = '2E6DA4'   // azul medio sub-cabeceras
const C_ALT      = 'EBF3FA'   // azul muy claro filas alternas
const C_WHITE    = 'FFFFFF'
const C_TOTAL    = 'D0E4F3'   // azul claro totales

const BORDER_NONE   = { style: BorderStyle.NONE,   size: 0, color: C_WHITE }
const BORDER_THIN   = { style: BorderStyle.SINGLE,  size: 4, color: '999999' }
const BORDER_MED    = { style: BorderStyle.SINGLE,  size: 8, color: '666666' }
const NO_BORDERS    = { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE }
const ALL_BORDERS   = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
const BOTTOM_ONLY   = { top: BORDER_NONE, bottom: BORDER_MED,  left: BORDER_NONE, right: BORDER_NONE }

const CECO_MAP = {
  '324P0894': 'CJD-Foundation (324P0894)',
  '324P0862': 'PN-2025 (324P0862)',
  '324P0887': '2026 Proof-of-Concept (324P0887)',
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function t(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
}

function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    alignment:   opts.align ?? AlignmentType.LEFT,
    spacing:     { before: opts.before ?? 60, after: opts.after ?? 60 },
    shading:     opts.shading,
  })
}

function blank(space = 80) {
  return new Paragraph({ children: [t('')], spacing: { before: space, after: space } })
}

function sectionTitle(label) {
  return new Paragraph({
    children: [t(label, { bold: true, size: SZ_LG, color: C_HEADER })],
    spacing:  { before: 200, after: 80 },
    border:   { bottom: { style: BorderStyle.SINGLE, size: 8, color: C_HEADER } },
  })
}

// ── Number helpers ────────────────────────────────────────────────────────────

function toNum(val) {
  return parseFloat(String(val).replace(',', '.')) || 0
}

function eur(val) {
  const n = toNum(val)
  return n.toFixed(2).replace('.', ',') + ' €'
}

function sumConIva(items) {
  return items.reduce((acc, it) => acc + toNum(it.conIva ?? 0), 0)
}

function kmTotal(item) {
  return (toNum(item.kmIda) + toNum(item.kmVuelta)) * toNum(item.precioPorKm ?? 0.29)
}

// ── Table builders ────────────────────────────────────────────────────────────

function cell(text, opts = {}) {
  const {
    bold = false, color = null, bg = null, align = AlignmentType.LEFT,
    size = SZ, span = 1, width = null,
  } = opts
  const run = new TextRun({ text: String(text ?? ''), font: FONT, size, bold, color: color || undefined })
  return new TableCell({
    children: [new Paragraph({
      children:  [run],
      alignment: align,
      spacing:   { before: 40, after: 40 },
    })],
    borders:  ALL_BORDERS,
    shading:  bg ? { fill: bg, type: 'clear', color: 'auto' } : undefined,
    margins:  { top: 50, bottom: 50, left: 80, right: 80 },
    columnSpan: span,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  })
}

function headerCell(text, opts = {}) {
  return cell(text, { bold: true, color: C_WHITE, bg: C_HEADER, ...opts })
}

function subHeaderCell(text, opts = {}) {
  return cell(text, { bold: true, color: C_WHITE, bg: C_SUBHEAD, size: SZ_SM, ...opts })
}

function totalCell(text, opts = {}) {
  return cell(text, { bold: true, bg: C_TOTAL, ...opts })
}

function row(cells, isAlt = false) {
  return new TableRow({
    children: cells.map((c, i) => {
      if (c instanceof TableCell) return c
      return cell(c, { bg: isAlt ? C_ALT : C_WHITE })
    }),
  })
}

// ── Ticket table (autopista, avion, tren, autobus, parking, otros-transport) ──

function ticketTable(items, label) {
  if (!items || items.length === 0) return null
  const total = sumConIva(items)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [headerCell(label, { span: 4 })] }),
      new TableRow({
        children: [
          subHeaderCell('Descripción'),
          subHeaderCell('Fecha'),
          subHeaderCell('Importe s/IVA', { align: AlignmentType.RIGHT }),
          subHeaderCell('Importe c/IVA', { align: AlignmentType.RIGHT }),
        ],
      }),
      ...items.map((it, i) => new TableRow({
        children: [
          cell(it.nombre || '—',                        { bg: i % 2 ? C_ALT : C_WHITE }),
          cell(formatDate(it.fecha),                    { bg: i % 2 ? C_ALT : C_WHITE }),
          cell(eur(it.sinIva), { align: AlignmentType.RIGHT, bg: i % 2 ? C_ALT : C_WHITE }),
          cell(eur(it.conIva), { align: AlignmentType.RIGHT, bg: i % 2 ? C_ALT : C_WHITE }),
        ],
      })),
      new TableRow({
        children: [
          totalCell('TOTAL', { span: 3 }),
          totalCell(eur(total), { align: AlignmentType.RIGHT }),
        ],
      }),
    ],
  })
}

function cocheTable(items) {
  if (!items || items.length === 0) return null
  const total = items.reduce((acc, it) => acc + kmTotal(it), 0)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [headerCell('VEHÍCULO PROPIO', { span: 6 })] }),
      new TableRow({
        children: [
          subHeaderCell('Desde'),
          subHeaderCell('Hasta'),
          subHeaderCell('Km ida'),
          subHeaderCell('Km vuelta'),
          subHeaderCell('€/km'),
          subHeaderCell('Total'),
        ],
      }),
      ...items.map((it, i) => {
        const bg = i % 2 ? C_ALT : C_WHITE
        return new TableRow({
          children: [
            cell(it.desde    || '—', { bg }),
            cell(it.hasta    || '—', { bg }),
            cell(toNum(it.kmIda).toString(),    { align: AlignmentType.RIGHT, bg }),
            cell(toNum(it.kmVuelta).toString(), { align: AlignmentType.RIGHT, bg }),
            cell(toNum(it.precioPorKm ?? 0.29).toFixed(2) + ' €', { align: AlignmentType.RIGHT, bg }),
            cell(eur(kmTotal(it)),  { align: AlignmentType.RIGHT, bg }),
          ],
        })
      }),
      new TableRow({
        children: [
          totalCell('TOTAL', { span: 5 }),
          totalCell(eur(total), { align: AlignmentType.RIGHT }),
        ],
      }),
    ],
  })
}

function manutencionTable(items) {
  if (!items || items.length === 0) return null
  const total = sumConIva(items)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [headerCell('MANUTENCIÓN', { span: 5 })] }),
      new TableRow({
        children: [
          subHeaderCell('Tipo'),
          subHeaderCell('Establecimiento / Lugar'),
          subHeaderCell('Fecha'),
          subHeaderCell('Importe s/IVA', { align: AlignmentType.RIGHT }),
          subHeaderCell('Importe c/IVA', { align: AlignmentType.RIGHT }),
        ],
      }),
      ...items.map((it, i) => {
        const bg = i % 2 ? C_ALT : C_WHITE
        return new TableRow({
          children: [
            cell(capitalizeFirst(it.tipo || '—'), { bg }),
            cell(it.nombre || it.lugar || '—', { bg }),
            cell(formatDate(it.fecha), { bg }),
            cell(eur(it.sinIva), { align: AlignmentType.RIGHT, bg }),
            cell(eur(it.conIva), { align: AlignmentType.RIGHT, bg }),
          ],
        })
      }),
      new TableRow({
        children: [
          totalCell('TOTAL', { span: 4 }),
          totalCell(eur(total), { align: AlignmentType.RIGHT }),
        ],
      }),
    ],
  })
}

function hotelTable(items) {
  if (!items || items.length === 0) return null
  const total = sumConIva(items)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [headerCell('ALOJAMIENTO', { span: 5 })] }),
      new TableRow({
        children: [
          subHeaderCell('Hotel / Alojamiento'),
          subHeaderCell('Check-in'),
          subHeaderCell('Check-out'),
          subHeaderCell('Importe s/IVA', { align: AlignmentType.RIGHT }),
          subHeaderCell('Importe c/IVA', { align: AlignmentType.RIGHT }),
        ],
      }),
      ...items.map((it, i) => {
        const bg = i % 2 ? C_ALT : C_WHITE
        return new TableRow({
          children: [
            cell(it.nombre || '—', { bg }),
            cell(formatDate(it.fechaCheckin), { bg }),
            cell(formatDate(it.fecha || it.fechaCheckout), { bg }),
            cell(eur(it.sinIva), { align: AlignmentType.RIGHT, bg }),
            cell(eur(it.conIva), { align: AlignmentType.RIGHT, bg }),
          ],
        })
      }),
      new TableRow({
        children: [
          totalCell('TOTAL', { span: 4 }),
          totalCell(eur(total), { align: AlignmentType.RIGHT }),
        ],
      }),
    ],
  })
}

function otrosTable(items) {
  if (!items || items.length === 0) return null
  const total = sumConIva(items)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [headerCell('OTROS GASTOS', { span: 4 })] }),
      new TableRow({
        children: [
          subHeaderCell('Descripción'),
          subHeaderCell('Fecha'),
          subHeaderCell('Importe s/IVA', { align: AlignmentType.RIGHT }),
          subHeaderCell('Importe c/IVA', { align: AlignmentType.RIGHT }),
        ],
      }),
      ...items.map((it, i) => {
        const bg = i % 2 ? C_ALT : C_WHITE
        const desc = [it.tipo, it.descripcion].filter(Boolean).join(' – ') || '—'
        return new TableRow({
          children: [
            cell(desc, { bg }),
            cell(formatDate(it.fecha), { bg }),
            cell(eur(it.sinIva), { align: AlignmentType.RIGHT, bg }),
            cell(eur(it.conIva), { align: AlignmentType.RIGHT, bg }),
          ],
        })
      }),
      new TableRow({
        children: [
          totalCell('TOTAL', { span: 3 }),
          totalCell(eur(total), { align: AlignmentType.RIGHT }),
        ],
      }),
    ],
  })
}

// ── Date formatter ────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return d
  }
}

function capitalizeFirst(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateGastosViaje(viaje) {
  const {
    nombre       = '',
    fechaInicio  = '',
    fechaFin     = '',
    logoCustom   = null,
    ceco         = '',
    transporte   = {},
    manutencion  = [],
    hotel        = [],
    otros        = [],
  } = viaje

  // ── Load images ──────────────────────────────────────────────────────────────
  let logoBuffer = null
  if (logoCustom && logoCustom.startsWith('data:')) {
    const b64 = logoCustom.replace(/^data:[^;]+;base64,/, '')
    logoBuffer = Buffer.from(b64, 'base64')
  } else {
    const defaultPath = join(PUBLIC, 'logos', 'animalario', 'cicbiogune.png')
    if (existsSync(defaultPath)) logoBuffer = readFileSync(defaultPath)
  }

  const sigPath = join(PUBLIC, 'firmas', 'Jokin.png')
  const sigBuffer = existsSync(sigPath) ? readFileSync(sigPath) : null

  // ── Totals ───────────────────────────────────────────────────────────────────
  const tr = transporte
  const tAutopista = sumConIva(tr.autopista || [])
  const tCoche     = (tr.coche || []).reduce((acc, it) => acc + kmTotal(it), 0)
  const tAvion     = sumConIva(tr.avion    || [])
  const tTren      = sumConIva(tr.tren     || [])
  const tAutobus   = sumConIva(tr.autobus  || [])
  const tParking   = sumConIva(tr.parking  || [])
  const tOtrosTr   = sumConIva(tr.otros    || [])
  const tTransporte = tAutopista + tCoche + tAvion + tTren + tAutobus + tParking + tOtrosTr
  const tManutencion = sumConIva(manutencion)
  const tHotel       = sumConIva(hotel)
  const tOtros       = sumConIva(otros)
  const tTotal       = tTransporte + tManutencion + tHotel + tOtros

  const fechasStr = fechaFin
    ? `${formatDate(fechaInicio)} – ${formatDate(fechaFin)}`
    : formatDate(fechaInicio)

  const cecoLabel = CECO_MAP[ceco] || ceco || '—'

  // ── Build doc children ────────────────────────────────────────────────────────
  const children = []

  // Header: logo + title
  children.push(
    new Paragraph({
      children: logoBuffer
        ? [new ImageRun({ data: logoBuffer, transformation: { width: 155, height: 56 }, type: 'png' })]
        : [t('CIC bioGUNE', { bold: true, size: SZ_LG })],
      spacing: { before: 0, after: 200 },
    }),
    new Paragraph({
      children: [t('INFORME DE GASTOS DE VIAJE', { bold: true, size: SZ_TITLE, color: C_HEADER })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    blank(80),
  )

  // Info table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            cell('Concepto / Destino:', { bold: true, bg: C_ALT }),
            cell(nombre || '—', { span: 3 }),
          ],
        }),
        new TableRow({
          children: [
            cell('Fecha(s) del viaje:', { bold: true, bg: C_ALT }),
            cell(fechasStr),
            cell('CeCO:', { bold: true, bg: C_ALT }),
            cell(cecoLabel),
          ],
        }),
        new TableRow({
          children: [
            cell('Firmante:', { bold: true, bg: C_ALT }),
            cell('Joaquín Castilla', { span: 3 }),
          ],
        }),
      ],
    }),
    blank(120),
  )

  // Resumen table
  const resumenRows = []
  const addResumenRow = (label, val) => {
    if (val > 0) resumenRows.push(new TableRow({
      children: [
        cell(label, { bg: C_ALT }),
        cell(eur(val), { align: AlignmentType.RIGHT, bg: C_ALT }),
      ],
    }))
  }
  if (tAutopista > 0) addResumenRow('Transporte — Autopistas / Peajes', tAutopista)
  if (tCoche     > 0) addResumenRow('Transporte — Vehículo propio', tCoche)
  if (tAvion     > 0) addResumenRow('Transporte — Avión', tAvion)
  if (tTren      > 0) addResumenRow('Transporte — Tren', tTren)
  if (tAutobus   > 0) addResumenRow('Transporte — Autobús', tAutobus)
  if (tParking   > 0) addResumenRow('Transporte — Parking', tParking)
  if (tOtrosTr   > 0) addResumenRow('Transporte — Otros', tOtrosTr)
  if (tManutencion > 0) addResumenRow('Manutención', tManutencion)
  if (tHotel       > 0) addResumenRow('Alojamiento', tHotel)
  if (tOtros       > 0) addResumenRow('Otros gastos', tOtros)

  if (resumenRows.length > 0) {
    children.push(
      sectionTitle('RESUMEN'),
      blank(40),
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [headerCell('Concepto'), headerCell('Importe (IVA incl.)', { align: AlignmentType.RIGHT })] }),
          ...resumenRows,
          new TableRow({
            children: [
              totalCell('TOTAL GENERAL', { bold: true, size: SZ_LG }),
              totalCell(eur(tTotal), { bold: true, size: SZ_LG, align: AlignmentType.RIGHT }),
            ],
          }),
        ],
      }),
      blank(160),
    )
  }

  // ── Detalle: Transporte ───────────────────────────────────────────────────────
  const hasTransporte = tTransporte > 0
  if (hasTransporte) {
    children.push(sectionTitle('DETALLE DE TRANSPORTE'))

    const autopistaTbl = ticketTable(tr.autopista, 'AUTOPISTAS / PEAJES')
    const cocheTbl     = cocheTable(tr.coche)
    const avionTbl     = ticketTable(tr.avion, 'AVIÓN')
    const trenTbl      = ticketTable(tr.tren, 'TREN')
    const autobusTbl   = ticketTable(tr.autobus, 'AUTOBÚS')
    const parkingTbl   = ticketTable(tr.parking, 'PARKING')
    const otrosTrTbl   = ticketTable(tr.otros, 'OTROS TRANSPORTES')

    for (const tbl of [autopistaTbl, cocheTbl, avionTbl, trenTbl, autobusTbl, parkingTbl, otrosTrTbl]) {
      if (tbl) { children.push(tbl); children.push(blank(80)) }
    }
  }

  // ── Detalle: Manutención ──────────────────────────────────────────────────────
  if (tManutencion > 0) {
    children.push(sectionTitle('DETALLE DE MANUTENCIÓN'))
    children.push(manutencionTable(manutencion))
    children.push(blank(80))
  }

  // ── Detalle: Hotel ────────────────────────────────────────────────────────────
  if (tHotel > 0) {
    children.push(sectionTitle('DETALLE DE ALOJAMIENTO'))
    children.push(hotelTable(hotel))
    children.push(blank(80))
  }

  // ── Detalle: Otros ────────────────────────────────────────────────────────────
  if (tOtros > 0) {
    children.push(sectionTitle('OTROS GASTOS'))
    children.push(otrosTable(otros))
    children.push(blank(80))
  }

  // ── Signature ─────────────────────────────────────────────────────────────────
  children.push(
    blank(120),
    new Paragraph({
      children: [t(`Derio, a ${formatDate(fechaFin || fechaInicio || new Date().toISOString().split('T')[0])}`)],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 60, after: 200 },
    }),
    new Table({
      width: { size: 45, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          height: { value: 1100, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              children: [new Paragraph({
                children: sigBuffer
                  ? [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })]
                  : [t('')],
                spacing: { before: 80, after: 80 },
              })],
              borders:  BOTTOM_ONLY,
              margins:  { top: 70, bottom: 70, left: 0, right: 0 },
              verticalAlign: VerticalAlign.BOTTOM,
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                p([t('Joaquín Castilla', { bold: true })],         { before: 40, after: 20 }),
                p([t('Ikerbasque Research Professor', { size: SZ_SM })], { before: 0, after: 0 }),
                p([t('CIC bioGUNE', { size: SZ_SM })],             { before: 0, after: 0 }),
              ],
              borders: NO_BORDERS,
              margins: { top: 70, bottom: 70, left: 0, right: 0 },
            }),
          ],
        }),
      ],
    }),
  )

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.0),
            bottom: convertInchesToTwip(1.0),
            left:   convertInchesToTwip(1.18),
            right:  convertInchesToTwip(1.18),
          },
        },
      },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
