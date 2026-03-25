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

// ── Design constants ──────────────────────────────────────────────────────────

const FONT = 'Calibri'
const SIZE = 20        // half-points → 10pt
const SIZE_SM = 16     // 8pt
const SIZE_TITLE = 28  // 14pt

const BORDER_SINGLE = { style: BorderStyle.SINGLE, size: 1, color: '000000' }
const ALL_BORDERS = {
  top: BORDER_SINGLE,
  bottom: BORDER_SINGLE,
  left: BORDER_SINGLE,
  right: BORDER_SINGLE,
}
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}
const CELL_MARGIN = { top: 70, bottom: 70, left: 110, right: 110 }
const GRAY_FILL = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }

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
    borders: opts.borders ?? ALL_BORDERS,
    shading: opts.shading,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    width: opts.width,
    verticalAlign: opts.verticalAlign ?? VerticalAlign.TOP,
    margins: opts.margins ?? CELL_MARGIN,
  })
}

function labelCell(text) {
  return makeCell([p(text)], {
    width: { size: 36, type: WidthType.PERCENTAGE },
  })
}

function valueCell(text, bold = false) {
  return makeCell([p([t(text, { bold })])])
}

function sectionHeaderRow(label) {
  return new TableRow({
    children: [
      makeCell(
        [p([t(label, { bold: true })])],
        { columnSpan: 2, shading: GRAY_FILL }
      ),
    ],
  })
}

function dataRow(label, value, bold = false) {
  return new TableRow({
    children: [labelCell(label), valueCell(value, bold)],
  })
}

// ── Institution data ──────────────────────────────────────────────────────────

