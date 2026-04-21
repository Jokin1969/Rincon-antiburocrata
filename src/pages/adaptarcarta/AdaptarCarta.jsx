import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './AdaptarCarta.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const TEMPLATES = {
  cicbiogune: { label: 'CIC bioGUNE',                                         icon: '🧬' },
  atlas:      { label: 'ATLAS molecular pharma',                              icon: '💊' },
  feep:       { label: 'Fundación Española de Enfermedades Priónicas (FEEP)', icon: '🏛' },
}

const DEFAULTS = {
  template:    null,
  signerName:  'Joaquín Castilla',
  sigType:     'manuscrita',
  date:        TODAY,
  lineSpacing: 1.5,
  lang:        'en',
  text:        '',
}

export default function AdaptarCarta() {
  const [step, setStep]             = useState(1)
  const [form, setForm]             = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error, setError]           = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)

    try {
      const res = await fetch(`/api/adaptar-carta?format=${format}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `Carta_${form.template}_${form.date}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const canProceed = form.template && form.signerName.trim() && form.date
  const isValid    = canProceed && form.text.trim()
  const busy       = loadingFmt !== null

  // ── STEP 1: template + signer config + options ───────────────────────────

  if (step === 1) {
    return (
      <div>
        <PageHeader
          back="/"
          backLabel="Módulos"
          title="Adaptar carta"
          subtitle="Elige el modelo, configura la firma y pega el texto a adaptar."
        />

        <div className={styles.wizard}>

          {/* Template selection */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.stepBadge}>1</span>
              Selecciona el modelo de carta
            </h2>
            <div className={styles.templateGrid}>
              {Object.entries(TEMPLATES).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.templateBtn} ${form.template === key ? styles.templateBtnActive : ''}`}
                  onClick={() => set('template', key)}
                >
                  <span className={styles.templateIcon}>{icon}</span>
                  <span className={styles.templateLabel}>{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Signer configuration */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.stepBadge}>2</span>
              Configura la firma
            </h2>
            <div className={styles.signerGrid}>
              <div className="form-group">
                <label htmlFor="signerName">Firmante</label>
                <input
                  id="signerName"
                  name="signerName"
                  type="text"
                  value={form.signerName}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Tipo de firma</label>
                <div className={styles.sigTypeSelector}>
                  <button
                    type="button"
                    className={`${styles.sigTypeBtn} ${form.sigType === 'manuscrita' ? styles.sigTypeBtnActive : ''}`}
                    onClick={() => set('sigType', 'manuscrita')}
                  >
                    ✒️ Manuscrita
                  </button>
                  <button
                    type="button"
                    className={`${styles.sigTypeBtn} ${form.sigType === 'digital' ? styles.sigTypeBtnActive : ''}`}
                    onClick={() => set('sigType', 'digital')}
                  >
                    💻 Digital
                  </button>
                </div>
                <span className={styles.sigHint}>
                  {form.sigType === 'manuscrita'
                    ? 'Se insertará la imagen de firma_joaquin.png'
                    : 'Se dejará el espacio en blanco para firmar posteriormente'}
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="date">Fecha del documento</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </section>

          {/* Document options: line spacing + language */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.stepBadge}>3</span>
              Opciones del documento
            </h2>
            <div className={styles.optionsRow}>

              <div className="form-group">
                <label>Interlineado</label>
                <div className={styles.sigTypeSelector}>
                  <button
                    type="button"
                    className={`${styles.sigTypeBtn} ${form.lineSpacing === 1.5 ? styles.sigTypeBtnActive : ''}`}
                    onClick={() => set('lineSpacing', 1.5)}
                  >
                    1,5
                  </button>
                  <button
                    type="button"
                    className={`${styles.sigTypeBtn} ${form.lineSpacing === 1 ? styles.sigTypeBtnActive : ''}`}
                    onClick={() => set('lineSpacing', 1)}
                  >
                    1
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Idioma del documento</label>
                <div className={styles.sigTypeSelector}>
                  <button
                    type="button"
                    className={`${styles.sigTypeBtn} ${styles.flagBtn} ${form.lang === 'en' ? styles.sigTypeBtnActive : ''}`}
                    onClick={() => set('lang', 'en')}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    className={`${styles.sigTypeBtn} ${styles.flagBtn} ${form.lang === 'es' ? styles.sigTypeBtnActive : ''}`}
                    onClick={() => set('lang', 'es')}
                  >
                    🇪🇸 Castellano
                  </button>
                </div>
                <span className={styles.sigHint}>
                  {form.lang === 'en'
                    ? 'Fecha en inglés; título FEEP en inglés'
                    : 'Fecha en castellano; título FEEP en castellano'}
                </span>
              </div>

            </div>
          </section>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProceed}
            onClick={() => setStep(2)}
          >
            Continuar → Pegar texto
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 2: text input + download ─────────────────────────────────────────

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Adaptar carta"
        subtitle="Pega el texto que deseas adaptar al modelo seleccionado."
      />

      <div className={styles.wizard}>

        {/* Config summary */}
        <div className={styles.summary}>
          <span>
            Modelo:{' '}
            <strong>{TEMPLATES[form.template]?.icon} {TEMPLATES[form.template]?.label}</strong>
          </span>
          <span>Firmante: <strong>{form.signerName}</strong></span>
          <span>Firma: <strong>{form.sigType === 'manuscrita' ? 'Manuscrita' : 'Digital'}</strong></span>
          <span>Fecha: <strong>{form.date}</strong></span>
          <span>Interlineado: <strong>{form.lineSpacing}</strong></span>
          <span>Idioma: <strong>{form.lang === 'en' ? '🇬🇧 EN' : '🇪🇸 ES'}</strong></span>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => { setStep(1); setError(null) }}
          >
            ✎ Editar
          </button>
        </div>

        {/* Text area */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.stepBadge}>4</span>
            Texto de la carta
          </h2>
          <div className="form-group">
            <label htmlFor="text">
              Pega aquí el cuerpo de la carta (sin firma)
            </label>
            <textarea
              id="text"
              name="text"
              className={styles.textArea}
              rows={20}
              placeholder={
                'Estimado/a…\n\nEn el presente escrito les comunico…\n\nA la espera de sus noticias, les saludo atentamente.'
              }
              value={form.text}
              onChange={handleChange}
            />
          </div>
        </section>

        {error && (
          <p className="alert alert-error">{error}</p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isValid || busy}
            onClick={() => handleDownload('docx')}
          >
            {loadingFmt === 'docx' ? 'Generando…' : '⬇ Descargar .docx'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!isValid || busy}
            onClick={() => handleDownload('pdf')}
          >
            {loadingFmt === 'pdf' ? 'Generando…' : '⬇ Descargar .pdf'}
          </button>
          <span className={styles.hint}>
            Si el texto ocupa más de una página, se paginará automáticamente.
          </span>
        </div>
      </div>
    </div>
  )
}
