import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import multer from 'multer'
import OpenAI from 'openai'
import { generateEndUserStatement } from './generators/endUserStatement.js'
import { generateMohQuestions } from './generators/mohQuestions.js'
import { generateAdaptarCarta } from './generators/adaptarCarta.js'
import { generateContratoMenor } from './generators/contratoMenor.js'
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

// ── IA: generar textos para Contrato Menor ────────────────────────────────────
app.post('/api/ia/contrato', upload.single('file'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY no configurada en el servidor.' })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt =
    'Eres un asistente experto en redacción de expedientes administrativos españoles. ' +
    'Genera texto para un contrato menor de CIC bioGUNE (centro de investigación biomédica en Derio, Bizkaia). ' +
    'Responde ÚNICAMENTE con un objeto JSON válido con exactamente estas dos claves: ' +
    '"objeto" (1-2 frases concisas describiendo el objeto del contrato) y ' +
    '"justificacionNecesidad" (2-4 frases justificando por qué es necesario el suministro o servicio). ' +
    'Tono formal y administrativo en español.'

  const userContent = []

  if (req.file) {
    const base64 = req.file.buffer.toString('base64')
    const mime   = req.file.mimetype

    if (mime === 'application/pdf') {
      userContent.push({
        type: 'file',
        file: { filename: req.file.originalname, file_data: `data:application/pdf;base64,${base64}` },
      })
    } else if (mime.startsWith('image/')) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${base64}` },
      })
    } else if (mime.startsWith('text/')) {
      const text = req.file.buffer.toString('utf-8').slice(0, 8000)
      userContent.push({ type: 'text', text: `Contenido del documento:\n\n${text}` })
    }

    userContent.push({
      type: 'text',
      text: 'Basándote en el documento anterior, genera el objeto del contrato y la justificación de la necesidad.',
    })
  } else {
    userContent.push({
      type: 'text',
      text: 'Genera un objeto del contrato y una justificación de la necesidad para un contrato menor típico de material o servicio científico en CIC bioGUNE.',
    })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
    })

    const parsed = JSON.parse(completion.choices[0].message.content)
    res.json({
      objeto:                 parsed.objeto                 || '',
      justificacionNecesidad: parsed.justificacionNecesidad || '',
    })
  } catch (err) {
    console.error('IA Contrato error:', err)
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
