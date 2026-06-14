import { Router }    from 'express'
import nodemailer   from 'nodemailer'
import {
  getUserByEmail, getUserById, getUserByResetToken,
  checkPassword, setPassword, generateResetToken, clearResetToken,
  updateUser, safeUser, ALL_APPS,
} from '../auth/users.js'
import { createSession, getSession, clearSession } from '../auth/session.js'

const router = Router()

// ── Rate limiting (in-memory, per IP) ────────────────────────────────────────
const WINDOW_MS   = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts    = new Map()

function getRateEntry(ip) {
  const now   = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) return { count: 0, windowStart: now }
  return entry
}

function isRateLimited(ip) { return getRateEntry(ip).count >= MAX_ATTEMPTS }

function recordAttempt(ip) {
  const entry = getRateEntry(ip)
  entry.count++
  attempts.set(ip, entry)
}

function resetAttempts(ip) { attempts.delete(ip) }

// ── Mailer ───────────────────────────────────────────────────────────────────
function mailer() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'No autenticado' })
  const user = getUserById(session.uid)
  if (!user || !user.is_active) return res.status(401).json({ error: 'No autenticado' })
  const visibleApps = user.is_admin ? ALL_APPS : (user.allowed_apps || [])
  res.json({ ...safeUser(user), visibleApps })
})

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const user = getUserByEmail(email)
  if (!user || !user.is_active || !checkPassword(user, password)) {
    recordAttempt(ip)
    return res.status(401).json({ error: 'Email o contraseña incorrectos' })
  }

  resetAttempts(ip)
  updateUser(user.id, { last_login_at: new Date().toISOString() })
  createSession(res, user.id)

  const visibleApps = user.is_admin ? ALL_APPS : (user.allowed_apps || [])
  res.json({ ...safeUser(user), visibleApps })
})

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'No autenticado' })
  const user = getUserById(session.uid)
  if (!user) return res.status(401).json({ error: 'No autenticado' })

  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan campos' })
  if (newPassword.length < 8)           return res.status(400).json({ error: 'Mínimo 8 caracteres' })
  if (newPassword === '12345678')       return res.status(400).json({ error: 'No puedes usar la contraseña inicial' })
  if (!checkPassword(user, currentPassword)) return res.status(401).json({ error: 'Contraseña actual incorrecta' })

  setPassword(user.id, newPassword)
  res.json({ ok: true })
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  res.json({ ok: true })  // always succeed to avoid enumeration

  const { email } = req.body || {}
  if (!email) return
  const user = getUserByEmail(email)
  if (!user || !user.is_active) return

  const token  = generateResetToken(user.id)
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const link   = `${appUrl}/reset-password?token=${token}`

  try {
    await mailer().sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      user.email,
      subject: 'Recuperación de contraseña – Rincón Antiburocrata',
      html: `
        <p>Hola ${user.display_name},</p>
        <p>Has solicitado restablecer tu contraseña en <strong>Rincón Antiburocrata</strong>.</p>
        <p><a href="${link}">Haz clic aquí para crear una nueva contraseña</a></p>
        <p>Este enlace es válido durante 1 hora. Si no has solicitado este cambio, ignora este email.</p>
        <br><p style="color:#888;font-size:0.85em">Rincón Antiburocrata · Grupo de Enfermedades Priónicas · CIC bioGUNE</p>
      `,
    })
  } catch (err) {
    console.error('Error enviando email de recuperación:', err.message)
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {}
  if (!token || !newPassword)     return res.status(400).json({ error: 'Faltan campos' })
  if (newPassword.length < 8)    return res.status(400).json({ error: 'Mínimo 8 caracteres' })
  if (newPassword === '12345678') return res.status(400).json({ error: 'No puedes usar la contraseña inicial' })

  const user = getUserByResetToken(token)
  if (!user) return res.status(400).json({ error: 'Enlace inválido o ya utilizado' })
  if (new Date(user.reset_token_exp) < new Date()) {
    clearResetToken(user.id)
    return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' })
  }

  setPassword(user.id, newPassword)
  clearResetToken(user.id)
  res.json({ ok: true })
})

export default router
