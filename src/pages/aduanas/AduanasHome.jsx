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
  {
    id: 'pqp-import',
    name: 'PQP import',
    description: 'Certificado de no sujeción a control para la importación de productos químicos (R/UE 649/2012). Dirigido a la Aduana de Irun, con firma y sello.',
    icon: '🧪',
    href: '/aduanas/pqp-import',
    status: 'ready',
  },
  {
    id: 'documento-1403',
    name: 'Documento 1403',
    description: 'Declaración del importador de productos NO sometidos a control farmacéutico (Orden SPI/2136/2011). Datos del producto, envío, TARIC, BoL y firma.',
    icon: '💊',
    href: '/aduanas/documento-1403',
    status: 'ready',
  },
  {
    id: 'declaracion-exenta',
    name: 'Declaración de mercancías exentas',
    description: 'Declaración ante la aduana de que las mercancías importadas no están sujetas a control oficial en frontera por el MAPA (DGSPABA/SGASCF). Remisión 02 362.',
    icon: '🛃',
    href: '/aduanas/declaracion-exenta',
    status: 'ready',
  },
  {
    id: 'cert-no-peligrosidad',
    name: 'Certificado de No Peligrosidad',
    description: 'Certifica que el material biológico enviado no es tóxico, explosivo, oxidante, infeccioso, radioactivo, corrosivo ni magnético. Disponible en español, inglés o bilingüe.',
    icon: '✅',
    href: '/aduanas/cert-no-peligrosidad',
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
