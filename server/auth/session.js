import { createHmac } from 'crypto'

const SESSION_SECRET = process.env.SESSION_SECRET || 'rincon-antiburocrata-secret-key-2024'
const COOKIE_NAME    = 'rab_session'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60  // 7 days in seconds

function sign(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig  = createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function verify(token) {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const b64 = token.slice(0, dot)
  const sig  = token.slice(dot + 1)
  const expected = createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url')
  if (sig !== expected) return null
  try { return JSON.parse(Buffer.from(b64, 'base64url').toString()) } catch { return null }
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const result = {}
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = part.slice(0, eqIdx).trim()
    const val = part.slice(eqIdx + 1).trim()
    try { result[key] = decodeURIComponent(val) } catch { result[key] = val }
  }
  return result
}

export function createSession(res, userId) {
  const token  = sign({ uid: userId, iat: Date.now() })
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/${secure}`)
}

export function getSession(req) {
  const cookies = parseCookies(req)
  return verify(cookies[COOKIE_NAME])
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Max-Age=0; Path=/`)
}
