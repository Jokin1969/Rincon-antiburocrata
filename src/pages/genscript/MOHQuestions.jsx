import PageHeader from '../../components/PageHeader'
import styles from './MOHQuestions.module.css'

export default function MOHQuestions() {
  return (
    <div>
      <PageHeader
        back="/genscript"
        backLabel="GenScript"
        title="MOH Questions"
        subtitle="Cuestionario del Ministry of Health de Singapur para síntesis con material de doble uso."
      />

      <div className={styles.placeholder}>
        <span className={styles.icon}>🏛</span>
        <h2>Próximamente</h2>
        <p>
          Este módulo se activará en cuanto se defina el conjunto de campos variables
          del cuestionario MOH. Los campos y la plantilla se cargarán desde{' '}
          <code>public/templates/MOH questions.docx</code>.
        </p>
        <span className="badge badge--wip" style={{ marginTop: '1rem' }}>En desarrollo</span>
      </div>
    </div>
  )
}
