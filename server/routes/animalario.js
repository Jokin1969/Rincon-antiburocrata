import { Router }                                    from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync, unlinkSync }   from 'fs'
import { join, dirname }                             from 'path'
import { fileURLToPath }                             from 'url'
import { randomUUID }                                from 'crypto'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = dirname(__filename)
const DATA_DIR      = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const PROYECTOS_DIR = join(DATA_DIR, 'animalario', 'proyectos')
const PROC_DIR      = join(DATA_DIR, 'animalario', 'procedimientos')
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

function readProc(id) {
  const path = join(PROC_DIR, `proc_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeProc(proc) {
  ensureDir(PROC_DIR)
  writeFileSync(
    join(PROC_DIR, `proc_${proc.id}.json`),
    JSON.stringify(proc, null, 2),
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

// Recalculate and persist the proyecto's hay_productos_riesgo derived flag
function syncProyectoRiesgo(proyecto) {
  const ids = Array.isArray(proyecto.procedimientos) ? proyecto.procedimientos : []
  const hayRiesgo = ids.some(id => {
    const p = readProc(id)
    return p?.otras_sustancias?.hay_riesgo === true
  })
  proyecto.hay_productos_riesgo = hayRiesgo
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
      id:                  existing.id,
      fecha_creacion:      existing.fecha_creacion,
      fecha_actualizacion: new Date().toISOString(),
    }
    writeProyecto(updated)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Procedimientos ────────────────────────────────────────────────────────────

// GET /api/animalario/proyectos/:proyectoId/procedimientos
router.get('/proyectos/:proyectoId/procedimientos', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const ids = Array.isArray(proyecto.procedimientos) ? proyecto.procedimientos : []
    const procs = ids
      .map(id => readProc(id))
      .filter(Boolean)

    res.json(procs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/animalario/proyectos/:proyectoId/procedimientos  (crear)
router.post('/proyectos/:proyectoId/procedimientos', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const now  = new Date().toISOString()
    const proc = {
      ...req.body,
      id:                  randomUUID(),
      proyecto_id:         req.params.proyectoId,
      fecha_creacion:      now,
      fecha_actualizacion: now,
    }
    writeProc(proc)

    // Register id in proyecto
    const ids = Array.isArray(proyecto.procedimientos) ? proyecto.procedimientos : []
    proyecto.procedimientos      = [...ids, proc.id]
    proyecto.fecha_actualizacion = now
    syncProyectoRiesgo(proyecto)
    writeProyecto(proyecto)

    res.status(201).json(proc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/animalario/procedimientos/:id
router.get('/procedimientos/:id', (req, res) => {
  try {
    const proc = readProc(req.params.id)
    if (!proc) return res.status(404).json({ error: 'Procedimiento no encontrado' })
    res.json(proc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/animalario/procedimientos/:id  (actualizar)
router.put('/procedimientos/:id', (req, res) => {
  try {
    const existing = readProc(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Procedimiento no encontrado' })

    const updated = {
      ...existing,
      ...req.body,
      id:                  existing.id,
      proyecto_id:         existing.proyecto_id,
      fecha_creacion:      existing.fecha_creacion,
      fecha_actualizacion: new Date().toISOString(),
    }
    writeProc(updated)

    // Update proyecto's fecha_actualizacion and riesgo flag
    const proyecto = readProyecto(existing.proyecto_id)
    if (proyecto) {
      proyecto.fecha_actualizacion = updated.fecha_actualizacion
      syncProyectoRiesgo(proyecto)
      writeProyecto(proyecto)
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/animalario/procedimientos/:id
router.delete('/procedimientos/:id', (req, res) => {
  try {
    const proc = readProc(req.params.id)
    if (!proc) return res.status(404).json({ error: 'Procedimiento no encontrado' })

    // Remove from proyecto's list and resync riesgo flag
    const proyecto = readProyecto(proc.proyecto_id)
    if (proyecto) {
      proyecto.procedimientos      = (proyecto.procedimientos ?? []).filter(id => id !== proc.id)
      proyecto.fecha_actualizacion = new Date().toISOString()
      syncProyectoRiesgo(proyecto)
      writeProyecto(proyecto)
    }

    // Delete file
    const path = join(PROC_DIR, `proc_${proc.id}.json`)
    if (existsSync(path)) unlinkSync(path)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/animalario/procedimientos/:id/duplicar
router.post('/procedimientos/:id/duplicar', (req, res) => {
  try {
    const original = readProc(req.params.id)
    if (!original) return res.status(404).json({ error: 'Procedimiento no encontrado' })

    const now  = new Date().toISOString()
    const copy = {
      ...JSON.parse(JSON.stringify(original)),
      id:                  randomUUID(),
      fecha_creacion:      now,
      fecha_actualizacion: now,
    }
    // Append "(copia)" to the title if present
    if (copy.datos_generales?.titulo_procedimiento) {
      copy.datos_generales.titulo_procedimiento += ' (copia)'
    }
    writeProc(copy)

    // Register in proyecto
    const proyecto = readProyecto(original.proyecto_id)
    if (proyecto) {
      proyecto.procedimientos      = [...(proyecto.procedimientos ?? []), copy.id]
      proyecto.fecha_actualizacion = now
      writeProyecto(proyecto)
    }

    res.status(201).json(copy)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
