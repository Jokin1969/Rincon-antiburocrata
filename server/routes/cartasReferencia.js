import { Router }                                      from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync, unlinkSync }     from 'fs'
import { join, dirname }                               from 'path'
import { fileURLToPath }                               from 'url'
import { contentDispositionHeader }                    from '../../utils/contentDisposition.js'
import { generateCartaReferencia }                     from '../../generators/cartaReferencia.js'
import { docxToPdf }                                   from '../../utils/pdf.js'
import nodemailer                                      from 'nodemailer'
import Anthropic                                       from '@anthropic-ai/sdk'
import OpenAI                                          from 'openai'
import { GoogleGenerativeAI }                          from '@google/generative-ai'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const DATA_DIR   = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const CARTAS_DIR = join(DATA_DIR, 'cartas-referencia')

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
function readCarta(id) {
  const path = join(CARTAS_DIR, `carta_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}
function writeCarta(carta) {
  ensureDir(CARTAS_DIR)
  writeFileSync(
    join(CARTAS_DIR, `carta_${carta.id}.json`),
    JSON.stringify(carta, null, 2),
    'utf-8'
  )
}
function emptyCarta() {
  const now = new Date().toISOString()
  return {
    id:       makeId(),
    titulo:   '',
    tipo:     'profesional',
    idioma:   'en',
    template: 'cicbiogune',
    fecha:    now.split('T')[0],
    firmaTipo: 'manuscrita',
    firmante: {
      nombre:  'Joaquín Castilla',
      titulo1: 'IKERBasque Research Professor',
      email:   'jcastilla@cicbiogune.es',
    },
    destinatario: {
      tipo:          'abierto',
      tratamiento:   '',
      nombre:        '',
      cargo:         '',
      departamento:  '',
      organizacion:  '',
      pais:          '',
    },
    referencia: {
      nombre:              '',
      cargo_actual:        '',
      organizacion_actual: '',
      relacion:            '',
      periodo:             '',
      logros:              '',
    },
    notas_ia:      '',
    cuerpo:        '',
    email_destino: '',
    creado:        now,
    actualizado:   now,
  }
}
function sendDoc(res, docxBuffer, basename, format) {
  if (format === 'pdf') {
    const pdfBuffer = docxToPdf(docxBuffer)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.pdf`))
    return res.send(pdfBuffer)
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.docx`))
  res.send(docxBuffer)
}
function makeTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  try {
    ensureDir(CARTAS_DIR)
    const cartas = readdirSync(CARTAS_DIR)
      .filter(f => f.startsWith('carta_') && f.endsWith('.json'))
      .map(f => {
        const c = JSON.parse(readFileSync(join(CARTAS_DIR, f), 'utf-8'))
        return {
          id:               c.id,
          titulo:           c.titulo,
          tipo:             c.tipo,
          idioma:           c.idioma,
          template:         c.template,
          fecha:            c.fecha,
          referenciaNombre: c.referencia?.nombre || '',
          actualizado:      c.actualizado,
        }
      })
      .sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''))
    res.json(cartas)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', (req, res) => {
  try {
    const base  = emptyCarta()
    const carta = { ...base, ...req.body, id: base.id, creado: base.creado, actualizado: base.creado }
    writeCarta(carta)
    res.status(201).json(carta)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', (req, res) => {
  const carta = readCarta(req.params.id)
  if (!carta) return res.status(404).json({ error: 'Carta no encontrada' })
  res.json(carta)
})

router.put('/:id', (req, res) => {
  try {
    const existing = readCarta(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Carta no encontrada' })
    const carta = { ...existing, ...req.body, id: req.params.id, creado: existing.creado, actualizado: new Date().toISOString() }
    writeCarta(carta)
    res.json(carta)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const path = join(CARTAS_DIR, `carta_${req.params.id}.json`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Carta no encontrada' })
    unlinkSync(path)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Export ────────────────────────────────────────────────────────────────────

router.get('/:id/exportar', async (req, res) => {
  try {
    const carta = readCarta(req.params.id)
    if (!carta) return res.status(404).json({ error: 'Carta no encontrada' })
    const format     = req.query.format === 'pdf' ? 'pdf' : 'docx'
    const docxBuffer = await generateCartaReferencia(carta)
    const safeName   = (carta.titulo || carta.id).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '').trim().replace(/\s+/g, '_')
    sendDoc(res, docxBuffer, `CartaRef_${safeName}`, format)
  } catch (e) {
    console.error('Export carta referencia error:', e)
    res.status(500).json({ error: e.message })
  }
})

// ── Email ─────────────────────────────────────────────────────────────────────

router.post('/:id/enviar-email', async (req, res) => {
  try {
    const carta = readCarta(req.params.id)
    if (!carta) return res.status(404).json({ error: 'Carta no encontrada' })
    const to = req.body.email || carta.email_destino
    if (!to) return res.status(400).json({ error: 'Email requerido' })

    const docxBuffer = await generateCartaReferencia(carta)
    const pdfBuffer  = docxToPdf(docxBuffer)
    const safeName   = (carta.titulo || carta.id).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '').trim().replace(/\s+/g, '_')
    const filename   = `CartaRef_${safeName}.pdf`

    const lang     = carta.idioma === 'es' ? 'es' : 'en'
    const subject  = lang === 'es'
      ? `Carta de referencia${carta.referencia?.nombre ? ` para ${carta.referencia.nombre}` : ''}`
      : `Letter of Reference${carta.referencia?.nombre ? ` for ${carta.referencia.nombre}` : ''}`

    const transporter = makeTransporter()
    await transporter.sendMail({
      from:        process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text:        `Adjunto encontrarás la carta de referencia${carta.referencia?.nombre ? ` para ${carta.referencia.nombre}` : ''}.\n\nGenerada desde Rincón Antiburocrata.`,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    })
    res.json({ ok: true, to })
  } catch (e) {
    console.error('Email carta referencia error:', e)
    res.status(500).json({ error: e.message })
  }
})

// ── AI Generation ─────────────────────────────────────────────────────────────

const TIPO_LABELS = {
  profesional:  { en: 'Professional Reference Letter', es: 'Carta de Referencia Profesional' },
  proyecto:     { en: 'Research Grant Support Letter', es: 'Carta de Apoyo a Proyecto/Grant' },
  'green-card': { en: 'Immigration Support Letter (Green Card / Visa)', es: 'Carta de Apoyo para Inmigración (Green Card / Visa)' },
  otro:         { en: 'Reference Letter', es: 'Carta de Referencia' },
}

function buildPrompt(data) {
  const lang    = data.idioma === 'es' ? 'es' : 'en'
  const tipo    = TIPO_LABELS[data.tipo]?.[lang] || TIPO_LABELS.otro[lang]
  const ref     = data.referencia || {}
  const dest    = data.destinatario || {}
  const firmante = data.firmante || {}

  const tmplNames = { cicbiogune: 'CIC bioGUNE', atlas: 'ATLAS molecular pharma', feep: 'Fundación Española de Enfermedades Priónicas' }
  const institution = tmplNames[data.template] || 'CIC bioGUNE'

  const addressee = (dest.tipo === 'especifico' && dest.nombre)
    ? `${dest.tratamiento ? dest.tratamiento + ' ' : ''}${dest.nombre}${dest.cargo ? ', ' + dest.cargo : ''}${dest.organizacion ? ', ' + dest.organizacion : ''}`
    : (lang === 'es' ? 'A quien corresponda' : 'To Whom It May Concern')

  if (lang === 'es') {
    return `Eres un asistente experto en redactar cartas de referencia formales y profesionales.

