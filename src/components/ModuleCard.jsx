import { Link } from 'react-router-dom'
import styles from './ModuleCard.module.css'

export default function ModuleCard({ name, description, href, status = 'ready', icon }) {
  const isWip = status === 'wip'

  return (
    <Link to={href} className={`${styles.card} ${isWip ? styles.wip : ''}`}>
      <div className={styles.top}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <div className={styles.titleRow}>
          <span className={styles.name}>{name}</span>
          {isWip && <span className="badge badge--wip">WIP</span>}
        </div>
      </div>
      <p className={styles.description}>{description}</p>
      <span className={styles.arrow}>→</span>
    </Link>
  )
}
