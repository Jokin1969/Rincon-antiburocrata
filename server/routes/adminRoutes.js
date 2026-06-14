import { Router } from 'express'
import {
  getAllUsers, getUserById, createUser, updateUser, deleteUser,
  safeUser, ALL_APPS,
} from '../auth/users.js'
import { getSession } from '../auth/session.js'

const router = Router()

function requireAdmin(req, res, next) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'No autenticado' })
  const user = getUserById(session.uid)
  if (!user || !user.is_admin) return res.status(403).json({ error: 'No autorizado' })
  req.adminUser = user
  next()
}

router.use(requireAdmin)

// GET /api/admin/users
router.get('/users', (_req, res) => {
  res.json(getAllUsers().map(safeUser))
})

// POST /api/admin/users
router.post('/users', (req, res) => {
  const { email, display_name, is_admin, allowed_apps } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requerido' })
  if (getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
  }
  const user = createUser({ email, display_name, is_admin, allowed_apps })
  res.json(safeUser(user))
})

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const { display_name, is_admin, is_active, allowed_apps } = req.body || {}
  const updated = updateUser(req.params.id, { display_name, is_admin, is_active, allowed_apps })
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json(safeUser(updated))
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.adminUser.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
  }
  const ok = deleteUser(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json({ ok: true })
})

// GET /api/admin/apps
router.get('/apps', (_req, res) => {
  res.json(ALL_APPS)
})

export default router