const INSTITUTIONS = {
  cicbiogune: {
    logo:    'logo-cicbiogune.png',
    name:    'CIC bioGUNE',
    address: 'Parque tecnológico de Bizkaia, edificio 801A. Derio 48160 (Bizkaia)',
    phone:   '+34946 572 525',
    website: 'https://www.cicbiogune.es/people/jcastilla',
    email:   'jcastilla@cicbiogune.es',
  },
  ciber: {
    logo:    'logo-ciber.png',
    name:    'Consorcio CIBER – Instituto Carlos III',
    address: 'Monforte de Lemos, 3-5, pab. 11. Madrid 28029',
    phone:   '+34 946 572 525',
    website: 'www.cicbiogune.es/jcastilla',
    email:   'jcastilla@cicbiogune.es',
  },
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateEndUserStatement(data) {
  const {
    model,
    quantity,
    endUse,
    date,
    institution = 'cicbiogune',
    productDescription = 'Purified Plasmid DNA Samples',
    strategicCode = '1C353',
    hsCode = '29349910',
  } = data

  const inst = INSTITUTIONS[institution] ?? INSTITUTIONS.cicbiogune

  const modelCount = model.split(',').filter(s => s.trim()).length
  const unit = modelCount > 1 ? 'vials' : 'vial'
  const quantityDisplay = /vials?$/i.test(quantity.trim()) ? quantity : `${quantity} ${unit}`

  // Format date: "25 March 2026"
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Load assets (graceful fallback if files missing)
  let logoBuffer = null
  let sigBuffer = null
  const logoPath = join(ASSETS, inst.logo)
  const sigPath  = join(ASSETS, 'firma-jokin.png')
  if (existsSync(logoPath)) logoBuffer = readFileSync(logoPath)
  if (existsSync(sigPath))  sigBuffer  = readFileSync(sigPath)

  // End-use cell: multiple paragraphs split by newline
  const endUseLines = endUse
    .split('\n')
    .map(line => p([t(line.trim())]))
    .filter((_, i, arr) => !(i > 0 && arr[i - 1].children?.length === 0))

  const children = [
    // ── Logo ──────────────────────────────────────────────────────────────
    new Paragraph({
      children: logoBuffer
        ? [new ImageRun({ data: logoBuffer, transformation: { width: 155, height: 56 }, type: 'png' })]
        : [t(inst.name, { bold: true, size: 24 })],
      spacing: { before: 0, after: 160 },
    }),

    // ── Document title ────────────────────────────────────────────────────
    new Paragraph({
      children: [t('END USER STATEMENT', { bold: true, size: SIZE_TITLE })],
      spacing: { before: 0, after: 200 },
    }),

    p([t('To: Director-General, Singapore Customs')]),
    emptyLine(),

    new Paragraph({
      children: [t('END-USER STATEMENT', { bold: true, underline: {} })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    }),

    emptyLine(),
    p(`We, ${inst.name}`),
    emptyLine(),

    // ── Consignee details ─────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Consignee details:'),
        dataRow('Company Name:', 'GenScript Biotech (Netherlands) B.V'),
        dataRow('Company Address:', 'Treubstraat 1, 1st floor, 2288, EG'),
        dataRow('Telephone Number:', '+31 715690120 (NL)'),
        dataRow('Website:', 'https://www.genscript.com/'),
        dataRow('Email Address:', 'DL-GS-EU-Logistics-NL@genscript.com'),
      ],
    }),

    emptyLine(),

    // ── End-user details ──────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('End-user details'),
        dataRow('Company Name:', inst.name),
        dataRow('Company Address:', inst.address),
        dataRow('Telephone Number:', inst.phone),
        dataRow('Website:', inst.website),
        dataRow('Email Address:', inst.email),
      ],
    }),

    emptyLine(),
    p('have requested'),
    emptyLine(),

    // ── Exporter details ──────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Exporter details'),
        dataRow('Company Name:', 'GenScript Biotech (Singapore) PTE. LTD'),
        dataRow('Company Address:', '164 Kallang Way, #06-14, Solaris @Kallang 164, East Wing, Singapore (349248)'),
      ],
    }),

    emptyLine(),
    p('to export'),
    emptyLine(),

    // ── Product details ───────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('Product details'),
        dataRow('Product Description:', productDescription),
        dataRow('Strategic Goods Product Code:', strategicCode),
        dataRow('HS Code:', hsCode),
        dataRow('Brand:', 'GenScript'),
        dataRow('Model:', model),
        dataRow('Quantity:', quantityDisplay),
      ],
    }),

    emptyLine(),
    p('which is intended for'),
    emptyLine(),

    // ── End-use details ───────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        sectionHeaderRow('End-use\u00B9 details (Specific details on purpose for which items would be used)'),
        new TableRow({
          children: [
            labelCell('End-use:'),
            makeCell(endUseLines.length > 0 ? endUseLines : [p('')]),
          ],
        }),
      ],
    }),

    emptyLine(),

    // ── Country / Location ────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        dataRow('Country/Region of Final Destination:', 'Spain'),
        dataRow('End-Use Location:', '(as per end-user details above)'),
      ],
    }),

    emptyLine(),

    // ── Footnotes ─────────────────────────────────────────────────────────
    new Paragraph({
      children: [t('\u00B9For consignee who is the end-user: to provide the detailed end-use of the product', { size: SIZE_SM })],
      spacing: { before: 60, after: 40 },
    }),
    new Paragraph({
      children: [t('For consignee who is not the end-user: to provide the detailed reason for receiving the product.', { size: SIZE_SM })],
      spacing: { before: 0, after: 160 },
    }),

    // ── Legal paragraphs ──────────────────────────────────────────────────
    ...[
      '\tI/we confirm that all goods loaned/gifted/purchased/received (directly/indirectly) from GenScript Biotech (Singapore) Pte Ltd will not be used in relation to nuclear, biological or chemical weapons, or missiles capable of delivering these weapons.',
      '\tI/we also confirm that all goods loaned/gifted/purchased/received (directly/indirectly) from GenScript Biotech (Singapore) Pte Ltd will not be re-exported or sold to a third party who is known or suspected to be involved in relation to nuclear, biological or chemical weapons, or missiles capable of delivering these weapons, or to any sanctioned entities.',
      '\tI/We also confirm that any re-export or sale to a third party, is carried out in compliance with the originating/supplying and receiving countries\' export control laws, as applicable.',
      '\tI/We also confirm that the end use location of the product is correct as per address specified in this end user statement.',
    ].map(text => new Paragraph({
      children: [t(text)],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 80, after: 80 },
    })),

    emptyLine(),

    // ── Signature table ───────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        dataRow('Name (in block letters):', 'JOAQUÍN CASTILLA', true),
        dataRow('Designation\u00B2:', 'IKERBASQUE RESEARCH PROFESSOR \u2013 LAB RESPONSIBLE'),
        dataRow('Date:', formattedDate),
        new TableRow({
          height: { value: 1100, rule: HeightRule.ATLEAST },
          children: [
            labelCell('Authorised Signature :'),
            makeCell([
              new Paragraph({
                children: sigBuffer
                  ? [new ImageRun({ data: sigBuffer, transformation: { width: 105, height: 65 }, type: 'png' })]
                  : [t('')],
                spacing: { before: 80, after: 80 },
              }),
            ]),
          ],
        }),
      ],
    }),

    emptyLine(),

    new Paragraph({
      children: [t('\u00B2At least managerial level.', { size: SIZE_SM })],
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
