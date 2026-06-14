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
const __dirname  = dirname(__filename)
const ASSETS     = join(__dirname, '..', 'public', 'assets')

const FONT    = 'Calibri'
const SIZE    = 22   // 11 pt
const SIZE_SM = 16   //  8 pt

const NO_BORDER  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }

const MONTHS_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]
const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const TEMPLATES = {
  cicbiogune: {
    logo: 'logo-cicbiogune.png', logoW: 200, logoH: 80, city: 'Derio',
    orgTitle_es: 'CIC bioGUNE',
    orgTitle_en: 'CIC bioGUNE',
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
    logo: 'atlas.png', logoW: 165, logoH: 52, city: 'Derio',
    orgTitle_es: 'ATLAS molecular pharma',
    orgTitle_en: 'ATLAS molecular pharma',
    contactInfo: [
      { text: 'ATLAS molecular pharma, S.L.', bold: true },
      { text: 'Parque tecnológico de Bizkaia, edificio 801A' },
      { text: '48160 Derio (Bizkaia), Spain' },
      { text: 'jcastilla@cicbiogune.es' },
      { text: 'www.atlasmolecularpharma.es' },
    ],
  },
  feep: {
    logo: 'feep.png', logoW: 72, logoH: 72, city: 'Bilbao',
    orgTitle_es: 'Presidente de la Fundación Española de Enfermedades Priónicas',
    orgTitle_en: 'President of the Spanish Foundation for Prion Diseases',
    contactInfo: [
      { text: 'Fundación Española de Enfermedades Priónicas', bold: true },
      { text: 'info@fundacionprionicas.org' },
      { text: 'www.fundacionprionicas.org' },
    ],
  },
}

function findAsset(...paths) {
  for (const p of paths) { if (existsSync(p)) return readFileSync(p) }
  return null
}

