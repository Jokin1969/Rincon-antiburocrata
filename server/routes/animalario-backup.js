import { Router } from 'express'
import { fileURLToPath } from 'url'
import { dirname, join, basename } from 'path'
import {
  existsSync, mkdirSync, readdirSync, statSync,
  unlinkSync, writeFileSync, readFileSync,
} from 'fs'
import JSZip from 'jszip'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const DATA_DIR       = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const ANIMALARIO_DIR = join(DATA_DIR, 'animalario')
const BACKUP_DIR     = process.env.BACKUP_DIR ?? join(DATA_DIR, 'backups', 'animalario')
const INTERVAL_HOURS = parseFloat(process.env.BACKUP_INTERVAL_HOURS ?? '2')
const MAX_COUNT      = parseInt(process.env.BACKUP_MAX_COUNT ?? '100', 10)

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
}

function listBackups() {
  ensureBackupDir()
  return readdirSync(BACKUP_DIR)
    .filter(f => /^animalario_backup_[\d_-]+\.zip$/.test(f))
    .sort()
    .reverse()
    .map(f => {
      const stat = statSync(join(BACKUP_DIR, f))
      return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() }
    })
}

function getLastModifiedMs() {
  if (!existsSync(ANIMALARIO_DIR)) return 0
  let latest = 0
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (stat.mtimeMs > latest) latest = stat.mtimeMs
    }
  }
  try { walk(ANIMALARIO_DIR) } catch {}
  return latest
}

async function createBackup() {
  ensureBackupDir()
  if (!existsSync(ANIMALARIO_DIR)) return null

  const zip = new JSZip()

  function addDir(dir, zipPath) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const zp   = zipPath ? `${zipPath}/${entry}` : entry
      if (statSync(full).isDirectory()) addDir(full, zp)
      else zip.file(zp, readFileSync(full))
    }
  }
  addDir(ANIMALARIO_DIR, '')

  const now = new Date()
  const p   = n => String(n).padStart(2, '0')
  const ts  = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`
  const filename = `animalario_backup_${ts}.zip`

  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  writeFileSync(join(BACKUP_DIR, filename), buf)

  // Rotate: delete oldest if over MAX_COUNT
  const all = readdirSync(BACKUP_DIR)
    .filter(f => /^animalario_backup_[\d_-]+\.zip$/.test(f))
    .sort()
  while (all.length > MAX_COUNT) {
    try { unlinkSync(join(BACKUP_DIR, all.shift())) } catch {}
  }

  return { filename, size: buf.length, createdAt: now.toISOString() }
}

// ── Auto-backup ───────────────────────────────────────────────────────────────

let lastBackupTime = 0

export function initAutoBackup() {
  // Initialise from most recent existing backup
  const existing = listBackups()
  if (existing.length > 0) {
    lastBackupTime = new Date(existing[0].createdAt).getTime()
  }

  const intervalMs = INTERVAL_HOURS * 60 * 60 * 1000

  setInterval(async () => {
    try {
      const lastMod = getLastModifiedMs()
      if (lastMod > lastBackupTime) {
        const result = await createBackup()
        if (result) {
          lastBackupTime = Date.now()
          console.log(`[Backup] ${result.filename} · ${Math.round(result.size / 1024)} KB`)
        }
      }
    } catch (err) {
      console.error('[Backup] Error en auto-backup:', err)
    }
  }, intervalMs)

  console.log(`[Backup] Auto-backup cada ${INTERVAL_HOURS}h → ${BACKUP_DIR} (máx. ${MAX_COUNT})`)
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router()

router.get('/backup/list', (_req, res) => {
  try {
    res.json({
      backups:       listBackups(),
      backupDir:     BACKUP_DIR,
      intervalHours: INTERVAL_HOURS,
      maxCount:      MAX_COUNT,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/backup/create', async (_req, res) => {
  try {
    const result = await createBackup()
    if (!result) return res.status(400).json({ error: 'No hay datos de animalario para respaldar.' })
    lastBackupTime = Date.now()
    res.json({ ok: true, backup: result })
  } catch (err) {
    console.error('[Backup] Error al crear backup manual:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/backup/download/:filename', (req, res) => {
  const { filename } = req.params
  if (!/^animalario_backup_[\d_-]+\.zip$/.test(filename)) {
    return res.status(400).json({ error: 'Nombre de archivo no válido.' })
  }
  const filepath = join(BACKUP_DIR, filename)
  if (!existsSync(filepath)) return res.status(404).json({ error: 'Backup no encontrado.' })
  res.download(filepath, filename)
})

router.post('/backup/restore/:filename', async (req, res) => {
  const { filename } = req.params
  if (!/^animalario_backup_[\d_-]+\.zip$/.test(filename)) {
    return res.status(400).json({ error: 'Nombre de archivo no válido.' })
  }
  const filepath = join(BACKUP_DIR, filename)
  if (!existsSync(filepath)) return res.status(404).json({ error: 'Backup no encontrado.' })

  try {
    const zip = await new JSZip().loadAsync(readFileSync(filepath))
    for (const [zipPath, file] of Object.entries(zip.files)) {
      if (file.dir) continue
      const destPath = join(ANIMALARIO_DIR, zipPath)
      mkdirSync(dirname(destPath), { recursive: true })
      writeFileSync(destPath, await file.async('nodebuffer'))
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[Backup] Error al restaurar:', err)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/backup/:filename', (req, res) => {
  const { filename } = req.params
  if (!/^animalario_backup_[\d_-]+\.zip$/.test(filename)) {
    return res.status(400).json({ error: 'Nombre de archivo no válido.' })
  }
  const filepath = join(BACKUP_DIR, filename)
  if (!existsSync(filepath)) return res.status(404).json({ error: 'Backup no encontrado.' })
  unlinkSync(filepath)
  res.json({ ok: true })
})

export default router
