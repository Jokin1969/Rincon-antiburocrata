import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
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

const FONT   = 'Calibri'
const SZ     = 22  // 11 pt
const SZ_SM  = 18  // 9 pt
const SZ_LG  = 26  // 13 pt

const TR = {
  es: {
    addressee:  'AT. ADUANA DE IRUN (DEPARTAMENTO IMPORTACIÓN)',
    bodyBefore: 'El que suscribe, ',
    bodyMid:    ', certifica que los productos incluidos en la factura de nuestro proveedor ',
    bodyEnd:    ' no están sujetos a control, según lo establecido en el R/UE 649/2012 L-201 (27-07-2012) (CELEX 32012R0649) y la Orden 03-06-1992 (BOE 13-06-1992) relativo a la importación de productos químicos peligrosos.',
    closing:    'Atentamente,',
    signLabel:  'FIRMA + SELLO',
    invoiceRef: ', factura nº ',
  },
  en: {
    addressee:  'ATT: IRUN CUSTOMS (IMPORT DEPARTMENT)',
    bodyBefore: 'The undersigned, ',
    bodyMid:    ', hereby certifies that the products included in our supplier’s invoice from ',
    bodyEnd:    ' are not subject to control under Regulation (EU) 649/2012 L-201 (27-07-2012) (CELEX 32012R0649) and the Order of 03-06-1992 (BOE 13-06-1992) concerning the import of hazardous chemical products.',
    closing:    'Sincerely,',
    signLabel:  'SIGNATURE + STAMP',
    invoiceRef: ', invoice no. ',
  },
}

function t(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
}

function p(children, { align, before = 80, after = 80 } = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    alignment: align,
    spacing: { before, after },
  })
}

function empty(sz = 120) {
  return new Paragraph({ children: [t('')], spacing: { before: sz, after: sz } })
}

export async function generatePqpImport(data) {
  const {
    lang             = 'es',
    lugar            = '',
    firmante         = '',
    proveedor        = '',
    facturaProveedor = '',
    shipper          = {},
    incluirFirma     = true,
    incluirSello     = true,
    incluirLogo      = true,
    shipperEsCIC     = false,
    logoBase64       = null,
    logoWidth        = 220,
    logoHeight       = 70,
  } = data

  const L = TR[lang] ?? TR.es

  const now = new Date()
  const dateStr = now.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const lugarFecha = lang === 'es'
    ? `${lugar ? `${lugar}, ` : ''}${dateStr}`
    : `${lugar ? `${lugar}, ` : ''}${dateStr}`

  // ── Assets ────────────────────────────────────────────────────────────────
  let logoBuffer  = null
  let sigBuffer   = null
  let selloBuffer = null
  const sigPath    = join(ASSETS, 'firma-jokin.png')
  const selloPath  = join(ASSETS, 'sello.png')
  const selloAlt   = join(ASSETS, 'Sello_cicbiogune.png')
  if (existsSync(sigPath))   sigBuffer   = readFileSync(sigPath)
  if (existsSync(selloPath)) selloBuffer = readFileSync(selloPath)
  else if (existsSync(selloAlt)) selloBuffer = readFileSync(selloAlt)

  if (incluirLogo && logoBase64) {
    logoBuffer = Buffer.from(logoBase64, 'base64')
  } else if (incluirLogo && shipperEsCIC) {
    const cicPath = join(ASSETS, 'logo-cicbiogune.png')
    if (existsSync(cicPath)) logoBuffer = readFileSync(cicPath)
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const children = []

  // 1. MEMBRETE (logo o nombre de organización)
  children.push(new Paragraph({
    children: logoBuffer
      ? [new ImageRun({ data: logoBuffer, transformation: { width: logoWidth, height: logoHeight }, type: 'png' })]
      : [t(shipper.organizacion || shipper.nombre || '', { bold: true, size: SZ_LG })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 120 },
  }))

  // Dirección del shipper (líneas pequeñas debajo del logo)
  const addrLines = [
    shipper.address1,
    shipper.address2,
    [shipper.ciudad, shipper.cp].filter(Boolean).join(' '),
    shipper.pais,
    shipper.vat ? `VAT/Tax ID: ${shipper.vat}` : '',
  ].filter(Boolean)
  for (const line of addrLines) {
    children.push(p([t(line, { size: SZ_SM })], { before: 0, after: 0 }))
  }

  children.push(empty(160))

  // 2. Lugar y fecha (a la derecha)
  children.push(p(
    [t(lugarFecha, { bold: true })],
    { align: AlignmentType.RIGHT, before: 80, after: 240 }
  ))

  // 3. Destinatario
  children.push(p(
    [t(L.addressee, { bold: true })],
    { before: 80, after: 320 }
  ))

  // 4. Cuerpo principal del certificado
  const proveedorTxt = facturaProveedor?.trim()
    ? `${proveedor}${L.invoiceRef}${facturaProveedor}`
    : proveedor
  children.push(p(
    [
      t(L.bodyBefore),
      t(firmante || '____________________', { bold: true }),
      t(L.bodyMid),
      t(proveedorTxt || '____________________', { bold: true }),
      t(L.bodyEnd),
    ],
    { before: 80, after: 320 }
  ))

  // 5. Cierre
  children.push(p([t(L.closing)], { before: 240, after: 80 }))

  children.push(empty(120))

  // 6. Firma + sello (lado a lado)
  const sigImages = []
  if (shipperEsCIC && incluirFirma && sigBuffer)
    sigImages.push(new ImageRun({ data: sigBuffer, transformation: { width: 110, height: 70 }, type: 'png' }))
  if (incluirSello && selloBuffer)
    sigImages.push(new ImageRun({ data: selloBuffer, transformation: { width: 85, height: 85 }, type: 'png' }))

  if (sigImages.length) {
    children.push(new Paragraph({
      children: sigImages,
      alignment: AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
    }))
  } else {
    children.push(p([t(L.signLabel, { color: '888888', size: SZ_SM })], { before: 240, after: 60 }))
  }

  if (firmante) {
    children.push(p([t(firmante, { bold: true })], { before: 40, after: 0 }))
  }
  if (shipper.organizacion) {
    children.push(p([t(shipper.organizacion, { size: SZ_SM, color: '555555' })], { before: 0, after: 0 }))
  }

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
