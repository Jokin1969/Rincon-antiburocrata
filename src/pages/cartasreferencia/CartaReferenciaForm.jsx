import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from './CartaReferenciaForm.module.css'

const TIPOS = [
  { value: 'profesional',  label: 'Referencia profesional' },
  { value: 'proyecto',     label: 'Apoyo a proyecto' },
  { value: 'green-card',   label: 'Green Card / Visa' },
  { value: 'otro',         label: 'Otro' },
]
const TEMPLATES = [
  { value: 'cicbiogune', label: 'CIC bioGUNE' },
  { value: 'atlas',      label: 'ATLAS molecular pharma' },
  { value: 'feep',       label: 'FEEP' },
]
const TRATAMIENTOS = ['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mrs.', 'Dra.', '']

const EMPTY = {
  titulo:    '',
  tipo:      'profesional',
  idioma:    'en',
  template:  'cicbiogune',
  fecha:     new Date().toISOString().split('T')[0],
  firmaTipo: 'manuscrita',
  firmante: { nombre: 'Joaquín Castilla', titulo1: 'IKERBasque Research Professor', email: 'jcastilla@cicbiogune.es' },
  destinatario: { tipo: 'abierto', tratamiento: '', nombre: '', cargo: '', departamento: '', organizacion: '', pais: '' },
  referencia: { nombre: '', cargo_actual: '', organizacion_actual: '', relacion: '', periodo: '', logros: '' },
  notas_ia:      '',
  cuerpo:        '',
  email_destino: '',
}

