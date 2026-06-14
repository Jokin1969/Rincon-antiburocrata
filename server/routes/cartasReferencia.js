import { Router }                                         from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync, unlinkSync }         from 'fs'
import { join, dirname }                                   from 'path'
import { fileURLToPath }                                   from 'url'
import { contentDispositionHeader }                        from '../../utils/contentDisposition.js'
import { randomUUID }                                      from 'crypto'
import { generateCartaReferencia }                         from '../../generators/cartaReferencia.js'
import { docxToPdf }                                       from '../../utils/pdf.js'
import Anthropic                                           from '@anthropic-ai/sdk'
import OpenAI                                              from 'openai'
import { GoogleGenerativeAI }                              from '@google/generative-ai'
import nodemailer                                          from 'nodemailer'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const DATA_DIR   = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const CARTAS_DIR = join(DATA_DIR, 'cartas-referencia')

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
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
  const today = now.split('T')[0]
  return {
    id: randomUUID(),
    titulo: '',
    tipo: 'profesional',
    idioma: 'en',
    template: 'cicbiogune',
    fecha: today,
    firmaTipo: 'manuscrita',
    firmante: {
      nombre: 'Joaquín Castilla',
      titulo1: 'IKERBasque Research Professor',
      email: 'jcastilla@cicbiogune.es',
    },
    destinatario: {
      tipo: 'abierto',
      tratamiento: '',
      nombre: '',
      cargo: '',
      departamento: '',
      organizacion: '',
      pais: '',
    },
    referencia: {
      nombre: '',
      cargo_actual: '',
      organizacion_actual: '',
      relacion: '',
      periodo: '',
      logros: '',
    },
    notas_ia: '',
    cuerpo: '',
    email_destino: '',
    creado: now,
    actualizado: now,
  }
}

