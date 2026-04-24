import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { generateEndUserStatement } from './generators/endUserStatement.js'
import { generateMohQuestions } from './generators/mohQuestions.js'
import { generateContratoMenor } from './generators/contratoMenor.js'
import { docxToPdf } from './utils/pdf.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

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

// ── Contrato Menor ────────────────────────────────────────────────────────────
app.post('/api/contrato-menor', async (req, res) => {
  const { codigo, objeto, justificacionNecesidad, tipoJustificacion } = req.body

  if (!codigo || !objeto || !justificacionNecesidad || !tipoJustificacion) {
    return res.status(400).json({
      error: 'Campos obligatorios: codigo, objeto, justificacionNecesidad, tipoJustificacion',
    })
  }

  try {
    const docxBuffer = await generateContratoMenor(req.body)
    const code = codigo.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    sendDocument(res, docxBuffer, `Contrato_Menor_#${code}`, 'docx')
  } catch (err) {
    console.error('Contrato Menor error:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rincón Anti-Burócrata · puerto ${PORT}`)
})
