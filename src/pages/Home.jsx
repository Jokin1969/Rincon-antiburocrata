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
    id: 'contrato-menor',
    name: 'Contrato menor',
    description: 'Documentación para la tramitación de contratos menores con proveedores especializados.',
    icon: '📝',
    href: '/contrato-menor',
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
