import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './AuthPage.module.css'

export default function ChangePasswordPage() {
  const { user, refreshUser } = useAuth()
  const navigate              = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (next !== confirm) return setError('Las contraseñas no coinciden')
    if (next.length < 8)  return setError('Mínimo 8 caracteres')
    if (next === '12345678') return setError('No puedes usar la contraseña inicial')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cambiar la contraseña')
      await refreshUser()
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>El Rincón del</span>
          <span className={styles.title}>Adhócrata</span>
        </div>
        {user?.must_change_pw
          ? <p className={styles.subtitle}>Debes cambiar tu contraseña antes de continuar</p>
          : <p className={styles.subtitle}>Cambia tu contraseña</p>
        }

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Contraseña actual</label>
            <input type="password" className={styles.input} value={current}
              onChange={e => setCurrent(e.target.value)} required placeholder="••••••••" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Nueva contraseña</label>
            <input type="password" className={styles.input} value={next}
              onChange={e => setNext(e.target.value)} required placeholder="Mínimo 8 caracteres" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Confirmar nueva contraseña</label>
            <input type="password" className={styles.input} value={confirm}
              onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
