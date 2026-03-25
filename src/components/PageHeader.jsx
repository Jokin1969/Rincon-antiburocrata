import { Link } from 'react-router-dom'
import styles from './PageHeader.module.css'

export default function PageHeader({ back, backLabel = 'Volver', title, subtitle }) {
  return (
    <div className={styles.wrapper}>
      {back && (
        <Link to={back} className={styles.back}>
          ← {backLabel}
        </Link>
      )}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  )
}
