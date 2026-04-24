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
import { TIPOS_JUSTIFICACION } from '../src/data/contratoMenorConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ASSETS = join(__dirname, '..', 'public', 'assets')

// ── Fixed configuration — editar aquí para personalizar ───────────────────────
const CONFIG = {
  centro:   'CIC bioGUNE',
  lugar:    'Derio',
  firmante: 'Joaquín Castilla',
  cargo:    'Ikerbasque Research Professor – Lab Responsible',
}

// ── Design constants ──────────────────────────────────────────────────────────
const FONT       = 'Calibri'
const SIZE       = 20   // half-points → 10 pt
const SIZE_SM    = 16   // 8 pt
const SIZE_LG    = 24   // 12 pt
const SIZE_TITLE = 28   // 14 pt

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

const CELL_MARGIN      = { top: 70,  bottom: 70,  left: 110, right: 110 }
const CELL_MARGIN_WIDE = { top: 100, bottom: 100, left: 110, right: 110 }
const GRAY_FILL        = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }
const CREAM_FILL       = { type: ShadingType.CLEAR, color: 'auto', fill: 'FFFACD' }

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
  return new Paragraph({ children: [t('')], spacing: { before: 30, after: 30 } })
}

function footnote(text) {
  return new Paragraph({
    children: [t(text, { size: SIZE_SM, italics: true })],
    spacing: { before: 40, after: 60 },
  })
}

function makeCell(paragraphs, opts = {}) {
  return new TableCell({
    children:      paragraphs,
    borders:       opts.borders       ?? ALL_BORDERS,
    shading:       opts.shading,
    columnSpan:    opts.columnSpan,
    rowSpan:       opts.rowSpan,
    width:         opts.width,
    verticalAlign: opts.verticalAlign ?? VerticalAlign.TOP,
    margins:       opts.margins       ?? CELL_MARGIN,
  })
}

function sectionTable(number, title, contentRows) {
  const header = new TableRow({
    children: [
      makeCell(
        [p([t(number != null ? `${number}. ${title}` : title, { bold: true })])],
        { columnSpan: 2, shading: CREAM_FILL }
      ),
    ],
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...contentRows],
  })
}

function textSection(number, title, text) {
  const lines = (text || '—').split('\n').map(line =>
    p([t(line.trim() || '')])
  )
  return sectionTable(number, title, [
    new TableRow({
      children: [makeCell(lines, { columnSpan: 2, margins: CELL_MARGIN_WIDE })],
    }),
  ])
}

