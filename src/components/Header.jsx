import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { href: '/',               label: 'Inicio',           icon: '🏠', end: true  },
  { href: '/genscript',      label: 'GenScript',        icon: '🧬', end: false },
  { href: '/adaptar-carta',  label: 'Adaptar carta',    icon: '📝', end: false },
  { href: '/logos',          label: 'Logos',             icon: '🖼', end: false },
  { href: '/documentos-cic', label: 'Documentos CIC',   icon: '🏛️', end: false },
  { href: '/aduanas',        label: 'Aduanas',           icon: '📦', end: false },
  { href: '/animalario',     label: 'Animalario',        icon: '🐭', end: false },
  { href: '/gastos-viaje',   label: 'Gastos de viaje',  icon: '✈️', end: false },
  { href: '/autorizaciones', label: 'Autorizaciones',   icon: '📋', end: false },
]

export default function Header() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link to="/" className={styles.brand}>
            <span className={styles.eyebrow}>El Rincón del</span>
            <span className={styles.title}>Adhócrata</span>
          </Link>

          {user && (
            <div className={styles.userBar}>
              <span className={styles.userName}>{user.display_name || user.email}</span>
              {user.is_admin && (
                <Link to="/admin" className={styles.adminLink}>Admin</Link>
              )}
              <button className={styles.logoutBtn} onClick={handleLogout}>Salir</button>
            </div>
          )}
        </div>

        <p className={styles.tagline}>Código vibrante, burocracia menguante</p>
        <p className={styles.sub}>
          Grupo de Enfermedades Priónicas · CIC bioGUNE
        </p>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          {NAV_ITEMS.map(({ href, label, icon, end, wip }) => (
            <NavLink
              key={href}
              to={href}
              end={end}
              className={({ isActive }) =>
                [styles.navLink, isActive && styles.navLinkActive, wip && styles.navLinkWip]
                  .filter(Boolean).join(' ')
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
              {wip && <span className={styles.wipDot} />}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}
