import { Router }                                              from 'express'
import { existsSync, readFileSync }                            from 'fs'
import { join, dirname }                                       from 'path'
import { fileURLToPath }                                       from 'url'
import archiver                                                from 'archiver'
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

const tx  = (text, opts = {}) =>
  new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts })
const txB = (text, opts = {}) => tx(text, { bold: true, ...opts })
const txS = (text, opts = {}) => tx(text, { size: SZ_SM, ...opts })

function par(children, opts = {}) {
  if (typeof children === 'string') children = [tx(children)]
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

function tbl(rows) {
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

function w(pct) { return { size: pct, type: WidthType.PERCENTAGE } }

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
  )])
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
    `<w:footnote w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>` +
    `<w:r><w:rPr><w:vertAlign w:val="superscript"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${id}</w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve"> ${xmlEsc(text)}</w:t></w:r>` +
    `</w:p></w:footnote>`
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
        lbc([par([txB('Nombre y apellidos')])], { w: w(40) }),
        lbc([par([txB('Función/es')])],          { w: w(35) }),
        lbc([par([txB('NIF/ Pasaporte')])],      { w: w(25) }),
      ),
      ...(a.participantes ?? []).map(pt => tr(
        tct([par(pt.nombre_apellidos ?? '')], { w: w(40) }),
        tct([par(fmtFunciones(pt.funciones))], { w: w(35) }),
        tct([par(pt.nif_pasaporte ?? '')],    { w: w(25) }),
      )),
      ...((a.participantes ?? []).length === 0
        ? Array(3).fill(null).map(() => tr(
            tct([par('')], { w: w(40) }),
            tct([par('')], { w: w(35) }),
            tct([par('')], { w: w(25) }),
          ))
        : []),
    ]),
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
        lbc([par([txB('Nº')],      { align: AlignmentType.CENTER })], { w: w(8)  }),
        lbc([par([txB('Título')],  { align: AlignmentType.CENTER })], { w: w(34) }),
        lbc([par([txB('Especie')], { align: AlignmentType.CENTER })], { w: w(22) }),
        lbc([par([txB('Nº animales')], { align: AlignmentType.CENTER })], { w: w(18) }),
        lbc([par([txB('Severidad')],   { align: AlignmentType.CENTER })], { w: w(18) }),
      ),
      ...(procs.length > 0
        ? procs.map((proc, idx) => tr(
            tct([par(String(idx + 1))],                                                                   { w: w(8)  }),
            tct([par(proc.datos_generales?.titulo_procedimiento ?? '')],                                  { w: w(34) }),
            tct([par((proc.datos_generales?.especies ?? []).join(', '))],                                 { w: w(22) }),
            tct([par(String(proc.datos_generales?.num_animales ?? ''))],                                  { w: w(18) }),
            tct([par((Array.isArray(proc.clasificacion_severidad) ? proc.clasificacion_severidad : [proc.clasificacion_severidad]).map(v => SEV_LABELS[v] ?? v).join(', '))], { w: w(18) }),
          ))
        : [tr(
            tct([par('')], { w: w(8)  }),
            tct([par('')], { w: w(34) }),
            tct([par('')], { w: w(22) }),
            tct([par('')], { w: w(18) }),
            tct([par('')], { w: w(18) }),
          )]
      ),
    ]),
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
          lbc([par([txB('Nomenclatura internacional de la cepa/línea a criar'), sup(6)])], { w: w(50) }),
          lbc([par([txB('Acrónimo de la cepa/línea'), sup(7)])],                            { w: w(25) }),
          lbc([par([txB('Número de animales que van a generarse')])],                       { w: w(25) }),
        ),
        ...(a.cepas_cria ?? []).map(c => tr(
          tct([par(c.nomenclatura_internacional ?? '')], { w: w(50) }),
          tct([par(c.acronimo ?? '')],                   { w: w(25) }),
          tct([par(String(c.num_animales ?? ''))],       { w: w(25) }),
        )),
      ]),
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

