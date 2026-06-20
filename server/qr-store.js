import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH   = process.env.DB_PATH ?? join(__dirname, '..', 'data', 'rincon.db')

const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS qr_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    config     TEXT NOT NULL,
    thumb      TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_qr_user ON qr_codes(user_id);

  CREATE TABLE IF NOT EXISTS qr_logos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    name       TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_qr_logos_user ON qr_logos(user_id);
`)

function systematicName(userId) {
  const row = userId != null
    ? db.prepare('SELECT COUNT(*) AS n FROM qr_codes WHERE user_id=?').get(userId)
    : db.prepare('SELECT COUNT(*) AS n FROM qr_codes').get()
  const d = new Date()
  return `QR-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${row.n+1}`
}

export function listQrs(userId) {
  return userId != null
    ? db.prepare('SELECT id,name,url,thumb,created_at FROM qr_codes WHERE user_id=? ORDER BY id DESC').all(userId)
    : db.prepare('SELECT id,name,url,thumb,created_at FROM qr_codes ORDER BY id DESC').all()
}

export function getQr(id, userId) {
  const row = userId != null
    ? db.prepare('SELECT * FROM qr_codes WHERE id=? AND user_id=?').get(id, userId)
    : db.prepare('SELECT * FROM qr_codes WHERE id=?').get(id)
  if (!row) return null
  return { ...row, config: JSON.parse(row.config) }
}

export function saveQr({ userId, name, url, config, thumb }) {
  const safeName  = String(name ?? '').trim().slice(0, 120) || systematicName(userId)
  const safeThumb = String(thumb ?? '').slice(0, 200_000)
  const r = db.prepare('INSERT INTO qr_codes (user_id,name,url,config,thumb) VALUES (?,?,?,?,?)')
    .run(userId ?? null, safeName, url, JSON.stringify(config), safeThumb)
  const row = db.prepare('SELECT id,name,url,thumb,config,created_at FROM qr_codes WHERE id=?').get(r.lastInsertRowid)
  return { ...row, config: JSON.parse(row.config) }
}

export function deleteQr(id, userId) {
  const info = userId != null
    ? db.prepare('DELETE FROM qr_codes WHERE id=? AND user_id=?').run(id, userId)
    : db.prepare('DELETE FROM qr_codes WHERE id=?').run(id)
  return info.changes > 0
}

export function listLogos(userId) {
  return userId != null
    ? db.prepare('SELECT id,name,data,created_at FROM qr_logos WHERE user_id=? ORDER BY id DESC').all(userId)
    : db.prepare('SELECT id,name,data,created_at FROM qr_logos ORDER BY id DESC').all()
}

export function saveLogo({ userId, name, data }) {
  const safeName = String(name ?? 'Logo').trim().slice(0, 80) || 'Logo'
  const r = db.prepare('INSERT INTO qr_logos (user_id,name,data) VALUES (?,?,?)').run(userId ?? null, safeName, data)
  return db.prepare('SELECT id,name,data,created_at FROM qr_logos WHERE id=?').get(r.lastInsertRowid)
}

export function renameLogo(id, userId, name) {
  const safeName = String(name ?? '').trim().slice(0, 80) || 'Logo'
  const info = userId != null
    ? db.prepare('UPDATE qr_logos SET name=? WHERE id=? AND user_id=?').run(safeName, id, userId)
    : db.prepare('UPDATE qr_logos SET name=? WHERE id=?').run(safeName, id)
  return info.changes > 0
}

export function deleteLogo(id, userId) {
  const info = userId != null
    ? db.prepare('DELETE FROM qr_logos WHERE id=? AND user_id=?').run(id, userId)
    : db.prepare('DELETE FROM qr_logos WHERE id=?').run(id)
  return info.changes > 0
}
