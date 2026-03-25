import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './GenScriptHome.module.css'

const DOCS = [
  {
    id: 'end-user-statement',
    name: 'End User Statement',
    description: 'Declaración legal de uso final requerida por GenScript para pedidos de síntesis con material regulado.',
    icon: '📋',
    href: '/genscript/end-user-statement',
    status: 'ready',
  },
  {
    id: 'moh-questions',
    name: 'MOH Questions',
    description: 'Cuestionario del Ministerio de Salud de Singapur requerido para ciertos tipos de síntesis.',
    icon: '🏛',
    href: '/genscript/moh-questions',
    status: 'wip',
  },
]

export default function GenScriptHome() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="GenScript"
        subtitle="Genera automáticamente los documentos de cumplimiento requeridos en cada pedido de síntesis de plásmidos."
      />

      <div className={styles.context}>
        <span className="badge">Proveedor externo</span>
        <p>
          GenScript (Singapur) exige adjuntar documentación de control de exportaciones en pedidos que
          incluyan secuencias con características reguladas. Esta herramienta rellena las plantillas oficiales
          con los datos de tu proyecto.
        </p>
      </div>

      <h2 className={styles.sectionLabel}>Documentos</h2>
      <div className={styles.grid}>
        {DOCS.map(doc => (
          <ModuleCard key={doc.id} {...doc} />
        ))}
      </div>
    </div>
  )
}
