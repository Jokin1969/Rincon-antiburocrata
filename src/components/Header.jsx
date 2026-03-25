import { Link } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <span className={styles.eyebrow}>El Rincón del</span>
          <span className={styles.title}>
            Anti<span className={styles.dash}>-</span>Burócrata
          </span>
        </Link>
        <p className={styles.sub}>
          Grupo de Enfermedades Priónicas · CIC bioGUNE
        </p>
      </div>
    </header>
  )
}
