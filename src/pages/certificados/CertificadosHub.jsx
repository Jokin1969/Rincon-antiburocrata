import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './CertificadosHub.module.css'

const DOCS = [
  {
    id: 'autorizacion-imagen',
    name: 'Autorización de imagen',
    description: 'Autorización RGPD para captación y uso de fotografías y vídeos en eventos. Formulario imprimible con QR y firma digital desde móvil.',
    icon: '📸',
    href: '/autorizaciones/autorizacion-imagen',
    status: 'ready',
  },
]

export default function CertificadosHub() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Autorizaciones"
        subtitle="Gestión de autorizaciones para eventos, reuniones y actividades."
      />

      <div className={styles.context}>
        <span className="badge">Firmas digitales</span>
        <p>
          Crea y gestiona autorizaciones de todo tipo: imagen, asistencia, consentimientos
          informados… Genera formularios imprimibles con QR y recoge firmas digitales desde
          cualquier dispositivo. Todas las firmas quedan registradas y disponibles para descarga.
        </p>
      </div>

      <h2 className={styles.sectionLabel}>Tipos de autorización</h2>
      <div className={styles.grid}>
        {DOCS.map(doc => (
          <ModuleCard key={doc.id} {...doc} />
        ))}
      </div>
    </div>
  )
}
