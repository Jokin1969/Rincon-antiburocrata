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
    id: 'adaptar-carta',
    name: 'Adaptar carta',
    description: 'Adapta un texto al modelo de carta oficial de CIC bioGUNE, ATLAS molecular pharma o FEEP. Descarga en .docx o .pdf con firma incluida.',
    icon: '📝',
    href: '/adaptar-carta',
    status: 'ready',
  },
  {
    id: 'logos',
    name: 'Gestor de logos',
    description: 'Almacena y organiza los logos de todas las instituciones. Descarga en PNG, WebP, JPG o SVG con tamaño, fondo y color personalizados.',
    icon: '🖼',
    href: '/logos',
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
          ¡Acelera los trámites burocráticos!{' '}
          <span className="accent">Sin errores.</span>
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
