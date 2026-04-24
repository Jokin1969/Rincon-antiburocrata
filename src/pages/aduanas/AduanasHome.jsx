import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './AduanasHome.module.css'

const DOCS = [
  {
    id: 'factura-proforma',
    name: 'Factura Proforma',
    description: 'Genera facturas proforma para envíos internacionales de material biológico. Incluye tabla de productos, códigos HS, bloque de investigación y firma digital.',
    icon: '🧾',
    href: '/aduanas/factura-proforma',
    status: 'ready',
  },
]

export default function AduanasHome() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Aduanas"
        subtitle="Documentación para envíos y recepciones internacionales de material biológico."
      />

      <div className={styles.context}>
        <span className="badge">Documentación aduanera</span>
        <p>
          Genera automáticamente los documentos necesarios para el transporte internacional
          de muestras biológicas desde o hacia CIC bioGUNE: facturas proforma, declaraciones
          de contenido y otros documentos de exportación.
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
