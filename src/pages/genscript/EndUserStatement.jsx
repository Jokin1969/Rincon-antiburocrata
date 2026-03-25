import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './EndUserStatement.module.css'

const TODAY = new Date().toISOString().split('T')[0]

export default function EndUserStatement() {
  const [form, setForm] = useState({
    projectCode: '',
    endUse: '',
    date: TODAY,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/genscript/end-user-statement', {
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
      a.download = `End_User_Statement_${form.projectCode}_${form.date}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isValid = form.projectCode.trim() && form.endUse.trim() && form.date

  return (
    <div>
      <PageHeader
        back="/genscript"
        backLabel="GenScript"
        title="End User Statement"
        subtitle="Rellena los campos variables. El documento se descarga como .docx listo para firmar y adjuntar al pedido."
      />

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fields}>
          <div className="form-group">
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
          </div>

          <div className="form-group">
            <label htmlFor="endUse">End-use / Uso final</label>
            <textarea
              id="endUse"
              name="endUse"
              value={form.endUse}
              onChange={handleChange}
              placeholder="Describe el uso final del material sintetizado (en inglés, tal como aparecerá en el documento)."
              required
            />
          </div>

          <div className="form-group" style={{ maxWidth: '240px' }}>
            <label htmlFor="date">Fecha del documento</label>
            <input
              id="date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isValid || loading}
          >
            {loading ? 'Generando…' : '⬇ Descargar documento'}
          </button>
        </div>
      </form>

      <div className={styles.note}>
        <strong>Nota técnica:</strong> Los campos se insertan en la plantilla oficial{' '}
        <code>End User Statement - 2.docx</code> almacenada en <code>public/templates/</code>.
        El texto legal del documento no se modifica.
      </div>
    </div>
  )
}
