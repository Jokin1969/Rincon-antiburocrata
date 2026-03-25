import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { MOH_QUESTIONS } from '../../data/mohQuestionsData.js'
import styles from './MOHQuestions.module.css'

const TODAY = new Date().toISOString().split('T')[0]

function buildDefaults() {
  const d = { projectCode: '', date: TODAY }
  MOH_QUESTIONS.forEach(q => { d[q.key] = q.defaultAnswer })
  return d
}

export default function MOHQuestions() {
  const [form, setForm] = useState(buildDefaults)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)

    try {
      const res = await fetch(`/api/genscript/moh-questions?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MOH_questions_${form.projectCode}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const isValid = form.projectCode.trim() && MOH_QUESTIONS.every(q => form[q.key]?.trim())
  const busy = loadingFmt !== null

  return (
    <div>
      <PageHeader
        back="/genscript"
        backLabel="GenScript"
        title="MOH Questions"
        subtitle="Cuestionario del Ministry of Health de Singapur. Las respuestas están pre-rellenas con el texto estándar del grupo — edita solo lo que cambie en cada pedido."
      />

      <form onSubmit={e => e.preventDefault()} className={styles.form}>

        <div className="form-group" style={{ maxWidth: '260px' }}>
          <label htmlFor="projectCode">Código de proyecto</label>
          <input
            id="projectCode"
            name="projectCode"
            type="text"
            value={form.projectCode}
            onChange={handleChange}
            placeholder="Ej. PRJ-2026-042"
            autoComplete="off"
            required
          />
          <span className={styles.hint}>Da nombre al archivo: MOH_questions_CODIGO.docx/pdf</span>
        </div>

        <div className={styles.qaList}>
          {MOH_QUESTIONS.map((q, i) => (
            <div key={q.key} className={styles.qaItem}>
              <div className={styles.questionHeader}>
                <span className={styles.qLabel}>{q.label}</span>
                <p className={styles.questionText}>{q.question}</p>
              </div>
              <div className="form-group">
                <label htmlFor={q.key} className={styles.answerLabel}>
                  Respuesta
                </label>
                <textarea
                  id={q.key}
                  name={q.key}
                  value={form[q.key]}
                  onChange={handleChange}
                  rows={i === 0 || i === 1 || i === 3 ? 6 : 3}
                  required
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isValid || busy}
            onClick={() => handleDownload('docx')}
          >
            {loadingFmt === 'docx' ? 'Generando…' : '⬇ .docx'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!isValid || busy}
            onClick={() => handleDownload('pdf')}
          >
            {loadingFmt === 'pdf' ? 'Generando…' : '⬇ PDF'}
          </button>
        </div>

      </form>
    </div>
  )
}
