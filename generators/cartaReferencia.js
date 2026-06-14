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

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TEMPLATES = {
  cicbiogune: {
    logo:     'logo-cicbiogune.png',
    logoW:    200,
    logoH:    80,
    city:     'Derio',
    orgTitle: 'CIC bioGUNE',
    orgTitleEn: 'CIC bioGUNE',
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
    logo:     'atlas.png',
    logoW:    165,
    logoH:    52,
    city:     'Derio',
    orgTitle: 'ATLAS molecular pharma',
    orgTitleEn: 'ATLAS molecular pharma',
    contactInfo: [
      { text: 'ATLAS molecular pharma, S.L.', bold: true },
      { text: 'Parque tecnológico de Bizkaia, edificio 801A' },
      { text: '48160 Derio (Bizkaia), Spain' },
      { text: 'jcastilla@cicbiogune.es' },
      { text: 'www.atlasmolecularpharma.es' },
    ],
  },
  feep: {
    logo:     'feep.png',
    logoW:    72,
    logoH:    72,
    city:     'Bilbao',
    orgTitle: 'Presidente de la Fundación Española de Enfermedades Priónicas',
    orgTitleEn: 'President of the Spanish Foundation for Prion Diseases',
    contactInfo: [
      { text: 'Fundación Española de Enfermedades Priónicas', bold: true },
      { text: 'info@fundacionprionicas.org' },
      { text: 'www.fundacionprionicas.org' },
    ],
  },
}

const DEFAULT_FIRMANTE = {
  nombre: 'Joaquín Castilla',
  titulo1: 'IKERBasque Research Professor',
  email: 'jcastilla@cicbiogune.es',
}

function findAsset(...paths) {
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p)
  }
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
  return new TextRun({ text, font: FONT, size: SIZE_XS, ...opts })
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

export async function generateCartaReferencia(data) {
  const {
    template   = 'cicbiogune',
    idioma     = 'en',
    fecha,
    firmaTipo  = 'manuscrita',
    cuerpo     = '',
  } = data

  const firmante     = { ...DEFAULT_FIRMANTE, ...(data.firmante || {}) }
  const destinatario = data.destinatario || { tipo: 'abierto' }
  const referencia   = data.referencia   || {}

  const tmpl          = TEMPLATES[template] ?? TEMPLATES.cicbiogune
  const formattedDate = formatDate(fecha || new Date().toISOString().split('T')[0], idioma)

  const orgTitle = (idioma === 'en' && tmpl.orgTitleEn) ? tmpl.orgTitleEn : tmpl.orgTitle

  const logoBuffer = findAsset(
    join(ASSETS, 'logos', tmpl.logo),
    join(ASSETS, tmpl.logo),
  )

  const sigBuffer = firmaTipo === 'manuscrita'
    ? findAsset(
        join(ASSETS, 'firmas', 'firma_joaquin.png'),
        join(ASSETS, 'firma-jokin.png'),
      )
    : null

  // Destinatario block
  const destParagraphs = []

  if (destinatario.tipo === 'abierto') {
    destParagraphs.push(
      p(idioma === 'es' ? 'A quien corresponda:' : 'To Whom It May Concern:', { after: 200 })
    )
  } else {
    if (destinatario.tratamiento || destinatario.nombre) {
      const nameParts = [destinatario.tratamiento, destinatario.nombre].filter(Boolean).join(' ')
      destParagraphs.push(p([t(nameParts, { bold: true })], { after: 60 }))
    }
    if (destinatario.cargo)        destParagraphs.push(p(destinatario.cargo,        { after: 60 }))
    if (destinatario.departamento) destParagraphs.push(p(destinatario.departamento, { after: 60 }))
    if (destinatario.organizacion) destParagraphs.push(p(destinatario.organizacion, { after: 60 }))
    if (destinatario.pais)         destParagraphs.push(p(destinatario.pais,         { after: 120 }))

    const apellido = (destinatario.nombre || '').trim().split(' ').pop()
    const salutation = idioma === 'es'
      ? `Estimado/a ${[destinatario.tratamiento, destinatario.nombre].filter(Boolean).join(' ')}:`
      : `Dear ${[destinatario.tratamiento, apellido].filter(Boolean).join(' ')}:`
    destParagraphs.push(p(salutation, { after: 200 }))
  }

  const subjectText = idioma === 'es'
    ? `Asunto: Carta de referencia para ${referencia.nombre || ''}`
    : `Re: Letter of Reference for ${referencia.nombre || ''}`

  const bodyParagraphs = cuerpo.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return spacer()
    return new Paragraph({
      children:  [t(trimmed)],
      alignment: AlignmentType.JUSTIFIED,
      spacing:   { before: 0, after: 200, line: 360, lineRule: 'auto' },
    })
  })

  const signatureBlock = sigBuffer
    ? [
        new Paragraph({
          children: [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })],
          spacing: { before: 60, after: 80 },
        }),
      ]
    : [spacer(), spacer(), spacer()]

  const footerTexts = idioma === 'es'
    ? { before: 'Página ', between: ' de ' }
    : { before: 'Page ', between: ' of ' }

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: footerTexts.before, font: FONT, size: SIZE_SM }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE_SM }),
          new TextRun({ text: footerTexts.between, font: FONT, size: SIZE_SM }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SIZE_SM }),
        ],
        spacing: { before: 0, after: 0 },
      }),
    ],
  })

  const children = [
    headerTable(logoBuffer, tmpl),
    spacer(),
    p(`${tmpl.city}, ${formattedDate}`, { alignment: AlignmentType.RIGHT, after: 480 }),
    ...destParagraphs,
    spacer(),
    p([t(subjectText, { bold: true })], { after: 300 }),
    spacer(),
    ...bodyParagraphs,
    spacer(), spacer(), spacer(),
    ...signatureBlock,
    p([t(firmante.nombre, { bold: true })], { before: 20, after: 40 }),
    p(firmante.titulo1 || 'IKERBasque Research Professor', { after: 40 }),
    p(orgTitle, { after: firmante.email ? 40 : 0 }),
    ...(firmante.email ? [p(firmante.email, { after: 0 })] : []),
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
