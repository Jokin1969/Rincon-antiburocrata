import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
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
const __dirname = dirname(__filename)
const ASSETS = join(__dirname, '..', 'public', 'assets')

// ── Fixed configuration — editar aquí para personalizar ───────────────────────
const CONFIG = {
  centro:   'CIC bioGUNE — [placeholder: unidad/departamento]',
  firmante: 'Joaquín Castilla',
  cargo:    'Ikerbasque Research Professor — [placeholder: cargo completo]',
}

// ── Design constants ──────────────────────────────────────────────────────────
const FONT      = 'Calibri'
const SIZE      = 20   // half-points → 10 pt
const SIZE_SM   = 16   // 8 pt
const SIZE_LG   = 24   // 12 pt
const SIZE_TITLE = 32  // 16 pt

const BORDER_SINGLE = { style: BorderStyle.SINGLE, size: 1, color: '000000' }
const ALL_BORDERS = {
  top:    BORDER_SINGLE,
  bottom: BORDER_SINGLE,
  left:   BORDER_SINGLE,
  right:  BORDER_SINGLE,
}
const NO_BORDERS = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const CELL_MARGIN = { top: 70, bottom: 70, left: 110, right: 110 }
const GRAY_FILL   = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts })
}

function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    alignment: opts.alignment,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80 },
  })
}

function emptyLine() {
  return new Paragraph({ children: [t('')], spacing: { before: 20, after: 20 } })
}

function makeCell(paragraphs, opts = {}) {
  return new TableCell({
    children: paragraphs,
    borders:       opts.borders       ?? ALL_BORDERS,
    shading:       opts.shading,
    columnSpan:    opts.columnSpan,
    rowSpan:       opts.rowSpan,
    width:         opts.width,
    verticalAlign: opts.verticalAlign ?? VerticalAlign.TOP,
    margins:       opts.margins       ?? CELL_MARGIN,
  })
}

function labelCell(text, widthPct = 36) {
  return makeCell([p(text)], {
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  })
}

function valueCell(content, bold = false) {
  const children = typeof content === 'string'
    ? [p([t(content, { bold })])]
    : content
  return makeCell(children)
}

function sectionHeaderRow(label, colSpan = 2) {
  return new TableRow({
    children: [
      makeCell(
        [p([t(label, { bold: true })])],
        { columnSpan: colSpan, shading: GRAY_FILL }
      ),
    ],
  })
}

function dataRow(label, content, bold = false) {
  return new TableRow({
    children: [labelCell(label), valueCell(content, bold)],
  })
}

