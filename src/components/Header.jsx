import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { href: '/',                  label: 'Inicio',           icon: '🏠', end: true },
  { href: '/qr',                label: 'QRs',              icon: '🔳', appId: 'qr' },
  { href: '/genscript',         label: 'GenScript',        icon: '🧬', appId: 'genscript' },
  { href: '/adaptar-carta',     label: 'Adaptar carta',    icon: '📝', appId: 'adaptar-carta' },
  { href: '/logos',             label: 'Logos',             icon: '🖼', appId: 'logos' },
  { href: '/documentos-cic',    label: 'Documentos CIC',   icon: '🏛️', appId: 'documentos-cic' },
  { href: '/aduanas',           label: 'Aduanas',           icon: '📦', appId: 'aduanas' },
  { href: '/animalario',        label: 'Animalario',        icon: '🐭', appId: 'animalario' },
  { href: '/gastos-viaje',      label: 'Gastos de viaje',  icon: '✈️', appId: 'gastos-viaje' },
  { href: '/autorizaciones',    label: 'Autorizaciones',   icon: '📋', appId: 'autorizaciones' },
  { href: '/cartas-referencia', label: 'Cartas de ref.',   icon: '📜', appId: 'cartas-referencia' },
]

export default function Header() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const visibleNav = NAV_ITEMS.filter(item =>
    !item.appId || user?.is_admin || user?.visibleApps?.includes(item.appId)
  )

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
          {visibleNav.map(({ href, label, icon, end }) => (
            <NavLink
              key={href}
              to={href}
              end={end}
              className={({ isActive }) =>
                [styles.navLink, isActive && styles.navLinkActive]
                  .filter(Boolean).join(' ')
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}
