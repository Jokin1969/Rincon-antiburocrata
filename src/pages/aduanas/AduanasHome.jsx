import PageHeader from '../../components/PageHeader'
import styles from './AduanasHome.module.css'

export default function AduanasHome() {
  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Aduanas"
        subtitle="Documentación para envíos y recepciones internacionales de material biológico."
      />

      <div className={styles.placeholder}>
        <span className={styles.icon}>📦</span>
        <h2>Módulo en construcción</h2>
        <p>
          Este módulo cubrirá la generación automática de documentación aduanera para el transporte
          internacional de muestras biológicas: permisos CITES, declaraciones de contenido,
          cartas de porte y certificados sanitarios de exportación.
        </p>
        <span className="badge badge--wip" style={{ marginTop: '1rem' }}>En desarrollo</span>
      </div>
    </div>
  )
}
