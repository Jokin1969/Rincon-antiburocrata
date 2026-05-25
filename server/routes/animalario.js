import { Router }                                    from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync, unlinkSync }   from 'fs'
import { join, dirname }                             from 'path'
import { fileURLToPath }                             from 'url'
import { contentDispositionHeader }                  from '../../utils/contentDisposition.js'
import { randomUUID }                                from 'crypto'
import multer                                        from 'multer'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = dirname(__filename)
const DATA_DIR        = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const PROYECTOS_DIR   = join(DATA_DIR, 'animalario', 'proyectos')
const PROC_DIR        = join(DATA_DIR, 'animalario', 'procedimientos')
const CRIA_DIR        = join(DATA_DIR, 'animalario', 'crias')
const PRODUCTOS_DIR   = join(DATA_DIR, 'animalario', 'productos')
const MODIF_DIR       = join(DATA_DIR, 'animalario', 'modificaciones')
const REPO_FILE       = join(DATA_DIR, 'animalario', 'repositorio', 'campos_frecuentes.json')
const CERT_DIR        = join(DATA_DIR, 'animalario', 'certificados')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

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

function readCria(id) {
  const path = join(CRIA_DIR, `cria_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeCria(cria) {
  ensureDir(CRIA_DIR)
  writeFileSync(
    join(CRIA_DIR, `cria_${cria.id}.json`),
    JSON.stringify(cria, null, 2),
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

// DELETE /api/animalario/proyectos/:id
router.delete('/proyectos/:id', (req, res) => {
  try {
    const path = join(PROYECTOS_DIR, `proyecto_${req.params.id}.json`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Proyecto no encontrado' })
    unlinkSync(path)
    res.json({ ok: true })
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

    const ids   = Array.isArray(proyecto.procedimientos) ? proyecto.procedimientos : []
    const procs = ids.map(id => readProc(id)).filter(Boolean)

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

    const ids = Array.isArray(proyecto.procedimientos) ? proyecto.procedimientos : []
    proyecto.procedimientos      = [...ids, proc.id]
    proyecto.fecha_actualizacion = now
    syncProyectoRiesgo(proyecto)
    writeProyecto(proyecto)

    // If linked to a modificación, register the procedure there too
    const modificacionId = req.query.modificacion_id
    if (modificacionId) {
      const modif = readModificacion(modificacionId)
      if (modif) {
        if (!Array.isArray(modif.modificacion?.procedimientos_nuevos)) {
          modif.modificacion = modif.modificacion ?? {}
          modif.modificacion.procedimientos_nuevos = []
        }
        modif.modificacion.procedimientos_nuevos.push(proc.id)
        modif.fecha_actualizacion = now
        writeModificacion(modif)
      }
    }

    res.status(201).json(proc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/animalario/procedimientos  (all, across all projects — for copy-from feature)
router.get('/procedimientos', (_req, res) => {
  try {
    if (!existsSync(PROC_DIR)) return res.json([])

    // Build proyecto title map
    const proyTitles = {}
    if (existsSync(PROYECTOS_DIR)) {
      readdirSync(PROYECTOS_DIR)
        .filter(f => /^proyecto_.+\.json$/.test(f))
        .forEach(f => {
          try {
            const p = JSON.parse(readFileSync(join(PROYECTOS_DIR, f), 'utf-8'))
            proyTitles[p.id] = p.seccionA?.titulo ?? '(Sin título)'
          } catch {}
        })
    }

    const procs = readdirSync(PROC_DIR)
      .filter(f => /^procedimiento_.+\.json$/.test(f))
      .map(f => {
        try {
          const p = JSON.parse(readFileSync(join(PROC_DIR, f), 'utf-8'))
          return {
            id:              p.id,
            titulo:          p.datos_generales?.titulo_procedimiento || '(Sin título)',
            proyecto_id:     p.proyecto_id,
            proyecto_titulo: proyTitles[p.proyecto_id] ?? '(Proyecto desconocido)',
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

    res.json(procs)
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

    const proyecto = readProyecto(proc.proyecto_id)
    if (proyecto) {
      proyecto.procedimientos      = (proyecto.procedimientos ?? []).filter(id => id !== proc.id)
      proyecto.fecha_actualizacion = new Date().toISOString()
      syncProyectoRiesgo(proyecto)
      writeProyecto(proyecto)
    }

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
    if (copy.datos_generales?.titulo_procedimiento) {
      copy.datos_generales.titulo_procedimiento += ' (copia)'
    }
    writeProc(copy)

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

// ── Crías ─────────────────────────────────────────────────────────────────────

// POST /api/animalario/proyectos/:proyectoId/crias  (crear)
router.post('/proyectos/:proyectoId/crias', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const now  = new Date().toISOString()
    const cria = {
      ...req.body,
      id:                  randomUUID(),
      proyecto_id:         req.params.proyectoId,
      fecha_creacion:      now,
      fecha_actualizacion: now,
    }
    writeCria(cria)

    // Store lightweight reference in proyecto.crias
    const ref = {
      id:                       cria.id,
      cepa_idx:                 req.body.cepa_idx ?? null,
      acronimo:                 cria.seccionC?.identificacion?.acronimo ?? '',
      nomenclatura_internacional: cria.seccionC?.identificacion?.nomenclatura_internacional ?? '',
      es_omg:                   cria.seccionC?.es_omg ?? false,
    }
    proyecto.crias               = [...(proyecto.crias ?? []), ref]
    proyecto.fecha_actualizacion = now
    writeProyecto(proyecto)

    res.status(201).json(cria)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/animalario/crias/:id
router.get('/crias/:id', (req, res) => {
  try {
    const cria = readCria(req.params.id)
    if (!cria) return res.status(404).json({ error: 'Cría no encontrada' })
    res.json(cria)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/animalario/crias/:id  (actualizar)
router.put('/crias/:id', (req, res) => {
  try {
    const existing = readCria(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Cría no encontrada' })

    const updated = {
      ...existing,
      ...req.body,
      id:                  existing.id,
      proyecto_id:         existing.proyecto_id,
      fecha_creacion:      existing.fecha_creacion,
      fecha_actualizacion: new Date().toISOString(),
    }
    writeCria(updated)

    // Update reference in proyecto
    const proyecto = readProyecto(existing.proyecto_id)
    if (proyecto) {
      proyecto.crias = (proyecto.crias ?? []).map(c =>
        c.id === updated.id
          ? {
              ...c,
              acronimo:                 updated.seccionC?.identificacion?.acronimo ?? c.acronimo,
              nomenclatura_internacional: updated.seccionC?.identificacion?.nomenclatura_internacional ?? c.nomenclatura_internacional,
              es_omg:                   updated.seccionC?.es_omg ?? c.es_omg,
            }
          : c
      )
      proyecto.fecha_actualizacion = updated.fecha_actualizacion
      writeProyecto(proyecto)
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Productos con riesgo (Sección D) ─────────────────────────────────────────

function productosPath(proyectoId) {
  return join(PRODUCTOS_DIR, `productos_${proyectoId}.json`)
}

function readProductos(proyectoId) {
  const path = productosPath(proyectoId)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeProductos(doc) {
  ensureDir(PRODUCTOS_DIR)
  writeFileSync(productosPath(doc.proyecto_id), JSON.stringify(doc, null, 2), 'utf-8')
}

const EMPTY_SECCION_D = { agentes_biologicos: [], agentes_quimicos: [], firmante: '' }

// GET /api/animalario/proyectos/:proyectoId/productos
router.get('/proyectos/:proyectoId/productos', (req, res) => {
  try {
    const doc = readProductos(req.params.proyectoId)
    if (!doc) {
      // Return empty structure so the form can initialise without a 404
      return res.json({
        proyecto_id:         req.params.proyectoId,
        fecha_creacion:      null,
        fecha_actualizacion: null,
        seccionD:            EMPTY_SECCION_D,
      })
    }
    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/animalario/proyectos/:proyectoId/productos  (crear)
router.post('/proyectos/:proyectoId/productos', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const now = new Date().toISOString()
    const doc = {
      ...req.body,
      id:                  randomUUID(),
      proyecto_id:         req.params.proyectoId,
      fecha_creacion:      now,
      fecha_actualizacion: now,
    }
    writeProductos(doc)

    proyecto.seccionD_id         = doc.id
    proyecto.fecha_actualizacion = now
    writeProyecto(proyecto)

    res.status(201).json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/animalario/proyectos/:proyectoId/productos  (actualizar)
router.put('/proyectos/:proyectoId/productos', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const existing = readProductos(req.params.proyectoId)
    const now = new Date().toISOString()
    const doc = {
      ...(existing ?? {}),
      ...req.body,
      proyecto_id:         req.params.proyectoId,
      id:                  existing?.id ?? randomUUID(),
      fecha_creacion:      existing?.fecha_creacion ?? now,
      fecha_actualizacion: now,
    }
    writeProductos(doc)

    proyecto.seccionD_id         = doc.id
    proyecto.fecha_actualizacion = now
    writeProyecto(proyecto)

    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Modificaciones ───────────────────────────────────────────────────────────

function readModificacion(id) {
  const path = join(MODIF_DIR, `modificacion_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeModificacion(m) {
  ensureDir(MODIF_DIR)
  writeFileSync(
    join(MODIF_DIR, `modificacion_${m.id}.json`),
    JSON.stringify(m, null, 2),
    'utf-8'
  )
}

// GET /api/animalario/proyectos/:proyectoId/modificaciones
router.get('/proyectos/:proyectoId/modificaciones', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const refs = Array.isArray(proyecto.modificaciones) ? proyecto.modificaciones : []
    const docs = refs
      .map(r => readModificacion(r.id))
      .filter(Boolean)
      .sort((a, b) => (a.numero_modificacion ?? 0) - (b.numero_modificacion ?? 0))

    res.json(docs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/animalario/proyectos/:proyectoId/modificaciones  (crear)
router.post('/proyectos/:proyectoId/modificaciones', (req, res) => {
  try {
    const proyecto = readProyecto(req.params.proyectoId)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const existentes      = Array.isArray(proyecto.modificaciones) ? proyecto.modificaciones : []
    const numeroMax       = existentes.reduce((m, r) => Math.max(m, r.numero_modificacion ?? 0), 0)
    const numeroMod       = numeroMax + 1
    const now             = new Date().toISOString()

    const m = {
      ...req.body,
      id:                  randomUUID(),
      proyecto_id:         req.params.proyectoId,
      numero_modificacion: numeroMod,
      fecha_creacion:      now,
      fecha_actualizacion: now,
    }
    writeModificacion(m)

    const ref = {
      id:                  m.id,
      numero_modificacion: numeroMod,
      fecha_creacion:      now,
      tipos_cambio:        m.modificacion?.tipos_cambio ?? {},
    }
    proyecto.modificaciones      = [...existentes, ref]
    proyecto.fecha_actualizacion = now
    writeProyecto(proyecto)

    res.status(201).json(m)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/animalario/modificaciones/:id
router.get('/modificaciones/:id', (req, res) => {
  try {
    const m = readModificacion(req.params.id)
    if (!m) return res.status(404).json({ error: 'Modificación no encontrada' })
    res.json(m)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/animalario/modificaciones/:id
router.put('/modificaciones/:id', (req, res) => {
  try {
    const existing = readModificacion(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Modificación no encontrada' })

    const updated = {
      ...existing,
      ...req.body,
      id:                  existing.id,
      proyecto_id:         existing.proyecto_id,
      numero_modificacion: existing.numero_modificacion,
      fecha_creacion:      existing.fecha_creacion,
      fecha_actualizacion: new Date().toISOString(),
    }
    writeModificacion(updated)

    // Update reference in proyecto
    const proyecto = readProyecto(existing.proyecto_id)
    if (proyecto) {
      proyecto.modificaciones = (proyecto.modificaciones ?? []).map(r =>
        r.id === updated.id
          ? { ...r, tipos_cambio: updated.modificacion?.tipos_cambio ?? r.tipos_cambio }
          : r
      )
      proyecto.fecha_actualizacion = updated.fecha_actualizacion
      writeProyecto(proyecto)
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/animalario/modificaciones/:id
router.delete('/modificaciones/:id', (req, res) => {
  try {
    const m = readModificacion(req.params.id)
    if (!m) return res.status(404).json({ error: 'Modificación no encontrada' })

    const proyecto = readProyecto(m.proyecto_id)
    if (proyecto) {
      proyecto.modificaciones      = (proyecto.modificaciones ?? []).filter(r => r.id !== m.id)
      proyecto.fecha_actualizacion = new Date().toISOString()
      writeProyecto(proyecto)
    }

    const path = join(MODIF_DIR, `modificacion_${m.id}.json`)
    if (existsSync(path)) unlinkSync(path)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/animalario/crias/:id
router.delete('/crias/:id', (req, res) => {
  try {
    const cria = readCria(req.params.id)
    if (!cria) return res.status(404).json({ error: 'Cría no encontrada' })

    const proyecto = readProyecto(cria.proyecto_id)
    if (proyecto) {
      proyecto.crias               = (proyecto.crias ?? []).filter(c => c.id !== cria.id)
      proyecto.fecha_actualizacion = new Date().toISOString()
      writeProyecto(proyecto)
    }

    const path = join(CRIA_DIR, `cria_${cria.id}.json`)
    if (existsSync(path)) unlinkSync(path)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Certificado Diputación de Bizkaia ─────────────────────────────────────────

router.post('/proyectos/:id/certificado', upload.single('file'), (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf')
      return res.status(400).json({ error: 'Se requiere un archivo PDF.' })
    ensureDir(CERT_DIR)
    writeFileSync(join(CERT_DIR, `cert_${req.params.id}.pdf`), req.file.buffer)
    const proyecto = readProyecto(req.params.id)
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' })
    proyecto.certificado = {
      filename:   req.file.originalname,
      size:       req.file.size,
      uploadedAt: new Date().toISOString(),
    }
    writeProyecto(proyecto)
    res.json({ ok: true, certificado: proyecto.certificado })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/proyectos/:id/certificado', (req, res) => {
  const filePath = join(CERT_DIR, `cert_${req.params.id}.pdf`)
  if (!existsSync(filePath)) return res.status(404).json({ error: 'No hay certificado adjunto.' })
  const proyecto = readProyecto(req.params.id)
  const filename = proyecto?.certificado?.filename ?? `certificado_${req.params.id}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', contentDispositionHeader('attachment', filename))
  res.send(readFileSync(filePath))
})

router.delete('/proyectos/:id/certificado', (req, res) => {
  try {
    const filePath = join(CERT_DIR, `cert_${req.params.id}.pdf`)
    if (existsSync(filePath)) unlinkSync(filePath)
    const proyecto = readProyecto(req.params.id)
    if (proyecto) {
      proyecto.certificado = null
      writeProyecto(proyecto)
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