function multilineCell(text) {
  const lines = (text || '—').split('\n').map(line => p([t(line.trim() || '')]))
  return makeCell(lines.length > 0 ? lines : [p('')])
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateContratoMenor(data) {
  const {
    codigo             = '',
    objeto             = '',
    justificacionNecesidad = '',
    tipoJustificacion  = '',
    centroCoste        = '',
    proveedores        = [],
    justificacionEleccion = '',
    plazo              = '',
    importe            = '',
    fecha              = new Date().toISOString().split('T')[0],
  } = data

  // Format date in Spanish
  const formattedDate = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  })

  // Format importe
  const importeFormatted = importe !== '' && importe !== null
    ? parseFloat(importe).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' €'
    : '—'

  // Load assets
  let logoBuffer = null
  let sigBuffer  = null
  const logoPath = join(ASSETS, 'logo-cicbiogune.png')
  const sigPath  = join(ASSETS, 'firma-jokin.png')
  if (existsSync(logoPath)) logoBuffer = readFileSync(logoPath)
  if (existsSync(sigPath))  sigBuffer  = readFileSync(sigPath)

  // Filter non-empty provider rows
  const filledProveedores = proveedores.filter(
    prov => prov.nombre?.trim() || prov.cif?.trim() || prov.contacto?.trim() || prov.presupuesto?.trim()
  )

  // Build provider table rows
  const proveedorHeaderRow = new TableRow({
    children: [
      makeCell([p([t('Nombre', { bold: true })])], { width: { size: 35, type: WidthType.PERCENTAGE }, shading: GRAY_FILL }),
      makeCell([p([t('CIF', { bold: true })])],    { width: { size: 15, type: WidthType.PERCENTAGE }, shading: GRAY_FILL }),
      makeCell([p([t('Contacto', { bold: true })])],   { width: { size: 30, type: WidthType.PERCENTAGE }, shading: GRAY_FILL }),
      makeCell([p([t('Presupuesto', { bold: true })])], { width: { size: 20, type: WidthType.PERCENTAGE }, shading: GRAY_FILL }),
    ],
  })

  const proveedorDataRows = filledProveedores.length > 0
    ? filledProveedores.map(prov =>
        new TableRow({
          children: [
            makeCell([p(prov.nombre  || '—')], { width: { size: 35, type: WidthType.PERCENTAGE } }),
            makeCell([p(prov.cif     || '—')], { width: { size: 15, type: WidthType.PERCENTAGE } }),
            makeCell([p(prov.contacto || '—')], { width: { size: 30, type: WidthType.PERCENTAGE } }),
            makeCell([p(prov.presupuesto || '—')], { width: { size: 20, type: WidthType.PERCENTAGE } }),
          ],
        })
      )
    : [
        new TableRow({
          children: [
            makeCell([p([t('—', { color: '888888' })])], { columnSpan: 4 }),
          ],
        }),
      ]

  const children = [

    // ── Logo ──────────────────────────────────────────────────────────────────
    new Paragraph({
      children: logoBuffer
        ? [new ImageRun({ data: logoBuffer, transformation: { width: 155, height: 56 }, type: 'png' })]
        : [t('CIC bioGUNE', { bold: true, size: SIZE_LG })],
      spacing: { before: 0, after: 200 },
    }),

    // ── Title ─────────────────────────────────────────────────────────────────
    new Paragraph({
      children: [t('CONTRATO MENOR', { bold: true, size: SIZE_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 280 },
    }),

    // ── Identification ────────────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Identificación del expediente'),
        dataRow('Nº de expediente / Código:', codigo || '—', true),
        dataRow('Centro:',       CONFIG.centro),
        dataRow('Centro de coste:', centroCoste || '—'),
        dataRow('Fecha:',        formattedDate),
      ],
    }),

    emptyLine(),

    // ── Object and economic data ──────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Objeto del contrato'),
        new TableRow({
          children: [
            labelCell('Descripción del objeto:'),
            multilineCell(objeto || '—'),
          ],
        }),
        dataRow('Importe (sin IVA):',     importeFormatted),
        dataRow('Plazo de ejecución:',    plazo || '—'),
      ],
    }),

    emptyLine(),

    // ── Justificación de necesidad ────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Justificación de la necesidad'),
        new TableRow({
          children: [
            makeCell(
              (justificacionNecesidad || '—').split('\n').map(line => p([t(line.trim())])),
              { columnSpan: 2 }
            ),
          ],
        }),
      ],
    }),

    emptyLine(),

    // ── Tipo de justificación ─────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Tipo de justificación'),
        new TableRow({
          children: [
            makeCell([p([t(tipoJustificacion || '—')])], { columnSpan: 2 }),
          ],
        }),
      ],
    }),

    emptyLine(),

    // ── Proveedores consultados ───────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Proveedores consultados', 4),
        proveedorHeaderRow,
        ...proveedorDataRows,
      ],
    }),

    emptyLine(),

    // ── Justificación de elección ─────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Justificación de la elección del proveedor'),
        new TableRow({
          children: [
            makeCell(
              (justificacionEleccion || '—').split('\n').map(line => p([t(line.trim())])),
              { columnSpan: 2 }
            ),
          ],
        }),
      ],
    }),

    emptyLine(),
    emptyLine(),

    // ── Signature table ───────────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // Header row
        new TableRow({
          children: [
            makeCell(
              [p([t('RESPONSABLE DEL CONTRATO', { bold: true })])],
              { shading: GRAY_FILL }
            ),
            makeCell(
              [p([t('ADMINISTRACIÓN / GESTIÓN ECONÓMICA', { bold: true })])],
              { shading: GRAY_FILL }
            ),
          ],
        }),
        // Signature row
        new TableRow({
          height: { value: 1600, rule: HeightRule.ATLEAST },
          children: [
            // Left: responsable's signature
            makeCell([
              new Paragraph({
                children: sigBuffer
                  ? [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })]
                  : [t('')],
                spacing: { before: 80, after: 120 },
              }),
              p([t(CONFIG.firmante, { bold: true })]),
              p([t(CONFIG.cargo, { size: SIZE_SM })]),
            ]),
            // Right: blank for administration
            makeCell([p('')]),
          ],
        }),
      ],
    }),

    emptyLine(),

    new Paragraph({
      children: [t(`Documento generado el ${new Date().toLocaleDateString('es-ES')}`, { size: SIZE_SM, color: '888888' })],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 40, after: 0 },
    }),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
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
