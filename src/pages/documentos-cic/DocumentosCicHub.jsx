import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './DocumentosCicHub.module.css'

const DOCS = [
  {
    id: 'contrato-menor',
    name: 'Contrato Menor',
    description: 'Genera el expediente completo de contrato menor: justificación de necesidad, comparativa de proveedores y documento firmado.',
    icon: '📄',
    href: '/contrato-menor',
    status: 'ready',
  },
]

export default function DocumentosCicHub() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Documentos CIC bioGUNE"
        subtitle="Expedientes y documentos administrativos internos del CIC bioGUNE."
      />

      <div className={styles.context}>
        <span className="badge">Gestión documental</span>
        <p>
          Genera y gestiona los documentos administrativos necesarios para el funcionamiento
          del CIC bioGUNE. Cada herramienta guía el proceso paso a paso, asegurando el
          cumplimiento de los requisitos formales y ahorrando tiempo en la burocracia.
        </p>
      </div>

      <h2 className={styles.sectionLabel}>Documentos disponibles</h2>
      <div className={styles.grid}>
        {DOCS.map(doc => (
          <ModuleCard key={doc.id} {...doc} />
        ))}
      </div>
    </div>
  )
}
