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
const __dirname  = dirname(__filename)
const ASSETS     = join(__dirname, '..', 'public', 'assets')

const FONT  = 'Calibri'
const SZ    = 22   // 11 pt
const SZ_SM = 18   // 9 pt
const SZ_LG = 28   // 14 pt

function t(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
}

function p(children, { align, before = 80, after = 80 } = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({ children, alignment: align, spacing: { before, after } })
}

function empty(sz = 120) {
  return new Paragraph({ children: [t('')], spacing: { before: sz, after: sz } })
}

function ordinalSuffix(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function formatDate(lang, lugar) {
  const now   = new Date()
  const day   = now.getDate()
  const year  = now.getFullYear()
  const loc   = lugar ? `${lugar}, ` : ''
  if (lang === 'en') {
    const month = now.toLocaleDateString('en-GB', { month: 'long' })
    return `${loc}${day}${ordinalSuffix(day)} of ${month} ${year}.`
  }
  const month = now.toLocaleDateString('es-ES', { month: 'long' })
  return `${loc}${day} de ${month} de ${year}.`
}

export async function generateCertNoPeligrosidad(data) {
  const {
    lang         = 'es+en',
    lugar        = 'Derio',
    nombre       = '',
    dni          = '',
    centro       = '',
    cif          = '',
    vat          = '',
    material     = '',
    materialEn   = '',
    hsCode       = '',
    incluirFirma = true,
    incluirSello = true,
    incluirLogo  = true,
    esCIC        = true,
    logoBase64   = null,
    logoWidth    = 220,
    logoHeight   = 70,
  } = data

  const showEs = lang === 'es' || lang === 'es+en'
  const showEn = lang === 'en' || lang === 'es+en'

  // ── Assets ────────────────────────────────────────────────────────────────
  let logoBuffer  = null
  let sigBuffer   = null
  let selloBuffer = null

  const sigPath   = join(ASSETS, 'firma-jokin.png')
  const selloPath = join(ASSETS, 'Sello_cicbiogune.png')
  const selloAlt  = join(ASSETS, 'sello.png')
  if (existsSync(sigPath))   sigBuffer   = readFileSync(sigPath)
  if (existsSync(selloPath)) selloBuffer = readFileSync(selloPath)
  else if (existsSync(selloAlt)) selloBuffer = readFileSync(selloAlt)

  if (incluirLogo && logoBase64) {
    logoBuffer = Buffer.from(logoBase64, 'base64')
  } else if (incluirLogo && esCIC) {
    const cicPath = join(__dirname, '..', 'public', 'logos', 'animalario', 'cicbiogune.png')
    const fallback = join(ASSETS, 'logo-cicbiogune.png')
    if (existsSync(cicPath))    logoBuffer = readFileSync(cicPath)
    else if (existsSync(fallback)) logoBuffer = readFileSync(fallback)
  }

  // Texto compuesto del centro para cada idioma
  const centroES = [centro, cif  ? `CIF ${cif}`   : ''].filter(Boolean).join(' (').replace(/([^)])$/, s => cif ? s + ')' : s)
  const centroEN = [centro, vat  ? `VAT nº ${vat}` : ''].filter(Boolean).join(' (').replace(/([^)])$/, s => vat ? s + ')' : s)

  const children = []

  // ── 1. Logo / membrete — fixed small size regardless of source resolution ──
  // Fit within 190×65 pt keeping aspect ratio
  const MAX_LOGO_W = 190, MAX_LOGO_H = 65
  let dispW = logoWidth  ?? MAX_LOGO_W
  let dispH = logoHeight ?? MAX_LOGO_H
  const scale = Math.min(MAX_LOGO_W / dispW, MAX_LOGO_H / dispH, 1)
  dispW = Math.round(dispW * scale)
  dispH = Math.round(dispH * scale)

  children.push(new Paragraph({
    children: logoBuffer
      ? [new ImageRun({ data: logoBuffer, transformation: { width: dispW, height: dispH }, type: 'png' })]
      : [t(centro || nombre || '', { bold: true, size: SZ_LG })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 160 },
  }))

  // ── 2. Título centrado ────────────────────────────────────────────────────
  children.push(p(
    [t('CERTIFICADO DE NO PELIGROSIDAD', { bold: true, size: SZ_LG })],
    { align: AlignmentType.CENTER, before: 240, after: 60 }
  ))
  children.push(p(
    [t('NON-HAZARDOUS CERTIFICATE', { bold: true, size: SZ_LG })],
    { align: AlignmentType.CENTER, before: 0, after: 240 }
  ))

  // ── 3. "A quien pueda interesar" ──────────────────────────────────────────
  children.push(p(
    [t('A QUIEN PUEDA INTERESAR:', { italics: true, bold: true })],
    { align: AlignmentType.CENTER, before: 80, after: 0 }
  ))
  children.push(p(
    [t('TO WHOM IT MAY CONCERN:', { italics: true, bold: true })],
    { align: AlignmentType.CENTER, before: 0, after: 320 }
  ))

  // ── 4. Cuerpo en español ──────────────────────────────────────────────────
  if (showEs) {
    children.push(p(
      [
        t(nombre || '_______________', { bold: true }),
        t(', con DNI '),
        t(dni    || '_______________', { bold: true }),
        t(', Investigador principal en el '),
        t(centroES || '_______________', { bold: true }),
        t(', declara que el producto contenido en el paquete que consiste en '),
        t(material || '_______________', { bold: true }),
        t(' (Código HS: '),
        t(hsCode   || '______', { bold: true }),
        t('), no es tóxico, explosivo, oxidante, infeccioso, radioactivo, corrosivo ni magnético, y por tanto, no presenta ningún riesgo para su transporte.'),
      ],
      { align: AlignmentType.BOTH, before: 80, after: showEn ? 240 : 80 }
    ))
  }

  // ── 5. Cuerpo en inglés ───────────────────────────────────────────────────
  if (showEn) {
    const materialEnText = materialEn?.trim() || material
    children.push(p(
      [
        t(nombre || '_______________', { bold: true }),
        t(', with Spanish national ID '),
        t(dni    || '_______________', { bold: true }),
        t(', Principal Investigator at '),
        t(centroEN || '_______________', { bold: true }),
        t(' declares that the product contained in this box that consists of '),
        t(materialEnText || '_______________', { bold: true }),
        t(' (HS Code: '),
        t(hsCode   || '______', { bold: true }),
        t('), is neither explosive, nor oxidizing, poisonous/toxic, infectious, radioactive, corrosive or magnetic, and therefore, it is proved not to be a dangerous goods for transportation.'),
      ],
      { align: AlignmentType.BOTH, before: 80, after: 80 }
    ))
  }

  // ── 6. Lugar y fecha ──────────────────────────────────────────────────────
  const dateStr = formatDate(showEn && !showEs ? 'en' : 'es', lugar)
  children.push(p(
    [t(dateStr)],
    { before: 320, after: 80 }
  ))

  children.push(empty(120))

  // ── 7. Firma + sello ──────────────────────────────────────────────────────
  const sigImages = []
  if (esCIC && incluirFirma && sigBuffer)
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
    children.push(p([t('FIRMA / SIGNATURE + SELLO / STAMP', { color: '888888', size: SZ_SM })], { before: 240, after: 60 }))
  }

  // Nombre impreso del firmante
  children.push(p([t(nombre || '', { bold: true })], { before: 40, after: 0 }))

  // ── Documento ─────────────────────────────────────────────────────────────
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