function sendDocument(res, docxBuffer, basename, format) {
  if (format === 'pdf') {
    const pdfBuffer = docxToPdf(docxBuffer)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.pdf`))
    return res.send(pdfBuffer)
  }
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
  res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `${basename}.docx`))
  res.send(docxBuffer)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

// GET / → list
router.get('/', (_req, res) => {
  try {
    ensureDir(CARTAS_DIR)
    const files = readdirSync(CARTAS_DIR)
      .filter(f => f.startsWith('carta_') && f.endsWith('.json'))
    const cartas = files
      .map(f => {
        const c = JSON.parse(readFileSync(join(CARTAS_DIR, f), 'utf-8'))
        return {
          id:         c.id,
          titulo:     c.titulo,
          tipo:       c.tipo,
          idioma:     c.idioma,
          refNombre:  c.referencia?.nombre || '',
          fecha:      c.fecha,
          actualizado: c.actualizado,
        }
      })
      .sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''))
    res.json(cartas)
  } catch (err) {
    console.error('GET cartas-referencia error:', err)
    res.status(500).json({ error: 'Error al leer las cartas.' })
  }
})

// POST / → create
router.post('/', (req, res) => {
  try {
    const base  = emptyCarta()
    const carta = { ...base, ...req.body, id: base.id, creado: base.creado, actualizado: base.creado }
    writeCarta(carta)
    res.status(201).json(carta)
  } catch (err) {
    console.error('POST cartas-referencia error:', err)
    res.status(500).json({ error: 'Error al crear la carta.' })
  }
})

// POST /ia-generar → generate body with AI (must be before /:id routes)
router.post('/ia-generar', async (req, res) => {
  const {
    provider = 'claude',
    tipo = 'profesional',
    idioma = 'en',
    template = 'cicbiogune',
    firmante = {},
    destinatario = {},
    referencia = {},
    notas_ia = '',
  } = req.body

  const TIPO_LABELS = {
    profesional: 'Professional reference / recommendation letter',
    proyecto:    'Letter of support for a project or grant application',
    'green-card': 'Immigration support letter (Green Card / Visa)',
    otro:        'Other reference letter',
  }

  const TEMPLATE_LABELS = {
    cicbiogune: 'CIC bioGUNE',
    atlas:      'ATLAS molecular pharma',
    feep:       'Fundación Española de Enfermedades Priónicas (FEEP)',
  }

  const signerName    = firmante.nombre  || 'Joaquín Castilla'
  const signerTitle   = firmante.titulo1 || 'IKERBasque Research Professor'
  const institution   = TEMPLATE_LABELS[template] || template
  const tipoLabel     = TIPO_LABELS[tipo] || tipo
  const langLabel     = idioma === 'es' ? 'Spanish (Castellano)' : 'English'
  const writeInLang   = idioma === 'es' ? 'Spanish (Castellano)' : 'English'

  let addresseeText = 'To Whom It May Concern'
  if (destinatario.tipo === 'especifico') {
    const parts = [destinatario.tratamiento, destinatario.nombre].filter(Boolean).join(' ')
    addresseeText = parts ? `Dear ${parts}` : 'To Whom It May Concern'
    if (idioma === 'es') {
      const partsEs = [destinatario.tratamiento, destinatario.nombre].filter(Boolean).join(' ')
      addresseeText = partsEs ? `Estimado/a ${partsEs}` : 'A quien corresponda'
    }
  } else if (idioma === 'es') {
    addresseeText = 'A quien corresponda'
  }

  const prompt = `You are helping write a formal letter of reference/recommendation.

LETTER TYPE: ${tipoLabel}
LANGUAGE: ${langLabel}

SIGNER:
- Name: ${signerName}
- Title: ${signerTitle}
- Institution: ${institution}

PERSON BEING REFERENCED:
- Name: ${referencia.nombre || ''}
- Current position: ${referencia.cargo_actual || ''} at ${referencia.organizacion_actual || ''}
- Relationship with signer: ${referencia.relacion || ''}
- Time period known: ${referencia.periodo || ''}
- Notable achievements/contributions: ${referencia.logros || ''}

ADDRESSEE: ${addresseeText}

ADDITIONAL NOTES FROM SIGNER:
${notas_ia || '(none)'}

Write a formal, professional reference letter body (3-5 paragraphs). Do NOT include salutation, closing, or signature — only the body paragraphs. Write in ${writeInLang}.`

  try {
    let cuerpo = ''

    if (provider === 'claude') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY no está configurada en el servidor.' })
      }
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await anthropic.messages.create({
        model:      'claude-opus-4-8',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      })
      cuerpo = msg.content?.[0]?.text || ''

    } else if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: 'OPENAI_API_KEY no está configurada en el servidor.' })
      }
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model:      'gpt-4o',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      })
      cuerpo = completion.choices[0]?.message?.content || ''

    } else if (provider === 'gemini') {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' })
      }
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      cuerpo = result.response.text() || ''

    } else {
      return res.status(400).json({ error: `Proveedor de IA desconocido: ${provider}` })
    }

    res.json({ cuerpo: cuerpo.trim() })
  } catch (err) {
    console.error('IA generar carta referencia error:', err)
    const status = err.status ?? err.statusCode
    let msg = `Error al consultar la IA (${provider}): ${err.message || 'error desconocido'}`
    if (status === 429) msg = `Se ha agotado la cuota de ${provider}. Revisa tu cuenta.`
    if (status === 401 || status === 403) msg = `La API key de ${provider} no es válida o no está autorizada.`
    res.status(500).json({ error: msg })
  }
})

// GET /:id → get full
router.get('/:id', (req, res) => {
  const carta = readCarta(req.params.id)
  if (!carta) return res.status(404).json({ error: 'Carta no encontrada.' })
  res.json(carta)
})

// PUT /:id → update
router.put('/:id', (req, res) => {
  try {
    const existing = readCarta(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Carta no encontrada.' })
    const carta = { ...existing, ...req.body, id: req.params.id, actualizado: new Date().toISOString() }
    writeCarta(carta)
    res.json(carta)
  } catch (err) {
    console.error('PUT cartas-referencia error:', err)
    res.status(500).json({ error: 'Error al actualizar la carta.' })
  }
})

// DELETE /:id → delete
router.delete('/:id', (req, res) => {
  try {
    const path = join(CARTAS_DIR, `carta_${req.params.id}.json`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Carta no encontrada.' })
    unlinkSync(path)
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE cartas-referencia error:', err)
    res.status(500).json({ error: 'Error al eliminar la carta.' })
  }
})

// GET /:id/exportar?format=docx|pdf → download
router.get('/:id/exportar', async (req, res) => {
  const carta = readCarta(req.params.id)
  if (!carta) return res.status(404).json({ error: 'Carta no encontrada.' })

  const format = req.query.format === 'pdf' ? 'pdf' : 'docx'
  const safeNombre = (carta.titulo || carta.referencia?.nombre || 'CartaReferencia')
    .replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚüÜñÑ]/g, '_')
    .slice(0, 50)
  const base = `CartaReferencia_${safeNombre}_${carta.fecha || 'sin_fecha'}`

  try {
    const docxBuffer = await generateCartaReferencia(carta)
    sendDocument(res, docxBuffer, base, format)
  } catch (err) {
    console.error('Exportar carta referencia error:', err)
    res.status(500).json({ error: 'Error al generar la carta.' })
  }
})

// POST /:id/enviar-email → send PDF as attachment
router.post('/:id/enviar-email', async (req, res) => {
  const carta = readCarta(req.params.id)
  if (!carta) return res.status(404).json({ error: 'Carta no encontrada.' })

  const to = req.body?.email || carta.email_destino
  if (!to) return res.status(400).json({ error: 'Se requiere un email de destino.' })

  const safeNombre = (carta.titulo || carta.referencia?.nombre || 'CartaReferencia')
    .replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚüÜñÑ]/g, '_')
    .slice(0, 50)
  const base = `CartaReferencia_${safeNombre}_${carta.fecha || 'sin_fecha'}`

  try {
    const docxBuffer = await generateCartaReferencia(carta)
    const pdfBuffer  = docxToPdf(docxBuffer)

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const refNombre = carta.referencia?.nombre || safeNombre
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `Carta de referencia: ${refNombre}`,
      text:    `Adjunto encontrarás la carta de referencia para "${refNombre}".\n\nGenerado automáticamente desde Rincón Antiburocrata.`,
      attachments: [
        { filename: `${base}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
      ],
    })

    res.json({ ok: true, to })
  } catch (err) {
    console.error('Cartas referencia enviar-email error:', err)
    res.status(500).json({ error: err.message || 'Error al enviar el email.' })
  }
})

export default router