async function genSeccionB(procId) {
  const proc = readProc(procId)
  if (!proc) throw new Error('Procedimiento no encontrado')

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
      tr(...headers.map((h, i) => lbc([par([txB(h)])], { w: w(widths[i]) }))),
      ...rows.map(r => tr(...r.map((v, i) => tct([par(dash(v))], { w: w(widths[i]) })))),
    ])]
  }

  // Helper: section heading like A.1, A.2, etc.
  const secHead = text => new Paragraph({ children: [txB(text)], spacing: { before: 120, after: 40 } })

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
      children: [new TextRun({
        text: 'B.\tPROCEDIMIENTO',
        font: FONT, size: SZ, bold: true,
        underline: { type: UnderlineType.SINGLE },
      })],
      spacing: { before: 80, after: 60 },
    }),

    // ── Número de procedimiento (fondo azul, texto blanco) ────────────────────
    tbl([tr(
      dbc([par([txBW('Número de procedimiento:')])], { w: w(70) }),
      dbc([par([txW(String(proc.numero ?? '—'))])],  { w: w(30) }),
    )]),
    emptyLine(),

    // ── B.1 DATOS GENERALES DEL PROCEDIMIENTO ────────────────────────────────
    secHead('B.1 DATOS GENERALES DEL PROCEDIMIENTO'),
    tbl([
      kvRow('Título',                  dg.titulo_procedimiento),
      kvRow('Especie/s animal/es',     (dg.especies ?? []).join(', ')),
      kvRow('Cepa/línea',              dg.cepa_linea),
      kvRow('Sexo',                    dg.sexo),
      kvRow('Edad',                    dg.edad_peso),
      kvRow('Nº total de animales',    dg.num_animales),
      kvRow('Severidad',               sevLabel),
      tr(
        gc([par([txB('Duración'), sup(1)])], { w: w(30) }),
        tc([par(dash(dg.duracion))],         { w: w(70) }),
      ),
    ]),
    emptyLine(),

    // ── B.2 METODOLOGÍA Y FASES ───────────────────────────────────────────────
    secHead('B.2 METODOLOGÍA Y FASES'),
    tbl([
      secRowBlue('Descripción del procedimiento'),
      fullTcThin([par(dash(met.descripcion))]),
      secRowBlue('Justificación del procedimiento'),
      fullTcThin([par(dash(met.justificacion_procedimiento))]),
    ]),
    emptyLine(),

    // ── B.3 TAMAÑO MUESTRAL ───────────────────────────────────────────────────
    secHead('B.3 TAMAÑO MUESTRAL'),
    tbl([
      kvRow('Número total de animales (incluyendo controles)', dash(tm.numero_total)),
      kvRow('Método de cálculo',   dash(tm.metodo)),
      kvRow('Justificación',       dash(tm.justificacion)),
    ]),
    ...((tm.grupos ?? []).length ? [
      emptyLine(),
      ...dynTable(
        ['Grupo', 'N animales', 'Justificación'],
        (tm.grupos).map(g => [g.nombre, g.n, g.justificacion]),
        [30, 15, 55]
      ),
    ] : []),
    emptyLine(),

    // ── B.4 AISLAMIENTO Y AYUNO ───────────────────────────────────────────────
    secHead('B.4 AISLAMIENTO Y AYUNO'),
    tbl([
      kvRow('¿Aislamiento?',        yn(aa.hay_aislamiento)),
      ...(aa.hay_aislamiento === 'Sí' || aa.hay_aislamiento === 'si'
        ? [kvRow('Duración aislamiento', aa.duracion_aislamiento)] : []),
      kvRow('¿Ayuno?',              yn(aa.hay_ayuno)),
      ...(aa.hay_ayuno === 'Sí' || aa.hay_ayuno === 'si'
        ? [kvRow('Duración ayuno', aa.duracion_ayuno)] : []),
      kvRow('Justificación',        dash(aa.justificacion)),
    ]),
    emptyLine(),

    // ── B.5 TÉCNICAS ──────────────────────────────────────────────────────────
    secHead('B.5 TÉCNICAS'),
    ...dynTable(
      ['Técnica', 'Frecuencia', 'Vía', 'Volumen', 'Duración', 'Observaciones'],
      (proc.tecnicas ?? []).map(t => [t.nombre, t.frecuencia, t.via, t.volumen, t.duracion, t.observaciones]),
      [22, 14, 12, 12, 12, 28]
    ),
    emptyLine(),

    // ── B.6 ANALGESIA Y ANESTESIA ─────────────────────────────────────────────
    secHead('B.6 ANALGESIA Y ANESTESIA'),
    tbl([
      kvRow('¿Analgesia?',          yn(ana.hay_analgesia)),
      kvRow('Protocolo analgesia',  dash(ana.protocolo_analgesia)),
      kvRow('¿Anestesia?',          yn(ana.hay_anestesia)),
      kvRow('Protocolo anestesia',  dash(ana.protocolo_anestesia)),
      kvRow('Monitorización',       dash(ana.monitorizacion)),
      kvRow('Recuperación',         dash(ana.recuperacion)),
    ]),
    emptyLine(),

    // ── B.7 OTRAS SUSTANCIAS Y PRODUCTOS CON RIESGO ───────────────────────────
    secHead('B.7 OTRAS SUSTANCIAS Y PRODUCTOS CON RIESGO'),
    tbl([kvRow('¿Sustancias con declaración de riesgo?', yn(os.hay_riesgo))]),
    ...((os.sustancias ?? []).length ? [
      emptyLine(),
      ...dynTable(
        ['Sustancia', 'Tipo', 'Cantidad', 'Vía', 'Frecuencia', 'Volumen (ml/Kg)'],
        os.sustancias.map(s => [s.nombre, s.tipo, s.cantidad, s.via, s.frecuencia, s.riesgo_desc]),
        [20, 12, 12, 12, 14, 30]
      ),
    ] : []),
    emptyLine(),

    // ── B.8 PARÁMETROS A MEDIR ────────────────────────────────────────────────
    secHead('B.8 PARÁMETROS A MEDIR'),
    ...dynTable(
      ['Parámetro', 'Método', 'Frecuencia', 'Unidad', 'N/grupo'],
      (proc.parametros ?? []).map(p => [p.parametro, p.metodo_medida, p.frecuencia, p.unidad, p.n_por_grupo]),
      [28, 24, 16, 16, 16]
    ),
    emptyLine(),

    // ── B.9 MUESTRAS ANTEMORTEM ───────────────────────────────────────────────
    secHead('B.9 MUESTRAS ANTEMORTEM'),
    ...dynTable(
      ['Tipo muestra', 'Volumen / cantidad', 'Frecuencia', 'Procedimiento'],
      (proc.muestras_antemortem ?? []).map(m => [m.tipo, m.volumen_cantidad, m.frecuencia, m.procedimiento]),
      [25, 25, 25, 25]
    ),
    emptyLine(),

    // ── B.10 FINALIZACIÓN Y EUTANASIA ─────────────────────────────────────────
    secHead('B.10 FINALIZACIÓN Y EUTANASIA'),
    tbl([
      kvRow('Criterios humanitarios de finalización', dash(fin.criterios_humanos)),
      kvRow('Método(s) de eutanasia',                 (fin.metodos_eutanasia ?? []).join(', ')),
      ...((fin.metodos_eutanasia ?? []).includes('Otro')
        ? [kvRow('Justificación del método de eutanasia', dash(fin.justificacion_eutanasia))] : []),
    ]),
    emptyLine(),

    // ── B.11 REUTILIZACIÓN DE ANIMALES ────────────────────────────────────────
    secHead('B.11 REUTILIZACIÓN DE ANIMALES'),
    tbl([
      kvRow('Destino de los animales', reuDestinoLabel),
      ...(reu.destino === 'Sacrifica los animales por requerimientos del procedimiento' && reu.tejidos
        ? [kvRow('Tejido u órganos a utilizar', dash(reu.tejidos))] : []),
      ...(reu.destino === 'Mantener los animales vivos para utilizarlos en otro procedimiento' && reu.num_procedimiento
        ? [kvRow('Número de procedimiento', dash(reu.num_procedimiento))] : []),
      ...(reu.destino === 'Mantener los animales vivos por otros procedimientos' && reu.justificacion_vivos
        ? [kvRow('Justificación', dash(reu.justificacion_vivos))] : []),
    ]),
    emptyLine(),

    // ── B.12 CLASIFICACIÓN DE SEVERIDAD ──────────────────────────────────────
    secHead('B.12 CLASIFICACIÓN DE SEVERIDAD'),
    tbl([kvRow('Severidad según Directiva 2010/63/UE', sevLabel)]),
    ...((proc.clasificacion_severidad ?? []).length > 1 && dg.severidad
      ? [tbl([kvRow('Detalle de severidad', dash(dg.severidad))])] : []),
    emptyLine(),

    ...makeFirmaBlock(frm.nombre),

    // ── Notas a pie de página ─────────────────────────────────────────────────
    notesPar('1 Debe indicarse el tiempo entre la primera y la última utilización (sacrificio) de cada animal. No confundir con la duración total del estudio.'),
    notesPar('2 Si desea adjunte un esquema de las distintas fases del procedimiento'),
  ]

  const rawBuf = await Packer.toBuffer(buildDoc(children, 'Sección B — Procedimiento'))
  return addDocxFootnotes(rawBuf, [
    { id: 1, text: 'Debe indicarse el tiempo entre la primera y la última utilización (sacrificio) de cada animal. No confundir con la duración total del estudio.' },
    { id: 2, text: 'Si desea adjunte un esquema de las distintas fases del procedimiento' },
  ])
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN C
// ═══════════════════════════════════════════════════════════════════════════════

