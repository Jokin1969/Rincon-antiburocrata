import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './AuthPage.module.css'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>El Rincón del</span>
          <span className={styles.title}>Adhócrata</span>
        </div>
        <p className={styles.subtitle}>Recuperar contraseña</p>

        {sent ? (
          <div className={styles.successBox}>
            <p>Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña en los próximos minutos.</p>
            <Link to="/login" className={styles.link}>Volver al inicio de sesión</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="tu@email.com"
              />
            </div>
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
            <div className={styles.links}>
              <Link to="/login" className={styles.link}>Volver al inicio de sesión</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
