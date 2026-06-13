import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './CertificadosHub.module.css'

const DOCS = [
  {
    id: 'autorizacion-imagen',
    name: 'Autorización de imagen',
    description: 'Genera formularios de autorización de captación y uso de imagen para eventos. Incluye QR para firma digital móvil y panel de gestión de firmas recibidas.',
    icon: '📸',
    href: '/certificados/autorizacion-imagen',
    status: 'ready',
  },
]

export default function CertificadosHub() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Certificados"
        subtitle="Gestión de autorizaciones de imagen y filmación para eventos."
      />

      <div className={styles.context}>
        <span className="badge">Firmas digitales</span>
        <p>
          Genera formularios imprimibles con QR para recoger autorizaciones de imagen de los
          participantes en tus eventos. Los firmantes pueden firmar digitalmente desde su móvil
          escaneando el QR o directamente en tablet/ordenador.
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
