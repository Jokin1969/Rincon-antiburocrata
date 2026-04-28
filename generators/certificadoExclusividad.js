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
const __dirname = dirname(__filename)
const ASSETS = join(__dirname, '..', 'public', 'assets')

const FONT = 'Calibri'
const SIZE = 20
const SIZE_SM = 16
const SIZE_LG = 26
const SIZE_TITLE = 32

const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const BORDER_BOTTOM = { style: BorderStyle.SINGLE, size: 4, color: '444444' }
const NO_BORDERS = { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE }
const BOTTOM_ONLY = { top: BORDER_NONE, bottom: BORDER_BOTTOM, left: BORDER_NONE, right: BORDER_NONE }
const CELL_MARGIN = { top: 70, bottom: 70, left: 0, right: 0 }

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts })
}

function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    alignment: opts.alignment ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80 },
  })
}

function emptyLine(space = 60) {
  return new Paragraph({ children: [t('')], spacing: { before: space, after: space } })
}

const INSTITUTIONS = {
  cicbiogune: {
    logo:       'logo-cicbiogune.png',
    name:       'CIC bioGUNE',
    address:    'Parque tecnológico de Bizkaia, edificio 801A, Derio 48160 (Bizkaia)',
    responsable:'Joaquín Castilla',
    cargo:      'Ikerbasque Research Professor – Responsable de Grupo',
  },
  ciber: {
    logo:       'logo-ciber.png',
    name:       'Consorcio CIBER – Instituto Carlos III',
    address:    'Monforte de Lemos, 3-5, pab. 11, Madrid 28029',
    responsable:'Joaquín Castilla',
    cargo:      'Investigador Principal',
  },
}

const DEFAULT_JUSTIFICACION =
  'GenScript Biotech es la única empresa que reúne la combinación de capacidades técnicas, ' +
  'certificaciones y autorizaciones regulatorias necesarias para suministrar el material requerido:\n\n' +
  '1. Tecnología propietaria de síntesis génica de alta fidelidad que permite abordar secuencias de ' +
  'difícil síntesis con las especificaciones técnicas del proyecto.\n\n' +
  '2. Autorización específica del Ministerio de Salud de Singapur para la exportación de secuencias ' +
  'con características reguladas (material de doble uso), junto con la capacidad de emitir la ' +
  'documentación de control de exportaciones exigida (End User Statement).\n\n' +
  '3. Certificaciones ISO 9001 y buenas prácticas de laboratorio (GLP) que garantizan la calidad ' +
  'y trazabilidad del material sintetizado.\n\n' +
  'Ningún otro proveedor consultado puede suministrar el material con las especificaciones técnicas ' +
  'y los requisitos regulatorios requeridos en el plazo necesario para el desarrollo del proyecto.'

export { DEFAULT_JUSTIFICACION }

export async function generateCertificadoExclusividad(data) {
  const {
    institution    = 'cicbiogune',
    expediente     = '',
    descripcion    = '',
    importe        = '',
    justificacion  = DEFAULT_JUSTIFICACION,
    date,
  } = data

  const inst = INSTITUTIONS[institution] ?? INSTITUTIONS.cicbiogune

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  let logoBuffer = null
  let sigBuffer  = null
  const logoPath = join(ASSETS, inst.logo)
  const sigPath  = join(ASSETS, 'firma-jokin.png')
  if (existsSync(logoPath)) logoBuffer = readFileSync(logoPath)
  if (existsSync(sigPath))  sigBuffer  = readFileSync(sigPath)

  // Split justification into paragraphs by \n\n
  const justParas = justificacion
    .split('\n\n')
    .map(block => p([t(block.replace(/\n/g, ' '))], { before: 60, after: 60 }))

  const children = [
    // ── Logo ──────────────────────────────────────────────────────────────────
    new Paragraph({
      children: logoBuffer
        ? [new ImageRun({ data: logoBuffer, transformation: { width: 155, height: 56 }, type: 'png' })]
        : [t(inst.name, { bold: true, size: 24 })],
      spacing: { before: 0, after: 320 },
    }),

    // ── Title ─────────────────────────────────────────────────────────────────
    new Paragraph({
      children: [t('CERTIFICADO DE EXCLUSIVIDAD', { bold: true, size: SIZE_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [t(
        'Art. 168.a).2 Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público (LCSP)',
        { size: SIZE_SM, italics: true }
      )],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
    }),

    // ── Opening statement ─────────────────────────────────────────────────────
    p([
      t('D./Dña. '),
      t(inst.responsable, { bold: true }),
      t(`, ${inst.cargo} de `),
      t(inst.name, { bold: true }),
      t(`, con sede en ${inst.address},`),
    ], { before: 0, after: 60 }),

    emptyLine(40),

    new Paragraph({
      children: [t('CERTIFICA', { bold: true, size: SIZE_LG })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    }),

    emptyLine(40),

    // ── Body ──────────────────────────────────────────────────────────────────
    p([
      t('Que para la adquisición de '),
      t(descripcion || '[descripción del objeto del contrato]', { bold: true }),
      t(expediente ? ` (expediente n.º ${expediente})` : ''),
      importe ? t(`, por importe estimado de ${importe},`) : t(','),
      t(' únicamente la empresa '),
      t('GenScript Biotech (Netherlands) B.V.', { bold: true }),
      t(' puede suministrar los citados bienes/servicios, por los motivos que se exponen a continuación:'),
    ], { before: 60, after: 100 }),

    emptyLine(40),

    ...justParas,

    emptyLine(40),

    p([
      t('En consecuencia, la contratación con '),
      t('GenScript Biotech (Netherlands) B.V.', { bold: true }),
      t(' queda justificada por razón de exclusividad, al amparo del artículo 168.a).2 de la LCSP, ' +
        'siendo la única empresa capaz de satisfacer las necesidades técnicas y regulatorias del proyecto.'),
    ], { before: 60, after: 120 }),

    emptyLine(80),

    // ── Place & date ──────────────────────────────────────────────────────────
    new Paragraph({
      children: [t(`${inst.name.replace('Consorcio CIBER – ', '')}, a ${formattedDate}`)],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 60, after: 240 },
    }),

    // ── Signature block ───────────────────────────────────────────────────────
    new Table({
      width: { size: 45, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          height: { value: 1100, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: sigBuffer
                    ? [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })]
                    : [t('')],
                  spacing: { before: 80, after: 80 },
                }),
              ],
              borders: BOTTOM_ONLY,
              margins: CELL_MARGIN,
              verticalAlign: VerticalAlign.BOTTOM,
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                p([t(inst.responsable, { bold: true })], { before: 40, after: 20 }),
                p([t(inst.cargo, { size: SIZE_SM })], { before: 0, after: 0 }),
              ],
              borders: NO_BORDERS,
              margins: CELL_MARGIN,
            }),
          ],
        }),
      ],
    }),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.18),
            bottom: convertInchesToTwip(1.18),
            left:   convertInchesToTwip(1.38),
            right:  convertInchesToTwip(1.18),
          },
        },
      },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
