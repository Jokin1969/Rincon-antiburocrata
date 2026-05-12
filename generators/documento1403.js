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

const FONT  = 'Calibri'
const SZ    = 22  // 11 pt
const SZ_SM = 18  // 9 pt
const SZ_LG = 26  // 13 pt
const SZ_TI = 30  // 15 pt

const TR = {
  es: {
    title:    'DOCUMENTO 1403',
    subtitle: 'DECLARACIÓN DEL IMPORTADOR DE PRODUCTOS NO SOMETIDOS A CONTROL FARMACÉUTICO',
    p1: ({ fecha, firmante, cargo, empresa, cif, domicilio }) => [
      ['Con fecha de ', false],
      [fecha || '____________', true],
      [' D/Dª ', false],
      [firmante || '____________________', true],
      [' en calidad de ', false],
      [cargo || '____________________', true],
      [', de la empresa ', false],
      [empresa || '____________________', true],
      [' con nº de CIF ', false],
      [cif || '____________', true],
      [' y domicilio en ', false],
      [domicilio || '____________________', true],
      ['.', false],
    ],
    p2: ({ producto, bultos, pesoNeto, taric, empresaOrigen, declaracionSumaria, contenedor, bol, factura }) => [
      ['DECLARA', true, true],
      [' bajo su responsabilidad, que el producto objeto de la importación denominado ', false],
      [producto || '____________________', true],
      [' compuesto por ', false],
      [bultos || '____', true],
      [' bultos de ', false],
      [pesoNeto || '____', true],
      [' Kg de peso neto, puntualizados en la partida TARIC ', false],
      [taric || '____________', true],
      [' procedentes de la empresa ', false],
      [empresaOrigen || '____________________', true],
      [', incluidos en la declaración sumaria / nº conocimiento aéreo ', false],
      [declaracionSumaria || '____________', true],
      [', contenedor ', false],
      [contenedor || '____________', true],
      [' con Bill of landing, Air bill o CMR nº ', false],
      [bol || '____________', true],
      [' y nº de factura ', false],
      [factura || '____________', true],
      ['.', false],
    ],
    p3: 'NO es un producto (medicamento de uso humano, materia prima farmacéutica, producto sanitario, cosmético, producto de higiene personal o biocida de uso clínico y personal) sometido a control farmacéutico de acuerdo al Anexo I de la Orden SPI/2136/2011, de 19 de julio.',
    p4: 'Al mismo tiempo, declara que conoce que la importación de mercancías sujetas a la Orden SPI/2136/2011, de 19 de julio, sin cumplir las disposiciones vigentes aplicables, implica una vulneración de la Ley Orgánica 12/1995, de 12 de diciembre, de represión del contrabando, modificada por Ley Orgánica 6/2011, de 30 de junio, con las consecuencias que de ello se derivan.',
    p5: ({ aduana }) => [
      ['Lo que se hace constar a los efectos del control de verificación documental que realiza la Aduana de ', false],
      [aduana || '____________________', true],
      [' sobre los productos incluidos en la Orden SPI/2136/2011, de 19 de julio.', false],
    ],
    sign:     'Fdo.:',
    signSub:  'Responsable de la empresa',
  },
  en: {
    title:    'DOCUMENT 1403',
    subtitle: 'IMPORTER’S DECLARATION FOR PRODUCTS NOT SUBJECT TO PHARMACEUTICAL CONTROL',
    p1: ({ fecha, firmante, cargo, empresa, cif, domicilio }) => [
      ['On ', false],
      [fecha || '____________', true],
      [', Mr/Ms ', false],
      [firmante || '____________________', true],
      [', acting as ', false],
      [cargo || '____________________', true],
      [', on behalf of the company ', false],
      [empresa || '____________________', true],
      [' with tax ID (CIF) ', false],
      [cif || '____________', true],
      [' and registered address at ', false],
      [domicilio || '____________________', true],
      ['.', false],
    ],
    p2: ({ producto, bultos, pesoNeto, taric, empresaOrigen, declaracionSumaria, contenedor, bol, factura }) => [
      ['HEREBY DECLARES', true, true],
      [' under his/her responsibility, that the import product named ', false],
      [producto || '____________________', true],
      [', consisting of ', false],
      [bultos || '____', true],
      [' packages totalling ', false],
      [pesoNeto || '____', true],
      [' Kg net weight, specified under TARIC heading ', false],
      [taric || '____________', true],
      [', originating from the company ', false],
      [empresaOrigen || '____________________', true],
      [', included in the summary declaration / air waybill no. ', false],
      [declaracionSumaria || '____________', true],
      [', container ', false],
      [contenedor || '____________', true],
      [' with Bill of Lading, Air Waybill or CMR no. ', false],
      [bol || '____________', true],
      [' and invoice no. ', false],
      [factura || '____________', true],
      ['.', false],
    ],
    p3: 'IS NOT a product (human medicine, pharmaceutical raw material, medical device, cosmetic, personal hygiene product or biocide for clinical and personal use) subject to pharmaceutical control under Annex I of Order SPI/2136/2011 of 19 July.',
    p4: 'At the same time, the undersigned declares awareness that the import of goods subject to Order SPI/2136/2011 of 19 July, without complying with the applicable regulations in force, constitutes a violation of Organic Law 12/1995 of 12 December on the repression of smuggling, as amended by Organic Law 6/2011 of 30 June, with the consequences arising therefrom.',
    p5: ({ aduana }) => [
      ['This is stated for the purposes of the documentary verification control carried out by the Customs Office of ', false],
      [aduana || '____________________', true],
      [' regarding the products included in Order SPI/2136/2011 of 19 July.', false],
    ],
    sign:     'Signed:',
    signSub:  'Company representative',
  },
}

