import { Router }                                    from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync }               from 'fs'
import { join, dirname }                             from 'path'
import { fileURLToPath }                             from 'url'
import { randomUUID }                                from 'crypto'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = dirname(__filename)
const DATA_DIR      = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const PROYECTOS_DIR = join(DATA_DIR, 'animalario', 'proyectos')
const REPO_FILE     = join(DATA_DIR, 'animalario', 'repositorio', 'campos_frecuentes.json')

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readProyecto(id) {
  const path = join(PROYECTOS_DIR, `proyecto_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeProyecto(proyecto) {
  ensureDir(PROYECTOS_DIR)
  writeFileSync(
    join(PROYECTOS_DIR, `proyecto_${proyecto.id}.json`),
    JSON.stringify(proyecto, null, 2),
    'utf-8'
  )
}

function readRepo() {
  if (!existsSync(REPO_FILE)) return {}
  return JSON.parse(readFileSync(REPO_FILE, 'utf-8'))
}

function writeRepo(data) {
  ensureDir(join(DATA_DIR, 'animalario', 'repositorio'))
  writeFileSync(REPO_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Repositorio de campos frecuentes ─────────────────────────────────────────

// GET /api/animalario/repositorio/campo/:campo
router.get('/repositorio/campo/:campo', (req, res) => {
  try {
    const repo = readRepo()
    res.json(repo[req.params.campo] ?? [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/animalario/repositorio/campo/:campo
router.post('/repositorio/campo/:campo', (req, res) => {
  try {
    const { valor } = req.body
    if (!valor?.trim()) return res.status(400).json({ error: 'valor requerido' })
    const repo = readRepo()
    if (!Array.isArray(repo[req.params.campo])) repo[req.params.campo] = []
    if (!repo[req.params.campo].includes(valor.trim())) {
      repo[req.params.campo].push(valor.trim())
      writeRepo(repo)
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Proyectos ─────────────────────────────────────────────────────────────────

// GET /api/animalario/proyectos
router.get('/proyectos', (_req, res) => {
  try {
    if (!existsSync(PROYECTOS_DIR)) return res.json([])

    const proyectos = readdirSync(PROYECTOS_DIR)
      .filter(f => /^proyecto_.+\.json$/.test(f))
      .map(f => {
        try {
          const p = JSON.parse(readFileSync(join(PROYECTOS_DIR, f), 'utf-8'))
          return {
            id:                  p.id,
            titulo:              p.seccionA?.titulo              ?? '(Sin título)',
            referencia_cbba:     p.seccionA?.referencia_cbba     ?? null,
            fecha_inicio:        p.seccionA?.duracion?.fecha_inicio ?? null,
            fecha_fin:           p.seccionA?.duracion?.fecha_fin   ?? null,
            responsable_nombre:  p.seccionA?.responsable?.nombre_apellidos ?? null,
            num_procedimientos:  Array.isArray(p.procedimientos) ? p.procedimientos.length : 0,
            fecha_actualizacion: p.fecha_actualizacion ?? p.fecha_creacion ?? null,
          }
        } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const da = a.fecha_actualizacion ? new Date(a.fecha_actualizacion).getTime() : 0
        const db = b.fecha_actualizacion ? new Date(b.fecha_actualizacion).getTime() : 0
        return db - da
      })

    res.json(proyectos)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/animalario/proyectos  (crear)
router.post('/proyectos', (req, res) => {
  try {
    const now     = new Date().toISOString()
    const proyecto = {
      id:                  randomUUID(),
      fecha_creacion:      now,
      fecha_actualizacion: now,
      procedimientos:      [],
      crias:               [],
      modificaciones:      [],
      ...req.body,
    }
    // Ensure arrays are never overwritten with undefined from body
    proyecto.procedimientos = Array.isArray(req.body.procedimientos) ? req.body.procedimientos : []
    proyecto.crias          = Array.isArray(req.body.crias)          ? req.body.crias          : []
    proyecto.modificaciones = Array.isArray(req.body.modificaciones) ? req.body.modificaciones : []

    writeProyecto(proyecto)
    res.status(201).json(proyecto)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/animalario/proyectos/:id
router.get('/proyectos/:id', (req, res) => {
  try {
    const p = readProyecto(req.params.id)
    if (!p) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.json(p)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/animalario/proyectos/:id  (actualizar)
router.put('/proyectos/:id', (req, res) => {
  try {
    const existing = readProyecto(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const updated = {
      ...existing,
      ...req.body,
      id:                  existing.id,           // proteger id
      fecha_creacion:      existing.fecha_creacion, // proteger fecha de creación
      fecha_actualizacion: new Date().toISOString(),
    }
    writeProyecto(updated)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
