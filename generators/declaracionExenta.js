import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
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
const LOGOS_MAPA = join(__dirname, '..', 'public', 'logos', 'mapa')

const FONT   = 'Arial'
const SZ     = 20   // 10 pt
const SZ_SM  = 16   // 8 pt
const SZ_LG  = 22   // 11 pt

const BORDER_THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDER_NONE = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const ALL_THIN    = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }

function tr(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
}

function pp(children, { align, before = 60, after = 60 } = {}) {
  if (typeof children === 'string') children = [tr(children)]
  return new Paragraph({ children, alignment: align, spacing: { before, after } })
}

function emptyLine(sz = 80) {
  return new Paragraph({ children: [tr('')], spacing: { before: sz, after: 0 } })
}

function underlineBullet(text, { pageBreak = false } = {}) {
  return new Paragraph({
    pageBreakBefore: pageBreak || undefined,
    children: [tr(text, { underline: { type: UnderlineType.SINGLE } })],
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 360 },
    spacing: { before: 180, after: 180 },
  })
}

// ── Institutional header table (text-based fallback) ─────────────────────────
function buildHeaderTable() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: ALL_THIN,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [tr('MINISTERIO DE AGRICULTURA,', { bold: true, size: SZ_SM })],
                spacing: { before: 40, after: 0 },
              }),
              new Paragraph({
                children: [tr('PESCA Y ALIMENTACIÓN', { bold: true, size: SZ_SM })],
                spacing: { before: 0, after: 40 },
              }),
            ],
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: ALL_THIN,
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [tr('DIRECCIÓN GENERAL DE SANIDAD DE LA PRODUCCIÓN AGROALIMENTARIA Y BIENESTAR ANIMAL (DGSPABA)', { bold: true, size: SZ_SM })],
                spacing: { before: 50, after: 50 },
              }),
              new Paragraph({
                children: [tr('SUBDIRECCION GENERAL DE ACUERDOS SANITARIOS Y CONTROL EN FRONTERA (SGASCF)', { bold: true, size: SZ_SM })],
                spacing: { before: 50, after: 50 },
                border: { top: BORDER_THIN },
              }),
            ],
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: ALL_THIN,
          }),
        ],
      }),
    ],
  })
}

