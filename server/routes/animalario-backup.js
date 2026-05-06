import { Router } from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  existsSync, mkdirSync, readdirSync, statSync,
  readFileSync, writeFileSync,
} from 'fs'
import JSZip from 'jszip'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const DATA_DIR       = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const ANIMALARIO_DIR = join(DATA_DIR, 'animalario')

const INTERVAL_HOURS = parseFloat(process.env.BACKUP_INTERVAL_HOURS ?? '2')
const MAX_COUNT      = parseInt(process.env.BACKUP_MAX_COUNT ?? '100', 10)

// Dropbox folder: strip trailing slash, ensure leading slash for non-root
const _rawFolder = (process.env.DROPBOX_FOLDER ?? '').replace(/\/$/, '')
const DBX_FOLDER = _rawFolder === '' ? '' : (_rawFolder.startsWith('/') ? _rawFolder : `/${_rawFolder}`)

function dropboxConfigured() {
  return !!(
    process.env.DROPBOX_REFRESH_TOKEN &&
    process.env.DROPBOX_APP_KEY &&
    process.env.DROPBOX_APP_SECRET
  )
}

function dbxPath(filename) {
  return DBX_FOLDER ? `${DBX_FOLDER}/${filename}` : `/${filename}`
}

// ── Dropbox OAuth2 token (cached, auto-refreshed) ─────────────────────────────

let _token  = null
let _expiry = 0

// Safe JSON parser — never throws "Unexpected end of JSON input"
async function safeJson(resp, label) {
  const text = await resp.text()
  if (!text.trim()) {
    if (!resp.ok) throw new Error(`[${label}] HTTP ${resp.status} (respuesta vacía)`)
    return {}
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`[${label}] HTTP ${resp.status} — respuesta no JSON: ${text.slice(0, 200)}`)
  }
}

async function getToken() {
  if (_token && Date.now() < _expiry - 60_000) return _token

  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      client_id:     process.env.DROPBOX_APP_KEY,
      client_secret: process.env.DROPBOX_APP_SECRET,
    }),
  })
  const data = await safeJson(resp, 'oauth2/token')
  if (!data.access_token) throw new Error(`Dropbox auth fallido: ${JSON.stringify(data)}`)
  _token  = data.access_token
  _expiry = Date.now() + (data.expires_in ?? 14400) * 1000
  return _token
}

// ── Dropbox API helpers ───────────────────────────────────────────────────────

async function dbxListFolder() {
  const token = await getToken()
  const resp  = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ path: DBX_FOLDER || '', recursive: false }),
  })
  const data = await safeJson(resp, 'list_folder')

  // Folder not found → return empty list (first backup will create it implicitly)
  if (!resp.ok) {
    const tag = data?.error?.path?.['.tag'] ?? data?.error_summary ?? ''
    if (tag.includes('not_found')) return []
    throw new Error(`[list_folder] ${data?.error_summary ?? JSON.stringify(data)}`)
  }
  return data.entries ?? []
}

async function dbxUpload(filename, buffer) {
  const token = await getToken()
  const resp  = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method:  'POST',
    headers: {
      Authorization:     `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path:       dbxPath(filename),
        mode:       'overwrite',
        autorename: false,
        mute:       true,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  })
  if (!resp.ok) {
    // Content-API errors come in the Dropbox-API-Result header, not the body
    const errHeader = resp.headers.get('Dropbox-API-Result')
    const errBody   = await resp.text()
    const detail    = errHeader || errBody || `HTTP ${resp.status}`
    throw new Error(`[files/upload] ${detail}`)
  }
  return safeJson(resp, 'files/upload')
}

async function dbxDownload(filename) {
  const token = await getToken()
  const resp  = await fetch('https://content.dropboxapi.com/2/files/download', {
    method:  'POST',
    headers: {
      Authorization:     `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dbxPath(filename) }),
    },
  })
  if (!resp.ok) {
    const errHeader = resp.headers.get('Dropbox-API-Result')
    const errBody   = await resp.text()
    const detail    = errHeader || errBody || `HTTP ${resp.status}`
    throw new Error(`[files/download] ${detail}`)
  }
  return Buffer.from(await resp.arrayBuffer())
}

