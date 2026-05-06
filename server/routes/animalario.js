import { Router } from 'express'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = dirname(__filename)
const DATA_DIR      = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const PROYECTOS_DIR = join(DATA_DIR, 'animalario', 'proyectos')

const router = Router()

function readProyecto(id) {
  const path = join(PROYECTOS_DIR, `proyecto_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

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
            titulo:              p.titulo,
            referencia_cbba:     p.referencia_cbba     ?? null,
            fecha_inicio:        p.fecha_inicio         ?? null,
            fecha_fin:           p.fecha_fin            ?? null,
            responsable_nombre:  p.responsable_nombre   ?? null,
            num_procedimientos:  Array.isArray(p.procedimientos) ? p.procedimientos.length : 0,
            fecha_actualizacion: p.fecha_actualizacion  ?? p.fecha_creacion ?? null,
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

export default router
