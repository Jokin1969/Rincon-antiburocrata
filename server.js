import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { generateEndUserStatement } from './generators/endUserStatement.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// ── GenScript: End User Statement ────────────────────────────────────────────
app.post('/api/genscript/end-user-statement', async (req, res) => {
  const { model, quantity, endUse, date } = req.body

  if (!model || !quantity || !endUse || !date) {
    return res.status(400).json({
      error: 'Campos obligatorios: model, quantity, endUse, date',
    })
  }

  try {
    const buffer = await generateEndUserStatement(req.body)
    const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    const filename = `EndUserStatement_${safeModel}_${date}.docx`

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err) {
    console.error('Error generating End User Statement:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── GenScript: MOH Questions (placeholder) ───────────────────────────────────
app.post('/api/genscript/moh-questions', (_req, res) => {
  res.status(501).json({ error: 'Módulo MOH Questions aún no implementado.' })
})

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rincón Anti-Burócrata · puerto ${PORT}`)
})