async function dbxDelete(filename) {
  const token = await getToken()
  const resp  = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ path: dbxPath(filename) }),
  })
  const data = await safeJson(resp, 'files/delete_v2')
  if (!resp.ok) throw new Error(`[files/delete_v2] ${data?.error_summary ?? JSON.stringify(data)}`)
}

// ── Backup logic ──────────────────────────────────────────────────────────────

function isBackupFile(name) {
  return /^animalario_backup_[\d_-]+\.zip$/.test(name)
}

async function listBackups() {
  const entries = await dbxListFolder()
  return entries
    .filter(e => e['.tag'] === 'file' && isBackupFile(e.name))
    .map(e => ({
      filename:  e.name,
      size:      e.size,
      createdAt: e.client_modified ?? e.server_modified,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function createBackup() {
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

  await dbxUpload(filename, buf)

  // Rotate: delete oldest if over MAX_COUNT
  try {
    const all = await listBackups()
    for (const old of all.slice(MAX_COUNT)) {
      await dbxDelete(old.filename).catch(() => {})
    }
  } catch {}

  return { filename, size: buf.length, createdAt: now.toISOString() }
}

// ── Auto-backup ───────────────────────────────────────────────────────────────

let lastBackupTime = 0

function getLastModifiedMs() {
  if (!existsSync(ANIMALARIO_DIR)) return 0
  let latest = 0
  function walk(dir) {
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const stat = statSync(full)
        if (stat.isDirectory()) walk(full)
        else if (stat.mtimeMs > latest) latest = stat.mtimeMs
      }
    } catch {}
  }
  walk(ANIMALARIO_DIR)
  return latest
}

export function initAutoBackup() {
  if (!dropboxConfigured()) {
    console.warn('[Backup] Dropbox no configurado (faltan DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY o DROPBOX_APP_SECRET) — auto-backup desactivado.')
    return
  }

  // Seed lastBackupTime from most recent existing backup
  listBackups()
    .then(all => { if (all.length > 0) lastBackupTime = new Date(all[0].createdAt).getTime() })
    .catch(() => {})

  const intervalMs = INTERVAL_HOURS * 60 * 60 * 1000

  setInterval(async () => {
    try {
      if (getLastModifiedMs() > lastBackupTime) {
        const result = await createBackup()
        if (result) {
          lastBackupTime = Date.now()
          console.log(`[Backup] ${result.filename} · ${Math.round(result.size / 1024)} KB → Dropbox:${DBX_FOLDER || '/'}`)
        }
      }
    } catch (err) {
      console.error('[Backup] Error en auto-backup:', err.message)
    }
  }, intervalMs)

  console.log(`[Backup] Auto-backup cada ${INTERVAL_HOURS}h → Dropbox:${DBX_FOLDER || '/'} (máx. ${MAX_COUNT})`)
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router()

function requireDropbox(res) {
  if (dropboxConfigured()) return false
  res.status(503).json({ error: 'Dropbox no configurado. Revisa las variables DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY y DROPBOX_APP_SECRET.' })
  return true
}

router.get('/backup/list', async (_req, res) => {
  if (requireDropbox(res)) return
  try {
    const backups = await listBackups()
    res.json({
      backups,
      dropboxFolder: DBX_FOLDER || '/',
      intervalHours: INTERVAL_HOURS,
      maxCount:      MAX_COUNT,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/backup/create', async (_req, res) => {
  if (requireDropbox(res)) return
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

router.get('/backup/download/:filename', async (req, res) => {
  if (requireDropbox(res)) return
  const { filename } = req.params
  if (!isBackupFile(filename)) return res.status(400).json({ error: 'Nombre de archivo no válido.' })
  try {
    const buf = await dbxDownload(filename)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/backup/restore/:filename', async (req, res) => {
  if (requireDropbox(res)) return
  const { filename } = req.params
  if (!isBackupFile(filename)) return res.status(400).json({ error: 'Nombre de archivo no válido.' })
  try {
    const buf = await dbxDownload(filename)
    const zip = await new JSZip().loadAsync(buf)
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

router.delete('/backup/:filename', async (req, res) => {
  if (requireDropbox(res)) return
  const { filename } = req.params
  if (!isBackupFile(filename)) return res.status(400).json({ error: 'Nombre de archivo no válido.' })
  try {
    await dbxDelete(filename)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
