import { Router } from 'express'
import express from 'express'
import multer from 'multer'
import nodemailer from 'nodemailer'
import { writeFileSync, existsSync, mkdirSync, createReadStream, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { sanitizeConfig, buildSvg, exportConfig, stylePreviews, normalizeUrl } from '../qr-render.js'
import { listQrs, getQr, saveQr, deleteQr, listLogos, saveLogo, renameLogo, deleteLogo,
         savePdfMeta, getPdfMeta, listPdfs, deletePdfMeta } from '../qr-store.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PDF_DIR = join(process.env.DATA_DIR || join(__dirname, '..', '..', 'data'), 'qr-pdfs')
try { mkdirSync(PDF_DIR, { recursive: true }) } catch {}

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const router = Router()
router.use(express.json({ limit: '1mb' }))

function safeStem(name) {
  return String(name ?? '').replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 80) || 'qr'
}
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '')) }
function escHtml(s)    { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// GET /meta
router.get('/meta', (_req, res) => {
  res.json({ styles: stylePreviews(), ecc: ['L','M','Q','H'], formats: ['png','jpeg','webp','svg','pdf'], defaultEmail: process.env.EMAIL_TO || '' })
})

// POST /render — body = config "pelado"
router.post('/render', (req, res) => {
  try   { res.json(buildSvg(sanitizeConfig(req.body))) }
  catch (e) { res.status(e.status || 400).json({ error: e.message }) }
})

// POST /validate
router.post('/validate', (req, res) => {
  const url = normalizeUrl(req.body?.url)
  res.json({ valid: url !== null, url })
})

// POST /export
router.post('/export', async (req, res) => {
  const { config, format, name } = req.body ?? {}
  const fmt = ['png','jpeg','webp','svg','pdf'].includes(format) ? format : 'png'
  try {
    const { buffer, mime, ext } = await exportConfig(config, fmt, { name })
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `attachment; filename="${safeStem(name)}.${ext}"`)
    res.send(buffer)
  } catch (e) { res.status(e.status || 500).json({ error: e.message }) }
})

// POST /email
router.post('/email', async (req, res) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
    return res.status(503).json({ error: 'SMTP no configurado' })
  const { config, format, name, to } = req.body ?? {}
  const dest = to || process.env.EMAIL_TO
  if (!validEmail(dest)) return res.status(400).json({ error: 'Destinatario inválido' })
  const fmt = ['png','jpeg','webp','svg','pdf'].includes(format) ? format : 'png'
  try {
    const cfg = sanitizeConfig(config)
    const [{ buffer: previewBuf }, { buffer, mime, ext }] = await Promise.all([
      exportConfig(config, 'png', { width: 360 }),
      exportConfig(config, fmt,   { name }),
    ])
    const displayName = name || cfg.url
    const transport   = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transport.sendMail({
      from:    process.env.EMAIL_FROM || `"Rincón del Anti-Burócrata" <${process.env.SMTP_USER}>`,
      to:      dest,
      subject: `[QRs] ${displayName}`,
      html: `<div style="font-family:sans-serif;max-width:480px">
        <h2 style="margin-bottom:8px">${escHtml(displayName)}</h2>
        <p style="color:#555;margin-top:0"><a href="${escHtml(cfg.url)}">${escHtml(cfg.url)}</a></p>
        <img src="cid:qr-preview" alt="QR" style="width:240px;height:240px;display:block;margin:16px 0"/>
        <p style="color:#888;font-size:12px">Generado con Rincón del Anti-Burócrata</p>
      </div>`,
      attachments: [
        { cid: 'qr-preview', filename: 'qr-preview.png', content: previewBuf },
        { filename: `${safeStem(name)}.${ext}`, content: buffer, contentType: mime },
      ],
    })
    res.json({ ok: true, to: dest })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /list
router.get('/list', (req, res) => res.json({ items: listQrs(null) }))

// POST /save
router.post('/save', (req, res) => {
  const { name, config } = req.body ?? {}
  try {
    const cfg = sanitizeConfig(config)
    const { svg } = buildSvg(cfg)
    const item = saveQr({ userId: null, name: name ?? '', url: cfg.url, config: cfg, thumb: svg })
    res.status(201).json({ item })
  } catch (e) { res.status(e.status || 500).json({ error: e.message }) }
})

// ── PDF permanente ────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /pdf-upload — sube un PDF y devuelve la ruta de descarga
router.post('/pdf-upload', pdfUpload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })
  if (req.file.mimetype !== 'application/pdf')
    return res.status(400).json({ error: 'Solo se admiten archivos PDF' })
  const id   = randomUUID()
  const name = req.body.name?.trim() || req.file.originalname
  writeFileSync(join(PDF_DIR, `${id}.pdf`), req.file.buffer)
  savePdfMeta(id, name, req.file.size)
  res.json({ id, name, size: req.file.size, path: `/api/qr/pdf/${id}` })
})

// GET /pdf/:token — descarga pública del PDF (no requiere sesión, listado en PUBLIC_API)
router.get('/pdf/:token', (req, res) => {
  const { token } = req.params
  if (!UUID_RE.test(token)) return res.status(400).json({ error: 'Token inválido' })
  const meta = getPdfMeta(token)
  if (!meta) return res.status(404).json({ error: 'PDF no encontrado' })
  const filePath = join(PDF_DIR, `${token}.pdf`)
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Archivo no disponible' })
  const safeName = meta.name.replace(/[^\w.\- ]/g, '_').replace(/\.pdf$/i, '') + '.pdf'
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
  createReadStream(filePath).pipe(res)
})

// GET /pdfs — lista los PDFs subidos (requiere sesión)
router.get('/pdfs', (_req, res) => res.json({ items: listPdfs() }))

// DELETE /pdf/:token — elimina el PDF y sus metadatos (requiere sesión)
router.delete('/pdf/:token', (req, res) => {
  const { token } = req.params
  if (!UUID_RE.test(token)) return res.status(400).json({ error: 'Token inválido' })
  const filePath = join(PDF_DIR, `${token}.pdf`)
  if (existsSync(filePath)) { try { unlinkSync(filePath) } catch {} }
  deletePdfMeta(token)
  res.json({ ok: true })
})

// Literal routes BEFORE /:id — avoids collision
router.get('/logos',              (req, res) => res.json({ items: listLogos(null) }))
router.post('/logos',             (req, res) => {
  const { name, data } = req.body ?? {}
  if (!String(data ?? '').startsWith('data:image/'))
    return res.status(400).json({ error: 'data debe ser data:image/…' })
  if (String(data).length > 1_200_000)
    return res.status(413).json({ error: 'Logo demasiado grande' })
  res.status(201).json({ item: saveLogo({ userId: null, name: name ?? 'Logo', data }) })
})
router.patch('/logos/:id(\\d+)',  (req, res) => {
  const ok = renameLogo(Number(req.params.id), null, req.body?.name)
  if (!ok) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})
router.delete('/logos/:id(\\d+)', (req, res) => {
  const ok = deleteLogo(Number(req.params.id), null)
  if (!ok) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

// GET /:id  DELETE /:id
router.get('/:id(\\d+)', (req, res) => {
  const item = getQr(Number(req.params.id), null)
  if (!item) return res.status(404).json({ error: 'No encontrado' })
  res.json({ item })
})
router.delete('/:id(\\d+)', (req, res) => {
  const ok = deleteQr(Number(req.params.id), null)
  if (!ok) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

export default router
