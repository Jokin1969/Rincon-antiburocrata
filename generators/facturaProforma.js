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

// ── Design constants ──────────────────────────────────────────────────────────

const FONT = 'Calibri'
const SZ   = 20   // 10 pt
const SZ_SM = 16  // 8 pt
const SZ_LG = 24  // 12 pt
const SZ_TI = 28  // 14 pt

const B  = { style: BorderStyle.SINGLE, size: 6,  color: '000000' }
const BT = { style: BorderStyle.SINGLE, size: 4,  color: '000000' }
const BN = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' }
const ALL_B  = { top: B,  bottom: B,  left: B,  right: B  }
const ALL_BT = { top: BT, bottom: BT, left: BT, right: BT }
const NO_B   = { top: BN, bottom: BN, left: BN, right: BN }

const CM = { top: 60, bottom: 60, left: 100, right: 100 }

// ── Translations ──────────────────────────────────────────────────────────────

const TR = {
  en: {
    title:       'PRO-FORMA INVOICE',
    shipper:     'SHIPPER',
    consignee:   'CONSIGNEE',
    origin:      'COUNTRY OF ORIGIN',
    desc:        'DESCRIPTION OF GOODS',
    qty:         'QTY',
    unitVal:     'UNIT VALUE',
    totalVal:    'TOTAL VALUE',
    totalQty:    'TOTAL QUANTITY',
    total:       'TOTAL',
    invoiceNo:   'INVOICE No.',
    tel:         'Tel.',
    fax:         'Fax',
    email:       'Email',
    research:    'For research purposes only. Not for human or veterinary use. No commercial value, not for re-sale. Contents packed on dry ice. Non-infectious, non-pathogenic, non-toxic, biological material',
    legal: [
      'THESE COMMODITIES ARE LICENSED FOR THE ULTIMATE DESTINATION AS SHOWN. DIVERSION CONTRARY TO THE UNITED STATES LAW IS PROHIBITED. I DECLARE ALL INFORMATION CONTAINED IN THIS INVOICE TO BE TRUE AND CORRECT.',
    ],
    printName:   'PRINT / TYPE NAME OF SHIPPER / EXPORTER',
    authSig:     'Authorised Signature',
    dateLabel:   'Date',
  },
  es: {
    title:       'FACTURA PROFORMA',
    shipper:     'REMITENTE',
    consignee:   'DESTINATARIO',
    origin:      'PAÍS DE ORIGEN',
    desc:        'DESCRIPCIÓN DE MERCANCÍAS',
    qty:         'CANTIDAD',
    unitVal:     'VALOR UNITARIO',
    totalVal:    'VALOR TOTAL',
    totalQty:    'CANTIDAD TOTAL',
    total:       'TOTAL',
    invoiceNo:   'Nº FACTURA',
    tel:         'Tel.',
    fax:         'Fax',
    email:       'Email',
    research:    'Solo para fines de investigación. No para uso humano ni veterinario. Sin valor comercial, no para reventa. Contenido envasado en hielo seco. Material biológico no infeccioso, no patógeno, no tóxico',
    legal: [
      'ESTAS MERCANCÍAS ESTÁN AUTORIZADAS PARA EL DESTINO FINAL INDICADO. LA DESVIACIÓN CONTRARIA A LA LEY DE ESTADOS UNIDOS ESTÁ PROHIBIDA. DECLARO QUE TODA LA INFORMACIÓN CONTENIDA EN ESTA FACTURA ES VERDADERA Y CORRECTA.',
    ],
    printName:   'NOMBRE EN MAYÚSCULAS DEL REMITENTE / EXPORTADOR',
    authSig:     'Firma autorizada',
    dateLabel:   'Fecha',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function t(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
}

function p(children, { align, before = 60, after = 60 } = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    alignment: align,
    spacing: { before, after },
  })
}

function empty(sz = 40) {
  return new Paragraph({ children: [t('')], spacing: { before: sz, after: sz } })
}