function t(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
}

function p(children, { align, before = 100, after = 100 } = {}) {
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

// Convert a list of [text, bold] (or [text, bold, big]) tuples into TextRuns.
function runs(tuples) {
  return tuples.map(([text, bold, big]) =>
    t(text, { bold: !!bold, size: big ? SZ_LG : SZ })
  )
}

export async function generateDocumento1403(data) {
  const {
    lang             = 'es',
    fecha            = '',
    firmante         = '',
    cargo            = '',
    cif              = '',
    domicilio        = '',
    producto         = '',
    bultos           = '',
    pesoNeto         = '',
    taric            = '',
    empresaOrigen    = '',
    declaracionSumaria = '',
    contenedor       = '',
    bol              = '',
    factura          = '',
    aduana           = '',
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

  // Build CIF / domicilio falling back to shipper data
  const cifFinal = cif?.trim() || shipper.vat || ''
  const empresaFinal = shipper.organizacion || ''
  const domicilioFinal = domicilio?.trim() || [
    shipper.address1,
    shipper.address2,
    [shipper.ciudad, shipper.cp].filter(Boolean).join(' '),
    shipper.pais,
  ].filter(Boolean).join(', ')

  // Date: use provided string (already formatted) or today's date
  const today = new Date()
  const todayStr = today.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const fechaFinal = fecha?.trim() || todayStr

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

  const children = []

  // 1. Membrete (logo o nombre de empresa)
  children.push(new Paragraph({
    children: logoBuffer
      ? [new ImageRun({ data: logoBuffer, transformation: { width: logoWidth, height: logoHeight }, type: 'png' })]
      : [t(empresaFinal || shipper.nombre || '', { bold: true, size: SZ_LG })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 120 },
  }))

  children.push(empty(120))

  // 2. Título centrado
  children.push(new Paragraph({
    children: [t(L.title, { bold: true, size: SZ_TI })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 80 },
  }))
  children.push(new Paragraph({
    children: [t(L.subtitle, { bold: true, size: SZ })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240 },
  }))

  // 3. Párrafo 1 — datos del firmante y empresa
  children.push(p(
    runs(L.p1({
      fecha: fechaFinal,
      firmante,
      cargo,
      empresa: empresaFinal,
      cif: cifFinal,
      domicilio: domicilioFinal,
    })),
    { align: AlignmentType.JUSTIFIED, before: 80, after: 200 }
  ))

  // 4. Párrafo 2 — producto y envío (DECLARA …)
  children.push(p(
    runs(L.p2({
      producto, bultos, pesoNeto, taric,
      empresaOrigen, declaracionSumaria, contenedor, bol, factura,
    })),
    { align: AlignmentType.JUSTIFIED, before: 80, after: 200 }
  ))

  // 5. Párrafo 3 — NO es producto sometido a control farmacéutico
  children.push(p(
    [t(L.p3, { bold: true })],
    { align: AlignmentType.JUSTIFIED, before: 80, after: 200 }
  ))

  // 6. Párrafo 4 — declaración de conocimiento Ley Orgánica 12/1995
  children.push(p(L.p4, { align: AlignmentType.JUSTIFIED, before: 80, after: 200 }))

  // 7. Párrafo 5 — Aduana
  children.push(p(runs(L.p5({ aduana })), { align: AlignmentType.JUSTIFIED, before: 80, after: 320 }))

  // 8. Firma
  children.push(p([t(L.sign, { bold: true })], { before: 60, after: 80 }))

  const sigImages = []
  if (shipperEsCIC && incluirFirma && sigBuffer)
    sigImages.push(new ImageRun({ data: sigBuffer, transformation: { width: 110, height: 70 }, type: 'png' }))
  if (incluirSello && selloBuffer)
    sigImages.push(new ImageRun({ data: selloBuffer, transformation: { width: 85, height: 85 }, type: 'png' }))

  if (sigImages.length) {
    children.push(new Paragraph({
      children: sigImages,
      alignment: AlignmentType.LEFT,
      spacing: { before: 40, after: 60 },
    }))
  } else {
    children.push(empty(200))
  }

  if (firmante) {
    children.push(p([t(firmante, { bold: true })], { before: 40, after: 0 }))
  }
  children.push(p([t(L.signSub, { size: SZ_SM, color: '555555' })], { before: 0, after: 0 }))

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
