import ModuleCard from '../components/ModuleCard'
import styles from './Home.module.css'

const MODULES = [
  {
    id: 'genscript',
    name: 'GenScript',
    description: 'Documentación de cumplimiento para síntesis de plásmidos con características reguladas.',
    icon: '🧬',
    href: '/genscript',
    status: 'ready',
  },
  {
    id: 'aduanas',
    name: 'Aduanas',
    description: 'Documentación para envíos y recepciones internacionales de material biológico.',
    icon: '📦',
    href: '/aduanas',
    status: 'wip',
  },
  {
    id: 'logos',
    name: 'Logos',
    description: 'Galería de logotipos de instituciones y proyectos con acceso a sus modelos en PDF.',
    icon: '🖼️',
    href: '/logos',
    status: 'ready',
  },
]

export default function Home() {
  return (
    <div>
      <div className={styles.intro}>
        <p className={styles.tagline}>
          Trámites burocráticos en menos de dos minutos.{' '}
          <span className="accent">Sin conocimiento previo. Sin errores.</span>
        </p>
      </div>

      <section>
        <h2 className={styles.sectionLabel}>Módulos disponibles</h2>
        <div className={styles.grid}>
          {MODULES.map(mod => (
            <ModuleCard key={mod.id} {...mod} />
          ))}
        </div>
      </section>
    </div>
  )
}