function formatDate(dateStr, lang = 'en') {
  const d = new Date(dateStr + 'T12:00:00')
  return lang === 'es'
    ? `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
    : `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`
}

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts })
}
function tSm(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE_SM, ...opts })
}
function p(children, { alignment, before = 0, after = 200 } = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({ children, alignment, spacing: { before, after } })
}
function spacer() {
  return new Paragraph({ children: [t('')], spacing: { before: 0, after: 0 } })
}

function headerTable(logoBuffer, tmpl) {
  const logoCell = new TableCell({
    children: [new Paragraph({
      children: logoBuffer
        ? [new ImageRun({ data: logoBuffer, transformation: { width: tmpl.logoW, height: tmpl.logoH }, type: 'png' })]
        : [t(tmpl.orgTitle_en, { bold: true, size: 28 })],
      spacing: { before: 0, after: 0 },
    })],
    borders: NO_BORDERS, verticalAlign: VerticalAlign.TOP,
    width: { size: 58, type: WidthType.PERCENTAGE },
    margins: { top: 0, bottom: 0, left: 0, right: 200 },
  })
  const infoCell = new TableCell({
    children: tmpl.contactInfo.map(({ text, bold = false }) =>
      new Paragraph({
        children: [tSm(text, { bold })],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 50 },
      })
    ),
    borders: NO_BORDERS, verticalAlign: VerticalAlign.TOP,
    width: { size: 42, type: WidthType.PERCENTAGE },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [logoCell, infoCell] })],
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideH: NO_BORDER, insideV: NO_BORDER },
  })
}

export async function generateCartaReferencia(data) {
  const {
    template   = 'cicbiogune',
    idioma     = 'en',
    fecha      = new Date().toISOString().split('T')[0],
    firmaTipo  = 'manuscrita',
    firmante   = {},
    destinatario = {},
    referencia = {},
    cuerpo     = '',
  } = data

  const tmpl = TEMPLATES[template] ?? TEMPLATES.cicbiogune
  const lang = idioma === 'es' ? 'es' : 'en'
  const orgTitle = lang === 'es' ? tmpl.orgTitle_es : tmpl.orgTitle_en
  const formattedDate = formatDate(fecha, lang)

  const logoBuffer = findAsset(
    join(ASSETS, 'logos', tmpl.logo),
    join(ASSETS, tmpl.logo),
  )
  const sigBuffer = firmaTipo === 'manuscrita'
    ? findAsset(join(ASSETS, 'firmas', 'firma_joaquin.png'), join(ASSETS, 'firma-jokin.png'))
    : null

  // ── Addressee block ──────────────────────────────────────────────────────────
  const addresseeBlock = []
  if (destinatario.tipo === 'especifico' && destinatario.nombre) {
    const fullName = [destinatario.tratamiento, destinatario.nombre].filter(Boolean).join(' ')
    addresseeBlock.push(p([t(fullName, { bold: true })], { after: 60 }))
    if (destinatario.cargo)         addresseeBlock.push(p(destinatario.cargo,         { after: 60 }))
    if (destinatario.departamento)  addresseeBlock.push(p(destinatario.departamento,  { after: 60 }))
    if (destinatario.organizacion)  addresseeBlock.push(p(destinatario.organizacion,  { after: 60 }))
    if (destinatario.pais)          addresseeBlock.push(p(destinatario.pais,          { after: 120 }))
    // Salutation
    const lastName = destinatario.nombre.split(' ').pop()
    const salutation = lang === 'es'
      ? `Estimado/a ${destinatario.tratamiento || ''} ${destinatario.nombre}:`
      : `Dear ${destinatario.tratamiento || 'Dr.'} ${lastName}:`
    addresseeBlock.push(p(salutation, { after: 0 }))
  } else {
    const salutation = lang === 'es' ? 'A quien corresponda:' : 'To Whom It May Concern:'
    addresseeBlock.push(p(salutation, { after: 0 }))
  }

  // ── Subject line ─────────────────────────────────────────────────────────────
  const subjectLabel = lang === 'es' ? 'Asunto' : 'Re'
  const subjectText  = lang === 'es'
    ? `${subjectLabel}: Carta de referencia para ${referencia.nombre || '___'}`
    : `${subjectLabel}: Letter of Reference for ${referencia.nombre || '___'}`

  // ── Body paragraphs ──────────────────────────────────────────────────────────
  const bodyParagraphs = (cuerpo || '').split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return spacer()
    return new Paragraph({
      children: [t(trimmed)],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 200, line: 360, lineRule: 'auto' },
    })
  })

  // ── Signature block ──────────────────────────────────────────────────────────
  const signatureBlock = sigBuffer
    ? [new Paragraph({
        children: [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })],
        spacing: { before: 60, after: 80 },
      })]
    : [spacer(), spacer(), spacer()]

  const signerName  = firmante.nombre  || 'Joaquín Castilla'
  const signerTitle = firmante.titulo1 || 'IKERBasque Research Professor'
  const signerEmail = firmante.email   || 'jcastilla@cicbiogune.es'

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageLabel = lang === 'es' ? ['Página ', ' de '] : ['Page ', ' of ']
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: pageLabel[0], font: FONT, size: SIZE_SM }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE_SM }),
        new TextRun({ text: pageLabel[1], font: FONT, size: SIZE_SM }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SIZE_SM }),
      ],
      spacing: { before: 0, after: 0 },
    })],
  })

  const children = [
    headerTable(logoBuffer, tmpl),
    spacer(),
    p(`${tmpl.city}, ${formattedDate}`, { alignment: AlignmentType.RIGHT, after: 480 }),
    ...addresseeBlock,
    spacer(),
    p([t(subjectText, { bold: true })], { after: 240 }),
    ...bodyParagraphs,
    spacer(), spacer(), spacer(),
    ...signatureBlock,
    p([t(signerName, { bold: true })], { before: 20, after: 40 }),
    p(signerTitle, { after: 40 }),
    p(orgTitle, { after: 40 }),
    p(signerEmail, { after: 0 }),
  ]

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
