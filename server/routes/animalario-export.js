import { Router }                                              from 'express'
import { existsSync, readFileSync }                            from 'fs'
import { join, dirname }                                       from 'path'
import { fileURLToPath }                                       from 'url'
import archiver                                                from 'archiver'
import { contentDispositionHeader }                            from '../../utils/contentDisposition.js'
import multer                                                  from 'multer'
import JSZip                                                   from 'jszip'
import {
  AlignmentType, BorderStyle, Document, Footer, ImageRun,
  Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, UnderlineType, VerticalAlign, WidthType, convertInchesToTwip,
} from 'docx'
import { docxToPdf } from '../../utils/pdf.js'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = dirname(__filename)

const DATA_DIR      = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const LOGOS_DIR     = join(__dirname, '..', '..', 'public', 'logos', 'animalario')
const FIRMA_PATH    = join(__dirname, '..', '..', 'public', 'firmas', 'Jokin.png')

let _firmaBuf = null
try { _firmaBuf = readFileSync(FIRMA_PATH) } catch { _firmaBuf = null }
const PROYECTOS_DIR = join(DATA_DIR, 'animalario', 'proyectos')
const PROC_DIR      = join(DATA_DIR, 'animalario', 'procedimientos')
const CRIA_DIR      = join(DATA_DIR, 'animalario', 'crias')
const PRODUCTOS_DIR = join(DATA_DIR, 'animalario', 'productos')
const MODIF_DIR     = join(DATA_DIR, 'animalario', 'modificaciones')

const router = Router()

// ── Data readers ──────────────────────────────────────────────────────────────

function rj(path) { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null }
const readProyecto = id => rj(join(PROYECTOS_DIR, `proyecto_${id}.json`))
const readProc     = id => rj(join(PROC_DIR,      `proc_${id}.json`))
const readCria     = id => rj(join(CRIA_DIR,      `cria_${id}.json`))
const readModif    = id => rj(join(MODIF_DIR,     `modificacion_${id}.json`))
const readProductos= id => rj(join(PRODUCTOS_DIR, `productos_${id}.json`))

// ── Design constants ──────────────────────────────────────────────────────────

const FONT  = 'Calibri'
const SZ    = 22    // 11 pt (half-points)
const SZ_SM = 18    // 9 pt
const SZ_H1 = 26    // 13 pt
const MARG  = convertInchesToTwip(0.984)  // ≈ 2.5 cm

const BS  = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const ALL = { top: BS, bottom: BS, left: BS, right: BS }
const NON = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}
const CM = { top: 25, bottom: 25, left: 110, right: 110 }
const GF        = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }
const DARK_BLUE = { type: ShadingType.CLEAR, color: 'auto', fill: '1F4E79' }
const LITE_BLUE = { type: ShadingType.CLEAR, color: 'auto', fill: 'DEEAF1' }
const BS_THIN   = { style: BorderStyle.SINGLE, size: 2, color: 'BDD7EE' }
const ALL_THIN  = { top: BS_THIN, bottom: BS_THIN, left: BS_THIN, right: BS_THIN }

// ── Helpers ───────────────────────────────────────────────────────────────────

const tx   = (text, opts = {}) =>
  new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
const txB  = (text, opts = {}) => tx(text, { bold: true, ...opts })
const txBsm= (text, opts = {}) => txB(text, { size: SZ_SM, ...opts })  // bold, 9pt — for table column headers
const txS  = (text, opts = {}) => tx(text, { size: SZ_SM, ...opts })

function par(children, opts = {}) {
  if (typeof children === 'string') {
    const lines = children.split(/\r?\n/)
    children = lines.flatMap((line, i) =>
      i === 0
        ? [tx(line)]
        : [new TextRun({ text: line, font: FONT, size: SZ, break: 1 })]
    )
  }
  return new Paragraph({
    children,
    alignment: opts.align,
    spacing: { before: opts.before ?? 25, after: opts.after ?? 25 },
  })
}
const emptyLine = () => new Paragraph({ children: [tx('')], spacing: { before: 20, after: 20 } })

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SZ_H1, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
  })
}
function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    spacing: { before: 120, after: 60 },
  })
}

function tc(children, opts = {}) {
  if (typeof children === 'string') children = [par(children)]
  return new TableCell({
    children,
    borders:       opts.borders   ?? ALL,
    shading:       opts.shading,
    columnSpan:    opts.span,
    width:         opts.w,
    verticalAlign: opts.va ?? VerticalAlign.TOP,
    margins:       CM,
  })
}
const gc   = (children, opts = {}) => tc(children, { shading: GF,        ...opts })
const dbc  = (children, opts = {}) => tc(children, { shading: DARK_BLUE,  ...opts })
const lbc  = (children, opts = {}) => tc(children, { shading: LITE_BLUE, borders: ALL_THIN, ...opts })
const tct  = (children, opts = {}) => tc(children, { borders: ALL_THIN,  ...opts })
const txW  = (text, opts = {}) => tx(text,  { color: 'FFFFFF', ...opts })
const txBW = (text, opts = {}) => txB(text, { color: 'FFFFFF', ...opts })

const tr = (...cells) => new TableRow({ children: cells })

// A4 content width in twips: 11906 (A4 210mm) − 2×1417 (2×2.5cm margins) = 9072
const TABLE_W = 9072
const wp = (pct) => Math.round(TABLE_W * pct / 100)          // plain twips (for columnWidths)
function w(pct) { return { size: wp(pct), type: WidthType.DXA } }

// tbl(rows)            — auto tblGrid (equal columns)
// tbl(rows, [p1,p2…]) — explicit column percentages → correct tblGrid for LibreOffice
function tbl(rows, pcts) {
  return new Table({
    rows,
    width: { size: TABLE_W, type: WidthType.DXA },
    ...(pcts ? { columnWidths: pcts.map(wp) } : {}),
  })
}

function kvRow(label, value, lw = 30) {
  return tr(
    gc([par([txB(label)])], { w: w(lw) }),
    tc([par(String(value ?? '—'))], { w: w(100 - lw) })
  )
}

const fmtDate = iso => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}
const yn  = v => (v === true || v === 'si' || v === 'sí') ? 'Sí' : (v === false || v === 'no') ? 'No' : (v ?? '—')
const chk = v => v ? '☑' : '☐'
const dash = v => (v && String(v).trim()) ? String(v) : '—'

// ── Image helpers ─────────────────────────────────────────────────────────────

function scaledImgRun(buf, targetW, type = 'png') {
  let h = Math.round(targetW * 0.4)
  try {
    const oW = buf.readUInt32BE(16)
    const oH = buf.readUInt32BE(20)
    if (oW > 0) h = Math.round(targetW * (oH / oW))
  } catch {}
  return new ImageRun({ data: buf, transformation: { width: targetW, height: h }, type })
}

function fmtFunciones(str) {
  const codes = (str ?? '').split(',').map(f => f.trim()).filter(Boolean)
  if (!codes.length) return ''
  if (codes.length === 1) return codes[0]
  return codes.slice(0, -1).join(', ') + ' y ' + codes[codes.length - 1]
}

// ── Logo caching ──────────────────────────────────────────────────────────────

let _cic = null, _aaa = null
const cicLogo = () => { if (!_cic) { const p = join(LOGOS_DIR, 'cicbiogune.png'); if (existsSync(p)) _cic = readFileSync(p) } return _cic }
const aaaLogo = () => { if (!_aaa) { const p = join(LOGOS_DIR, 'aaalac.png');    if (existsSync(p)) _aaa = readFileSync(p) } return _aaa }

// ── Common document blocks ────────────────────────────────────────────────────

function makeHeader() {
  const cic = cicLogo()
  const aaa = aaaLogo()
  return tbl([tr(
    tc([new Paragraph({ children: aaa ? [scaledImgRun(aaa, 110)] : [tx('AAALAC')],     spacing: { before: 40, after: 40 } })],                              { borders: NON, w: w(25) }),
    tc([], { borders: NON, w: w(50) }),
    tc([new Paragraph({ children: cic ? [scaledImgRun(cic, 130)] : [tx('CIC bioGUNE')], alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 } })], { borders: NON, w: w(25) }),
  )], [25, 50, 25])
}

function makeFooter(label) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        txS(`${label}. Página `),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ_SM }),
        txS(' de '),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SZ_SM }),
        txS('          Revisión 2 (agosto 2024)'),
      ],
    })],
  })
}

function makeEstablishment() {
  return tbl([
    tr(gc([par([txB('Datos del establecimiento usuario')])], { span: 2 })),
    kvRow('Nombre', 'CIC bioGUNE'),
    kvRow('Número de registro', 'ES489010006106'),
    kvRow('Fecha de autorización', '4/3/2011'),
    kvRow('Responsable EU', 'Juan Anguita Castillo'),
    kvRow('Responsable de bienestar animal', 'Juan Rodríguez Cuesta'),
    kvRow('Veterinario designado', 'Juan Rodríguez Cuesta'),
  ])
}

// ── Firma block ───────────────────────────────────────────────────────────────

const FIRMA_TARGET_W = 132  // ≈ 3.5 cm a 96 dpi

function makeFirmaBlock(nombre) {
  let imgPar
  if (_firmaBuf) {
    let imgH = 50
    try {
      const oW = _firmaBuf.readUInt32BE(16)
      const oH = _firmaBuf.readUInt32BE(20)
      if (oW > 0) imgH = Math.round(FIRMA_TARGET_W * (oH / oW))
    } catch {}
    imgPar = new Paragraph({
      children: [new ImageRun({ data: _firmaBuf, transformation: { width: FIRMA_TARGET_W, height: imgH }, type: 'png' })],
      spacing: { before: 60, after: 60 },
    })
  } else {
    imgPar = par([tx('(firma)', { color: 'AAAAAA' })], { before: 80, after: 80 })
  }

  return [
    par([
      txB('F. FIRMA: '),
      tx('El/La abajo firmante declara que conoce las directrices éticas y la legislación aplicables a la investigación con animales y que se compromete a cumplirlas.'),
    ], { before: 80, after: 40 }),
    imgPar,
    par([txB(nombre ?? '—')], { before: 10, after: 20 }),
    emptyLine(),
  ]
}

function buildDoc(children, footerLabel) {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: SZ },
        },
      },
    },
    sections: [{
      properties: { page: { margin: { top: MARG, bottom: MARG, left: MARG, right: MARG } } },
      footers: { default: makeFooter(footerLabel) },
      children,
    }],
  })
}

function notesPar(text) {
  return new Paragraph({ children: [txS(text)], spacing: { before: 40, after: 40 } })
}

// ── Real Word footnotes via zip post-processing ───────────────────────────────

