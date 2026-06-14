import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from './AdminPanel.module.css'

const APP_LABELS = {
  'genscript':      'GenScript',
  'adaptar-carta':  'Adaptar carta',
  'logos':          'Gestor de logos',
  'documentos-cic': 'Documentos CIC',
  'aduanas':        'Aduanas',
  'gastos-viaje':   'Gastos de viaje',
  'animalario':     'Animalario',
  'autorizaciones': 'Autorizaciones',
  'cartas-referencia': 'Cartas de referencia',
}

export default function AdminPanel() {
  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [users, setUsers]     = useState([])
  const [allApps, setAllApps] = useState([])
  const [editing, setEditing] = useState(null)   // user object being edited
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', display_name: '', is_admin: false })
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (user && !user.is_admin) navigate('/')
    fetchUsers()
    fetchApps()
  }, [user])

  async function fetchUsers() {
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
  }

  async function fetchApps() {
    const res = await fetch('/api/admin/apps')
    if (res.ok) setAllApps(await res.json())
  }

  function toggleApp(u, appId) {
    const apps = u.allowed_apps.includes(appId)
      ? u.allowed_apps.filter(a => a !== appId)
      : [...u.allowed_apps, appId]
    setEditing({ ...u, allowed_apps: apps })
  }

  async function saveEdit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${editing.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          display_name: editing.display_name,
          is_admin:     editing.is_admin,
          is_active:    editing.is_active,
          allowed_apps: editing.allowed_apps,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(prev => prev.map(u => u.id === data.id ? data : u))
      setEditing(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(id) {
    if (!confirm('¿Eliminar este usuario?')) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id))
  }

  async function createUser() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newUser),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(prev => [...prev, data])
      setCreating(false)
      setNewUser({ email: '', display_name: '', is_admin: false })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user?.is_admin) return null

  return (
    <div>
      <PageHeader
        title="Panel de administración"
        subtitle="Gestión de usuarios y permisos de acceso"
      />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.toolbar}>
        <button className={styles.btnAdd} onClick={() => { setCreating(true); setError('') }}>
          + Nuevo usuario
        </button>
      </div>

      {creating && (
        <div className={styles.createCard}>
          <h3 className={styles.cardTitle}>Nuevo usuario</h3>
          <div className={styles.formRow}>
            <input className={styles.input} placeholder="Email" type="email"
              value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
            <input className={styles.input} placeholder="Nombre completo"
              value={newUser.display_name} onChange={e => setNewUser(p => ({ ...p, display_name: e.target.value }))} />
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={newUser.is_admin}
                onChange={e => setNewUser(p => ({ ...p, is_admin: e.target.checked }))} />
              Admin
            </label>
          </div>
          <p className={styles.hint}>La contraseña inicial será <code>12345678</code> y se pedirá cambiarla en el primer acceso.</p>
          <div className={styles.actions}>
            <button className={styles.btnSave} onClick={createUser} disabled={saving}>
              {saving ? 'Creando…' : 'Crear usuario'}
            </button>
            <button className={styles.btnCancel} onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.is_active ? styles.inactive : ''}>
                <td className={styles.nameCell}>
                  <span className={styles.name}>{u.display_name || '—'}</span>
                  {u.must_change_pw && <span className={styles.badge}>Debe cambiar PW</span>}
                </td>
                <td className={styles.emailCell}>{u.email}</td>
                <td>
                  <span className={u.is_admin ? styles.roleAdmin : styles.roleUser}>
                    {u.is_admin ? 'Admin' : 'Usuario'}
                  </span>
                </td>
                <td>
                  <span className={u.is_active ? styles.active : styles.disabled}>
                    {u.is_active ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td className={styles.dateCell}>
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('es-ES') : '—'}
                </td>
                <td>
                  <button className={styles.btnEdit}
                    onClick={() => { setEditing({ ...u }); setError('') }}>
                    Editar
                  </button>
                  {u.id !== user.id && (
                    <button className={styles.btnDelete} onClick={() => deleteUser(u.id)}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className={styles.modal} onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Editar usuario</h3>

            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input className={styles.input} value={editing.display_name}
                onChange={e => setEditing(p => ({ ...p, display_name: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} value={editing.email} disabled />
            </div>

            <div className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={editing.is_admin}
                  onChange={e => setEditing(p => ({ ...p, is_admin: e.target.checked }))} />
                Administrador
              </label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={editing.is_active}
                  onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))} />
                Cuenta activa
              </label>
            </div>

            {!editing.is_admin && (
              <div className={styles.appsSection}>
                <label className={styles.label}>Apps visibles</label>
                <div className={styles.appsGrid}>
                  {allApps.map(appId => (
                    <label key={appId} className={styles.appCheck}>
                      <input type="checkbox"
                        checked={editing.allowed_apps?.includes(appId)}
                        onChange={() => toggleApp(editing, appId)} />
                      {APP_LABELS[appId] || appId}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnSave} onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button className={styles.btnCancel} onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
