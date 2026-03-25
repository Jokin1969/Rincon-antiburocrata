import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// ── GenScript: End User Statement ────────────────────────────────────────────
app.post('/api/genscript/end-user-statement', (req, res) => {
  const { projectCode, endUse, date } = req.body

  if (!projectCode || !endUse || !date) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: projectCode, endUse, date' })
  }

  const templatePath = join(__dirname, 'public', 'templates', 'End User Statement - 2.docx')

  let content
  try {
    content = readFileSync(templatePath, 'binary')
  } catch {
    return res.status(503).json({
      error: 'Plantilla no encontrada. Sube el archivo "End User Statement - 2.docx" a public/templates/',
    })
  }

  try {
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    doc.render({ projectCode, endUse, date })

    const buf = doc.getZip().generate({ type: 'nodebuffer' })
    const filename = `End_User_Statement_${projectCode}_${date}.docx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  } catch (err) {
    console.error('Error rendering template:', err)
    res.status(500).json({ error: 'Error al generar el documento.' })
  }
})

// ── GenScript: MOH Questions ─────────────────────────────────────────────────
app.post('/api/genscript/moh-questions', (req, res) => {
  const templatePath = join(__dirname, 'public', 'templates', 'MOH questions.docx')

  let content
  try {
    content = readFileSync(templatePath, 'binary')
  } catch {
    return res.status(503).json({
      error: 'Plantilla no encontrada. Sube el archivo "MOH questions.docx" a public/templates/',
    })
  }

  try {
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

    doc.render({ ...req.body })

    const buf = doc.getZip().generate({ type: 'nodebuffer' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', 'attachment; filename="MOH_Questions.docx"')
    res.send(buf)
  } catch (err) {
    console.error('Error rendering template:', err)
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
