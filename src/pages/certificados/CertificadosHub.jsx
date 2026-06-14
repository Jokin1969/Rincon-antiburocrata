import ModuleCard from '../../components/ModuleCard'
import PageHeader from '../../components/PageHeader'
import styles from './CertificadosHub.module.css'

const DOCS = [
  {
    id: 'autorizacion-imagen',
    name: 'Autorización de imagen',
    description: 'Autorización de captación y uso de imagen conforme al RGPD. Genera el formulario imprimible con QR y recoge firmas digitales desde cualquier dispositivo.',
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
        <span className="badge">Gestión de autorizaciones</span>
        <p>
          Crea y gestiona autorizaciones de todo tipo: imagen, asistencia a eventos, consentimientos
          informados, acuerdos de confidencialidad… Genera formularios imprimibles con QR y recoge
          firmas digitales desde cualquier dispositivo. Todas las autorizaciones quedan registradas
          y disponibles para consulta y descarga en cualquier momento.
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