async function genSeccionC(criaId) {
  const cria = readCria(criaId)
  if (!cria) throw new Error('Cría no encontrada')

  const id  = cria.identificacion  ?? {}
  const fen = cria.fenotipo_anormal ?? {}
  const ce  = cria.condiciones_especiales ?? {}
  const gen = cria.genotipaje       ?? {}
  const ag  = cria.animales_a_generar ?? {}
  const pc  = cria.procedimiento_cria ?? {}
  const omg = cria.omg              ?? {}

  const children = [
    makeHeader(), emptyLine(),
    h1('CRÍA DE CEPAS/LÍNEAS DE RATÓN'),
    emptyLine(),
    tbl([
      kvRow('Nomenclatura internacional', id.nomenclatura_internacional),
      kvRow('Acrónimo',                   id.acronimo),
      kvRow('¿Organismo modificado genéticamente?', yn(cria.es_omg)),
    ]),
    emptyLine(),

    h2('Identificación de la cepa'),
    tbl([
      kvRow('Fenotipo anormal',    fen.estado === 'si' ? 'Sí' : 'No'),
      ...(fen.estado === 'si' ? [kvRow('Descripción fenotipo', fen.descripcion)] : []),
      kvRow('Condiciones especiales', ce.requiere === 'si' ? 'Sí' : 'No'),
      ...(ce.requiere === 'si' ? [kvRow('Descripción condiciones', ce.descripcion)] : []),
    ]),
    emptyLine(),

    h2('Sistema de cría y genotipaje'),
    tbl([
      kvRow('Sistema de cría', pc.tipo === 'estandar_cicbiogune' ? 'Estándar CIC bioGUNE' : pc.descripcion),
      kvRow('Procedimiento de genotipaje', gen.procedimiento),
      kvRow('Puesto a punto',              yn(gen.puesto_a_punto)),
      kvRow('Tipo de muestra',             gen.tipo_muestra),
      kvRow('Identificación de animales', (cria.identificacion_animales ?? []).join(', ')),
      kvRow('Animales a generar',          ag.numero_total),
      kvRow('Justificación número',        ag.justificacion),
    ]),
    emptyLine(),
  ]

  if (cria.es_omg) {
    children.push(h2('C-O — Bloque OMG'))
    if (omg.usado_anteriormente) {
      children.push(tbl([
        kvRow('¿Usado anteriormente?',           'Sí'),
        kvRow('Nº procedimiento previo',          omg.numero_procedimiento_previo),
      ]))
    } else {
      children.push(
        tbl([
          kvRow('¿Usado anteriormente?',          'No'),
          kvRow('Clasificación de la actividad',  omg.clasificacion_actividad),
          kvRow('Descripción de operaciones',     omg.descripcion_operaciones),
          kvRow('Lugar de manipulación',
            omg.lugar_manipulacion?.tipo === 'animalario_cicbiogune'
              ? 'Animalario CIC bioGUNE'
              : (omg.lugar_manipulacion?.descripcion ?? omg.lugar_manipulacion?.tipo)),
          kvRow('Dónde se realizó la manipulación genética', omg.donde_manipulacion_genetica),
          kvRow('¿Es cruce de OMGs?', yn(omg.es_cruce_omgs)),
        ])
      )
      if (omg.es_cruce_omgs && (omg.cruces ?? []).length) {
        children.push(emptyLine(), par([txB('Cruces OMG:')]),
          tbl([
            tr(gc([par([txB('Código CBBA')])], { w: w(50) }), gc([par([txB('Fecha aprobación')])], { w: w(50) })),
            ...omg.cruces.map(c => tr(tc([par(c.codigo_cbba ?? '')], { w: w(50) }), tc([par(fmtDate(c.fecha_aprobacion))], { w: w(50) }))),
          ])
        )
      }
      const mg = omg.modificacion_genetica ?? {}
      children.push(
        emptyLine(),
        h2('Modificación genética'),
        tbl([
          kvRow('Tipo de modificación', mg.tipo_modificacion),
          kvRow('Método / descripción', mg.metodo_descripcion),
          kvRow('Características del vector', mg.caracteristicas_vector),
          kvRow('Tipo / identidad del vector', mg.tipo_identidad_vector),
        ])
      )
      const ins = mg.inserto ?? {}
      if (ins.organismo_origen || ins.funcion_especifica) {
        children.push(
          emptyLine(),
          h2('Inserto'),
          tbl([
            kvRow('Organismo de origen',          ins.organismo_origen),
            kvRow('Dimensiones / mapa / secuencias', ins.dimensiones_mapa_secuencias),
            kvRow('Función específica',           ins.funcion_especifica),
            kvRow('Genes estructurales',          ins.genes_estructurales),
            kvRow('Elementos reguladores',        ins.elementos_reguladores),
          ])
        )
      }
    }
    children.push(emptyLine())
  }

  children.push(
    ...makeFirmaBlock(cria.firmante ?? ''),
    notesPar('1 Los OMGs deben tener autorización del Ministerio de Medio Ambiente antes del inicio de la actividad.'),
    notesPar('2 El mapa del vector debe adjuntarse como documento independiente.')
  )

  return Packer.toBuffer(buildDoc(children, 'Sección C'))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN D
// ═══════════════════════════════════════════════════════════════════════════════

async function genSeccionD(proyectoId) {
  const doc = readProductos(proyectoId)
  if (!doc) throw new Error('Sección D no encontrada')
  const d = doc.seccionD ?? {}

  function agBioTable(rows) {
    const data = rows.length ? rows : [{ nombre_cientifico: '', descripcion: '', grupo_riesgo: '', lugar_manipulacion: '', numero_procedimiento: '' }]
    return tbl([
      tr(
        gc([par([txB('Nombre científico')])],    { w: w(20) }),
        gc([par([txB('Descripción')])],           { w: w(20) }),
        gc([par([txB('Grupo riesgo')])],          { w: w(12) }),
        gc([par([txB('Lugar manipulación')])],    { w: w(24) }),
        gc([par([txB('Nº procedimiento')])],      { w: w(24) }),
      ),
      ...data.map(ag => tr(
        tc([par(ag.nombre_cientifico ?? '')],     { w: w(20) }),
        tc([par(ag.descripcion ?? '')],            { w: w(20) }),
        tc([par(ag.grupo_riesgo ? `Grupo ${ag.grupo_riesgo}` : '')], { w: w(12) }),
        tc([par(ag.lugar_manipulacion ?? '')],    { w: w(24) }),
        tc([par(ag.numero_procedimiento ?? '')],  { w: w(24) }),
      )),
    ])
  }

  function agQuimTable(rows) {
    const data = rows.length ? rows : [{ nombre: '', identificacion_riesgo: '', condiciones_manipulacion: '', numero_procedimiento: '' }]
    return tbl([
      tr(
        gc([par([txB('Nombre del producto')])],        { w: w(25) }),
        gc([par([txB('Identificación del riesgo')])],  { w: w(25) }),
        gc([par([txB('Condiciones de manipulación')])],{ w: w(25) }),
        gc([par([txB('Nº procedimiento')])],           { w: w(25) }),
      ),
      ...data.map(aq => tr(
        tc([par(aq.nombre ?? '')],                    { w: w(25) }),
        tc([par(aq.identificacion_riesgo ?? '')],     { w: w(25) }),
        tc([par(aq.condiciones_manipulacion ?? '')],  { w: w(25) }),
        tc([par(aq.numero_procedimiento ?? '')],      { w: w(25) }),
      )),
    ])
  }

  const children = [
    makeHeader(), emptyLine(),
    h1('PRODUCTOS ADMINISTRADOS CON RIESGO\nPARA LA SALUD O MEDIO AMBIENTE'),
    emptyLine(),

    h2('D.1 — Agentes biológicos'),
    agBioTable(d.agentes_biologicos ?? []),
    emptyLine(),

    h2('D.2 — Agentes químicos'),
    agQuimTable(d.agentes_quimicos ?? []),
    emptyLine(),

    ...makeFirmaBlock(d.firmante ?? ''),

    notesPar('Recuerde adjuntar la ficha de seguridad de cada uno de los productos listados al exportar el proyecto.'),
    notesPar('Los agentes biológicos del grupo 2 o superior requieren medidas de contención adicionales (RD 664/1997).'),
  ]

  return Packer.toBuffer(buildDoc(children, 'Sección D'))
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
          tc([par((Array.isArray(proc.clasificacion_severidad) ? proc.clasificacion_severidad : [proc.clasificacion_severidad]).map(v => SEV_LABELS[v] ?? v).filter(Boolean).join(', '))], { w: w(17) }),
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
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.pdf"`)
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
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.zip"`)
    return res.send(Buffer.concat(chunks))
  }

  // default: docx
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${basename}.docx"`)
  res.send(docxBuf)
}

