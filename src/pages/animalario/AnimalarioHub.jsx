import { Link } from 'react-router-dom'
import ModuleCard from '../../components/ModuleCard'
import styles from '../../styles/animalario/animalario.module.css'

const CARDS = [
  {
    id: 'proyectos',
    name: 'Proyectos',
    description: 'Crea y gestiona proyectos de experimentación animal. Cumplimenta las secciones A–D, define procedimientos y registra modificaciones.',
    icon: '📋',
    href: '/animalario/proyectos',
  },
  {
    id: 'procedimientos',
    name: 'Procedimientos',
    description: 'Accede directamente a los procedimientos (Sección B) de un proyecto existente. Primero seleccionarás el proyecto.',
    icon: '🔬',
    href: '/animalario/proyectos',
  },
]

export default function AnimalarioHub() {
  return (
    <div>
      <div className={styles.logosBar}>
        <img
          src="/logos/animalario/cicbiogune.png"
          alt="CIC bioGUNE"
          className={styles.logoImg}
        />
        <div className={styles.logosBarCenter}>
          <div className={styles.logosBarTitle}>Animalario</div>
          <div className={styles.logosBarSub}>CIC bioGUNE · Gestión de experimentación animal</div>
        </div>
        <img
          src="/logos/animalario/aaalac.png"
          alt="AAALAC International"
          className={styles.logoImg}
        />
      </div>

      <div className={styles.hubGrid}>
        {CARDS.map(card => (
          <ModuleCard key={card.id} {...card} />
        ))}
      </div>

      <p className={styles.hint}>
        Para gestionar procedimientos, primero selecciona o crea un proyecto.
      </p>
    </div>
  )
}