function shortSection(number, title, value) {
  return sectionTable(number, title, [
    new TableRow({
      children: [makeCell([p([t(value || '—')])], { columnSpan: 2, margins: CELL_MARGIN_WIDE })],
    }),
  ])
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateContratoMenor(data) {
  const {
    codigo                = '',
    objeto                = '',
    justificacionNecesidad = '',
    tipoJustificacion     = '',
    centroCoste           = '',
    proveedores           = [],
    justificacionEleccion = '',
    plazo                 = '',
    importe               = '',
    fecha                 = new Date().toISOString().split('T')[0],
  } = data

  // Formatted date: "24 de abril de 2026"
  const fechaObj = new Date(fecha + 'T12:00:00')
  const formattedDate = fechaObj.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Formatted importe
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

  // ── Section 3: Tipo de justificación ───────────────────────────────────────
  // All 7 options listed; selected one marked with ☑ and bold, others with ☐
  const justifOptions = TIPOS_JUSTIFICACION.map(({ label }) => {
    const selected = label === tipoJustificacion
    return new Paragraph({
      children: [
        t(selected ? '☑  ' : '☐  ', { bold: selected, size: SIZE_LG }),
        t(label, { bold: selected }),
      ],
      spacing: { before: 70, after: 70 },
    })
  })

  // ── Section 5: Providers table ─────────────────────────────────────────────
  const COL_W = [
    { size: 35, type: WidthType.PERCENTAGE },
    { size: 15, type: WidthType.PERCENTAGE },
    { size: 30, type: WidthType.PERCENTAGE },
    { size: 20, type: WidthType.PERCENTAGE },
  ]
  const provHeaderRow = new TableRow({
    children: ['Nombre', 'CIF', 'Contacto', 'Presupuesto'].map((h, i) =>
      makeCell([p([t(h, { bold: true })])], { width: COL_W[i], shading: GRAY_FILL })
    ),
  })
  const provDataRows = filledProveedores.length > 0
    ? filledProveedores.map(prov =>
        new TableRow({
          children: [prov.nombre, prov.cif, prov.contacto, prov.presupuesto].map((v, i) =>
            makeCell([p(v || '—')], { width: COL_W[i] })
          ),
        })
      )
    : [new TableRow({ children: [makeCell([p('—')], { columnSpan: 4 })] })]

  const proveedoresTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeCell(
            [p([t(filledProveedores.length <= 1 ? '5. EMPRESA PROVEEDORA' : '5. EMPRESAS PROVEEDORAS (al menos 3) (**)', { bold: true })])],
            { columnSpan: 4, shading: CREAM_FILL }
          ),
        ],
      }),
      provHeaderRow,
      ...provDataRows,
    ],
  })

  // ── Signature table ────────────────────────────────────────────────────────
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeCell([p([t('Investigador Principal o Responsable', { bold: true })])], { shading: GRAY_FILL }),
          makeCell([p([t('Órgano de Contratación', { bold: true })])], { shading: GRAY_FILL }),
        ],
      }),
      new TableRow({
        height: { value: 1600, rule: HeightRule.ATLEAST },
        children: [
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
          makeCell([p('')]),
        ],
      }),
    ],
  })

  // ── Document body ──────────────────────────────────────────────────────────
  const children = [

    // ── Header: logo (left) + reference info (right) ───────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            makeCell(
              [new Paragraph({
                children: logoBuffer
                  ? [new ImageRun({ data: logoBuffer, transformation: { width: 155, height: 56 }, type: 'png' })]
                  : [t(CONFIG.centro, { bold: true, size: SIZE_LG })],
                spacing: { before: 0, after: 0 },
              })],
              { borders: NO_BORDERS, width: { size: 58, type: WidthType.PERCENTAGE }, margins: { top: 0, bottom: 0, left: 0, right: 110 } }
            ),
            makeCell(
              [
                p([t(CONFIG.centro, { bold: true })]),
                p([t('Código de contrato menor: ________')]),
                p([t(formattedDate, { size: SIZE_LG })]),
              ],
              { borders: NO_BORDERS, width: { size: 42, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: { top: 0, bottom: 0, left: 110, right: 0 } }
            ),
          ],
        }),
      ],
    }),

    emptyLine(),

    // ── Document title ─────────────────────────────────────────────────────
    new Paragraph({
      children: [t('INFORME JUSTIFICATIVO DE GASTO A TRAVÉS DE CONTRATO MENOR', { bold: true, size: SIZE_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 280 },
    }),

    // ── Objeto del contrato (sin número) ──────────────────────────────────
    textSection(null, 'OBJETO DEL CONTRATO', objeto),
    emptyLine(),

    // ── 2. Justificación de la necesidad ───────────────────────────────────
    textSection(2, 'JUSTIFICACIÓN DE LA NECESIDAD DEL SUMINISTRO / SERVICIO', justificacionNecesidad),
    emptyLine(),

    // ── 3. Tipo de justificación ───────────────────────────────────────────
    sectionTable(3, 'JUSTIFICACIÓN DEL CONTRATO MENOR (*)', [
      new TableRow({
        children: [makeCell(justifOptions, { columnSpan: 2, margins: CELL_MARGIN_WIDE })],
      }),
    ]),
    footnote('(*) Será necesario seleccionar uno de los supuestos indicados para la justificación del trámite de contrato menor.'),
    emptyLine(),

    // ── 4. Centro de coste/financiación ───────────────────────────────────
    shortSection(4, 'CENTRO DE COSTE/FINANCIACIÓN', centroCoste),
    emptyLine(),

    // ── 5. Proveedores ─────────────────────────────────────────────────────
    proveedoresTable,
    ...(filledProveedores.length > 1 ? [footnote('(**) Será necesario adjuntar a este documento las 3 ofertas de los proveedores referidos. En el caso de que solo hubiera un proveedor para el servicio/suministro referido, deberá adjuntarse el certificado de exclusividad.')] : []),
    emptyLine(),

    // ── 6. Justificación de la elección ────────────────────────────────────
    textSection(6, 'JUSTIFICACIÓN DE LA ELECCIÓN DE LA EMPRESA PROVEEDORA (***)', justificacionEleccion),
    footnote('(***) Se requiere motivar la elección del proveedor por razón de (i) precio, (ii) características técnicas o (iii) exclusividad.'),
    emptyLine(),

    // ── 7. Plazo ───────────────────────────────────────────────────────────
    shortSection(7, 'PLAZO DE ENTREGA/EJECUCIÓN/VIGENCIA', plazo),
    emptyLine(),

    // ── 8. Importe ─────────────────────────────────────────────────────────
    shortSection(8, 'IMPORTE', importeFormatted),

    emptyLine(),
    emptyLine(),

    // ── Signature table ────────────────────────────────────────────────────
    signatureTable,

    emptyLine(),

    // ── Footer: place and date ─────────────────────────────────────────────
    new Paragraph({
      children: [t(`${CONFIG.lugar}, ${formattedDate}`)],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 80, after: 0 },
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