function safeName(str) {
  return String(str ?? '').replace(/[^a-zA-Z0-9À-ÿ_ \-]/g, '').replace(/\s+/g, '_').substring(0, 40)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/proyectos/:id/exportar/seccionA', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const proyecto = readProyecto(req.params.id)
    const basename = `SeccionA_${safeName(proyecto?.titulo ?? req.params.id)}`
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
    const acronimo = cria?.identificacion?.acronimo ?? req.params.id
    const basename = `SeccionC_${safeName(acronimo)}`
    await sendFile(res, () => genSeccionC(req.params.id), basename, formato)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/proyectos/:id/exportar/seccionD', async (req, res) => {
  try {
    const formato  = req.query.formato ?? 'docx'
    const proyecto = readProyecto(req.params.id)
    const basename = `SeccionD_${safeName(proyecto?.titulo ?? req.params.id)}`
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

    const titulo  = safeName(proyecto.titulo ?? req.params.id)
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
      await addFile(() => genSeccionB(proc.id), `SeccionB_Proc${i + 1}_${bt}`)
    }

    // Secciones C
    const a = proyecto.seccionA ?? {}
    if (a.hay_cria) {
      const crias = (proyecto.crias ?? []).map(ref => readCria(ref.id)).filter(Boolean)
      for (const cria of crias) {
        const acronimo = safeName(cria.identificacion?.acronimo ?? cria.id)
        await addFile(() => genSeccionC(cria.id), `SeccionC_${acronimo}`)
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
    res.setHeader('Content-Disposition', `attachment; filename="Proyecto_${titulo}.zip"`)
    res.send(Buffer.concat(chunks))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
