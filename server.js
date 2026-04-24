import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateEndUserStatement } from './generators/endUserStatement.js'
import { generateMohQuestions } from './generators/mohQuestions.js'
import { generateAdaptarCarta } from './generators/adaptarCarta.js'
import { generateContratoMenor } from './generators/contratoMenor.js'
import { generateFacturaProforma } from './generators/facturaProforma.js'
import { docxToPdf } from './utils/pdf.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ── Shared helper ─────────────────────────────────────────────────────────────

function sendDocument(res, docxBuffer, basename, format) {
  if (format === 'pdf') {
    const pdfBuffer = docxToPdf(docxBuffer)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.pdf"`)
    return res.send(pdfBuffer)
  }
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
  res.setHeader('Content-Disposition', `attachment; filename="${basename}.docx"`)
  res.send(docxBuffer)
}

// ── GenScript: End User Statement ────────────────────────────────────────────
app.post('/api/genscript/end-user-statement', async (req, res) => {
  const { model, quantity, endUse, date, projectCode } = req.body

  if (!model || !quantity || !endUse || !date) {
    return res.status(400).json({
      error: 'Campos obligatorios: model, quantity, endUse, date',
    })
  }

  const format = req.query.format === 'pdf' ? 'pdf' : 'docx'

  try {
    const docxBuffer = await generateEndUserStatement(req.body)
    const code = (projectCode || model).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    sendDocument(res, docxBuffer, `EndUserStatement_${code}_${date}`, format)
  } catch (err) {
    console.error('End User Statement error:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── GenScript: MOH Questions ─────────────────────────────────────────────────
app.post('/api/genscript/moh-questions', async (req, res) => {
  const { projectCode, ...answers } = req.body

  if (!projectCode) {
    return res.status(400).json({ error: 'Campo obligatorio: projectCode' })
  }

  const format = req.query.format === 'pdf' ? 'pdf' : 'docx'

  try {
    const docxBuffer = await generateMohQuestions(answers)
    const code = projectCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    sendDocument(res, docxBuffer, `MOH_questions_${code}`, format)
  } catch (err) {
    console.error('MOH Questions error:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── Adaptar carta ─────────────────────────────────────────────────────────────
app.post('/api/adaptar-carta', async (req, res) => {
  const { template, text } = req.body

  if (!template || !text?.trim()) {
    return res.status(400).json({ error: 'Campos obligatorios: template, text' })
  }

  const format = req.query.format === 'pdf' ? 'pdf' : 'docx'

  try {
    const docxBuffer = await generateAdaptarCarta(req.body)
    const labels     = { cicbiogune: 'CIC_bioGUNE', atlas: 'ATLAS', feep: 'FEEP' }
    const label      = labels[template] || template
    const safeDate   = (req.body.date || '').replace(/[^0-9-]/g, '') || 'sin_fecha'
    sendDocument(res, docxBuffer, `Carta_${label}_${safeDate}`, format)
  } catch (err) {
    console.error('Adaptar carta error:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── Contrato Menor ────────────────────────────────────────────────────────────
app.post('/api/contrato-menor', async (req, res) => {
  const { codigo, objeto, justificacionNecesidad, tipoJustificacion } = req.body

  if (!codigo || !objeto || !justificacionNecesidad || !tipoJustificacion) {
    return res.status(400).json({
      error: 'Campos obligatorios: codigo, objeto, justificacionNecesidad, tipoJustificacion',
    })
  }

  const format = req.query.format === 'pdf' ? 'pdf' : 'docx'

  try {
    const docxBuffer = await generateContratoMenor(req.body)
    const code = codigo.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    sendDocument(res, docxBuffer, `Contrato_Menor_#${code}`, format)
  } catch (err) {
    console.error('Contrato Menor error:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── Aduanas: Factura Proforma ─────────────────────────────────────────────────
app.post('/api/aduanas/factura-proforma', async (req, res) => {
  const { numero, shipper, consignee, lineas } = req.body

  if (!numero || !shipper || !consignee) {
    return res.status(400).json({ error: 'Campos obligatorios: numero, shipper, consignee' })
  }
  if (!lineas?.some(l => l.descripcion?.trim())) {
    return res.status(400).json({ error: 'Se requiere al menos una línea de producto.' })
  }

  const format = req.query.format === 'pdf' ? 'pdf' : 'docx'

  try {
    const docxBuffer = await generateFacturaProforma(req.body)
    const sn  = (shipper.organizacion  || shipper.nombre  || 'shipper').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
    const cn  = (consignee.organizacion || consignee.nombre || 'consignee').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
    const num = numero.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)
    sendDocument(res, docxBuffer, `Proforma_${num}_${sn}_${cn}`, format)
  } catch (err) {
    console.error('Factura Proforma error:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── IA helpers ───────────────────────────────────────────────────────────────

const IA_SYSTEM_PROMPT =
  'Eres un asistente experto en redacción de expedientes administrativos españoles. ' +
  'Genera texto para un contrato menor de CIC bioGUNE (centro de investigación biomédica en Derio, Bizkaia). ' +
  'Responde ÚNICAMENTE con un objeto JSON válido con exactamente estas dos claves: ' +
  '"objeto" (1-2 frases concisas describiendo el objeto del contrato) y ' +
  '"justificacionNecesidad" (2-4 frases justificando por qué es necesario el suministro o servicio). ' +
  'Tono formal y administrativo en español.'

const IA_PROMPT_NO_FILE =
  'Genera un objeto del contrato y una justificación de la necesidad para un contrato menor típico de material o servicio científico en CIC bioGUNE.'

const IA_PROMPT_WITH_FILE =
  'Basándote en el documento anterior, genera el objeto del contrato y la justificación de la necesidad.'

function parseIaJson(text) {
  const match = (text || '{}').match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(match ? match[0] : '{}')
  return {
    objeto:                 parsed.objeto                 || '',
    justificacionNecesidad: parsed.justificacionNecesidad || '',
  }
}

async function iaWithClaude(file) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userContent = []

  if (file) {
    const base64 = file.buffer.toString('base64')
    const mime   = file.mimetype
    if (mime === 'application/pdf') {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
    } else if (mime.startsWith('image/')) {
      const mediaType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) ? mime : 'image/jpeg'
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
    } else if (mime.startsWith('text/')) {
      userContent.push({ type: 'text', text: `Contenido del documento:\n\n${file.buffer.toString('utf-8').slice(0, 8000)}` })
    }
    userContent.push({ type: 'text', text: IA_PROMPT_WITH_FILE })
  } else {
    userContent.push({ type: 'text', text: IA_PROMPT_NO_FILE })
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: [{ type: 'text', text: IA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })

  return parseIaJson(message.content.find(b => b.type === 'text')?.text)
}

async function iaWithOpenAI(file) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const userContent = []

  if (file) {
    const base64 = file.buffer.toString('base64')
    const mime   = file.mimetype
    if (mime === 'application/pdf') {
      userContent.push({ type: 'file', file: { filename: file.originalname, file_data: `data:application/pdf;base64,${base64}` } })
    } else if (mime.startsWith('image/')) {
      userContent.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } })
    } else if (mime.startsWith('text/')) {
      userContent.push({ type: 'text', text: `Contenido del documento:\n\n${file.buffer.toString('utf-8').slice(0, 8000)}` })
    }
    userContent.push({ type: 'text', text: IA_PROMPT_WITH_FILE })
  } else {
    userContent.push({ type: 'text', text: IA_PROMPT_NO_FILE })
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: IA_SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 800,
  })

  return parseIaJson(completion.choices[0].message.content)
}

async function iaWithGemini(file) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: IA_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const parts = []

  if (file) {
    parts.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } })
    parts.push({ text: IA_PROMPT_WITH_FILE })
  } else {
    parts.push({ text: IA_PROMPT_NO_FILE })
  }

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
  return parseIaJson(result.response.text())
}

// ── IA: generar textos para Contrato Menor ────────────────────────────────────
app.post('/api/ia/contrato', upload.single('file'), async (req, res) => {
  const provider = req.body.provider || 'claude'

  const KEY_MAP = {
    claude: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
  }
  const keyName = KEY_MAP[provider]
  if (!keyName) return res.status(400).json({ error: `Proveedor desconocido: ${provider}` })
  if (!process.env[keyName]) return res.status(503).json({ error: `${keyName} no configurada en el servidor.` })

  try {
    let data
    if (provider === 'claude') data = await iaWithClaude(req.file)
    else if (provider === 'openai') data = await iaWithOpenAI(req.file)
    else data = await iaWithGemini(req.file)
    res.json(data)
  } catch (err) {
    console.error(`IA Contrato [${provider}] error:`, err)
    res.status(500).json({ error: err.message || 'Error al consultar a la IA.' })
  }
})

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rincón Anti-Burócrata · puerto ${PORT}`)
})
