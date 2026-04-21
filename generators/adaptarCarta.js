import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
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
const __dirname = dirname(__filename)
const ASSETS = join(__dirname, '..', 'public', 'assets')

const FONT    = 'Calibri'
const SIZE    = 22  // 11 pt
const SIZE_SM = 18  //  9 pt
const SIZE_XS = 16  //  8 pt

const NO_BORDER  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const TEMPLATES = {
  cicbiogune: {
    logo:     'logo-cicbiogune.png',
    logoW:    200,
    logoH:    80,
    city:     'Derio',
    orgTitle: 'CIC bioGUNE',
    // Contact info shown to the right of the logo in the letterhead
    contactInfo: [
      { text: 'CIC bioGUNE', bold: true },
      { text: 'Parque tecnológico de Bizkaia, edificio 801A' },
      { text: '48160 Derio (Bizkaia), Spain' },
      { text: 'Tel. +34 946 572 525' },
      { text: 'jcastilla@cicbiogune.es' },
      { text: 'www.cicbiogune.es' },
    ],
  },
  atlas: {
    logo:     'logo-atlas.png',
    logoW:    165,
    logoH:    52,
    city:     'Derio',
    orgTitle: 'ATLAS molecular pharma',
    contactInfo: [
      { text: 'ATLAS molecular pharma, S.L.', bold: true },
      { text: 'Parque tecnológico de Bizkaia, edificio 801A' },
      { text: '48160 Derio (Bizkaia), Spain' },
      { text: 'jcastilla@atlasmolecularpharma.com' },
      { text: 'www.atlasmolecularpharma.com' },
    ],
  },
  feep: {
    logo:     'logo-feep.png',
    logoW:    72,
    logoH:    72,
    city:     'Bilbao',
    orgTitle: 'Presidente de la Fundación Española de Enfermedades Priónicas',
    contactInfo: [
      { text: 'Fundación Española de Enfermedades Priónicas', bold: true },
      { text: 'www.feep.es' },
    ],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findAsset(...paths) {
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p)
  }
  return null
}

function formatDateEs(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts })
}

function tSm(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE_XS, ...opts })
}

function p(children, { alignment, before = 0, after = 200 } = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({ children, alignment, spacing: { before, after } })
}

function spacer() {
  return new Paragraph({ children: [t('')], spacing: { before: 0, after: 0 } })
}

// Header table: logo (left) | contact info (right)
function headerTable(logoBuffer, tmpl) {
  const logoCell = new TableCell({
    children: [
      new Paragraph({
        children: logoBuffer
          ? [new ImageRun({ data: logoBuffer, transformation: { width: tmpl.logoW, height: tmpl.logoH }, type: 'png' })]
          : [t(tmpl.orgTitle, { bold: true, size: 28 })],
        spacing: { before: 0, after: 0 },
      }),
    ],
    borders:       NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    width:         { size: 58, type: WidthType.PERCENTAGE },
    margins:       { top: 0, bottom: 0, left: 0, right: 200 },
  })

  const infoCell = new TableCell({
    children: tmpl.contactInfo.map(({ text, bold = false }) =>
      new Paragraph({
        children: [tSm(text, { bold })],
        alignment: AlignmentType.RIGHT,
        spacing:   { before: 0, after: 50 },
      })
    ),
    borders:       NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    width:         { size: 42, type: WidthType.PERCENTAGE },
    margins:       { top: 0, bottom: 0, left: 0, right: 0 },
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows:  [new TableRow({ children: [logoCell, infoCell] })],
    borders: {
      top:     NO_BORDER,
      bottom:  NO_BORDER,
      left:    NO_BORDER,
      right:   NO_BORDER,
      insideH: NO_BORDER,
      insideV: NO_BORDER,
    },
  })
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateAdaptarCarta(data) {
  const {
    template,
    signerName = 'Joaquín Castilla',
    sigType    = 'manuscrita',
    text       = '',
    date,
  } = data

  const tmpl          = TEMPLATES[template] ?? TEMPLATES.cicbiogune
  const formattedDate = formatDateEs(date)

  const logoBuffer = findAsset(
    join(ASSETS, 'logos', tmpl.logo),
    join(ASSETS, tmpl.logo),
  )

  const sigBuffer = sigType === 'manuscrita'
    ? findAsset(
        join(ASSETS, 'firmas', 'firma_joaquin.png'),
        join(ASSETS, 'firma-jokin.png'),
      )
    : null

  // Parse body text: each newline → paragraph, blank lines → spacers
  const bodyParagraphs = text.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return spacer()
    return p(trimmed, { alignment: AlignmentType.JUSTIFIED })
  })

  const signatureBlock = sigBuffer
    ? [
        new Paragraph({
          children: [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })],
          spacing: { before: 60, after: 80 },
        }),
      ]
    : [spacer(), spacer(), spacer()]

  const children = [
    // ── Header: logo + contact info ───────────────────────────────────────────
    headerTable(logoBuffer, tmpl),

    // ── Space after header ────────────────────────────────────────────────────
    spacer(),

    // ── Date (right-aligned) ─────────────────────────────────────────────────
    p(`${tmpl.city}, ${formattedDate}`, { alignment: AlignmentType.RIGHT, after: 480 }),

    // ── Body text ────────────────────────────────────────────────────────────
    ...bodyParagraphs,

    // ── Space before signature ────────────────────────────────────────────────
    spacer(), spacer(), spacer(),

    // ── Signature image or empty space ────────────────────────────────────────
    ...signatureBlock,

    // ── Signer name ───────────────────────────────────────────────────────────
    p([t(signerName, { bold: true })], { before: 20, after: 40 }),

    // ── Fixed title ───────────────────────────────────────────────────────────
    p('IKERBasque Research Professor', { after: 40 }),

    // ── Organization-specific title ───────────────────────────────────────────
    p(tmpl.orgTitle, { after: 0 }),
  ]

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Página ', font: FONT, size: SIZE_SM }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE_SM }),
          new TextRun({ text: ' de ', font: FONT, size: SIZE_SM }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SIZE_SM }),
        ],
        spacing: { before: 0, after: 0 },
      }),
    ],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.18),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.18),
            right:  convertInchesToTwip(1.18),
          },
        },
      },
      footers: { default: footer },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
