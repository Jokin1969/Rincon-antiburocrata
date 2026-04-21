import { Link, NavLink } from 'react-router-dom'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { href: '/',              label: 'Inicio',        icon: '🏠', end: true  },
  { href: '/genscript',     label: 'GenScript',     icon: '🧬', end: false },
  { href: '/adaptar-carta', label: 'Adaptar carta', icon: '📝', end: false },
  { href: '/aduanas',       label: 'Aduanas',       icon: '📦', end: false, wip: true },
]

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