export default function CartaReferenciaForm() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const isNew    = !id

  const [form, setForm]           = useState(EMPTY)
  const [loading, setLoading]     = useState(!isNew)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState(null)

  const [genPdf, setGenPdf]       = useState(false)
  const [genDocx, setGenDocx]     = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMsg, setEmailMsg]   = useState(null)

  const [aiLoading, setAiLoading] = useState(null) // 'claude'|'openai'|'gemini'
  const [aiError, setAiError]     = useState(null)

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`/api/cartas-referencia/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setForm(data)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }
  function setNested(section, key, val) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!form.titulo.trim()) { setError('El título interno es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      const method = isNew ? 'POST' : 'PUT'
      const url    = isNew ? '/api/cartas-referencia' : `/api/cartas-referencia/${id}`
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (isNew) {
        navigate(`/cartas-referencia/${data.id}`, { replace: true })
      } else {
        setForm(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDescargar(format) {
    if (!id) { alert('Guarda la carta primero.'); return }
    if (format === 'pdf') setGenPdf(true); else setGenDocx(true)
    try {
      const res  = await fetch(`/api/cartas-referencia/${id}/exportar?format=${format}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `CartaRef_${form.titulo || id}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error al descargar: ' + e.message)
    } finally {
      setGenPdf(false)
      setGenDocx(false)
    }
  }

  async function handleEnviarEmail() {
    if (!id) { alert('Guarda la carta primero.'); return }
    if (!form.email_destino.trim()) { setEmailMsg('❌ Introduce un email.'); return }
    setSendingEmail(true)
    setEmailMsg(null)
    try {
      const res  = await fetch(`/api/cartas-referencia/${id}/enviar-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: form.email_destino }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmailMsg(`✅ Enviado a ${data.to}`)
    } catch (e) {
      setEmailMsg(`❌ Error: ${e.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleGenerarIA(provider) {
    setAiLoading(provider)
    setAiError(null)
    try {
      const res  = await fetch('/api/cartas-referencia/ia-generar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, provider }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setField('cuerpo', data.cuerpo)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(null)
    }
  }

  if (loading) return <div className={styles.loading}>Cargando carta…</div>

  return (
    <div>
      <PageHeader
        back="/cartas-referencia"
        backLabel="Cartas de referencia"
        title={isNew ? 'Nueva carta de referencia' : (form.titulo || 'Editar carta')}
        subtitle="Genera cartas de referencia, recomendación y apoyo a proyectos."
      />

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── Sección 1: Configuración ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Configuración</h2>

        <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
          <label className={styles.label}>Título interno *</label>
          <input
            className={styles.input}
            value={form.titulo}
            onChange={e => setField('titulo', e.target.value)}
            placeholder="Ej: Ref para María García – NIH Grant 2026"
          />
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Tipo de carta</label>
            <div className={styles.toggleGroup}>
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  className={`${styles.toggleBtn} ${form.tipo === t.value ? styles.active : ''}`}
                  onClick={() => setField('tipo', t.value)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Idioma</label>
            <div className={styles.toggleGroup}>
              <button
                className={`${styles.toggleBtn} ${form.idioma === 'en' ? styles.active : ''}`}
                onClick={() => setField('idioma', 'en')} type="button"
              >🇬🇧 English</button>
              <button
                className={`${styles.toggleBtn} ${form.idioma === 'es' ? styles.active : ''}`}
                onClick={() => setField('idioma', 'es')} type="button"
              >🇪🇸 Castellano</button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Plantilla institucional</label>
            <div className={styles.templateGrid}>
              {TEMPLATES.map(t => (
                <button
                  key={t.value}
                  className={`${styles.templateBtn} ${form.template === t.value ? styles.active : ''}`}
                  onClick={() => setField('template', t.value)} type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Fecha del documento</label>
            <input
              className={styles.input}
              type="date"
              value={form.fecha}
              onChange={e => setField('fecha', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Tipo de firma</label>
            <div className={styles.toggleGroup}>
              <button
                className={`${styles.toggleBtn} ${form.firmaTipo === 'manuscrita' ? styles.active : ''}`}
                onClick={() => setField('firmaTipo', 'manuscrita')} type="button"
              >✒️ Manuscrita</button>
              <button
                className={`${styles.toggleBtn} ${form.firmaTipo === 'digital' ? styles.active : ''}`}
                onClick={() => setField('firmaTipo', 'digital')} type="button"
              >💻 Digital (espacio en blanco)</button>
            </div>
          </div>
        </div>

        <div className={styles.saveRow}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear carta' : 'Guardar cambios'}
          </button>
          {saved && <span className={styles.savedMsg}>✅ Guardado</span>}
        </div>
      </section>

      {/* ── Sección 2: Datos del firmante ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Datos del firmante</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nombre</label>
            <input className={styles.input} value={form.firmante.nombre}
              onChange={e => setNested('firmante', 'nombre', e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Título / Cargo</label>
            <input className={styles.input} value={form.firmante.titulo1}
              onChange={e => setNested('firmante', 'titulo1', e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email institucional</label>
            <input className={styles.input} type="email" value={form.firmante.email}
              onChange={e => setNested('firmante', 'email', e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── Sección 3: Destinatario ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Destinatario</h2>
        <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleBtn} ${form.destinatario.tipo === 'abierto' ? styles.active : ''}`}
              onClick={() => setNested('destinatario', 'tipo', 'abierto')} type="button"
            >{form.idioma === 'es' ? 'A quien corresponda' : 'To Whom It May Concern'}</button>
            <button
              className={`${styles.toggleBtn} ${form.destinatario.tipo === 'especifico' ? styles.active : ''}`}
              onClick={() => setNested('destinatario', 'tipo', 'especifico')} type="button"
            >Persona específica</button>
          </div>
        </div>

        {form.destinatario.tipo === 'especifico' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tratamiento</label>
              <select className={styles.input} value={form.destinatario.tratamiento}
                onChange={e => setNested('destinatario', 'tratamiento', e.target.value)}>
                {TRATAMIENTOS.map(t => <option key={t} value={t}>{t || '(ninguno)'}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre completo</label>
              <input className={styles.input} value={form.destinatario.nombre}
                onChange={e => setNested('destinatario', 'nombre', e.target.value)}
                placeholder="Jane Smith" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Cargo</label>
              <input className={styles.input} value={form.destinatario.cargo}
                onChange={e => setNested('destinatario', 'cargo', e.target.value)}
                placeholder="Director of Research" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Departamento</label>
              <input className={styles.input} value={form.destinatario.departamento}
                onChange={e => setNested('destinatario', 'departamento', e.target.value)}
                placeholder="Department of Neuroscience" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Organización / Institución</label>
              <input className={styles.input} value={form.destinatario.organizacion}
                onChange={e => setNested('destinatario', 'organizacion', e.target.value)}
                placeholder="National Institutes of Health" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>País</label>
              <input className={styles.input} value={form.destinatario.pais}
                onChange={e => setNested('destinatario', 'pais', e.target.value)}
                placeholder="United States" />
            </div>
          </div>
        )}
      </section>

      {/* ── Sección 4: Persona referenciada ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Persona referenciada</h2>
        <div className={styles.formGrid}>
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Nombre completo *</label>
            <input className={`${styles.input} ${styles.inputHighlight}`}
              value={form.referencia.nombre}
              onChange={e => setNested('referencia', 'nombre', e.target.value)}
              placeholder="María García López" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Cargo actual</label>
            <input className={styles.input} value={form.referencia.cargo_actual}
              onChange={e => setNested('referencia', 'cargo_actual', e.target.value)}
              placeholder="Postdoctoral Researcher" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Organización actual</label>
            <input className={styles.input} value={form.referencia.organizacion_actual}
              onChange={e => setNested('referencia', 'organizacion_actual', e.target.value)}
              placeholder="Harvard Medical School" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Periodo de conocimiento</label>
            <input className={styles.input} value={form.referencia.periodo}
              onChange={e => setNested('referencia', 'periodo', e.target.value)}
              placeholder="2018–2022" />
          </div>
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Relación con el firmante</label>
            <textarea className={styles.textarea} rows={3}
              value={form.referencia.relacion}
              onChange={e => setNested('referencia', 'relacion', e.target.value)}
              placeholder="Ej: Postdoctoral researcher in my laboratory at CIC bioGUNE from 2018 to 2022, working on prion disease mechanisms." />
          </div>
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Logros y contribuciones destacadas</label>
            <textarea className={styles.textarea} rows={4}
              value={form.referencia.logros}
              onChange={e => setNested('referencia', 'logros', e.target.value)}
              placeholder="Ej: Published 5 first-author papers in top journals, developed a novel diagnostic assay, led a team of 3 PhD students..." />
          </div>
        </div>
      </section>

      {/* ── Sección 5: Notas para IA ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Contexto adicional para la IA</h2>
        <p className={styles.hint}>
          Añade cualquier información extra que quieras que los modelos de IA incluyan al generar la carta:
          anécdotas relevantes, habilidades específicas, contexto del proyecto, visa type, etc.
        </p>
        <textarea
          className={styles.textarea}
          rows={5}
          value={form.notas_ia}
          onChange={e => setField('notas_ia', e.target.value)}
          placeholder="Ej: Please emphasize her leadership skills and her ability to work under pressure. She is applying for an O-1 visa based on extraordinary ability in prion research."
        />
      </section>

      {/* ── Sección 6: Cuerpo de la carta ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Cuerpo de la carta</h2>
        <p className={styles.hint}>
          Genera el texto con IA o escríbelo directamente. Puedes mezclar ambos: genera con IA y luego edita.
        </p>

        <div className={styles.aiRow}>
          <span className={styles.aiLabel}>Generar con IA:</span>
          <button
            className={`btn btn-sm ${styles.aiBtnClaude}`}
            onClick={() => handleGenerarIA('claude')}
            disabled={aiLoading !== null}
            type="button"
          >
            {aiLoading === 'claude' ? '⏳ Generando…' : '⚡ Claude'}
          </button>
          <button
            className={`btn btn-sm ${styles.aiBtnOpenai}`}
            onClick={() => handleGenerarIA('openai')}
            disabled={aiLoading !== null}
            type="button"
          >
            {aiLoading === 'openai' ? '⏳ Generando…' : '⚡ ChatGPT'}
          </button>
          <button
            className={`btn btn-sm ${styles.aiBtnGemini}`}
            onClick={() => handleGenerarIA('gemini')}
            disabled={aiLoading !== null}
            type="button"
          >
            {aiLoading === 'gemini' ? '⏳ Generando…' : '⚡ Gemini'}
          </button>
          {form.cuerpo && (
            <button className="btn btn-sm" onClick={() => setField('cuerpo', '')} type="button">
              ✕ Limpiar
            </button>
          )}
        </div>

        {aiError && <p className={styles.aiError}>❌ {aiError}</p>}

        <textarea
          className={styles.textarea}
          rows={16}
          value={form.cuerpo}
          onChange={e => setField('cuerpo', e.target.value)}
          placeholder={
            form.idioma === 'es'
              ? 'Escribe el cuerpo de la carta aquí, o pulsa uno de los botones de IA para generarlo automáticamente a partir de los datos introducidos...'
              : 'Write the letter body here, or click one of the AI buttons to generate it automatically from the data above...'
          }
        />
      </section>

      {/* ── Sección 7: Descargar y enviar ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Descargar y enviar</h2>

        <div className={styles.emailRow}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email de destino (copia para ti o para el destinatario)"
            value={form.email_destino}
            onChange={e => setField('email_destino', e.target.value)}
          />
          <button
            className="btn"
            onClick={handleEnviarEmail}
            disabled={sendingEmail || !id}
          >
            {sendingEmail ? 'Enviando…' : '✉ Enviar PDF'}
          </button>
        </div>
        {emailMsg && <p className={styles.emailMsg}>{emailMsg}</p>}

        <div className={styles.actions}>
          <button
            className="btn btn-primary"
            onClick={() => handleDescargar('docx')}
            disabled={genDocx || !id}
          >
            {genDocx ? 'Generando…' : '⬇ Descargar .docx'}
          </button>
          <button
            className="btn"
            onClick={() => handleDescargar('pdf')}
            disabled={genPdf || !id}
          >
            {genPdf ? 'Generando…' : '⬇ Descargar .pdf'}
          </button>
        </div>
        {!id && <p className={styles.hint}>Guarda la carta primero para poder descargarla.</p>}
      </section>
    </div>
  )
}