TIPO DE CARTA: ${tipo}
IDIOMA: Español

FIRMANTE:
- Nombre: ${firmante.nombre || 'Joaquín Castilla'}
- Título: ${firmante.titulo1 || 'IKERBasque Research Professor'}
- Institución: ${institution}

PERSONA REFERENCIADA:
- Nombre: ${ref.nombre || ''}
- Cargo actual: ${ref.cargo_actual || ''}
- Organización: ${ref.organizacion_actual || ''}
- Relación con el firmante: ${ref.relacion || ''}
- Periodo de conocimiento: ${ref.periodo || ''}
- Logros y contribuciones: ${ref.logros || ''}

DESTINATARIO: ${addressee}

NOTAS ADICIONALES DEL FIRMANTE:
${data.notas_ia || '(ninguna)'}

Redacta el cuerpo de la carta de referencia (3-5 párrafos). No incluyas saludo, cierre ni firma — solo los párrafos del cuerpo. El tono debe ser formal, profesional y específico. Habla en primera persona del firmante.`
  }

  return `You are an expert at writing formal, professional reference letters.

LETTER TYPE: ${tipo}
LANGUAGE: English

SIGNER:
- Name: ${firmante.nombre || 'Joaquín Castilla'}
- Title: ${firmante.titulo1 || 'IKERBasque Research Professor'}
- Institution: ${institution}

PERSON BEING REFERENCED:
- Name: ${ref.nombre || ''}
- Current position: ${ref.cargo_actual || ''}
- Organization: ${ref.organizacion_actual || ''}
- Relationship with signer: ${ref.relacion || ''}
- Time period known: ${ref.periodo || ''}
- Notable achievements / contributions: ${ref.logros || ''}

ADDRESSEE: ${addressee}

ADDITIONAL NOTES FROM SIGNER:
${data.notas_ia || '(none)'}

Write the body of the reference letter (3-5 paragraphs). Do NOT include salutation, closing, or signature — only the body paragraphs. Be formal, professional and specific. Write in first person from the signer's perspective.`
}

router.post('/ia-generar', async (req, res) => {
  const { provider = 'claude', ...cartaData } = req.body
  const prompt = buildPrompt(cartaData)

  try {
    let cuerpo = ''

    if (provider === 'claude') {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada' })
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await anthropic.messages.create({
        model:      'claude-opus-4-8',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      })
      cuerpo = msg.content?.[0]?.text || ''

    } else if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY no configurada' })
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model:      'gpt-4o',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      })
      cuerpo = completion.choices?.[0]?.message?.content || ''

    } else if (provider === 'gemini') {
      if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY no configurada' })
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      cuerpo = result.response.text() || ''

    } else {
      return res.status(400).json({ error: 'Provider no válido. Usa: claude, openai, gemini' })
    }

    res.json({ cuerpo: cuerpo.trim() })
  } catch (e) {
    console.error(`IA carta referencia [${provider}] error:`, e)
    res.status(500).json({ error: e.message || 'Error al generar con IA' })
  }
})

export default router
