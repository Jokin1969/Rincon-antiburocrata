import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import styles from './AuthPage.module.css'

export default function ResetPasswordPage() {
  const [searchParams]        = useSearchParams()
  const token                 = searchParams.get('token') || ''
  const navigate              = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Las contraseñas no coinciden')
    if (password.length < 8)  return setError('Mínimo 8 caracteres')
    if (password === '12345678') return setError('No puedes usar la contraseña inicial')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al restablecer la contraseña')
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error}>Enlace inválido.</p>
          <Link to="/login" className={styles.link}>Volver al inicio de sesión</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>El Rincón del</span>
          <span className={styles.title}>Adhócrata</span>
        </div>
        <p className={styles.subtitle}>Crear nueva contraseña</p>

        {done ? (
          <div className={styles.successBox}>
            <p>Tu contraseña ha sido actualizada correctamente.</p>
            <button className={styles.btn} onClick={() => navigate('/login')}>
              Ir al inicio de sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Nueva contraseña</label>
              <input type="password" className={styles.input} value={password}
                onChange={e => setPassword(e.target.value)} required autoFocus placeholder="Mínimo 8 caracteres" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Confirmar contraseña</label>
              <input type="password" className={styles.input} value={confirm}
                onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
