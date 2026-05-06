import { Router }                                              from 'express'
import { existsSync, readFileSync }                            from 'fs'
import { join, dirname }                                       from 'path'
import { fileURLToPath }                                       from 'url'
import archiver                                                from 'archiver'
import {
  AlignmentType, BorderStyle, Document, Footer, ImageRun,
  Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, VerticalAlign, WidthType, convertInchesToTwip,
} from 'docx'
import { docxToPdf } from '../../utils/pdf.js'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = dirname(__filename)

const DATA_DIR      = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const LOGOS_DIR     = join(__dirname, '..', '..', 'public', 'logos', 'animalario')
const FIRMA_PATH    = join(__dirname, '..', '..', 'public', 'firmas', 'jokin.png')

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
const CM = { top: 70, bottom: 70, left: 110, right: 110 }
const GF = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }

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
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60 },
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
const gc = (children, opts = {}) => tc(children, { shading: GF, ...opts })

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

// ── Logo caching ──────────────────────────────────────────────────────────────

let _cic = null, _aaa = null
const cicLogo = () => { if (!_cic) { const p = join(LOGOS_DIR, 'cicbiogune.png'); if (existsSync(p)) _cic = readFileSync(p) } return _cic }
const aaaLogo = () => { if (!_aaa) { const p = join(LOGOS_DIR, 'aaalac.png');    if (existsSync(p)) _aaa = readFileSync(p) } return _aaa }

// ── Common document blocks ────────────────────────────────────────────────────

