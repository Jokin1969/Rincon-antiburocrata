import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.wrapper}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Página no encontrada</h1>
      <p className={styles.sub}>Esta burocracia no existe. Por suerte.</p>
      <Link to="/" className="btn btn-ghost" style={{ marginTop: '2rem' }}>
        ← Volver al inicio
      </Link>
    </div>
  )
}
