import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pbkdf2Sync, randomBytes } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const DATA_DIR   = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const AUTH_DIR   = join(DATA_DIR, 'auth')
const USERS_FILE = join(AUTH_DIR, 'users.json')

export const ALL_APPS = [
  'qr', 'genscript', 'adaptar-carta', 'logos', 'documentos-cic',
  'aduanas', 'gastos-viaje', 'animalario', 'autorizaciones', 'cartas-referencia',
]

const DEFAULT_USER_APPS = ALL_APPS.filter(a => a !== 'cartas-referencia')

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readUsers() {
  if (!existsSync(USERS_FILE)) return []
  return JSON.parse(readFileSync(USERS_FILE, 'utf-8'))
}

function writeUsers(users) {
  ensureDir(AUTH_DIR)
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

function hashPassword(password, salt) {
  if (!salt) salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return { salt, hash, stored: `${salt}:${hash}` }
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const { hash: computed } = hashPassword(password, salt)
  return computed === hash
}

export function initUsers() {
  const existing = readUsers()
  if (existing.length > 0) return

  const SEED = [
    { email: 'castilla@joaquincastilla.com', display_name: 'Joaquín Castilla', is_admin: true },
    { email: 'cdiaz@cicbiogune.es',          display_name: 'Carlos Díaz',       is_admin: false },
    { email: 'csampedro@cicbiogune.es',      display_name: 'Cristina Sampedro', is_admin: false },
    { email: 'efernandez@cicbiogune.es',     display_name: 'Eva Férnandez',     is_admin: false },
    { email: 'herana@cicbiogune.es',         display_name: 'Hasier Eraña',      is_admin: false },
    { email: 'jgalarza@cicbiogune.es',       display_name: 'Josu Galarza',      is_admin: false },
    { email: 'jmoreno@cicbiogune.es',        display_name: 'Jorge Moreno',      is_admin: false },
    { email: 'msanjuan@cicbiogune.es',       display_name: 'Maitena San Juan',  is_admin: false },
    { email: 'nanjo@cicbiogune.es',          display_name: 'Nuño Anjo',         is_admin: false },
    { email: 'nisusi@cicbiogune.es',         display_name: 'Nerea Isusi',       is_admin: false },
    { email: 'ppineiro@cicbiogune.es',       display_name: 'Patricia Piñeiro',  is_admin: false },
  ]

  const now   = new Date().toISOString()
  const users = SEED.map((u, i) => ({
    id:             String(i + 1),
    email:          u.email,
    display_name:   u.display_name,
    password_hash:  hashPassword('12345678').stored,
    is_admin:       u.is_admin,
    must_change_pw: true,
    is_active:      true,
    reset_token:    null,
    reset_token_exp: null,
    created_at:     now,
    last_login_at:  null,
    allowed_apps:   u.is_admin ? ALL_APPS : DEFAULT_USER_APPS,
  }))

  writeUsers(users)
}

export function getAllUsers()       { return readUsers() }
export function getUserById(id)    { return readUsers().find(u => u.id === id) || null }
export function getUserByEmail(e)  { return readUsers().find(u => u.email.toLowerCase() === e.toLowerCase()) || null }
export function getUserByResetToken(t) { return readUsers().find(u => u.reset_token === t) || null }

export function updateUser(id, updates) {
  const users = readUsers()
  const idx   = users.findIndex(u => u.id === id)
  if (idx === -1) return null
  users[idx] = { ...users[idx], ...updates }
  writeUsers(users)
  return users[idx]
}

export function createUser(data) {
  const users = readUsers()
  const id    = String(Date.now())
  const now   = new Date().toISOString()
  const user  = {
    id,
    email:          data.email,
    display_name:   data.display_name || '',
    password_hash:  hashPassword(data.password || '12345678').stored,
    is_admin:       data.is_admin || false,
    must_change_pw: true,
    is_active:      true,
    reset_token:    null,
    reset_token_exp: null,
    created_at:     now,
    last_login_at:  null,
    allowed_apps:   data.is_admin ? ALL_APPS : (data.allowed_apps || DEFAULT_USER_APPS),
  }
  users.push(user)
  writeUsers(users)
  return user
}

export function deleteUser(id) {
  const users    = readUsers()
  const filtered = users.filter(u => u.id !== id)
  if (filtered.length === users.length) return false
  writeUsers(filtered)
  return true
}

export function checkPassword(user, password) {
  return verifyPassword(password, user.password_hash)
}

export function setPassword(id, newPassword) {
  return updateUser(id, { password_hash: hashPassword(newPassword).stored, must_change_pw: false })
}

export function resetPasswordToDefault(id) {
  return updateUser(id, { password_hash: hashPassword('12345678').stored, must_change_pw: true })
}

export function generateResetToken(id) {
  const token = randomBytes(32).toString('hex')
  const exp   = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  updateUser(id, { reset_token: token, reset_token_exp: exp })
  return token
}

export function clearResetToken(id) {
  updateUser(id, { reset_token: null, reset_token_exp: null })
}

export function safeUser(user) {
  const { password_hash, reset_token, reset_token_exp, ...safe } = user
  return safe
}