function makeHeader() {
  const cic = cicLogo()
  const aaa = aaaLogo()
  return tbl([tr(
    tc([new Paragraph({ children: cic ? [new ImageRun({ data: cic, transformation: { width: 130, height: 47 }, type: 'png' })] : [tx('CIC bioGUNE')], spacing: { before: 40, after: 40 } })], { borders: NON, w: w(25) }),
    tc([], { borders: NON, w: w(50) }),
    tc([new Paragraph({ children: aaa ? [new ImageRun({ data: aaa, transformation: { width: 110, height: 47 }, type: 'png' })] : [tx('AAALAC')], alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 } })], { borders: NON, w: w(25) }),
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
      spacing: { before: 80, after: 60 },
    })
  } else {
    imgPar = par([tx('(firma)', { color: 'AAAAAA' })], { before: 120, after: 120 })
  }

  return [
    h2('F. Firma del responsable'),
    tbl([tr(
      gc([par([txB('F. FIRMA:')])], { w: w(20) }),
      tc([
        par([tx('El/La abajo firmante declara que conoce las directrices éticas y la legislación aplicables a la investigación con animales y que se compromete a cumplirlas.')], { before: 40, after: 60 }),
        par([txB(nombre ?? '—')], { before: 20, after: 40 }),
        imgPar,
      ], { w: w(80) }),
    )]),
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

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN A
// ═══════════════════════════════════════════════════════════════════════════════

async function genSeccionA(proyectoId) {
  const proyecto = readProyecto(proyectoId)
  if (!proyecto) throw new Error('Proyecto no encontrado')

  const a   = proyecto.seccionA ?? {}
  const res = a.responsable ?? {}
  const procs = (proyecto.procedimientos ?? []).map(id => readProc(id)).filter(Boolean)

  const FINALIDAD_LABELS = {
    a: 'Investigación básica', b: 'Investigación traslacional',
    c: 'Utilización reglamentaria y producción rutinaria', d: 'Protección del medio ambiente natural',
    e: 'Preservación de especies', f: 'Enseñanza superior o formación', g: 'Investigaciones forenses',
  }

  const children = [
    makeHeader(), emptyLine(),
    h1('SOLICITUD DE EVALUACIÓN ÉTICA DE UN PROYECTO\nDE INVESTIGACIÓN CON ANIMALES DE INVESTIGACIÓN'),
    emptyLine(),
    tbl([
      kvRow('Título del proyecto', a.titulo ?? proyecto.titulo),
      kvRow('Registro CBBA', a.referencia_cbba ?? proyecto.referencia_cbba),
    ]),
    emptyLine(),
    makeEstablishment(),
    emptyLine(),

    h2('A.1 — Responsable del proyecto'),
    tbl([
      kvRow('NIF / Pasaporte',       res.nif_pasaporte),
      kvRow('Nombre y apellidos',    res.nombre_apellidos),
      kvRow('Teléfono',              res.telefono),
      kvRow('Correo electrónico',    res.email),
      kvRow('Función ECC566',        res.funcion_ecc566),
      kvRow('Autoridad competente',  res.autoridad_competente),
      kvRow('Fecha acreditación',    fmtDate(res.fecha_acreditacion)),
    ]),
    emptyLine(),

    h2('A.2 — Participantes'),
    ...(!(a.participantes ?? []).length
      ? [par('— Sin participantes registrados —')]
      : [tbl([
          tr(
            gc([par([txB('Nombre y apellidos')])], { w: w(35) }),
            gc([par([txB('NIF / Pasaporte')])],   { w: w(20) }),
            gc([par([txB('Institución')])],        { w: w(25) }),
            gc([par([txB('Función ECC566')])],     { w: w(20) }),
          ),
          ...a.participantes.map(pt => tr(
            tc([par(pt.nombre_apellidos ?? '')], { w: w(35) }),
            tc([par(pt.nif_pasaporte ?? '')],    { w: w(20) }),
            tc([par(pt.institucion ?? '')],       { w: w(25) }),
            tc([par(pt.funcion_ecc566 ?? '')],    { w: w(20) }),
          )),
        ])]
    ),
    emptyLine(),

    h2('A.3 — Duración, financiación y localización'),
    tbl([
      kvRow('Fecha inicio',           fmtDate(a.duracion?.fecha_inicio)),
      kvRow('Fecha fin',              fmtDate(a.duracion?.fecha_fin)),
      kvRow('Entidad financiadora',   a.financiacion?.entidad_programa),
      kvRow('Estado financiación',    a.financiacion?.estado),
      kvRow('Nº proyecto',            a.financiacion?.numero_proyecto),
      kvRow('IP es responsable',      yn(a.financiacion?.ip_es_responsable)),
      ...(a.financiacion?.ip_es_responsable === false
        ? [kvRow('IP / otro responsable', a.financiacion?.ip_responsable_otro)] : []),
      kvRow('Lugar de realización',
        a.lugar_realizacion?.tipo === 'animalario_cicbiogune'
          ? 'Animalario CIC bioGUNE'
          : (a.lugar_realizacion?.descripcion ?? a.lugar_realizacion?.tipo)),
    ]),
    emptyLine(),

    h2('A.4 — Resumen y objetivos'),
    tbl([
      kvRow('Tipo de proyecto',
        a.tipo_proyecto === 'I' ? 'I. Proyecto nuevo' : 'II. Repetición de proyecto'),
      kvRow('Finalidades',
        (a.finalidad ?? []).length
          ? a.finalidad.map(f => `${chk(true)} ${f}. ${FINALIDAD_LABELS[f] ?? f}`).join('\n')
          : '—'),
      kvRow('Objetivo principal', a.objetivos?.objetivo_principal),
      kvRow('Resumen',            a.objetivos?.resumen),
      kvRow('Daño / beneficio',   a.objetivos?.dano_beneficio),
    ]),
    emptyLine(),

    h2('A.5 — Las 3Rs'),
    tbl([
      kvRow('Reemplazo',    a.tres_rs?.reemplazo),
      kvRow('Reducción',    a.tres_rs?.reduccion),
      kvRow('Refinamiento', a.tres_rs?.refinamiento),
    ]),
    emptyLine(),

    h2('A.6 — Resumen de procedimientos'),
    ...(!procs.length
      ? [par('— No hay procedimientos vinculados —')]
      : [tbl([
          tr(
            gc([par([txB('Nº')])],         { w: w(6)  }),
            gc([par([txB('Título')])],      { w: w(32) }),
            gc([par([txB('Especies')])],    { w: w(20) }),
            gc([par([txB('Nº animales')])], { w: w(14) }),
            gc([par([txB('Severidad')])],   { w: w(14) }),
            gc([par([txB('Con riesgo')])],  { w: w(14) }),
          ),
          ...procs.map((proc, idx) => tr(
            tc([par(String(idx + 1))], { w: w(6)  }),
            tc([par(proc.datos_generales?.titulo_procedimiento ?? '')], { w: w(32) }),
            tc([par((proc.datos_generales?.especies ?? []).join(', '))], { w: w(20) }),
            tc([par(String(proc.datos_generales?.num_animales ?? ''))], { w: w(14) }),
            tc([par(proc.clasificacion_severidad ?? 'none')], { w: w(14) }),
            tc([par(proc.otras_sustancias?.hay_riesgo ? 'Sí' : 'No')], { w: w(14) }),
          )),
        ])]
    ),
    emptyLine(),

    ...(a.hay_cria && (a.cepas_cria ?? []).length > 0
      ? [
          h2('Cepas / líneas de cría'),
          tbl([
            tr(
              gc([par([txB('Nomenclatura internacional')])], { w: w(50) }),
              gc([par([txB('Acrónimo')])],                   { w: w(25) }),
              gc([par([txB('Nº animales')])],                { w: w(25) }),
            ),
            ...a.cepas_cria.map(c => tr(
              tc([par(c.nomenclatura_internacional ?? '')], { w: w(50) }),
              tc([par(c.acronimo ?? '')],                   { w: w(25) }),
              tc([par(String(c.num_animales ?? ''))],       { w: w(25) }),
            )),
          ]),
          emptyLine(),
        ]
      : []
    ),

    h2('A.7 — Condiciones de alojamiento'),
    tbl([
      kvRow('Tipo',
        a.condiciones_alojamiento?.tipo === 'estandar'
          ? '☑ Estándar'
          : a.condiciones_alojamiento?.tipo === 'especiales'
          ? '☑ Condiciones especiales'
          : (a.condiciones_alojamiento?.tipo ?? '—')),
      ...(a.condiciones_alojamiento?.tipo !== 'estandar'
        ? [kvRow('Descripción', a.condiciones_alojamiento?.descripcion)] : []),
    ]),
    emptyLine(),

    ...makeFirmaBlock(a.firmante || res.nombre_apellidos),

    notesPar('1 El responsable del proyecto debe estar acreditado según RD 53/2013 y ECC/566/2015.'),
    notesPar('2 La duración máxima del proyecto es de 5 años.'),
    notesPar('3 El resumen no debe superar las 300 palabras.'),
  ]

  return Packer.toBuffer(buildDoc(children, 'Sección A'))
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

  function dynTable(headers, rows, widths) {
    if (!rows.length) return [par('— Sin registros —')]
    return [tbl([
      tr(...headers.map((h, i) => gc([par([txB(h)])], { w: w(widths[i]) }))),
      ...rows.map(r => tr(...r.map((v, i) => tc([par(dash(v))], { w: w(widths[i]) })))),
    ])]
  }

  const children = [
    makeHeader(), emptyLine(),
    h1('PROCEDIMIENTO'),
    emptyLine(),
    tbl([
      kvRow('Número de procedimiento', proc.numero ?? '—'),
      kvRow('Título', dg.titulo_procedimiento),
    ]),
    emptyLine(),

    h2('B.1 — Datos generales'),
    tbl([
      kvRow('Especie(s)',           (dg.especies ?? []).join(', ')),
      kvRow('Cepa / línea',        dg.cepa_linea),
      kvRow('Sexo',                dg.sexo),
      kvRow('Edad / peso',         dg.edad_peso),
      kvRow('Nº animales',         dg.num_animales),
      kvRow('Origen',              dg.origen),
      kvRow('Aclimatación',        dg.aclimatacion),
      kvRow('Identificación',      dg.identificacion),
      kvRow('Condiciones especiales', dg.condiciones_especiales),
    ]),
    emptyLine(),

    h2('B.2 — Metodología y fases'),
    tbl([
      kvRow('Descripción',              met.descripcion),
      kvRow('Justificación procedimiento', met.justificacion_procedimiento),
    ]),
    emptyLine(),

    h2('B.2 bis — Tamaño muestral'),
    tbl([
      kvRow('Método de cálculo',   tm.metodo),
      kvRow('Justificación',       tm.justificacion),
    ]),
    ...(( tm.grupos ?? []).length
      ? [emptyLine(), par([txB('Grupos:')]),
         ...dynTable(['Grupo', 'N', 'Justificación'], (tm.grupos).map(g => [g.nombre, g.n, g.justificacion]), [30, 10, 60])]
      : []
    ),
    emptyLine(),

    h2('B.3 — Aislamiento y ayuno'),
    tbl([
      kvRow('¿Aislamiento?',       yn(aa.hay_aislamiento)),
      ...(aa.hay_aislamiento === 'si' ? [kvRow('Duración aislamiento', aa.duracion_aislamiento)] : []),
      kvRow('¿Ayuno?',             yn(aa.hay_ayuno)),
      ...(aa.hay_ayuno === 'si' ? [kvRow('Duración ayuno', aa.duracion_ayuno)] : []),
      kvRow('Justificación',       aa.justificacion),
    ]),
    emptyLine(),

    h2('B.4 — Técnicas'),
    ...dynTable(
      ['Técnica', 'Frecuencia', 'Vía', 'Volumen', 'Duración', 'Observaciones'],
      (proc.tecnicas ?? []).map(t => [t.nombre, t.frecuencia, t.via, t.volumen, t.duracion, t.observaciones]),
      [22, 14, 12, 12, 12, 28]
    ),
    emptyLine(),

    h2('B.5 — Analgesia y anestesia'),
    tbl([
      kvRow('¿Analgesia?',         yn(ana.hay_analgesia)),
      kvRow('Protocolo analgesia', ana.protocolo_analgesia),
      kvRow('¿Anestesia?',         yn(ana.hay_anestesia)),
      kvRow('Protocolo anestesia', ana.protocolo_anestesia),
      kvRow('Monitorización',      ana.monitorizacion),
      kvRow('Recuperación',        ana.recuperacion),
    ]),
    emptyLine(),

    h2('B.6 — Otras sustancias'),
    tbl([
      kvRow('¿Sustancias con riesgo?', yn(os.hay_riesgo)),
    ]),
    ...(( os.sustancias ?? []).length
      ? [emptyLine(),
         ...dynTable(
           ['Sustancia', 'Tipo', 'Cantidad', 'Vía', 'Frecuencia', 'Descripción riesgo'],
           os.sustancias.map(s => [s.nombre, s.tipo, s.cantidad, s.via, s.frecuencia, s.riesgo_desc]),
           [20, 12, 12, 12, 14, 30]
         )]
      : []
    ),
    emptyLine(),

    h2('B.7 — Parámetros a medir'),
    ...dynTable(
      ['Parámetro', 'Método', 'Frecuencia', 'Unidad', 'N/grupo'],
      (proc.parametros ?? []).map(p => [p.parametro, p.metodo_medida, p.frecuencia, p.unidad, p.n_por_grupo]),
      [28, 24, 16, 16, 16]
    ),
    emptyLine(),

    h2('B.8 — Muestras antemortem'),
    ...dynTable(
      ['Tipo muestra', 'Volumen / cantidad', 'Frecuencia', 'Procedimiento'],
      (proc.muestras_antemortem ?? []).map(m => [m.tipo, m.volumen_cantidad, m.frecuencia, m.procedimiento]),
      [25, 25, 25, 25]
    ),
    emptyLine(),

    h2('B.9 — Finalización'),
    tbl([
      kvRow('Criterios punto final humano', fin.criterios_humanos),
      kvRow('Métodos de eutanasia', (fin.metodos_eutanasia ?? []).join(', ')),
      kvRow('Justificación eutanasia',     fin.justificacion_eutanasia),
      kvRow('Destino carcasas',            fin.destino_carcasas),
    ]),
    emptyLine(),

    h2('B.10 — Reutilización'),
    tbl([
      kvRow('¿Reutilización?',   yn(reu.hay_reutilizacion)),
      kvRow('Descripción',       reu.descripcion),
      kvRow('Justificación',     reu.justificacion),
    ]),
    emptyLine(),

    h2('Clasificación de severidad'),
    tbl([kvRow('Severidad', proc.clasificacion_severidad ?? 'none')]),
    emptyLine(),

    ...makeFirmaBlock(frm.nombre),

    notesPar('1 Los protocolos de analgesia/anestesia deben estar validados por el Veterinario Designado.'),
    notesPar('2 Los métodos de eutanasia deben ajustarse al Anexo IV del RD 53/2013.'),
  ]

  return Packer.toBuffer(buildDoc(children, 'Sección B'))
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
          tc([par(proc.clasificacion_severidad ?? '')], { w: w(17) }),
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