function xmlEsc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function buildFootnotesXml(entries) {
  const ns = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`
  const sep = [
    `<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>`,
    `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>`,
  ].join('')
  const notes = entries.map(({ id, text }) =>
    `<w:footnote w:id="${id}">` +
    `<w:p>` +
    `<w:pPr><w:pStyle w:val="FootnoteText"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>` +
    `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve"> ${xmlEsc(text)}</w:t></w:r>` +
    `</w:p>` +
    `</w:footnote>`
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${ns}>${sep}${notes}</w:footnotes>`
}

async function addDocxFootnotes(docxBuf, entries) {
  if (!entries || entries.length === 0) return docxBuf
  const zip = await new JSZip().loadAsync(docxBuf)

  // Patch document.xml: replace just the <w:t>FNN</w:t> with <w:footnoteReference/>
  // (leaves the surrounding <w:r><w:rPr>…</w:rPr> intact — safe, no cross-boundary risk)
  let docXml = await zip.file('word/document.xml').async('string')
  for (const { id } of entries) {
    docXml = docXml.replace(
      new RegExp(`<w:t[^>]*>${FN_MARKER(id)}<\\/w:t>`, 'g'),
      `<w:footnoteReference w:id="${id}"/>`
    )
  }
  zip.file('word/document.xml', docXml)

  // Add footnotes.xml
  zip.file('word/footnotes.xml', buildFootnotesXml(entries))

  // Register content type
  let ct = await zip.file('[Content_Types].xml').async('string')
  if (!ct.includes('footnotes')) {
    ct = ct.replace('</Types>', '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>')
    zip.file('[Content_Types].xml', ct)
  }

  // Register relationship
  let rels = await zip.file('word/_rels/document.xml.rels').async('string')
  if (!rels.includes('footnotes')) {
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdFootnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>')
    zip.file('word/_rels/document.xml.rels', rels)
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN A
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCION_LABELS = {
  A: 'A. Cuidado de los animales',
  B: 'B. Eutanasia',
  C: 'C. Realización de procedimientos',
  D: 'D. Diseño de proyectos y procedimientos',
  E: 'E. Responsabilidad supervisión in situ',
  F: 'F. Veterinario Designado',
}

const FINALIDAD_LABELS_A = {
  a: 'a. Investigación básica',
  b: 'b. Investigación traslacional',
  c: 'c. Utilización reglamentaria y producción rutinaria',
  d: 'd. Protección del medio ambiente natural en interés de la salud o bienestar de los seres humanos o de los animales',
  e: 'e. Preservación de especies',
  f: 'f. Enseñanza superior o formación para la adquisición, mantenimiento o mejora',
  g: 'g. Investigaciones forenses',
}

const SEV_LABELS = { none: 'Sin clasificar', norecovery: 'Sin recuperación', low: 'Leve', medium: 'Moderada', high: 'Severa' }

// Single-cell full-width grey header row (span = number of cols in that table)
function secRow(title, span = 1) {
  return tr(gc([par([txB(title)])], { w: w(100), span }))
}
// Bold paragraph heading used for B.x and D.x section labels
const secHead   = text => new Paragraph({ children: [txB(text)],                    spacing: { before: 120, after: 40 } })
const secHeadSm = text => new Paragraph({ children: [txB(text, { size: SZ_SM })],   spacing: { before: 120, after: 40 } })
const noteDisplay = (val, nota) => (val != null && String(val).trim()) ? (nota ? `${val} (${nota})` : String(val)) : null
// Single-cell full-width light-blue header row (accepts string or TextRun[])
function secRowBlue(children, span = 1) {
  const parChildren = typeof children === 'string'
    ? [par([txB(children)])]
    : [par(children)]
  return tr(lbc(parChildren, { w: w(100), span }))
}
// Single-cell full-width content row (standard border)
function fullTc(children, span = 1) {
  if (typeof children === 'string') children = [par(children)]
  return tr(tc(children, { w: w(100), span }))
}
// Single-cell full-width content row (thin border)
function fullTcThin(children, span = 1) {
  if (typeof children === 'string') children = [par(children)]
  return tr(tct(children, { w: w(100), span }))
}
// Footnote reference marker — replaced post-generation with real Word footnoteRef XML
const FN_MARKER = id => `FN${id}`
const sup = n => new TextRun({ text: FN_MARKER(n), font: FONT, size: 20, superScript: true })

async function genSeccionA(proyectoId) {
  const proyecto = readProyecto(proyectoId)
  if (!proyecto) throw new Error('Proyecto no encontrado')

  const a     = proyecto.seccionA ?? {}
  const res   = a.responsable ?? {}
  const procs = (proyecto.procedimientos ?? []).map(id => readProc(id)).filter(Boolean)
  const fin   = a.financiacion ?? {}
  const lr    = a.lugar_realizacion ?? {}
  const ca    = a.condiciones_alojamiento ?? {}

  // ── Lugar de realización ──────────────────────────────────────────────────
  function lugarRows() {
    if ('animalario_cicbiogune' in lr) {
      return [
        par([tx(chk(lr.animalario_cicbiogune)), tx(' Animalario CIC bioGUNE')]),
        par([tx(chk(lr.otro)), tx(' Otro. '), txB('Indicar: '), tx(lr.otro ? (lr.descripcion ?? '') : '')]),
      ]
    }
    const tipo = lr.tipo ?? ''
    return [
      par([tx(chk(tipo === 'animalario_cicbiogune')), tx(' Animalario CIC bioGUNE')]),
      par([tx(chk(tipo === 'otro')), tx(' Otro. '), txB('Indicar: '), tx(tipo === 'otro' ? (lr.descripcion ?? '') : '')]),
    ]
  }

  // ── Condiciones alojamiento ───────────────────────────────────────────────
  function condRows() {
    if ('estandar' in ca) {
      const rows = [
        par([tx(chk(ca.estandar)), tx(' Según las condiciones estándar del CIC bioGUNE'), sup(8)]),
        par([tx(chk(ca.variaciones)), tx(' Con las siguientes variaciones:')]),
      ]
      if (ca.variaciones && ca.descripcion)
        rows.push(par([tx('     '), tx(ca.descripcion)]))
      rows.push(par([tx('☐ Otras condiciones. '), txB('Describir:')]))
      return rows
    }
    const tipo = ca.tipo ?? ''
    return [
      par([tx(chk(tipo === 'estandar')), tx(' Según las condiciones estándar del CIC bioGUNE'), sup(8)]),
      par([tx(chk(tipo === 'variaciones' || tipo === 'especiales')), tx(' Con las siguientes variaciones:')]),
      ...(tipo !== 'estandar' && ca.descripcion ? [par([tx('     '), tx(ca.descripcion)])] : []),
      par([tx('☐ Otras condiciones. '), txB('Describir:')]),
    ]
  }

  const children = [
    // ── Logos ──────────────────────────────────────────────────────────────
    makeHeader(),
    emptyLine(),

    // ── Título principal (Calibri 16pt) ─────────────────────────────────────
    new Paragraph({
      children: [new TextRun({
        text: 'SOLICITUD DE EVALUACIÓN ÉTICA DE UN PROYECTO DE INVESTIGACIÓN CON ANIMALES DE INVESTIGACIÓN',
        font: FONT, size: 32, bold: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
    }),

    // ── Título proyecto + CBBA (dark blue header, white text) ──────────────
    tbl([
      tr(
        dbc([par([txBW('Título del proyecto:')])],           { w: w(35) }),
        tc([par(a.titulo ?? proyecto.titulo ?? '')],         { w: w(65) }),
      ),
      tr(tc([par([
        txB('Registro de referencia (CBBA): '),
        tx((a.referencia_cbba ?? proyecto.referencia_cbba)
          ? `P-CBG-CBBA-${(a.referencia_cbba ?? proyecto.referencia_cbba ?? '').replace(/^P-CBG-CBBA-/, '')}`
          : 'P-CBG-CBBA-'),
      ])], { w: w(100), span: 2 })),
    ]),
    emptyLine(),

    // ── Establecimiento usuario ─────────────────────────────────────────────
    tbl([
      tr(lbc([
        par([txB('Identificación del establecimiento usuario (EU)')], { align: AlignmentType.CENTER }),
        par([new TextRun({ text: '(Indicar dónde se va a llevar a cabo la experimentación)', font: FONT, size: SZ_SM, italics: true })], { align: AlignmentType.CENTER }),
      ], { w: w(100) })),
      tr(tc([
        par([txB('Nombre: '), tx('CIC bioGUNE')]),
        par([txB('Número de registro (REGA): '), tx('ES489010006106')]),
        par([txB('Fecha de registro: '), tx('4/3/2011')]),
      ], { w: w(100) })),
      tr(tc([
        par([txB('Nombre y apellidos del responsable del EU: '), tx('Juan Anguita Castillo')]),
        par([txB('E-mail: '), tx('janguita@cicbiogune.es')]),
      ], { w: w(100) })),
      tr(tc([
        par([txB('Nombre y apellidos del responsable de bienestar animal: '), tx('Juan Rodríguez Cuesta')]),
        par([txB('E-mail: '), tx('juanrodriguezcuesta@gmail.com')]),
      ], { w: w(100) })),
      tr(tc([
        par([txB('Nombre y apellidos del veterinario designado: '), tx('Juan Rodríguez Cuesta')]),
        par([txB('E-mail: '), tx('juanrodriguezcuesta@gmail.com')]),
      ], { w: w(100) })),
    ]),
    emptyLine(),

    // ── A. INFORMACIÓN GENERAL ──────────────────────────────────────────────
    new Paragraph({
      children: [new TextRun({ text: 'A. INFORMACIÓN GENERAL DEL PROYECTO', font: FONT, size: SZ, bold: true })],
      spacing: { before: 140, after: 80 },
    }),

    // ── A.1 Responsable (light blue, thin borders, ECC superscript) ─────────
    new Paragraph({ children: [txB('A.1 RESPONSABLE DEL PROYECTO')], spacing: { before: 80, after: 40 } }),
    tbl([
      tr(
        lbc([par([txB('NIF/ Pasaporte')])],    { w: w(50) }),
        lbc([par([txB('Nombre y apellidos')])], { w: w(50) }),
      ),
      tr(
        tct([par(dash(res.nif_pasaporte))],    { w: w(50) }),
        tct([par(dash(res.nombre_apellidos))], { w: w(50) }),
      ),
      tr(
        lbc([par([txB('Teléfono')])],           { w: w(50) }),
        lbc([par([txB('Correo electrónico')])], { w: w(50) }),
      ),
      tr(
        tct([par(dash(res.telefono))], { w: w(50) }),
        tct([par(dash(res.email))],    { w: w(50) }),
      ),
      tr(lbc([par([
        txB('Función en experimentación animal según ECC/566/2015'),
        new TextRun({ text: '1', font: FONT, size: 14, superScript: true }),
      ])], { w: w(100), span: 2 })),
      tr(tct([par(
        res.funcion_ecc566
          ? (FUNCION_LABELS[res.funcion_ecc566] ?? res.funcion_ecc566)
          : '—'
      )], { w: w(100), span: 2 })),
      tr(
        lbc([par([txB('Autoridad Competente')])],                          { w: w(50) }),
        lbc([par([txB('Última fecha de acreditación o mantenimiento')])],  { w: w(50) }),
      ),
      tr(
        tct([par(dash(res.autoridad_competente))],  { w: w(50) }),
        tct([par(fmtDate(res.fecha_acreditacion))], { w: w(50) }),
      ),
    ]),
    emptyLine(),

    // ── A.2 Participantes (light blue, thin borders, abbreviated functions) ─
    new Paragraph({ children: [txB('A.2 CAPACITACIÓN DE LAS PERSONAS QUE PARTICIPAN EN EL PROYECTO')], spacing: { before: 80, after: 40 } }),
    tbl([
      tr(
        lbc([par([txB('Nombre y apellidos')])], { w: w(60) }),
        lbc([par([txB('Función/es')])],          { w: w(18) }),
        lbc([par([txB('NIF/ Pasaporte')])],      { w: w(22) }),
      ),
      ...(a.participantes ?? []).map(pt => tr(
        tct([par(pt.nombre_apellidos ?? '')], { w: w(60) }),
        tct([par(fmtFunciones(pt.funciones))], { w: w(18) }),
        tct([par(pt.nif_pasaporte ?? '')],    { w: w(22) }),
      )),
      ...((a.participantes ?? []).length === 0
        ? Array(3).fill(null).map(() => tr(
            tct([par('')], { w: w(60) }),
            tct([par('')], { w: w(18) }),
            tct([par('')], { w: w(22) }),
          ))
        : []),
    ], [60, 18, 22]),
    emptyLine(),

    // ── A.3 Duración, financiación y localización (light blue, thin borders) ─
    new Paragraph({ children: [txB('A.3 DURACIÓN, FINANCIACIÓN Y LOCALIZACIÓN')], spacing: { before: 80, after: 40 } }),
    tbl([
      tr(
        lbc([par([txB('Fecha prevista de inicio')])],       { w: w(50) }),
        lbc([par([txB('Fecha prevista de finalización'), sup(2)])], { w: w(50) }),
      ),
      tr(
        tct([par(fmtDate(a.duracion?.fecha_inicio))], { w: w(50) }),
        tct([par(fmtDate(a.duracion?.fecha_fin))],    { w: w(50) }),
      ),
      tr(lbc([par([txB('Fuente de financiación')])], { w: w(100), span: 2 })),
      tr(tct([par([txB('Entidad financiadora y programa: '), tx(dash(fin.entidad_programa))])], { w: w(100), span: 2 })),
      tr(tct([
        par([tx(chk(fin.estado === 'solicitada')), tx(' Solicitada')]),
        par([tx(chk(fin.estado === 'aprobada')),   tx(' Aprobada. (Número de proyecto: '), tx(dash(fin.numero_proyecto)), tx(')')]),
      ], { w: w(100), span: 2 })),
      tr(lbc([par([txB('¿Es el IP del proyecto el responsable de la financiación del mismo?')])], { w: w(100), span: 2 })),
      tr(tct([
        par([tx(chk(fin.ip_es_responsable === true)),  tx(' Sí')]),
        par([tx(chk(fin.ip_es_responsable === false)), tx(' No. '), txB('Indicar: '),
          tx(fin.ip_es_responsable === false ? (fin.ip_responsable_otro ?? '') : ''),
        ]),
      ], { w: w(100), span: 2 })),
      tr(lbc([par([txB('Lugar de realización del proyecto')])], { w: w(100), span: 2 })),
      tr(tct(lugarRows(), { w: w(100), span: 2 })),
    ]),
    emptyLine(),

    // ── A.4 Resumen y objetivos (light blue, thin borders) ─────────────────
    new Paragraph({ children: [txB('A.4 RESUMEN Y OBJETIVOS DEL PROYECTO')], spacing: { before: 80, after: 40 } }),
    tbl([
      secRowBlue('Objetivo científico principal', 3),
      fullTcThin([par(a.objetivos?.objetivo_principal ?? '')], 3),
      secRowBlue('Resumen (300 palabras máx.)', 3),
      fullTcThin([par(a.objetivos?.resumen ?? '')], 3),
      secRowBlue('Análisis daño/beneficio justificado (300 palabras máx.)', 3),
      fullTcThin([par(a.objetivos?.dano_beneficio ?? '')], 3),
      secRowBlue('Tipo de proyecto según el Art. 31 RD 53/2013', 3),
      tr(
        tct([par([tx(chk(a.tipo_proyecto === 'I')),   tx(' Tipo I')])],   { w: w(33) }),
        tct([par([tx(chk(a.tipo_proyecto === 'II')),  tx(' Tipo II')])],  { w: w(33) }),
        tct([par([tx(chk(a.tipo_proyecto === 'III')), tx(' Tipo III')])], { w: w(34) }),
      ),
      secRowBlue('Finalidad del proyecto', 3),
      fullTcThin(
        Object.entries(FINALIDAD_LABELS_A).map(([k, lbl]) =>
          par([tx(chk((a.finalidad ?? []).includes(k))), tx(` ${lbl}`)])
        ),
        3
      ),
    ]),
    emptyLine(),

    // ── A.5 Las 3Rs (light blue, thin borders, superscripts) ────────────────
    new Paragraph({ children: [txB('A.5 CUMPLIMIENTO DE LAS 3 Rs:')], spacing: { before: 80, after: 40 } }),
    tbl([
      secRowBlue([txB('Reemplazo'), sup(3)]),
      fullTcThin([par(a.tres_rs?.reemplazo ?? '')]),
      secRowBlue([txB('Reducción'), sup(4)]),
      fullTcThin([par(a.tres_rs?.reduccion ?? '')]),
      secRowBlue([txB('Refinamiento'), sup(5)]),
      fullTcThin([par(a.tres_rs?.refinamiento ?? '')]),
    ]),
    emptyLine(),

    // ── A.6 Resumen de procedimientos (light blue, thin, centered headers) ──
    new Paragraph({ children: [txB('A.6 RESUMEN DE PROCEDIMIENTOS:')], spacing: { before: 80, after: 40 } }),
    tbl([
      tr(
        lbc([par([txB('Nº')],      { align: AlignmentType.CENTER })], { w: w(5)  }),
        lbc([par([txB('Título')],  { align: AlignmentType.CENTER })], { w: w(37) }),
        lbc([par([txB('Especie')], { align: AlignmentType.CENTER })], { w: w(22) }),
        lbc([par([txB('Nº animales')], { align: AlignmentType.CENTER })], { w: w(18) }),
        lbc([par([txB('Severidad')],   { align: AlignmentType.CENTER })], { w: w(18) }),
      ),
      ...(procs.length > 0
        ? procs.map((proc, idx) => tr(
            tct([par(String(idx + 1))],                                                                   { w: w(5)  }),
            tct([par(proc.datos_generales?.titulo_procedimiento ?? '')],                                  { w: w(37) }),
            tct([par((proc.datos_generales?.especies ?? []).join(', '))],                                 { w: w(22) }),
            tct([par(dash(noteDisplay(proc.datos_generales?.num_animales, proc.datos_generales?.num_animales_nota)))], { w: w(18) }),
            tct([par((Array.isArray(proc.clasificacion_severidad) ? proc.clasificacion_severidad : [proc.clasificacion_severidad]).filter(v => v && v.length > 1 && v !== 'none' && SEV_LABELS[v]).map(v => SEV_LABELS[v]).join(', ') || '—')], { w: w(18) }),
          ))
        : [tr(
            tct([par('')], { w: w(5)  }),
            tct([par('')], { w: w(37) }),
            tct([par('')], { w: w(22) }),
            tct([par('')], { w: w(18) }),
            tct([par('')], { w: w(18) }),
          )]
      ),
    ], [5, 37, 22, 18, 18]),
    emptyLine(),

    par([
      txB('¿Contempla un procedimiento de cría de animales? '),
      tx(chk(!a.hay_cria)), tx(' NO     '),
      tx(chk(a.hay_cria)),  tx(' SÍ'),
    ]),

    ...(a.hay_cria ? [
      par([new TextRun({ text: 'Si ha contestado que sí, necesita rellenar la siguiente tabla e incluir un formulario C para cada línea.', font: FONT, size: SZ, color: '1F4E79' })]),
      emptyLine(),
      tbl([
        tr(
          lbc([par([txB('Nomenclatura internacional de la cepa/línea a criar'), sup(6)])], { w: w(62) }),
          lbc([par([txB('Acrónimo de la cepa/línea'), sup(7)])],                            { w: w(17) }),
          lbc([par([txB('Número de animales que van a generarse')])],                       { w: w(21) }),
        ),
        ...(a.cepas_cria ?? []).map(c => tr(
          tct([par(c.nomenclatura_internacional ?? '')], { w: w(62) }),
          tct([par(c.acronimo ?? '')],                   { w: w(17) }),
          tct([par(String(c.num_animales ?? ''))],       { w: w(21) }),
        )),
      ], [62, 17, 21]),
    ] : []),
    emptyLine(),

    // ── A.7 Condiciones de alojamiento (light blue, thin borders) ───────────
    new Paragraph({ children: [txB('A.7 CONDICIONES DE ALOJAMIENTO, ZOOTÉCNICAS Y CUIDADO DE ANIMALES:')], spacing: { before: 80, after: 40 } }),
    tbl([
      secRowBlue('Marcar con una X'),
      fullTcThin(condRows()),
    ]),
    emptyLine(),

    // ── Firma ───────────────────────────────────────────────────────────────
    ...makeFirmaBlock(a.firmante || res.nombre_apellidos),
  ]

  const footnoteEntries = [
    { id: 1, text: 'Función según orden ECC/566/2015: A. Cuidado de los animales B. Eutanasia C. Realización de los procedimientos. D. Diseño de los proyectos y procedimientos. E. Responsabilidad de la supervisión in situ del bienestar y cuidados de los animales. F. Veterinario Designado. Ninguna función específica.' },
    { id: 2, text: 'Máximo 5 años.' },
    { id: 3, text: '¿Por qué no es posible alcanzar los objetivos de su proyecto sin usar animales? ¿Qué alternativas ha considerado y por qué no son posibles? ¿Qué alternativas usará para alcanzar sus objetivos?' },
    { id: 4, text: '¿Qué medidas se han tomado o se tomarán para asegurar que se utiliza el menor número posible de animales? ¿Existe la posibilidad de que este procedimiento ya se haya realizado? ¿Contempla alguna medida para evitar la repetición injustificada de procedimientos?' },
    { id: 5, text: 'Explique su elección de especie(s), cepa(s) o raza(s), modelo(s) y método(s). Explique por qué son los más adecuados para sus objetivos.' },
    ...(a.hay_cria ? [
      { id: 6, text: 'Nomenclature for Mouse Strains. Jackson Laboratories.' },
      { id: 7, text: 'Nombre con el que se referirá a la cepa/línea a lo largo del Proyecto y en el animalario de CIC bioGUNE.' },
    ] : []),
    { id: 8, text: 'Las condiciones estándar del CIC bioGUNE consisten en el alojamiento de los animales en jaulas de policarbonato con lecho de viruta de madera. La densidad animal en cada jaula no excede en ningún momento la densidad máxima descrita en el Anexo II del RD 53/2013. Las salas de estabulación se mantienen dentro de los rangos de temperatura y humedad relativa apropiados para roedores (20-24ºC y 50-65%, respectivamente). La iluminación de las salas consiste en un ciclo de luz-oscuridad de 12:12 horas (luz de 08:00h a 20:00h). Los animales se alimentan con dieta de mantenimiento o cría específica para roedores y se les suministra agua de bebida ad libitum, mediante el empleo de biberón o de un sistema de bebida automática, según proceda.' },
  ]

  const rawBuf = await Packer.toBuffer(buildDoc(children, 'Sección A'))
  return addDocxFootnotes(rawBuf, footnoteEntries)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN B
// ═══════════════════════════════════════════════════════════════════════════════

async function genSeccionB(procId, numeroOverride) {
  const proc = readProc(procId)
  if (!proc) throw new Error('Procedimiento no encontrado')

  // Derive procedure number from position in project if not supplied
  let numeroProcedimiento = numeroOverride
  if (numeroProcedimiento == null) {
    const proyecto = proc.proyecto_id ? readProyecto(proc.proyecto_id) : null
    if (proyecto && Array.isArray(proyecto.procedimientos)) {
      const idx = proyecto.procedimientos.indexOf(procId)
      if (idx !== -1) numeroProcedimiento = idx + 1
    }
  }
  const numeroLabel = numeroProcedimiento != null ? String(numeroProcedimiento) : '—'

  const dg  = proc.datos_generales     ?? {}
  const met = proc.metodologia         ?? {}
  const tm  = proc.tamano_muestral     ?? {}
  const aa  = proc.aislamiento_ayuno   ?? {}
  const ana = proc.analgesia_anestesia ?? {}
  const os  = proc.otras_sustancias    ?? {}
  const fin = proc.finalizacion        ?? {}
  const reu = proc.reutilizacion       ?? {}
  const frm = proc.firma               ?? {}

  const sevLabel = (Array.isArray(proc.clasificacion_severidad)
    ? proc.clasificacion_severidad
    : [proc.clasificacion_severidad])
    .map(v => SEV_LABELS[v] ?? v).filter(Boolean).join(', ') || '—'

  function dynTable(headers, rows, widths) {
    if (!rows.length) return [par('— Sin registros —')]
    return [tbl([
      tr(...headers.map((h, i) => lbc([par([txBsm(h)])], { w: w(widths[i]) }))),
      ...rows.map(r => tr(...r.map((v, i) => tct([par(dash(v))], { w: w(widths[i]) })))),
    ], widths)]
  }

  // kvRow with light-blue label (SeccionB style)
  const kvRowB = (label, value, lw = 30) => tr(
    lbc([par([txB(label)])], { w: w(lw) }),
    tct([par(String(value ?? '—'))], { w: w(100 - lw) })
  )

  // Analgesia/anestesia table helper (6-col, one empty row if no data)
  const ANA_COLS_W = [12, 20, 28, 10, 14, 16]
  const ANA_HDRS   = ['Frecuencia', 'Grupo / Nº animales', 'Producto / Concentración', 'Dosis (mg/kg)', 'Volumen (ml/kg)', 'Vía']
  function anaTable(rows) {
    const dataRows = rows && rows.length
      ? rows.map(r => tr(...[r.frecuencia, r.grupo_animales, r.producto_concentracion, r.dosis_mg_kg, r.volumen_ml_kg, r.via]
          .map((v, i) => tct([par(dash(v))], { w: w(ANA_COLS_W[i]) }))))
      : [tr(...ANA_COLS_W.map(cw => tct([par('')], { w: w(cw) })))]
    return tbl([
      tr(...ANA_HDRS.map((h, i) => lbc([par([txBsm(h)])], { w: w(ANA_COLS_W[i]) }))),
      ...dataRows,
    ], ANA_COLS_W)
  }

  // Reutilización destino label
  const reuDestinos = {
    'Sacrifica los animales por requerimientos del procedimiento': 'Sacrificio por requerimientos del procedimiento',
    'Mantener los animales vivos para utilizarlos en otro procedimiento': 'Mantener vivos para otro procedimiento',
    'Mantener los animales vivos por otros procedimientos': 'Mantener vivos por otros procedimientos',
  }
  const reuDestinoLabel = reuDestinos[reu.destino] ?? dash(reu.destino)

  const children = [
    makeHeader(), emptyLine(),

    // ── B. PROCEDIMIENTO ──────────────────────────────────────────────────────
    new Paragraph({
      children: [
        new TextRun({ text: 'B.\t', font: FONT, size: SZ, bold: true }),
        new TextRun({ text: 'PROCEDIMIENTO', font: FONT, size: SZ, bold: true, underline: { type: UnderlineType.SINGLE } }),
      ],
      spacing: { before: 80, after: 60 },
    }),

    // ── Número de procedimiento (fondo azul, texto blanco) ────────────────────
    tbl([tr(
      dbc([par([txBW('Número de procedimiento:')])], { w: w(70) }),
      dbc([par([txW(numeroLabel)])], { w: w(30) }),
    )], [70, 30]),
    emptyLine(),

    // ── B.1 DATOS GENERALES DEL PROCEDIMIENTO ────────────────────────────────
    secHead('B.1 DATOS GENERALES DEL PROCEDIMIENTO'),
    tbl([
      kvRowB('Título',                  dg.titulo_procedimiento,                             25),
      kvRowB('Especie/s animal/es',     (dg.especies ?? []).join(', '),                      25),
      kvRowB('Cepa/línea',              dg.cepa_linea,                                       25),
      kvRowB('Sexo',                    dg.sexo,                                             25),
      kvRowB('Edad',                    dg.edad_peso,                                        25),
      kvRowB('Nº total de animales',    dash(noteDisplay(dg.num_animales, dg.num_animales_nota)), 25),
      kvRowB('Severidad',               dash(dg.severidad),                                  25),
      tr(
        lbc([par([txB('Duración')])], { w: w(25) }),
        tct([par(dash(dg.duracion))], { w: w(75) }),
      ),
    ], [25, 75]),
    emptyLine(),

    // ── B.2 METODOLOGÍA Y FASES ───────────────────────────────────────────────
    secHead('B.2 METODOLOGÍA Y FASES DEL PROCEDIMIENTO'),
    tbl([
      secRowBlue([txB('Fases del procedimiento')]),
      fullTcThin([par(dash(met.descripcion))]),
      secRowBlue('Describa en qué fases del procedimiento se prevé que el animal pueda experimentar sufrimiento, dolor, angustia o malestar'),
      fullTcThin([par(dash(met.justificacion_procedimiento))]),
    ]),
    emptyLine(),

    // ── B.3 TAMAÑO MUESTRAL ───────────────────────────────────────────────────
    secHead('B.3 TAMAÑO MUESTRAL'),
    (() => {
      const grupos = tm.grupos ?? []
      const grupoPars = grupos.length
        ? [
            par([txB('Grupos experimentales:')], { before: 120, after: 25 }),
            ...grupos.map(g =>
              par(`• ${g.nombre || '—'} (n = ${noteDisplay(g.n, g.n_nota) || '—'})${g.justificacion ? ': ' + g.justificacion : ''}`)
            ),
          ]
        : []
      return tbl([
        secRowBlue('Indicar el número total de animales y los grupos experimentales (incluyendo controles) que se van a utilizar'),
        fullTcThin([par(dash(tm.numero_total)), ...grupoPars]),
        secRowBlue('Justificar estadísticamente (o método empleado) el número total de animales a utilizar y el de animales por grupo experimental'),
        fullTcThin([par(dash(tm.justificacion))]),
      ])
    })(),
    emptyLine(),

    // ── B.4 AISLAMIENTO Y AYUNO ───────────────────────────────────────────────
    secHead('B.4 AISLAMIENTO Y AYUNO'),
    tbl([
      tr(lbc([par([txB('Aislamiento')])], { w: w(100), span: 2 })),
      kvRowB('Duración',     dash(aa.duracion_aislamiento)),
      kvRowB('Justificación', dash(aa.justificacion_aislamiento ?? aa.justificacion)),
      tr(lbc([par([txB('Ayuno')])], { w: w(100), span: 2 })),
      tr(
        tct([par([tx(chk(aa.hay_ayuno_alimento === true || aa.hay_ayuno === 'Sí')), tx(' Alimento')])], { w: w(50) }),
        tct([par([tx(chk(aa.hay_ayuno_agua === true)),                              tx(' Agua')])],     { w: w(50) }),
      ),
      kvRowB('Duración',     dash(aa.duracion_ayuno)),
      kvRowB('Justificación', dash(aa.justificacion_ayuno ?? '')),
    ]),
    emptyLine(),

    // ── B.5 TÉCNICAS ──────────────────────────────────────────────────────────
    secHead('B.5 TÉCNICAS'),
    ...dynTable(
      ['Frecuencia', 'Grupo / Nº animales', 'Técnica experimental/quirúrgica'],
      (proc.tecnicas ?? []).map(t => [t.frecuencia, t.grupo_animales ?? t.observaciones, t.nombre]),
      [15, 30, 55]
    ),
    emptyLine(),

    // ── B.6 ANALGESIA Y ANESTESIA ─────────────────────────────────────────────
    secHead('B.6 USO DE ANALGESIA Y ANESTESIA'),
    tbl([
      tr(lbc([par([txBsm('Analgesia')])], { w: w(100), span: 6 })),
      tr(...ANA_HDRS.map((h, i) => lbc([par([txBsm(h)])], { w: w(ANA_COLS_W[i]) }))),
      ...((ana.analgesia ?? []).length
        ? (ana.analgesia).map(r => tr(...[r.frecuencia, r.grupo_animales, r.producto_concentracion, r.dosis_mg_kg, r.volumen_ml_kg, r.via].map((v, i) => tct([par(dash(v))], { w: w(ANA_COLS_W[i]) }))))
        : [tr(...ANA_COLS_W.map(cw => tct([par('')], { w: w(cw) })))]),
      tr(lbc([par([txBsm('Anestesia')])], { w: w(100), span: 6 })),
      tr(...ANA_HDRS.map((h, i) => lbc([par([txBsm(h)])], { w: w(ANA_COLS_W[i]) }))),
      ...((ana.anestesia ?? []).length
        ? (ana.anestesia).map(r => tr(...[r.frecuencia, r.grupo_animales, r.producto_concentracion, r.dosis_mg_kg, r.volumen_ml_kg, r.via].map((v, i) => tct([par(dash(v))], { w: w(ANA_COLS_W[i]) }))))
        : [tr(...ANA_COLS_W.map(cw => tct([par('')], { w: w(cw) })))]),
    ], ANA_COLS_W),
    emptyLine(),

    // ── B.7 ADMINISTRACIÓN DE OTRAS SUSTANCIAS ────────────────────────────────
    secHead('B.7 ADMINISTRACIÓN DE OTRAS SUSTANCIAS'),
    anaTable(os.sustancias),
    emptyLine(),
    par([txB('¿Alguno de los productos supone un riesgo para la salud o el medio ambiente (citotóxico, biológico, etc.)?')]),
    tbl([tr(
      tct([par([tx(chk(os.hay_riesgo !== true)), tx(' No')])], { w: w(50) }),
      tct([par([tx(chk(os.hay_riesgo === true)), tx(' Sí')])], { w: w(50) }),
    )]),
    ...(os.hay_riesgo === true ? [par([tx('Si ha contestado que sí, necesita rellenar un formulario D.')])] : []),
    emptyLine(),

    // ── B.8 PARÁMETROS A MEDIR ────────────────────────────────────────────────
    secHead('B.8 PARÁMETROS A MEDIR'),
    (() => {
      const B8_HDRS = ['Frecuencia', 'Grupo / Nº animales', 'Parámetro/Muestra', 'Metodología/Técnica', 'Procedimiento terminal (si/no)']
      const B8_W    = [14, 18, 24, 24, 20]
      const rows8   = (proc.parametros ?? []).map(p => [p.frecuencia, p.grupo_animales ?? '', p.parametro, p.metodo_medida, p.terminal ?? ''])
      const dataRows = rows8.length ? rows8 : [[]]
      return tbl([
        tr(...B8_HDRS.map((h, i) => lbc([par([txBsm(h)])], { w: w(B8_W[i]) }))),
        ...dataRows.map(r => tr(...B8_W.map((cw, i) => tct([par(dash(r[i]))], { w: w(cw) })))),
      ], B8_W)
    })(),
    emptyLine(),

    // ── B.9 MUESTRAS ANTEMORTEM ───────────────────────────────────────────────
    secHead('B.9 MUESTRAS ANTEMORTEM'),
    (() => {
      const B9_HDRS = ['Frecuencia', 'Grupo / Nº animales', 'Muestra', 'Cantidad (g) / Volumen (mg/kg peso animal)', 'Método/Vía']
      const B9_W    = [14, 18, 20, 30, 18]
      const rows9   = (proc.muestras_antemortem ?? []).map(m => [m.frecuencia, m.grupo_animales ?? '', m.tipo, m.volumen_cantidad, m.metodo_via ?? m.procedimiento ?? ''])
      const dataRows = rows9.length ? rows9 : [[]]
      return tbl([
        tr(...B9_HDRS.map((h, i) => lbc([par([txBsm(h)])], { w: w(B9_W[i]) }))),
        ...dataRows.map(r => tr(...B9_W.map((cw, i) => tct([par(dash(r[i]))], { w: w(cw) })))),
      ], B9_W)
    })(),
    emptyLine(),

    // ── B.10 FINALIZACIÓN DEL PROCEDIMIENTO ──────────────────────────────────
    secHead('B.10 FINALIZACIÓN DEL PROCEDIMIENTO'),
    tbl([
      tr(lbc([par([
        txB('Métodos de eutanasia'), tx('. La eutanasia de los animales que tengan que ser sacrificados al finalizar el procedimiento o que se descarten del procedimiento debido a su estado de salud, se realizará por:'),
      ])], { w: w(100), span: 2 })),
      tr(tct([
        ...['Sobredosis anestésica', 'Dislocación cervical', 'CO₂', 'Decapitación', 'Perfusión transcardíaca', 'Otro'].map(m =>
          par([tx(chk((fin.metodos_eutanasia ?? []).includes(m))), tx(` ${m}`)])
        ),
      ], { w: w(100), span: 2 })),
      ...((fin.metodos_eutanasia ?? []).includes('Otro') ? [
        kvRowB('Justificar', dash(fin.justificacion_eutanasia)),
      ] : []),
    ]),
    emptyLine(),

    // ── B.11 REUTILIZACIÓN DE ANIMALES ────────────────────────────────────────
    secHead('B.11 REUTILIZACIÓN DE ANIMALES'),
    tbl([
      tr(lbc([par([txB('Al finalizar el procedimiento está previsto:')])], { w: w(100), span: 2 })),
      tr(tct([
        par([tx(chk(reu.destino === 'Sacrifica los animales por requerimientos del procedimiento')), tx(' Sacrificar los animales por requerimientos del procedimiento')]),
      ], { w: w(100), span: 2 })),
      ...(reu.destino === 'Sacrifica los animales por requerimientos del procedimiento' ? [
        tr(tct([
          par([txB('¿Qué tejido u órganos van a utilizarse? '), tx(dash(reu.tejidos))]),
        ], { w: w(100), span: 2 })),
      ] : []),
      tr(tct([
        par([tx(chk(reu.destino === 'Mantener los animales vivos para utilizarlos en otro procedimiento')), tx(' Mantener los animales vivos para utilizarlos en otro procedimiento')]),
      ], { w: w(100), span: 2 })),
      ...(reu.destino === 'Mantener los animales vivos para utilizarlos en otro procedimiento' ? [
        tr(tct([
          par([txB('Número de procedimiento: '), tx(dash(reu.num_procedimiento))]),
        ], { w: w(100), span: 2 })),
      ] : []),
      tr(tct([
        par([tx(chk(reu.destino === 'Mantener los animales vivos por otros procedimientos')), tx(' Mantener los animales vivos por otros motivos')]),
      ], { w: w(100), span: 2 })),
      ...(reu.destino === 'Mantener los animales vivos por otros procedimientos' ? [
        tr(tct([
          par([txB('Justificar: '), tx(dash(reu.justificacion_vivos))]),
        ], { w: w(100), span: 2 })),
      ] : []),
    ]),
    emptyLine(),

  ]

  return Packer.toBuffer(buildDoc(children, 'Sección B — Procedimiento'))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN C
// ═══════════════════════════════════════════════════════════════════════════════

async function genSeccionC(criaId) {
  const cria = readCria(criaId)
  if (!cria) throw new Error('Cría no encontrada')

  const sc  = cria.seccionC             ?? {}
  const id  = sc.identificacion         ?? {}
  const fen = sc.fenotipo_anormal        ?? {}
  const ce  = sc.condiciones_especiales  ?? {}
  const gen = sc.genotipaje              ?? {}
  const ag  = sc.animales_a_generar      ?? {}
  const pc  = sc.procedimiento_cria      ?? {}
  const omg = sc.omg                     ?? {}

  // ── Helpers locales ──────────────────────────────────────────────────────────
  const GEN = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }  // grey
  const gcL = (ch, opts = {}) => tc(ch, { shading: GEN, ...opts })

  // Fila cabecera gris oscuro (como "Genotipaje")
  function greyHeaderRow(label, span = 2) {
    return tr(gcL([par([txB(label)])], { w: w(100), span }))
  }
  // Fila de 2 celdas: label azul claro | value blanco fino
  const kvB = (label, value, lw = 35) => tr(
    lbc([par([txB(label)])], { w: w(lw) }),
    tct([par(String(value ?? '—'))], { w: w(100 - lw) })
  )
  // Fila full-width valor delgada
  const fullVal = (content) =>
    tr(tct(typeof content === 'string' ? [par(content)] : content, { w: w(100), span: 2 }))

  const IDOPTS = ['Rotulador indeleble', 'Crotal (oreja)', 'Perforación auricular',
                  'Etiquetado jaula', 'Tatuaje', 'Microchip', 'Otro']

  // ── Main identification table ────────────────────────────────────────────────
  const mainTable = tbl([
    // Nomenclatura
    tr(lbc([par([txB('Nombre o nomenclatura internacional'), sup(1), txB(' de la cepa/línea a criar')])],
        { w: w(100), span: 2 })),
    fullVal(dash(id.nomenclatura_internacional)),

    // Acrónimo
    tr(lbc([par([txB('Nombre o acrónimo de la cepa/línea a criar'), sup(2)])], { w: w(100), span: 2 })),
    fullVal(dash(id.acronimo)),

    // OMG
    tr(lbc([par([txB('¿Es un organismo modificado genéticamente?')])], { w: w(100), span: 2 })),
    fullVal([
      par([tx(chk(!sc.es_omg)), tx(' No')]),
      par([tx(chk(sc.es_omg)),  tx(' Si Necesita rellenar la sección C-O de este documento')]),
    ]),

    // Fenotipo anormal
    tr(lbc([par([txB('¿El fenotipo de los reproductores o de la descendencia está asociado con alguna anormalidad física, mayor susceptibilidad a padecer enfermedad o a un acortamiento de la longevidad?')])],
        { w: w(100), span: 2 })),
    fullVal([
      par([tx(chk(fen.estado === 'no')),         tx(' No')]),
      par([tx(chk(fen.estado === 'se_desconoce')), tx(' Se desconoce')]),
      par([tx(chk(fen.estado === 'si')),          tx(' Sí. Especificar: '), tx(fen.estado === 'si' ? dash(fen.descripcion) : '')]),
    ]),

    // Condiciones especiales
    tr(lbc([par([txB('¿Los animales necesitan ser mantenidos/manipulados en condiciones especiales?')])],
        { w: w(100), span: 2 })),
    fullVal([
      par([tx(chk(ce.requiere === 'no')),         tx(' No')]),
      par([tx(chk(ce.requiere === 'se_desconoce')), tx(' Se desconoce')]),
      par([tx(chk(ce.requiere === 'si')),          tx(' Sí, especificar: '), tx(ce.requiere === 'si' ? dash(ce.descripcion) : '')]),
    ]),

    // Sistema de cría
    tr(lbc([par([txB('Sistema de cría a emplear (HOxHO, HOxHE, HOxWT, ...) y estrategia:')])],
        { w: w(100), span: 2 })),
    fullVal(dash(sc.sistema_cria)),

    // Genotipaje (subgrupo azul claro)
    secRowBlue('Genotipaje', 2),
    tr(
      lbc([par([txB('Procedimiento\n(PCR, Southern, etc.)')])], { w: w(35) }),
      tct([par(dash(gen.procedimiento))], { w: w(65) }),
    ),
    tr(
      lbc([par([txB('¿Puesto a punto?')])], { w: w(35) }),
      tct([
        par([tx(chk(gen.puesto_a_punto !== true)), tx(' No')]),
        par([tx(chk(gen.puesto_a_punto === true)), tx(' Si')]),
      ], { w: w(65) }),
    ),
    tr(
      lbc([par([txB('Tipo de muestra\n(biopsia cola, sangre, etc.)')])], { w: w(35) }),
      tct([par(dash(gen.tipo_muestra))], { w: w(65) }),
    ),

    // Identificación animales
    tr(lbc([par([txB('Indicar el sistema de identificación de los animales')])], { w: w(100), span: 2 })),
    fullVal(IDOPTS.map(opt => {
      const sel = (sc.identificacion_animales ?? []).includes(opt)
      if (opt === 'Otro') {
        return par([tx(chk(sel)), tx(' Otro. Especificar: '), tx(sel ? dash(sc.identificacion_animales_otro) : '')], { before: 12, after: 12 })
      }
      return par([tx(chk(sel)), tx(` ${opt}`)], { before: 12, after: 12 })
    })),

    // Animales a generar (subgrupo azul claro)
    secRowBlue('Animales que van a generarse', 2),
    tr(
      lbc([par([txB('Número total'), sup(3)])], { w: w(35) }),
      tct([par(dash(ag.numero_total))], { w: w(65) }),
    ),
    tr(lbc([par([txB('Justificar')])], { w: w(100), span: 2 })),
    fullVal(dash(ag.justificacion)),

    // Procedimiento de cría
    tr(lbc([par([txB('Procedimiento de cría')])], { w: w(100), span: 2 })),
    fullVal([
      par([tx(chk(pc.tipo === 'estandar_cicbiogune')), txB(' Según las normas internas del CIC bioGUNE'), sup(4)]),
      par([tx(chk(pc.tipo === 'otro')), tx(' Otro. Describir: '), tx(pc.tipo === 'otro' ? dash(pc.descripcion) : '')]),
    ]),
  ])

  const children = [
    makeHeader(), emptyLine(),

    // ── Título C ───────────────────────────────────────────────────────────────
    new Paragraph({
      children: [
        new TextRun({ text: 'C.\t', font: FONT, size: SZ, bold: true }),
        new TextRun({ text: 'CRIA DE CEPAS/LÍNEAS DE RATÓN', font: FONT, size: SZ, bold: true, underline: { type: UnderlineType.SINGLE } }),
      ],
      spacing: { before: 80, after: 30 },
    }),
    par([new TextRun({ text: 'Necesita rellenar un formulario C para cada una de las cepas/líneas', font: FONT, size: SZ, color: '1F4E79', italics: true })],
      { before: 0, after: 60 }),

    mainTable,
    emptyLine(),
  ]

  // ── Sección C-O (OMG) ────────────────────────────────────────────────────────
  if (sc.es_omg) {
    // Título C-O (fondo azul oscuro, texto blanco)
    children.push(
      tbl([tr(dbc([par([txBW('C-O: ORGANISMOS MODIFICADOS GENÉTICAMENTE')])], { w: w(100) }))]),
      emptyLine(),
    )

    // 1. Utilización OMGs
    children.push(
      tbl([
        tr(lbc([par([txB('1.\tUtilización OMGs. ¿Ha sido utilizado anteriormente este OMG, en las mismas condiciones, en otro procedimiento ya aprobado?')])],
            { w: w(100), span: 2 })),
        fullVal([
          par([tx(chk(!omg.usado_anteriormente)), tx(' No')]),
          par([
            tx(chk(omg.usado_anteriormente)), tx(' Sí, nº procedimiento: '),
            tx(omg.usado_anteriormente ? dash(omg.numero_procedimiento_previo) : ''),
            tx('  '),
            new TextRun({ text: omg.usado_anteriormente ? 'No necesita seguir rellenando esta sección.' : '', font: FONT, size: SZ, color: '1F4E79' }),
          ]),
        ]),
      ]),
      emptyLine(),
    )

    if (!omg.usado_anteriormente) {
      const lm  = omg.lugar_manipulacion ?? {}
      const mg  = omg.modificacion_genetica ?? {}
      const ins = mg.inserto ?? {}
      const or  = omg.omg_resultante ?? {}
      const ins2 = or.insercion ?? {}
      const inact = or.inactiva_gen ?? {}
      const idf  = or.identificacion ?? {}
      const tec  = idf.tecnicas_disponibles ?? {}
      const mse  = or.medidas_seguridad_especiales ?? {}

      // 2. Información general
      children.push(
        tbl([
          secRowBlue('2.\tInformación general', 2),
          tr(lbc([par([txB('Clasificación de la actividad (según 98/81/CE y 2000/608/CE)')])], { w: w(100), span: 2 })),
          fullVal(dash(omg.clasificacion_actividad)),
          tr(lbc([par([txB('Descripción de las operaciones que van a realizarse')])], { w: w(100), span: 2 })),
          fullVal(dash(omg.descripcion_operaciones)),
          tr(lbc([par([txB('Lugar de manipulación (indique la dependencia del centro en la que va a ser manipulado el OMG)')])],
              { w: w(100), span: 2 })),
          fullVal([
            par([tx(chk(Array.isArray(lm.tipo) ? lm.tipo.includes('animalario_cicbiogune') : lm.tipo === 'animalario_cicbiogune')),
                 tx(' Animalario del CIC bioGUNE')]),
            par([tx(chk(Array.isArray(lm.tipo) ? lm.tipo.includes('otro') : lm.tipo === 'otro')),
                 tx(' Otro. Especificar: '), tx(dash(lm.descripcion))]),
          ]),
        ]),
        emptyLine(),
      )

      // 3. ¿Dónde se ha realizado la manipulación genética?
      children.push(
        tbl([
          secRowBlue('3.\t¿Dónde se ha realizado la manipulación genética?', 2),
          fullVal(dash(omg.donde_manipulacion_genetica)),
        ]),
        emptyLine(),
      )

      // 4. ¿Es cruce de OMGs?
      const cruces = omg.cruces ?? []
      children.push(
        tbl([
          tr(lbc([par([txB('4.\t¿Es este OMG resultado de un cruce (apareamiento) entre otros OMGs utilizados previamente en el centro?')])],
              { w: w(100), span: 3 })),
          tr(
            tct([par([tx(chk(!omg.es_cruce_omgs)), tx(' No')])], { w: w(20) }),
            tct([par([
              tx(chk(omg.es_cruce_omgs)), tx(' Sí  '),
              txB('Código CBBA asignado: '), tx(omg.es_cruce_omgs && cruces.length ? cruces.map(c => c.codigo_cbba).join(', ') : ''),
            ])], { w: w(50) }),
            tct([par([txB('Fecha de aprobación: '), tx(omg.es_cruce_omgs && cruces.length ? cruces.map(c => fmtDate(c.fecha_aprobacion)).join(', ') : '')])], { w: w(30) }),
          ),
        ]),
        emptyLine(),
      )

      // 5. Modificación genética
      children.push(
        tbl([
          secRowBlue('5.\tInformación relativa a la modificación genética', 2),
          tr(lbc([par([txB('Tipo de modificación (inserción, deleción, sustitución, fusión celular, etc.)')])], { w: w(100), span: 2 })),
          fullVal(dash(mg.tipo_modificacion)),
          tr(lbc([par([txB('Breve descripción del método de modificación utilizado')])], { w: w(100), span: 2 })),
          fullVal(dash(mg.metodo_descripcion)),
          tr(lbc([par([txB('Características del vector')])], { w: w(100), span: 2 })),
          fullVal(dash(mg.caracteristicas_vector)),
          tr(
            lbc([par([txB('Tipo de identidad del vector')])], { w: w(35) }),
            tct([par(dash(mg.tipo_identidad_vector))], { w: w(65) }),
          ),
          secRowBlue('Información del inserto (la información debe referirse exclusivamente al inserto, no al vector)', 2),
          tr(
            lbc([par([txB('Organismo de origen del inserto')])], { w: w(35) }),
            tct([par(dash(ins.organismo_origen))], { w: w(65) }),
          ),
          tr(
            lbc([par([txB('Dimensiones del inserto, mapa de restricción y secuencias')])], { w: w(35) }),
            tct([par(dash(ins.dimensiones_mapa_secuencias))], { w: w(65) }),
          ),
          tr(
            lbc([par([txB('¿Tiene alguna función específica el inserto?')])], { w: w(35) }),
            tct([par(dash(ins.funcion_especifica))], { w: w(65) }),
          ),
          tr(
            lbc([par([txB('Información sobre los genes estructurales del inserto')])], { w: w(35) }),
            tct([par(dash(ins.genes_estructurales))], { w: w(65) }),
          ),
          tr(
            lbc([par([txB('Información sobre los elementos reguladores del inserto')])], { w: w(35) }),
            tct([par(dash(ins.elementos_reguladores))], { w: w(65) }),
          ),
          tr(
            lbc([par([txB('¿Ha sido secuenciado el inserto completamente?')])], { w: w(35) }),
            tct([
              par([tx(chk(ins.secuenciado_completamente !== true)), tx(' No')]),
              par([tx(chk(ins.secuenciado_completamente === true)), tx(' Si')]),
            ], { w: w(65) }),
          ),
        ]),
        emptyLine(),
      )

      // 6. OMG resultante
      children.push(
        tbl([
          secRowBlue('6.\tInformación relativa al OMG resultante', 2),
          tr(
            lbc([par([txB('Denominación del OMG'), sup(5)])], { w: w(35) }),
            tct([par(dash(or.denominacion))], { w: w(65) }),
          ),
          tr(lbc([par([txB('¿Requiere el empleo de este OMG de medidas de seguridad especiales?')])], { w: w(100), span: 2 })),
          fullVal([
            par([tx(chk(!mse.requiere)), tx(' No')]),
            par([tx(chk(mse.requiere === true)), tx(' Si. Detallar: '), tx(mse.requiere ? dash(mse.detalle) : '')]),
          ]),
          tr(lbc([par([txB('Breve descripción del OMG')])], { w: w(100), span: 2 })),
          fullVal(dash(or.descripcion_breve)),
          tr(lbc([par([txB('Estado y expresión del material genético')])], { w: w(100), span: 2 })),
          fullVal(dash(or.estado_expresion_material_genetico)),
          tr(lbc([par([txB('¿Conoce el número y localización de la inserción?')])], { w: w(100), span: 2 })),
          fullVal([
            par([tx(chk(ins2.conoce_numero_localizacion !== true)), tx(' No')]),
            par([tx(chk(ins2.conoce_numero_localizacion === true)),  tx(' Sí')]),
            ...(ins2.conoce_numero_localizacion === true ? [
              par([txB('Número de copias: '), tx(dash(ins2.num_copias))]),
              par([txB('Localización cromosómica: '), tx(dash(ins2.localizacion_cromosomica))]),
              par([txB('Secuencias laterales: '), tx(dash(ins2.secuencias_laterales))]),
            ] : []),
          ]),
          tr(lbc([par([txB('¿Inactiva la inserción la expresión de algún gen?')])], { w: w(100), span: 2 })),
          fullVal([
            par([tx(chk(inact.estado === 'no')),        tx(' No')]),
            par([tx(chk(inact.estado === 'no_se_sabe')), tx(' No se sabe')]),
            par([tx(chk(inact.estado === 'si')),         tx(' Si. Indicar: '), tx(inact.estado === 'si' ? dash(inact.descripcion) : '')]),
          ]),
          tr(lbc([par([txB('Descripción de métodos de identificación del OMG resultante')])], { w: w(100), span: 2 })),
          fullVal(dash(idf.descripcion_metodos)),
          tr(
            lbc([par([txB('Marcadores específicos del OMG')])], { w: w(35) }),
            tct([par(dash(idf.marcadores_especificos))], { w: w(65) }),
          ),
          tr(lbc([par([txB('¿Se dispone de técnicas para la identificación del OMG?')])], { w: w(100), span: 2 })),
          fullVal([
            par([tx(chk(!tec.disponible)), tx(' No')]),
            par([tx(chk(tec.disponible === true)), tx(' Si. Especificar: '), tx(tec.disponible ? dash(tec.descripcion) : '')]),
          ]),
        ]),
        emptyLine(),
      )
    }
  }

  const footnoteEntries = [
    { id: 1, text: 'Nomenclature for Mouse Strains. Jackson Laboratories' },
    { id: 2, text: 'Nombre con el que se referirá a la cepa/línea a lo largo del Proyecto y en el animalario de CIC bioGUNE. Este nombre debe coincidir con el de la tabla de la sección A.6.' },
    { id: 3, text: 'Este número debe coincidir con el de la tabla de la sección A.6.' },
    { id: 4, text: 'Los machos se separan y tras 5 días se establecen las parejas de cría. Las parejas se renuevan cada 6 meses aproximadamente o antes si los parámetros reproductivos no son óptimos. Los destetes se realizan a los 18-21 de la fecha de parto, momento en que son sexados y dispuestos en jaulas de stock para atender la demanda de experimentos. Siempre que sea posible se guardan 5 animales de cada sexo para garantizar el mantenimiento de la línea. Más información en PNT/SDA/EXP/01' },
    ...(sc.es_omg && !omg.usado_anteriormente ? [
      { id: 5, text: 'Utilice siempre que sea posible la nomenclatura según recomendaciones internacionales sobre denominación de ratones modificados genéticamente' },
    ] : []),
  ]

  const rawBuf = await Packer.toBuffer(buildDoc(children, 'Sección C'))
  return addDocxFootnotes(rawBuf, footnoteEntries)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN D
// ═══════════════════════════════════════════════════════════════════════════════

async function genSeccionD(proyectoId) {
  const doc = readProductos(proyectoId)
  if (!doc) throw new Error('Sección D no encontrada')
  const d = doc.seccionD ?? {}

  // Build id → "1", "2", … map so stored UUIDs render as procedure numbers
  const proyecto = readProyecto(proyectoId)
  const procNum = {}
  ;(proyecto?.procedimientos ?? []).forEach((id, idx) => { procNum[id] = String(idx + 1) })
  const fmtProc = id => {
    if (!id) return ''
    if (procNum[id]) return procNum[id]
    // Fallback: procedure may belong to another project (replicated) — read its file
    const p = readProc(id)
    if (p?.proyecto_id) {
      const ownerProj = readProyecto(p.proyecto_id)
      const idx = (ownerProj?.procedimientos ?? []).indexOf(id)
      if (idx !== -1) return String(idx + 1)
    }
    return '—'
  }

  const ctr = { align: AlignmentType.CENTER }

  function agBioTable(rows) {
    const data = rows.length ? rows : [{ nombre_cientifico: '', descripcion: '', grupo_riesgo: '', lugar_manipulacion: '', numero_procedimiento: '' }]
    return tbl([
      tr(
        lbc([par([txBsm('Nombre científico')],   ctr)], { w: w(20) }),
        lbc([par([txBsm('Descripción del agente')], ctr)], { w: w(20) }),
        lbc([par([txBsm('Grupo de riesgo')],     ctr)], { w: w(12) }),
        lbc([par([txBsm('Lugar de manipulación'), sup(1)], ctr)], { w: w(24) }),
        lbc([par([txBsm('Nº de procedimiento'),  sup(2)], ctr)], { w: w(24) }),
      ),
      ...data.map(ag => tr(
        tct([par(ag.nombre_cientifico ?? '')],                    { w: w(20) }),
        tct([par(ag.descripcion ?? '')],                           { w: w(20) }),
        tct([par(ag.grupo_riesgo ? `Grupo ${ag.grupo_riesgo}` : '')], { w: w(12) }),
        tct([par(ag.lugar_manipulacion ?? '')],                   { w: w(24) }),
        tct([par(fmtProc(ag.numero_procedimiento))],              { w: w(24) }),
      )),
    ], [20, 20, 12, 24, 24])
  }

  function agQuimTable(rows) {
    const data = rows.length ? rows : [{ nombre: '', identificacion_riesgo: '', condiciones_manipulacion: '', numero_procedimiento: '' }]
    return tbl([
      tr(
        lbc([par([txBsm('Nombre')],                              ctr)], { w: w(22) }),
        lbc([par([txBsm('Identificación del riesgo')],           ctr)], { w: w(26) }),
        lbc([par([txBsm('Condiciones especiales de manipulación')], ctr)], { w: w(30) }),
        lbc([par([txBsm('Nº de procedimiento'), sup(3)],         ctr)], { w: w(22) }),
      ),
      ...data.map(aq => tr(
        tct([par(aq.nombre ?? '')],                    { w: w(22) }),
        tct([par(aq.identificacion_riesgo ?? '')],     { w: w(26) }),
        tct([par(aq.condiciones_manipulacion ?? '')],  { w: w(30) }),
        tct([par(fmtProc(aq.numero_procedimiento))],   { w: w(22) }),
      )),
    ], [22, 26, 30, 22])
  }

  const children = [
    makeHeader(), emptyLine(),

    // ── Título principal ──────────────────────────────────────────────────────
    new Paragraph({
      children: [
        new TextRun({ text: 'D. ', font: FONT, size: SZ, bold: true }),
        new TextRun({ text: 'PRODUCTOS ADMINISTRADOS CON RIESGO PARA LA SALUD O MEDIO AMBIENTE', font: FONT, size: SZ, bold: true, underline: { type: UnderlineType.SINGLE } }),
      ],
      spacing: { before: 80, after: 60 },
    }),
    emptyLine(),

    // ── D.1 ───────────────────────────────────────────────────────────────────
    secHead('D.1 USO DE AGENTES BIOLÓGICOS EN ANIMALES DE EXPERIMENTACIÓN'),
    agBioTable(d.agentes_biologicos ?? []),
    emptyLine(),

    // ── D.2 ───────────────────────────────────────────────────────────────────
    secHead('D.2. USO DE AGENTES QUÍMICOS EN ANIMALES DE EXPERIMENTACIÓN'),
    par([new TextRun({ text: 'Recuerde adjuntar al proyecto la ficha de seguridad de cada uno de los productos listados en la siguiente tabla', font: FONT, size: SZ, color: '1F4E79' })], { before: 0, after: 60 }),
    agQuimTable(d.agentes_quimicos ?? []),
    emptyLine(),
  ]

  const rawBuf = await Packer.toBuffer(buildDoc(children, 'Sección D'))
  return addDocxFootnotes(rawBuf, [
    { id: 1, text: 'Especifique la zona del Animalario de CIC bioGUNE donde se va a llevar a cabo la manipulación' },
    { id: 2, text: 'Indique el número del procedimiento en el cual va a emplear el agente biológico' },
    { id: 3, text: 'Indique el número del procedimiento en el cual se va a emplear el agente químico' },
  ])
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

async function genModificacion(modifId) {
  const m = readModif(modifId)
  if (!m) throw new Error('Modificación no encontrada')

  const iden = m.identificacion ?? {}
  const tc_  = m.tipos_cambio   ?? {}

  const TIPO_LABELS = {
    alta_baja_investigadores: 'Alta/Baja de investigadores',
    adicion_animales:         'Adición de animales',
    adicion_procedimientos:   'Adición de procedimientos',
    cambios_procedimientos:   'Cambios en procedimientos originales',
    adicion_linea_animal:     'Adición de línea de animales nueva',
    adicion_lugar:            'Adición de un lugar de realización del proyecto',
    cambio_alojamiento:       'Cambio en condiciones de alojamiento, zootécnicas y de cuidado de animales',
  }

  const children = [
    makeHeader(), emptyLine(),
    h1('SOLICITUD DE MODIFICACIÓN DE UN PROYECTO\nDE INVESTIGACIÓN CON ANIMALES DE INVESTIGACIÓN'),
    emptyLine(),

    tbl([
      kvRow('Título del proyecto',   iden.titulo_proyecto),
      kvRow('Referencia CBBA',       iden.referencia_cbba),
      kvRow('Nº de modificación',    iden.numero_modificacion),
      kvRow('Fecha aprobación proyecto', fmtDate(iden.fecha_aprobacion_proyecto)),
    ]),
    emptyLine(),
    makeEstablishment(),
    emptyLine(),

    h2('Tipos de cambio solicitados'),
    tbl(
      Object.entries(TIPO_LABELS).map(([key, label]) =>
        kvRow(`${chk(tc_[key] === true)} ${label}`, tc_[key] ? 'Solicitado' : '—')
      )
    ),
    emptyLine(),
  ]

  // ── Bloque 1: Investigadores
  if (tc_.alta_baja_investigadores) {
    const inv = m.investigadores ?? {}
    children.push(h2('1. Alta / Baja de investigadores'))

    if ((inv.altas ?? []).length) {
      children.push(par([txB('Altas:')]),
        tbl([
          tr(gc([par([txB('Nombre')])], { w: w(50) }), gc([par([txB('NIF / Pasaporte')])], { w: w(25) }), gc([par([txB('Función')])], { w: w(25) })),
          ...inv.altas.map(i => tr(
            tc([par(i.nombre_apellidos ?? '')], { w: w(50) }),
            tc([par(i.nif_pasaporte ?? '')],   { w: w(25) }),
            tc([par(i.funcion ?? '')],          { w: w(25) }),
          )),
        ])
      )
    }
    if ((inv.bajas ?? []).length) {
      children.push(par([txB('Bajas:')]),
        tbl([
          tr(gc([par([txB('Nombre')])], { w: w(50) }), gc([par([txB('NIF / Pasaporte')])], { w: w(25) }), gc([par([txB('Función')])], { w: w(25) })),
          ...inv.bajas.map(i => tr(
            tc([par(i.nombre_apellidos ?? '')], { w: w(50) }),
            tc([par(i.nif_pasaporte ?? '')],   { w: w(25) }),
            tc([par(i.funcion ?? '')],          { w: w(25) }),
          )),
        ])
      )
    }
    children.push(emptyLine())
  }

  // ── Bloque 2: Adición animales
  if (tc_.adicion_animales) {
    const aa = m.adicion_animales ?? {}
    children.push(
      h2('2. Adición de animales'),
      tbl([
        kvRow('Nº original aprobados',               aa.num_original_aprobados),
        kvRow('Nº aprobados en modificaciones previas', aa.num_aprobados_otras_modificaciones),
        kvRow('Nº a aumentar en esta modificación',  aa.num_aumentar_esta_modificacion),
        kvRow('Porcentaje de incremento total',       `${aa.porcentaje_incremento_total ?? 0} %`),
      ]),
      emptyLine()
    )
  }

  // ── Bloque 3: Nuevos procedimientos
  if (tc_.adicion_procedimientos) {
    children.push(h2('3. Adición de procedimientos'))
    const procs = (m.procedimientos_nuevos ?? []).map(id => readProc(id)).filter(Boolean)
    if (procs.length) {
      children.push(tbl([
        tr(gc([par([txB('Nº')])], { w: w(8) }), gc([par([txB('Título')])], { w: w(55) }), gc([par([txB('Nº animales')])], { w: w(20) }), gc([par([txB('Severidad')])], { w: w(17) })),
        ...procs.map((proc, i) => tr(
          tc([par(String(i + 1))], { w: w(8) }),
          tc([par(proc.datos_generales?.titulo_procedimiento ?? '')], { w: w(55) }),
          tc([par(String(proc.datos_generales?.num_animales ?? ''))], { w: w(20) }),
          tc([par((Array.isArray(proc.clasificacion_severidad) ? proc.clasificacion_severidad : [proc.clasificacion_severidad]).filter(v => v && v.length > 1 && v !== 'none' && SEV_LABELS[v]).map(v => SEV_LABELS[v]).join(', ') || '—')], { w: w(17) }),
        )),
      ]))
    } else {
      children.push(par('— Sin procedimientos nuevos vinculados —'))
    }
    children.push(emptyLine())
  }

  // ── Bloque 4: Cambios procedimientos existentes
  if (tc_.cambios_procedimientos) {
    const cambios = m.cambios_procedimientos_existentes ?? []
    children.push(h2('4. Cambios en procedimientos existentes'))
    if (cambios.length) {
      children.push(tbl([
        tr(gc([par([txB('Nº procedimiento')])], { w: w(30) }), gc([par([txB('Descripción del cambio')])], { w: w(70) })),
        ...cambios.map(c => tr(
          tc([par(c.numero_procedimiento ?? '')], { w: w(30) }),
          tc([par(c.descripcion_cambio ?? '')],   { w: w(70) }),
        )),
      ]))
    } else {
      children.push(par('— Sin cambios registrados —'))
    }
    children.push(emptyLine())
  }

  // ── Bloque 5: Nuevas líneas animales
  if (tc_.adicion_linea_animal) {
    const lineas = m.lineas_animales_nuevas ?? []
    children.push(h2('5. Nuevas líneas animales'))
    if (lineas.length) {
      children.push(tbl([
        tr(gc([par([txB('Nomenclatura internacional')])], { w: w(50) }), gc([par([txB('Acrónimo')])], { w: w(30) }), gc([par([txB('¿Con cría?')])], { w: w(20) })),
        ...lineas.map(l => tr(
          tc([par(l.nomenclatura_internacional ?? '')], { w: w(50) }),
          tc([par(l.acronimo ?? '')],                   { w: w(30) }),
          tc([par(yn(l.hay_cria))],                     { w: w(20) }),
        )),
      ]))
    }
    children.push(emptyLine())
  }

  // ── Bloque 6: Nuevo lugar
  if (tc_.adicion_lugar) {
    children.push(
      h2('6. Nuevo lugar de realización'),
      tbl([kvRow('Descripción del nuevo lugar', m.lugar_nuevo)]),
      emptyLine()
    )
  }

  // ── Bloque 7: Cambio alojamiento
  if (tc_.cambio_alojamiento) {
    children.push(
      h2('7. Cambio en condiciones de alojamiento'),
      tbl([kvRow('Descripción del cambio', m.cambio_alojamiento_descripcion)]),
      emptyLine()
    )
  }

  children.push(
    h2('Justificación general'),
    tbl([kvRow('Justificación', m.justificacion_general)]),
    emptyLine(),
    ...makeFirmaBlock(m.firmante ?? ''),
    notesPar('1 Un incremento del número de animales superior al 25% (severidad leve) o al 10% (severidad moderada) requiere nuevo proyecto.'),
    notesPar('2 El número de modificación se asigna correlativamente por el Comité de Ética.'),
  )

  return Packer.toBuffer(buildDoc(children, `Modificación ${iden.numero_modificacion ?? ''}`))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND HELPER
// ═══════════════════════════════════════════════════════════════════════════════

async function sendFile(res, genFn, basename, formato) {
  const docxBuf = await genFn()

  if (formato === 'pdf') {
    const pdfBuf = docxToPdf(docxBuf)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.pdf`))
    return res.send(pdfBuf)
  }

  if (formato === 'ambos') {
    const pdfBuf = docxToPdf(docxBuf)
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks = []
    archive.on('data', c => chunks.push(c))
    await new Promise((resolve, reject) => {
      archive.on('end', resolve)
      archive.on('error', reject)
      archive.append(docxBuf, { name: `${basename}.docx` })
      archive.append(pdfBuf,  { name: `${basename}.pdf`  })
      archive.finalize()
    })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.zip`))
    return res.send(Buffer.concat(chunks))
  }

  // default: docx
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.docx`))
  res.send(docxBuf)
}

