import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './ContratoMenorHome.module.css'

const DOCS = [
  {
    id: 'certificado-exclusividad',
    name: 'Certificado de exclusividad',
    description: 'Acredita que GenScript es el único proveedor capaz de suministrar la síntesis génica requerida (Art. 168.a).2 LCSP).',
    icon: '📄',
    href: '/contrato-menor/certificado-exclusividad',
    status: 'ready',
  },
]

export default function ContratoMenorHome() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Contrato menor"
        subtitle="Documentación para la tramitación de contratos menores con proveedores especializados."
      />

      <div className={styles.context}>
        <span className="badge">Contratación pública</span>
        <p>
          El contrato menor es el procedimiento simplificado de contratación para adquisiciones
          de suministros y servicios de cuantía reducida. Cuando el proveedor es único, la Ley de
          Contratos del Sector Público (LCSP) exige acreditar la exclusividad mediante certificado.
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
