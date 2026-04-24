import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { MOH_QUESTIONS } from '../../data/mohQuestionsData.js'
import { useMOHStore } from '../../hooks/useGenScriptStore'
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
  const [showRepo, setShowRepo] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)

  const { records, saveRecord, deleteRecord } = useMOHStore()

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  function loadRecord(record) {
    setForm({ ...buildDefaults(), ...record.form, date: form.date })
    setShowRepo(false)
    setError(null)
  }

  function handleSave() {
    if (!form.projectCode.trim()) return
    const { date, ...toSave } = form
    saveRecord(form.projectCode, toSave)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
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

  const filteredRecords = records.filter(r =>
    !repoSearch || r.id.toLowerCase().includes(repoSearch.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        back="/genscript"
        backLabel="GenScript"
        title="MOH Questions"
        subtitle="Cuestionario del Ministry of Health de Singapur. Las respuestas están pre-rellenas con el texto estándar del grupo — edita solo lo que cambie en cada pedido."
      />

      {/* ── Repositorio de cuestionarios ─────────────────────────────────── */}
      <div className={styles.repoPanel}>
        <button
          type="button"
          className={styles.repoPanelToggle}
          onClick={() => setShowRepo(v => !v)}
        >
          {showRepo ? '▲' : '▼'} Repositorio de cuestionarios
          {records.length > 0 && <span className={styles.repoBadge}>{records.length}</span>}
        </button>
        {showRepo && (
          <div className={styles.repoPanelBody}>
            {records.length === 0 ? (
              <p className={styles.repoEmpty}>Sin cuestionarios guardados aún. Usa «Guardar cuestionario» tras rellenar el formulario.</p>
            ) : (
              <>
                <input
                  type="text"
                  className={styles.repoSearch}
                  placeholder="Buscar por código de proyecto…"
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                />
                {filteredRecords.length === 0 ? (
                  <p className={styles.repoEmpty}>Sin resultados para «{repoSearch}».</p>
                ) : (
                  <ul className={styles.repoList}>
                    {filteredRecords.map(r => (
                      <li key={r.id} className={styles.repoItem}>
                        <div className={styles.repoItemMeta}>
                          <span className={styles.repoItemCode}>{r.id}</span>
                          <span className={styles.repoItemDate}>
                            Guardado el {new Date(r.savedAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className={styles.repoItemActions}>
                          <button
                            type="button"
                            className={styles.repoLoadBtn}
                            onClick={() => loadRecord(r)}
                          >
                            Cargar
                          </button>
                          <button
                            type="button"
                            className={styles.repoDeleteBtn}
                            onClick={() => { if (window.confirm(`¿Eliminar «${r.id}»?`)) deleteRecord(r.id) }}
                            title="Eliminar cuestionario"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!form.projectCode.trim()}
            onClick={handleSave}
          >
            Guardar cuestionario
          </button>
          {savedMsg && <span className={styles.savedMsg}>✓ Guardado</span>}
        </div>

      </form>
    </div>
  )
}