function safeName(str) {
  return String(str ?? '').replace(/[^a-zA-Z0-9À-ÿ_ \-]/g, '').replace(/\s+/g, '_').substring(0, 40)
}

function criaSafeName(cria) {
  const id  = cria?.seccionC?.identificacion ?? {}
  const raw = id.acronimo?.trim() || id.nomenclatura_internacional?.trim() || cria?.id || 'sin_nombre'
  return safeName(raw)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/proyectos/:id/exportar/seccionA', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const proyecto = readProyecto(req.params.id)
    const basename = `SeccionA_${safeName(proyecto?.seccionA?.titulo ?? req.params.id)}`
    await sendFile(res, () => genSeccionA(req.params.id), basename, formato)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/procedimientos/:id/exportar', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const proc     = readProc(req.params.id)
    const titulo   = proc?.datos_generales?.titulo_procedimiento ?? req.params.id
    const basename = `SeccionB_${safeName(titulo)}`
    await sendFile(res, () => genSeccionB(req.params.id), basename, formato)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/crias/:id/exportar', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const cria     = readCria(req.params.id)
    const basename = `SeccionC_${criaSafeName(cria)}`
    await sendFile(res, () => genSeccionC(req.params.id), basename, formato)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/proyectos/:id/exportar/seccionD', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const proyecto = readProyecto(req.params.id)
    const basename = `SeccionD_${safeName(proyecto?.seccionA?.titulo ?? req.params.id)}`
    await sendFile(res, () => genSeccionD(req.params.id), basename, formato)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/modificaciones/:id/exportar', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const modif    = readModif(req.params.id)
    const n        = modif?.numero_modificacion ?? ''
    const titulo   = modif?.identificacion?.titulo_proyecto ?? req.params.id
    const basename = `Modificacion_${n}_${safeName(titulo)}`
    await sendFile(res, () => genModificacion(req.params.id), basename, formato)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Global export ─────────────────────────────────────────────────────────────

router.get('/proyectos/:id/exportar/completo', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const proyecto = readProyecto(req.params.id)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const titulo  = safeName(proyecto.seccionA?.titulo ?? req.params.id)
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks  = []
    archive.on('data', c => chunks.push(c))

    const addFile = async (genFn, basename) => {
      const docxBuf = await genFn()
      if (formato === 'docx' || formato === 'ambos') {
        archive.append(docxBuf, { name: `${basename}.docx` })
      }
      if (formato === 'pdf' || formato === 'ambos') {
        archive.append(docxToPdf(docxBuf), { name: `${basename}.pdf` })
      }
    }

    // Sección A
    await addFile(() => genSeccionA(req.params.id), `SeccionA_${titulo}`)

    // Secciones B
    const procs = (proyecto.procedimientos ?? []).map(id => readProc(id)).filter(Boolean)
    for (let i = 0; i < procs.length; i++) {
      const proc = procs[i]
      const bt   = safeName(proc.datos_generales?.titulo_procedimiento ?? `Proc${i + 1}`)
      await addFile(() => genSeccionB(proc.id, i + 1), `SeccionB_Proc${i + 1}_${bt}`)
    }

    // Secciones C
    const a = proyecto.seccionA ?? {}
    if (a.hay_cria) {
      const crias = (proyecto.crias ?? []).map(ref => readCria(ref.id)).filter(Boolean)
      for (const cria of crias) {
        await addFile(() => genSeccionC(cria.id), `SeccionC_${criaSafeName(cria)}`)
      }
    }

    // Sección D
    if (proyecto.seccionD_id || existsSync(join(PRODUCTOS_DIR, `productos_${req.params.id}.json`))) {
      await addFile(() => genSeccionD(req.params.id), `SeccionD_${titulo}`)
    }

    // Modificaciones
    const modifs = (proyecto.modificaciones ?? []).map(id => readModif(id)).filter(Boolean)
    for (const mod of modifs) {
      const n = mod.numero_modificacion ?? ''
      await addFile(() => genModificacion(mod.id), `Modificacion_${n}_${titulo}`)
    }

    await new Promise((resolve, reject) => {
      archive.on('end', resolve)
      archive.on('error', reject)
      archive.finalize()
    })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `Proyecto_${titulo}.zip`))
    res.send(Buffer.concat(chunks))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── PDF unificado (merge con orden personalizable + archivos extra) ────────────

