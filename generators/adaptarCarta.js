import {
  AlignmentType,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
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

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const TEMPLATES = {
  cicbiogune: {
    logo:     'logo-cicbiogune.png',
    logoW:    155,
    logoH:    56,
    city:     'Derio',
    orgTitle: 'CIC bioGUNE',
  },
  atlas: {
    logo:     'logo-atlas.png',
    logoW:    155,
    logoH:    56,
    city:     'Bilbao',
    orgTitle: 'ATLAS molecular pharma',
  },
  feep: {
    logo:     'logo-feep.png',
    logoW:    155,
    logoH:    56,
    city:     'Bilbao',
    orgTitle: 'Presidente de la Fundación Española de Enfermedades Priónicas',
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

function p(children, { alignment, before = 0, after = 200 } = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({ children, alignment, spacing: { before, after } })
}

function spacer() {
  return new Paragraph({ children: [t('')], spacing: { before: 0, after: 0 } })
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

  const tmpl         = TEMPLATES[template] ?? TEMPLATES.cicbiogune
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
    : [spacer(), spacer(), spacer()]  // empty space for digital/no signature

  const children = [
    // ── Logo ──────────────────────────────────────────────────────────────────
    new Paragraph({
      children: logoBuffer
        ? [new ImageRun({ data: logoBuffer, transformation: { width: tmpl.logoW, height: tmpl.logoH }, type: 'png' })]
        : [t(tmpl.orgTitle, { bold: true, size: 28 })],
      spacing: { before: 0, after: 320 },
    }),

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