function cell(paragraphs, { borders = ALL_BT, span, width, valign, margins = CM } = {}) {
  return new TableCell({
    children: Array.isArray(paragraphs) ? paragraphs : [paragraphs],
    borders,
    columnSpan: span,
    width,
    verticalAlign: valign ?? VerticalAlign.TOP,
    margins,
  })
}

function hdrCell(text, width) {
  return cell(
    [p([t(text, { bold: true, size: SZ_SM })])],
    { borders: ALL_B, width: { size: width, type: WidthType.PERCENTAGE } }
  )
}

function row(...cells) {
  return new TableRow({ children: cells })
}

function formatMoney(sym, amount) {
  const n = parseFloat(amount) || 0
  return `${sym} ${n.toFixed(2)}`
}

function addressBlock(person, sym) {
  const lines = [
    person.nombre,
    person.organizacion,
    person.address1,
    person.address2,
    [person.ciudad, person.cp].filter(Boolean).join(' '),
    person.pais,
    person.telefono ? `Tel. ${person.telefono}` : '',
    person.vat ? `VAT/Tax ID: ${person.vat}` : '',
  ].filter(Boolean)

  return lines.map((l, i) =>
    p([t(l, { bold: i < 2, size: i < 2 ? SZ : SZ_SM })], { before: i === 0 ? 60 : 30, after: 30 })
  )
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateFacturaProforma(data) {
  const {
    numero        = '',
    moneda        = 'EUR',
    lang          = 'en',
    shipper       = {},
    consignee     = {},
    paisOrigen    = 'Spain',
    lineas        = [],
    researchOnly  = true,
    researchText  = '',
    hsCode        = '',
    incluirFirma  = true,
    incluirSello  = true,
    shipperEsCIC  = false,
  } = data

  const L   = TR[lang] ?? TR.en
  const sym = moneda === 'USD' ? '$' : '€'

  // Formatted date
  const now = new Date()
  const dateStr = now.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Load assets
  let logoBuffer  = null
  let sigBuffer   = null
  let selloBuffer = null
  const logoPath  = join(ASSETS, 'logo-cicbiogune.png')
  const sigPath   = join(ASSETS, 'firma-jokin.png')
  const selloPath = join(ASSETS, 'Sello_cicbiogune.png')
  if (existsSync(logoPath))  logoBuffer  = readFileSync(logoPath)
  if (existsSync(sigPath))   sigBuffer   = readFileSync(sigPath)
  if (existsSync(selloPath)) selloBuffer = readFileSync(selloPath)

  // Compute totals
  const validLineas = lineas.filter(l => l.descripcion?.trim())
  const totalQty   = validLineas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
  const totalValue = validLineas.reduce((s, l) => {
    const qty = parseFloat(l.cantidad) || 0
    const pu  = parseFloat(l.precioUnitario) || 0
    return s + qty * pu
  }, 0)

  // ── Build document children ───────────────────────────────────────────────

  const children = []

  // ── 1. Header: logo left + invoice number below ───────────────────────────
  children.push(new Paragraph({
    children: logoBuffer
      ? [new ImageRun({ data: logoBuffer, transformation: { width: 160, height: 58 }, type: 'png' })]
      : [t('CIC bioGUNE', { bold: true, size: SZ_LG })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 40 },
  }))

  children.push(p(
    [t(`${L.invoiceNo}  `, { bold: true, size: SZ_LG }), t(numero, { size: SZ_LG })],
    { before: 0, after: 80 }
  ))

  // ── 2. SHIPPER | CONSIGNEE table ──────────────────────────────────────────
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row(
          hdrCell(L.shipper,   50),
          hdrCell(L.consignee, 50),
        ),
        row(
          cell(addressBlock(shipper),   { width: { size: 50, type: WidthType.PERCENTAGE } }),
          cell(addressBlock(consignee), { width: { size: 50, type: WidthType.PERCENTAGE } }),
        ),
      ],
    })
  )

  // ── 3. Country of Origin ──────────────────────────────────────────────────
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row(
          cell([p([t(`${L.origin}: `, { bold: true }), t(paisOrigen)])], { borders: ALL_BT }),
        ),
      ],
    })
  )

  children.push(empty(40))

  // ── 4. Product table ──────────────────────────────────────────────────────
  const productRows = [
    row(
      hdrCell(L.desc,     50),
      hdrCell(L.qty,      10),
      hdrCell(L.unitVal,  20),
      hdrCell(L.totalVal, 20),
    ),
    ...validLineas.map(l => {
      const qty  = parseFloat(l.cantidad) || 0
      const pu   = parseFloat(l.precioUnitario) || 0
      const tot  = qty * pu
      return row(
        cell([
          p([t(l.descripcion, { size: SZ_SM })], { before: 40, after: 40 }),
        ], { width: { size: 50, type: WidthType.PERCENTAGE } }),
        cell([p([t(qty > 0 ? String(qty) : '', { size: SZ_SM })], { align: AlignmentType.CENTER })], { width: { size: 10, type: WidthType.PERCENTAGE } }),
        cell([p([t(formatMoney(sym, pu),  { size: SZ_SM })], { align: AlignmentType.RIGHT })], { width: { size: 20, type: WidthType.PERCENTAGE } }),
        cell([p([t(formatMoney(sym, tot), { size: SZ_SM })], { align: AlignmentType.RIGHT })], { width: { size: 20, type: WidthType.PERCENTAGE } }),
      )
    }),
    // HS code row (if provided)
    ...(hsCode?.trim() ? [
      row(
        cell(
          [p([t('HS Code: ', { bold: true, size: SZ_SM }), t(hsCode, { size: SZ_SM })])],
          { borders: ALL_BT, span: 4 }
        )
      )
    ] : []),
    // Research notice row (in red, conditional)
    ...(researchOnly ? [
      row(
        cell(
          [p([t(researchText?.trim() || L.research, { bold: true, color: 'CC0000', size: SZ_SM })], { align: AlignmentType.CENTER })],
          { borders: ALL_BT, span: 4 }
        )
      )
    ] : []),
    // Totals row
    row(
      cell([p([t(`${L.totalQty}: ${totalQty}`, { bold: true })])], { borders: ALL_B, span: 2 }),
      cell([p([t(`${L.total}: ${formatMoney(sym, totalValue)}`, { bold: true })], { align: AlignmentType.RIGHT })], { borders: ALL_B, span: 2 }),
    ),
  ]

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: productRows,
  }))

  children.push(empty(80))

  // ── 5. Centered title ─────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [t(L.title, { bold: true, size: SZ_TI })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
  }))

  children.push(empty(60))

  // ── 7. Signature block ────────────────────────────────────────────────────
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row(
          // Left: name + printName label
          cell([
            p([t(shipper.nombre || '', { bold: true })], { before: 60, after: 40 }),
            p([t(L.printName, { size: SZ_SM, color: '888888' })], { before: 0, after: 60 }),
          ], { borders: ALL_BT, width: { size: 60, type: WidthType.PERCENTAGE } }),
          // Right: signature + stamp (side by side) + date
          cell([
            new Paragraph({
              children: (() => {
                const imgs = []
                if (shipperEsCIC && incluirFirma && sigBuffer)
                  imgs.push(new ImageRun({ data: sigBuffer, transformation: { width: 95, height: 60 }, type: 'png' }))
                if (shipperEsCIC && incluirSello && selloBuffer)
                  imgs.push(new ImageRun({ data: selloBuffer, transformation: { width: 75, height: 75 }, type: 'png' }))
                return imgs.length ? imgs : [t('')]
              })(),
              spacing: { before: 40, after: 40 },
            }),
            p([t(`${L.dateLabel}: ${dateStr}`, { size: SZ_SM })], { before: 0, after: 40 }),
          ], { borders: ALL_BT, width: { size: 40, type: WidthType.PERCENTAGE } }),
        ),
      ],
    })
  )

  // ── Build document ────────────────────────────────────────────────────────
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