export async function generateDeclaracionExenta(data) {
  const {
    firmante       = 'Joaquín Castilla',
    cargo          = 'Investigador responsable del laboratorio de priones en el CIC bioGUNE',
    representacion = '',
    aduana         = 'Vitoria-Gasteiz (Aeropuerto de Foronda)',
    naturaleza     = '',
    cantidad       = '',
    importador     = '',
    exportador     = '',
    awb            = '',
    paisOrigen     = '',
    lugar          = 'Derio',
    fecha          = '',
    incluirFirma   = true,
    incluirSello   = true,
    logoBase64     = null,
    logoHeight     = 90,
  } = data

  const today = new Date()
  const dd    = String(today.getDate()).padStart(2, '0')
  const mm    = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy  = today.getFullYear()
  const fechaFinal = fecha?.trim() || `${dd}/${mm}/${yyyy}`
  const lugarFinal = lugar?.trim() || 'Derio'

  // ── Assets ─────────────────────────────────────────────────────────────────
  let sigBuffer   = null
  let selloBuffer = null
  const sigPath   = join(ASSETS, 'firmas', 'firma_joaquin.png')
  const selloPath = join(ASSETS, 'Sello_cicbiogune.png')
  const selloAlt  = join(ASSETS, 'Sello.png')
  if (incluirFirma && existsSync(sigPath))   sigBuffer   = readFileSync(sigPath)
  if (incluirSello) {
    if      (existsSync(selloPath)) selloBuffer = readFileSync(selloPath)
    else if (existsSync(selloAlt))  selloBuffer = readFileSync(selloAlt)
  }

  // ── Logo header ─────────────────────────────────────────────────────────────
  // Strip data URL prefix if present, then try file fallback
  const rawBase64 = logoBase64
    ? logoBase64.replace(/^data:[^;]+;base64,/, '')
    : null
  const mimeType = logoBase64?.includes('data:image/jpeg') ? 'jpg' : 'png'

  // Try default MAPA logo from public/logos/mapa/
  let defaultLogoBuffer = null
  for (const name of ['header-mapa.png', 'header-mapa.jpg', 'mapa.png', 'mapa.jpg']) {
    const p = join(LOGOS_MAPA, name)
    if (existsSync(p)) { defaultLogoBuffer = readFileSync(p); break }
  }

  let headerChildren = []
  if (rawBase64) {
    headerChildren = [
      new Paragraph({
        children: [new ImageRun({
          data:           Buffer.from(rawBase64, 'base64'),
          transformation: { width: 595, height: Number(logoHeight) || 90 },
          type:           mimeType,
        })],
        spacing: { before: 0, after: 40 },
      }),
    ]
  } else if (defaultLogoBuffer) {
    headerChildren = [
      new Paragraph({
        children: [new ImageRun({
          data:           defaultLogoBuffer,
          transformation: { width: 595, height: Number(logoHeight) || 90 },
          type:           'png',
        })],
        spacing: { before: 0, after: 40 },
      }),
    ]
  } else {
    headerChildren = [buildHeaderTable(), emptyLine(40)]
  }

  const docHeader = new Header({ children: headerChildren })

  // ── Footer: email left, page number right ──────────────────────────────────
  const docFooter = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          tr('Bzn-importacion@mapa.es', { size: SZ_SM }),
          new TextRun({ children: [new Tab()], font: FONT, size: SZ_SM }),
          tr('Página ', { size: SZ_SM }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ_SM }),
          tr(' de 2', { size: SZ_SM }),
        ],
        spacing: { before: 0, after: 0 },
      }),
    ],
  })

  // ── Body ────────────────────────────────────────────────────────────────────
  const children = []

  // 1. Title
  children.push(new Paragraph({
    children: [
      tr('DECLARACION DE MERCANCÍAS EXENTAS DE CONTROLES OFICIALES EN FRONTERA', {
        bold: true, size: SZ_LG, underline: { type: UnderlineType.SINGLE },
      }),
      new TextRun({ text: '¹', font: FONT, size: SZ_SM, bold: true, superScript: true }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
  }))
  children.push(new Paragraph({
    children: [tr('DOCUMENTO PARA LA ADUANA', { bold: true, size: SZ_LG, underline: { type: UnderlineType.SINGLE } })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 160 },
  }))

  // 2. De / Para / Asunto
  children.push(pp([
    tr('De: ', { bold: true }),
    tr(firmante || '_______________________________________'),
  ], { before: 60, after: 40 }))

  children.push(pp([
    tr('Para: ', { bold: true }),
    tr('La administración de la ADUANA de '),
    tr(aduana || '___________________________________', { bold: true }),
  ], { before: 40, after: 40 }))

  children.push(pp([
    tr('Asunto: ', { bold: true }),
    tr('INFORMA que la partida de productos que a continuación se detalla:'),
  ], { before: 40, after: 140 }))

  // 3. Product details table
  const productRow = (label, value) => new TableRow({
    children: [new TableCell({
      children: [new Paragraph({
        children: [
          tr(label + '  ', { bold: true }),
          tr(value || ''),
        ],
        spacing: { before: 80, after: 80 },
      })],
      borders: ALL_THIN,
    })],
  })

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: ALL_THIN,
    rows: [
      productRow('Naturaleza (Código NC/ Descripción):', naturaleza),
      productRow('Cantidad:', cantidad),
      productRow('Importador:', importador),
      productRow('Exportador:', exportador),
      productRow('AWB / Conocimiento Aéreo:', awb),
      productRow('País de origen:', paisOrigen),
    ],
  }))

  children.push(emptyLine(160))

  // 4. Legal paragraph
  children.push(pp([
    tr('El abajo firmante, en representación de '),
    tr(representacion || '……………………………'),
    tr(', declara que los productos introducidos/importados y vinculados al presente documento no se encuentran sujetos a control en frontera por los Servicios de Control Oficial en Frontera dependientes del Ministerio de Agricultura, Pesca y Alimentación (MAPA), por todos los siguientes motivos '),
    tr('(remisión 02 362)', { bold: true }),
    tr(':'),
  ], { align: AlignmentType.JUSTIFIED, before: 80, after: 200 }))

  // 5. Six underlined bullet points — first 5 on page 1, 6th forces page 2
  const bullets = [
    'No contiene productos destinados al consumo humano o a la industria alimentaria ni materiales destinados a entrar en contacto con los alimentos.',
    'No contiene productos destinados a la alimentación animal.',
    'No se destinan a la fabricación industrial de aceites esenciales o de resinoides.',
    'No contiene biocidas para usos distintos al uso clínico, personal o fitosanitario.',
    'No contienen nicotina o productos derivados de ésta.',
    'No son medicamentos de uso veterinario, productos intermedios y graneles, principios activos o sustancias activas de uso en medicamentos veterinarios cuya importación tiene que ser autorizada por la Agencia Española de Medicamentos y Productos Sanitarios.',
  ]

  bullets.forEach((b, i) => {
    children.push(underlineBullet(b, { pageBreak: i === 5 }))
  })

  children.push(emptyLine(120))

  // 6. Second legal paragraph (bold Reglamento reference)
  children.push(pp([
    tr('Al mismo tiempo, declara que conoce que la importación de mercancías está sujeta a controles oficiales '),
    tr('Reglamento (UE) 2017/625 del Parlamento Europeo y del Consejo, de 15 de marzo de 2017, relativo a los controles y otras actividades realizados para garantizar la aplicación de la legislación sobre alimentos y piensos, y de las normas sobre salud y bienestar de los animales, sanidad vegetal y productos sanitarios y la Orden PJC/756/2024 por la que se delimitan las actuaciones a realizar en los servicios de control oficial en frontera dependientes funcionalmente del Ministerio de Agricultura, Pesca y Alimentación y del Ministerio de Sanidad.', { bold: true }),
  ], { align: AlignmentType.JUSTIFIED, before: 80, after: 200 }))

  // 7. Signature block
  children.push(pp([
    tr('En '),
    tr(lugarFinal, { bold: true }),
    tr(' a '),
    tr(fechaFinal, { bold: true }),
    tr('.'),
  ], { align: AlignmentType.CENTER, before: 80, after: 120 }))

  const sigImages = []
  if (sigBuffer)   sigImages.push(new ImageRun({ data: sigBuffer,   transformation: { width: 110, height: 70 }, type: 'png' }))
  if (selloBuffer) sigImages.push(new ImageRun({ data: selloBuffer, transformation: { width: 85,  height: 85 }, type: 'png' }))

  if (sigImages.length) {
    children.push(new Paragraph({
      children: sigImages,
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
    }))
  } else {
    children.push(emptyLine(180))
    children.push(emptyLine(180))
  }

  if (firmante) children.push(pp([tr(firmante, { bold: true })], { align: AlignmentType.CENTER, before: 40, after: 0 }))
  if (cargo)    children.push(pp([tr(cargo, { size: SZ_SM, color: '555555' })], { align: AlignmentType.CENTER, before: 0, after: 120 }))

  // 8. NOTA
  children.push(pp([
    tr('NOTA: ', { bold: true, size: SZ_SM }),
    tr('El presente documento se emite única y exclusivamente para efectos de la Administración de Aduanas española reseñada anteriormente, careciendo de cualquier otro valor.', { size: SZ_SM }),
  ], { before: 80, after: 60 }))

  // 9. Footnote
  children.push(new Paragraph({
    children: [
      new TextRun({ text: '¹ ', font: FONT, size: SZ_SM, superScript: true }),
      tr('Sin perjuicio de lo declarado en el presente documento, las partidas vinculadas al mismo podrán ser seleccionadas para la realización de controles oficiales en base a una frecuencia aleatoria, o como resultado de la detección de un riesgo de carácter sanitario.', { size: SZ_SM }),
    ],
    border: { top: BORDER_THIN },
    spacing: { before: 80, after: 40 },
  }))

  const doc = new Document({
    sections: [{
      headers:    { default: docHeader },
      footers:    { default: docFooter },
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(0.5),
            bottom: convertInchesToTwip(0.7),
            left:   convertInchesToTwip(1.18),
            right:  convertInchesToTwip(1.18),
            header: convertInchesToTwip(0.2),
            footer: convertInchesToTwip(0.3),
          },
        },
      },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
