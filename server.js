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

// ── AI error classifier ───────────────────────────────────────────────────────

const AI_PROVIDER_NAMES = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

const BILLING_LINKS = {
  claude: 'https://console.anthropic.com/settings/plans',
  openai: 'https://platform.openai.com/account/billing',
  gemini: 'https://aistudio.google.com/apikey',
}

function classifyAIError(err, provider) {
  const name = AI_PROVIDER_NAMES[provider] || provider
  const link = BILLING_LINKS[provider] || ''

  // Extract HTTP status from Anthropic/OpenAI SDK (.status) or from the error message string (Gemini)
  const msgStatus = err.message?.match(/\[(\d{3})\s/)?.[1]
  const status = err.status ?? err.statusCode ?? (msgStatus ? parseInt(msgStatus, 10) : null)

  if (
    status === 429 ||
    /quota|rate.?limit|too many requests|exceeded.*quota|resource.*exhausted/i.test(err.message)
  ) {
    return (
      `Se ha agotado la cuota de ${name}. ` +
      `Puede que hayas alcanzado el límite de uso gratuito o necesites recargar saldo. ` +
      (link ? `Revisa tu cuenta en: ${link}` : '')
    ).trim()
  }

  if (
    status === 401 ||
    status === 403 ||
    /invalid.{0,10}api.?key|incorrect.{0,10}api.?key|api.?key.{0,10}invalid|authentication|unauthorized|forbidden|permission denied/i.test(err.message)
  ) {
    return `La API key de ${name} no es válida o no está autorizada. Verifica que la clave esté bien configurada en el servidor.`
  }

  if (status >= 500 || /server.?error|internal.?error/i.test(err.message)) {
    return `El servidor de ${name} ha devuelto un error. Inténtalo de nuevo en unos minutos.`
  }

  return `Error al consultar a ${name}. ${err.message || 'Error desconocido.'}`
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
    model: 'gemini-2.0-flash-lite',
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
    res.status(500).json({ error: classifyAIError(err, provider) })
  }
})

// ── Logos: mejorar con OpenAI ─────────────────────────────────────────────────

const LOGO_ENHANCE_SYSTEM =
  'Eres un experto diseñador gráfico y desarrollador SVG. Tu tarea es analizar el logo ' +
  'proporcionado y generar código SVG limpio y optimizado que lo reproduzca con la mayor ' +
  'fidelidad posible: mismos colores, tipografías, proporciones y diseño. Solo puedes reparar ' +
  'imperfecciones técnicas (bordes dentados, ruido, artefactos de compresión, trazados irregulares). ' +
  'No añadas ni elimines ningún elemento del diseño original. ' +
  'Responde ÚNICAMENTE con código SVG válido y completo. Empieza con <svg y termina con </svg>. ' +
  'No incluyas explicaciones, comentarios ni bloques de código markdown.'

app.post('/api/logos/openai-enhance', async (req, res) => {
  const { imageBase64, mimeType, nombre, instrucciones } = req.body

  if (!imageBase64 || !mimeType)
    return res.status(400).json({ error: 'Faltan imageBase64 y mimeType.' })
  if (!process.env.OPENAI_API_KEY)
    return res.status(503).json({ error: 'OPENAI_API_KEY no configurada en el servidor.' })

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const isSvg = mimeType === 'image/svg+xml'
    const userText = instrucciones?.trim()
      || `Reproduce fielmente el logo "${nombre}", reparando imperfecciones sin alterar el diseño.`

    let userContent
    if (isSvg) {
      const svgText = Buffer.from(imageBase64, 'base64').toString('utf-8')
      userContent = [{ type: 'text', text: `SVG original del logo "${nombre}":\n\n${svgText}\n\n${userText}` }]
    } else {
      userContent = [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
        { type: 'text', text: userText },
      ]
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: LOGO_ENHANCE_SYSTEM },
        { role: 'user',   content: userContent },
      ],
    })

    const raw = completion.choices[0].message.content?.trim() || ''
    const match = raw.match(/<svg[\s\S]*<\/svg>/i)
    if (!match) {
      return res.status(422).json({
        error: 'OpenAI no devolvió SVG válido. Prueba con un logo más sencillo o añade instrucciones.',
      })
    }
    res.json({ svg: match[0] })
  } catch (err) {
    console.error('OpenAI logo enhance error:', err)
    res.status(500).json({ error: classifyAIError(err, 'openai') })
  }
})