const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.post('/proyectos/:id/exportar/pdf-unificado', uploadMem.any(), async (req, res) => {
  try {
    const proyecto = readProyecto(req.params.id)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const items      = JSON.parse(req.body.items ?? '[]')   // [{type, ref, fileIndex}]
    const uploadedFiles = req.files ?? []

    const pdfBuffers = []

    for (const item of items) {
      if (!item.enabled) continue

      let docxBuf = null

      if (item.type === 'seccionA') {
        docxBuf = await genSeccionA(req.params.id)
      } else if (item.type === 'seccionB') {
        const procs = (proyecto.procedimientos ?? [])
        const idx   = procs.indexOf(item.ref)
        docxBuf = await genSeccionB(item.ref, idx !== -1 ? idx + 1 : undefined)
      } else if (item.type === 'seccionC') {
        docxBuf = await genSeccionC(item.ref)
      } else if (item.type === 'seccionD') {
        docxBuf = await genSeccionD(req.params.id)
      } else if (item.type === 'upload') {
        const f = uploadedFiles.find(f => f.fieldname === `file_${item.fileIndex}`)
        if (f) pdfBuffers.push(f.buffer)
        continue
      } else if (item.type === 'extra') {
        const extraPath = join(PROYECTOS_DIR, `proyecto_${req.params.id}_extras`, item.name)
        if (existsSync(extraPath)) pdfBuffers.push(readFileSync(extraPath))
        continue
      }

      if (docxBuf) {
        const pdfBuf = await docxToPdf(docxBuf)
        if (pdfBuf) pdfBuffers.push(pdfBuf)
      }
    }

    const { mergePdfs } = await import('../../utils/mergePdf.js')
    const merged = await mergePdfs(pdfBuffers)

    const today    = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const words    = (proyecto.seccionA?.titulo ?? '').split(/\s+/).filter(Boolean).slice(0, 4).join('_')
    const fileTitle = words ? `${today}_${words}` : `${today}_${proyecto.id.slice(0, 8)}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${fileTitle}.pdf`))
    res.send(merged)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
