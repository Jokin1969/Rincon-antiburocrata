import { Router }                                         from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync, unlinkSync }         from 'fs'
import { join, dirname }                                   from 'path'
import { fileURLToPath }                                   from 'url'
import { contentDispositionHeader }                        from '../../utils/contentDisposition.js'
import { randomUUID }                                      from 'crypto'
import multer                                              from 'multer'
import OpenAI                                              from 'openai'
import { PDFDocument }                                     from 'pdf-lib'

const __filename  = fileURLToPath(import.meta.url)
const __dirname   = dirname(__filename)
const DATA_DIR    = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const VIAJES_DIR  = join(DATA_DIR, 'gastosviaje')
const ADJUNTOS_BASE = join(VIAJES_DIR, 'adjuntos')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readViaje(id) {
  const path = join(VIAJES_DIR, `viaje_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeViaje(viaje) {
  ensureDir(VIAJES_DIR)
  writeFileSync(
    join(VIAJES_DIR, `viaje_${viaje.id}.json`),
    JSON.stringify(viaje, null, 2),
    'utf-8'
  )
}

function emptyViaje() {
  const now = new Date().toISOString()
  return {
    id:           randomUUID(),
    nombre:       '',
    fechaInicio:  new Date().toISOString().split('T')[0],
    fechaFin:     '',
    logoCustom:   null,
    ceco:         '',
    transporte: {
      autopista: [],
      coche:     [],
      avion:     [],
      tren:      [],
      autobus:   [],
      parking:   [],
      taxi:      [],
      otros:     [],
    },
    manutencion:  [],
    hotel:        [],
    otros:        [],
    numeroPedido: '',
    adjuntos:     [],
    createdAt:    now,
    updatedAt:   now,
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  try {
    ensureDir(VIAJES_DIR)
    const files = readdirSync(VIAJES_DIR)
      .filter(f => f.startsWith('viaje_') && f.endsWith('.json'))
    const viajes = files
      .map(f => {
        const v = JSON.parse(readFileSync(join(VIAJES_DIR, f), 'utf-8'))
        return {
          id:          v.id,
          nombre:      v.nombre,
          fechaInicio: v.fechaInicio,
          fechaFin:    v.fechaFin,
          updatedAt:   v.updatedAt,
        }
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    res.json(viajes)
  } catch (err) {
    console.error('GET gastos-viaje error:', err)
    res.status(500).json({ error: 'Error al leer los viajes.' })
  }
})

router.get('/:id', (req, res) => {
  const viaje = readViaje(req.params.id)
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado.' })
  res.json(viaje)
})

router.post('/', (req, res) => {
  try {
    const base  = emptyViaje()
    const viaje = { ...base, ...req.body, id: base.id, createdAt: base.createdAt, updatedAt: base.createdAt }
    writeViaje(viaje)
    res.status(201).json(viaje)
  } catch (err) {
    console.error('POST gastos-viaje error:', err)
    res.status(500).json({ error: 'Error al crear el viaje.' })
  }
})

router.put('/:id', (req, res) => {
  try {
    const existing = readViaje(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Viaje no encontrado.' })
    const viaje = { ...existing, ...req.body, id: req.params.id, updatedAt: new Date().toISOString() }
    writeViaje(viaje)
    res.json(viaje)
  } catch (err) {
    console.error('PUT gastos-viaje error:', err)
    res.status(500).json({ error: 'Error al actualizar el viaje.' })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const path = join(VIAJES_DIR, `viaje_${req.params.id}.json`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Viaje no encontrado.' })
    unlinkSync(path)
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE gastos-viaje error:', err)
    res.status(500).json({ error: 'Error al eliminar el viaje.' })
  }
})

// ── IA: extracción de ticket ──────────────────────────────────────────────────

const IA_TICKET_SYSTEM =
  'Eres un asistente especializado en extraer datos de documentos de gastos de viaje. ' +
  'Responde ÚNICAMENTE con un objeto JSON válido con exactamente estas claves: ' +
  '"nombre" (string descriptivo del documento o establecimiento), ' +
  '"fecha" (string en formato YYYY-MM-DD), ' +
  '"sinIva" (string con el importe sin IVA en euros, usa punto como separador decimal, ej: "12.50"), ' +
  '"conIva" (string con el importe total con IVA en euros, usa punto como separador decimal, ej: "15.13"). ' +
  'Si no encuentras un campo usa cadena vacía "". No incluyas nada fuera del objeto JSON.'

const TIPO_PROMPTS = {
  autopista:
    'Este documento es un ticket de peaje de autopista. Extrae: nombre de la autopista o ' +
    'identificador del peaje (campo nombre), fecha del cobro en YYYY-MM-DD (campo fecha), ' +
    'importe sin IVA en euros (campo sinIva), importe total con IVA en euros (campo conIva). ' +
    'Si no aparece el importe sin IVA pero sí el total, calcula sinIva = conIva / 1.21.',
  avion:
    'Este documento es un billete o factura de avión/vuelo. Extrae: nombre descriptivo del vuelo ' +
    'o ruta (campo nombre, ej: "Vuelo IB1234 MAD-BCN"), fecha del vuelo en YYYY-MM-DD (campo fecha), ' +
    'precio sin IVA en euros (campo sinIva), precio total con IVA en euros (campo conIva).',
  tren:
    'Este documento es un billete o factura de tren (AVE, Renfe, Cercanías, Euskotren, etc.). Extrae: ' +
    'nombre descriptivo del trayecto o número de tren (campo nombre), fecha del viaje en YYYY-MM-DD ' +
    '(campo fecha), precio sin IVA en euros (campo sinIva), precio total con IVA en euros (campo conIva).',
  autobus:
    'Este documento es un billete o factura de autobús. Extrae: nombre descriptivo de la ruta o ' +
    'compañía (campo nombre), fecha del viaje en YYYY-MM-DD (campo fecha), precio sin IVA en euros ' +
    '(campo sinIva), precio total con IVA en euros (campo conIva).',
  parking:
    'Este documento es un ticket o factura de parking/estacionamiento. Extrae: nombre del parking ' +
    'o dirección (campo nombre), fecha de salida en YYYY-MM-DD (campo fecha), importe sin IVA en euros ' +
    '(campo sinIva), importe total con IVA en euros (campo conIva). ' +
    'Si no aparece el importe sin IVA calcula sinIva = conIva / 1.21.',
  taxi:
    'Este documento es un recibo, ticket o factura de taxi o VTC (Uber, Cabify, etc.). Extrae: ' +
    'nombre o identificador del servicio (campo nombre, ej: "Taxi Bilbao" o "Uber"), ' +
    'fecha del trayecto en YYYY-MM-DD (campo fecha), importe sin IVA en euros (campo sinIva), ' +
    'importe total con IVA en euros (campo conIva). ' +
    'Si no aparece el importe sin IVA calcula sinIva = conIva / 1.21.',
  manutencion:
    'Este documento es un ticket o factura de restaurante, cafetería, bar o servicio de comidas. ' +
    'Extrae: nombre del establecimiento (campo nombre), fecha en YYYY-MM-DD (campo fecha), importe ' +
    'sin IVA en euros (campo sinIva), importe total con IVA en euros (campo conIva). ' +
    'Si no aparece IVA separado, asume IVA del 10% para restauración.',
  hotel:
    'Este documento es una factura de hotel o alojamiento. Extrae: nombre del hotel (campo nombre), ' +
    'fecha de check-out en YYYY-MM-DD (campo fecha), importe sin IVA en euros (campo sinIva), ' +
    'importe total con IVA en euros (campo conIva).',
  otros:
    'Este documento es un justificante de gasto de viaje. Extrae: descripción del gasto (campo nombre), ' +
    'fecha en YYYY-MM-DD (campo fecha), importe sin IVA en euros (campo sinIva), importe total con IVA ' +
    'en euros (campo conIva).',
}

router.post('/ia-ticket', upload.single('file'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY no está configurada en el servidor.' })
  }

  const tipo = req.body.tipo || 'otros'
  const file = req.file

  if (!file) return res.status(400).json({ error: 'Se requiere un archivo (PDF, PNG o JPG).' })

  const mime = file.mimetype
  if (mime !== 'application/pdf' && !mime.startsWith('image/')) {
    return res.status(400).json({ error: 'Formato no soportado. Usa PDF, PNG o JPG.' })
  }

  try {
    const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const base64     = file.buffer.toString('base64')
    const userContent = []

    if (mime === 'application/pdf') {
      userContent.push({
        type: 'file',
        file: {
          filename:  file.originalname || 'documento.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        },
      })
    } else {
      userContent.push({
        type:      'image_url',
        image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' },
      })
    }

    userContent.push({ type: 'text', text: TIPO_PROMPTS[tipo] || TIPO_PROMPTS.otros })

    const completion = await openai.chat.completions.create({
      model:           'gpt-4o',
      messages: [
        { role: 'system', content: IA_TICKET_SYSTEM },
        { role: 'user',   content: userContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens:      400,
    })

    const text  = completion.choices[0].message.content
    const match = (text || '{}').match(/\{[\s\S]*\}/)
    const data  = JSON.parse(match ? match[0] : '{}')

    res.json({
      nombre: data.nombre || '',
      fecha:  data.fecha  || '',
      sinIva: data.sinIva || '',
      conIva: data.conIva || '',
    })
  } catch (err) {
    console.error('IA Ticket error:', err)
    const status = err.status ?? err.statusCode
    let msg = `Error al consultar OpenAI: ${err.message || 'error desconocido'}`
    if (status === 429) msg = 'Se ha agotado la cuota de OpenAI. Revisa tu cuenta en platform.openai.com/account/billing'
    if (status === 401 || status === 403) msg = 'La API key de OpenAI no es válida o no está autorizada.'
    res.status(500).json({ error: msg })
  }
})

// ── Adjuntos ──────────────────────────────────────────────────────────────────

function adjuntosDir(viajeId) {
  return join(ADJUNTOS_BASE, viajeId)
}

// POST /api/gastos-viaje/:id/adjuntos  — sube un fichero
router.post('/:id/adjuntos', upload.single('file'), async (req, res) => {
  const viaje = readViaje(req.params.id)
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado.' })
  if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo.' })

  try {
    const dir      = adjuntosDir(req.params.id)
    ensureDir(dir)
    const adjId    = randomUUID()
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 80)
    const filename = `${adjId}_${safeName}`
    writeFileSync(join(dir, filename), req.file.buffer)

    // Contar páginas reales si es PDF
    let pageCount = 1
    if (req.file.mimetype === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true })
        pageCount = pdfDoc.getPageCount()
      } catch { pageCount = 1 }
    }

    const meta = { id: adjId, originalName: req.file.originalname, mime: req.file.mimetype, filename, pageCount }
    viaje.adjuntos = [...(viaje.adjuntos || []), meta]
    writeViaje(viaje)
    res.status(201).json(meta)
  } catch (err) {
    console.error('Adjunto upload error:', err)
    res.status(500).json({ error: 'Error al guardar el adjunto.' })
  }
})

// POST /api/gastos-viaje/:id/adjunto-item  — sube adjunto para un gasto individual
// (no modifica viaje.adjuntos; la referencia se guarda dentro del item al guardar el viaje)
router.post('/:id/adjunto-item', upload.single('file'), async (req, res) => {
  const viaje = readViaje(req.params.id)
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado.' })
  if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo.' })

  try {
    const dir      = adjuntosDir(req.params.id)
    ensureDir(dir)
    const adjId    = randomUUID()
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 80)
    const filename = `${adjId}_${safeName}`
    writeFileSync(join(dir, filename), req.file.buffer)

    let pageCount = 1
    if (req.file.mimetype === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true })
        pageCount = pdfDoc.getPageCount()
      } catch { pageCount = 1 }
    }

    res.status(201).json({ id: adjId, originalName: req.file.originalname, mime: req.file.mimetype, filename, pageCount })
  } catch (err) {
    console.error('Adjunto item upload error:', err)
    res.status(500).json({ error: 'Error al guardar el adjunto.' })
  }
})

// DELETE /api/gastos-viaje/:id/adjunto-item/:adjId
router.delete('/:id/adjunto-item/:adjId', (req, res) => {
  const dir = adjuntosDir(req.params.id)
  if (existsSync(dir)) {
    const prefix = req.params.adjId + '_'
    readdirSync(dir).filter(f => f.startsWith(prefix)).forEach(f => {
      try { unlinkSync(join(dir, f)) } catch {}
    })
  }
  res.json({ ok: true })
})

// GET /api/gastos-viaje/:id/adjuntos/:adjId  — visualizar/descargar adjunto
router.get('/:id/adjuntos/:adjId', (req, res) => {
  const viaje = readViaje(req.params.id)
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado.' })

  const meta = (viaje.adjuntos || []).find(a => a.id === req.params.adjId)
  if (!meta) return res.status(404).json({ error: 'Adjunto no encontrado.' })

  const filePath = join(adjuntosDir(req.params.id), meta.filename)
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado.' })

  res.setHeader('Content-Type', meta.mime || 'application/octet-stream')
  res.setHeader('Content-Disposition', contentDispositionHeader('inline', meta.originalName))
  res.sendFile(filePath)
})

// DELETE /api/gastos-viaje/:id/adjuntos/:adjId
router.delete('/:id/adjuntos/:adjId', (req, res) => {
  const viaje = readViaje(req.params.id)
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado.' })

  const meta = (viaje.adjuntos || []).find(a => a.id === req.params.adjId)
  if (!meta) return res.status(404).json({ error: 'Adjunto no encontrado.' })

  try {
    const filePath = join(adjuntosDir(req.params.id), meta.filename)
    if (existsSync(filePath)) unlinkSync(filePath)
    viaje.adjuntos = viaje.adjuntos.filter(a => a.id !== req.params.adjId)
    writeViaje(viaje)
    res.json({ ok: true })
  } catch (err) {
    console.error('Adjunto delete error:', err)
    res.status(500).json({ error: 'Error al eliminar el adjunto.' })
  }
})

export default router