app.post('/api/logos/gemini-enhance', async (req, res) => {
  const { imageBase64, mimeType, nombre, instrucciones } = req.body

  if (!imageBase64 || !mimeType)
    return res.status(400).json({ error: 'Faltan imageBase64 y mimeType.' })
  if (!process.env.GEMINI_API_KEY)
    return res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: LOGO_ENHANCE_SYSTEM,
    })

    const isSvg = mimeType === 'image/svg+xml'
    const userText = instrucciones?.trim()
      || `Reproduce fielmente el logo "${nombre}", reparando imperfecciones sin alterar el diseño.`

    let parts
    if (isSvg) {
      const svgText = Buffer.from(imageBase64, 'base64').toString('utf-8')
      parts = [{ text: `SVG original del logo "${nombre}":\n\n${svgText}\n\n${userText}` }]
    } else {
      parts = [
        { inlineData: { data: imageBase64, mimeType } },
        { text: userText },
      ]
    }

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
    const raw = result.response.text()?.trim() || ''
    const match = raw.match(/<svg[\s\S]*<\/svg>/i)
    if (!match) {
      return res.status(422).json({
        error: 'Gemini no devolvió SVG válido. Prueba con un logo más sencillo o añade instrucciones.',
      })
    }
    res.json({ svg: match[0] })
  } catch (err) {
    console.error('Gemini logo enhance error:', err)
    res.status(500).json({ error: classifyAIError(err, 'gemini') })
  }
})

// ── IA: localizar código HS / HTS ────────────────────────────────────────────

const HS_SYSTEM_PROMPT =
  'Eres un experto en clasificación arancelaria aduanera con profundo conocimiento ' +
  'del Sistema Armonizado (HS) de la OMA y del Arancel de Aduanas de Estados Unidos (HTS). ' +
  'Tu especialidad es el material biológico de investigación (priones, proteínas, tejidos, ' +
  'muestras, reactivos, cultivos, ADN/ARN, anticuerpos, etc.). ' +
  'Responde ÚNICAMENTE con un objeto JSON válido con exactamente estas cuatro claves: ' +
  '"codigo" (el código arancelario con puntos separadores: 6 dígitos para HS, 10 para HTS), ' +
  '"tipo" ("HS" o "HTS" según el sistema solicitado), ' +
  '"certeza" ("alta", "media" o "baja": alta = código claramente aplicable sin ambigüedad; ' +
  'media = probable pero puede haber alternativas; baja = tentativo, consultar agente aduanas), ' +
  '"justificacion" (2-3 frases que expliquen la clasificación y por qué es el código correcto, ' +
  'mencionando la partida arancelaria y su descripción oficial). Responde en español.'

function hsPrompt(descripcion, tipo) {
  const digitos = tipo === 'HTS' ? '10' : '6'
  return `Clasifica el siguiente material biológico de investigación bajo el sistema ${tipo} (${digitos} dígitos):\n\n${descripcion}`
}

function parseHsJson(text) {
  const match = (text || '{}').match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(match ? match[0] : '{}')
  return {
    codigo:        parsed.codigo        || '',
    tipo:          parsed.tipo          || 'HS',
    certeza:       parsed.certeza       || 'baja',
    justificacion: parsed.justificacion || '',
  }
}

async function hsWithClaude(descripcion, tipo) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    system: [{ type: 'text', text: HS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: hsPrompt(descripcion, tipo) }],
  })
  return parseHsJson(message.content.find(b => b.type === 'text')?.text)
}

async function hsWithOpenAI(descripcion, tipo) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: HS_SYSTEM_PROMPT },
      { role: 'user',   content: hsPrompt(descripcion, tipo) },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 512,
  })
  return parseHsJson(completion.choices[0].message.content)
}

async function hsWithGemini(descripcion, tipo) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    systemInstruction: HS_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: 'application/json' },
  })
  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: hsPrompt(descripcion, tipo) }] }] })
  return parseHsJson(result.response.text())
}

app.post('/api/ia/hs-code', async (req, res) => {
  const { descripcion, tipo = 'HS', provider = 'claude' } = req.body

  if (!descripcion?.trim()) {
    return res.status(400).json({ error: 'Campo obligatorio: descripcion' })
  }

  const KEY_MAP = { claude: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' }
  const keyName = KEY_MAP[provider]
  if (!keyName) return res.status(400).json({ error: `Proveedor desconocido: ${provider}` })
  if (!process.env[keyName]) return res.status(503).json({ error: `${keyName} no configurada en el servidor.` })

  try {
    let data
    if (provider === 'claude')      data = await hsWithClaude(descripcion, tipo)
    else if (provider === 'openai') data = await hsWithOpenAI(descripcion, tipo)
    else                            data = await hsWithGemini(descripcion, tipo)
    res.json(data)
  } catch (err) {
    console.error(`IA HS-Code [${provider}] error:`, err)
    res.status(500).json({ error: classifyAIError(err, provider) })
  }
})

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rincón Anti-Burócrata · puerto ${PORT}`)
})
