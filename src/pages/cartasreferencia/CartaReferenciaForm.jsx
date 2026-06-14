import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from './CartaReferenciaForm.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const DEFAULT_FIRMANTE = {
  nombre: 'Joaquín Castilla',
  titulo1: 'IKERBasque Research Professor',
  email: 'jcastilla@cicbiogune.es',
}

const TIPO_OPTS = [
  { value: 'profesional',  label: 'Referencia profesional' },
  { value: 'proyecto',     label: 'Apoyo a proyecto' },
  { value: 'green-card',  label: 'Green Card / Visa' },
  { value: 'otro',        label: 'Otro' },
]

const TEMPLATE_OPTS = [
  { value: 'cicbiogune', label: 'CIC bioGUNE' },
  { value: 'atlas',      label: 'ATLAS molecular pharma' },
  { value: 'feep',       label: 'FEEP' },
]

function emptyForm() {
  return {
    titulo: '',
    tipo: 'profesional',
    idioma: 'en',
    template: 'cicbiogune',
    fecha: TODAY,
    firmaTipo: 'manuscrita',
    firmante: { ...DEFAULT_FIRMANTE },
    destinatario: {
      tipo: 'abierto',
      tratamiento: '',
      nombre: '',
      cargo: '',
      departamento: '',
      organizacion: '',
      pais: '',
    },
    referencia: {
      nombre: '',
      cargo_actual: '',
      organizacion_actual: '',
      relacion: '',
      periodo: '',
      logros: '',
    },
    notas_ia: '',
    cuerpo: '',
    email_destino: '',
  }
}

export default function CartaReferenciaForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm]           = useState(emptyForm())
  const [loading, setLoading]     = useState(!!id)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [cartaId, setCartaId]     = useState(id || null)

  const [aiLoading, setAiLoading] = useState(null) // 'claude' | 'openai' | 'gemini'
  const [aiError, setAiError]     = useState(null)

  const [emailMsg, setEmailMsg]   = useState(null)
  const [emailSending, setEmailSending] = useState(false)

  // Load existing carta
  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/cartas-referencia/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setSaveError(data.error); return }
        setForm({
          titulo:        data.titulo        || '',
          tipo:          data.tipo          || 'profesional',
          idioma:        data.idioma        || 'en',
          template:      data.template      || 'cicbiogune',
          fecha:         data.fecha         || TODAY,
          firmaTipo:     data.firmaTipo     || 'manuscrita',
          firmante:      { ...DEFAULT_FIRMANTE, ...(data.firmante || {}) },
          destinatario:  {
            tipo:          'abierto',
            tratamiento:   '',
            nombre:        '',
            cargo:         '',
            departamento:  '',
            organizacion:  '',
            pais:          '',
            ...(data.destinatario || {}),
          },
          referencia: {
            nombre:              '',
            cargo_actual:        '',
            organizacion_actual: '',
            relacion:            '',
            periodo:             '',
            logros:              '',
            ...(data.referencia || {}),
          },
          notas_ia:      data.notas_ia      || '',
          cuerpo:        data.cuerpo        || '',
          email_destino: data.email_destino || '',
        })
        setCartaId(data.id)
      })
      .catch(() => setSaveError('Error al cargar la carta.'))
      .finally(() => setLoading(false))
  }, [id])

  // ── Field updaters ────────────────────────────────────────────────────────────

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function setFirmante(key, value) {
    setForm(f => ({ ...f, firmante: { ...f.firmante, [key]: value } }))
    setSaved(false)
  }

  function setDestinatario(key, value) {
    setForm(f => ({ ...f, destinatario: { ...f.destinatario, [key]: value } }))
    setSaved(false)
  }

  function setReferencia(key, value) {
    setForm(f => ({ ...f, referencia: { ...f.referencia, [key]: value } }))
    setSaved(false)
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const url    = cartaId ? `/api/cartas-referencia/${cartaId}` : '/api/cartas-referencia'
      const method = cartaId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setCartaId(data.id)
      setSaved(true)
      if (!cartaId) {
        navigate(`/cartas-referencia/${data.id}`, { replace: true })
      }
    } catch (err) {
      setSaveError(err.message || 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  // ── AI generation ─────────────────────────────────────────────────────────────

  async function handleAIGenerate(provider) {
    setAiLoading(provider)
    setAiError(null)
    try {
      const res = await fetch('/api/cartas-referencia/ia-generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setField('cuerpo', data.cuerpo || '')
    } catch (err) {
      setAiError(err.message || 'Error al generar con IA.')
    } finally {
      setAiLoading(null)
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────────

  async function handleSendEmail() {
    if (!cartaId) { alert('Guarda la carta primero.'); return }
    setEmailSending(true)
    setEmailMsg(null)
    try {
      const res = await fetch(`/api/cartas-referencia/${cartaId}/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email_destino }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setEmailMsg({ ok: true, text: `Email enviado a ${data.to}` })
    } catch (err) {
      setEmailMsg({ ok: false, text: err.message || 'Error al enviar.' })
    } finally {
      setEmailSending(false)
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────────

  function handleDownload(format) {
    if (!cartaId) return
    window.open(`/api/cartas-referencia/${cartaId}/exportar?format=${format}`, '_blank')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.loading}>Cargando carta…</div>

  const isNew = !cartaId

  return (
    <div>
      <PageHeader
        back="/cartas-referencia"
        backLabel="Cartas de referencia"
        title={isNew ? 'Nueva carta de referencia' : (form.titulo || 'Editar carta')}
        subtitle="Redacta cartas de referencia, recomendación o apoyo a proyectos."
      />

      <Link to="/cartas-referencia" className={styles.backLink}>
        ← Cartas de referencia
      </Link>

      {saveError && <div className="alert alert-error">{saveError}</div>}

      {/* ── Section 1: Configuración ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>⚙️ Configuración</h2>

        <div className={styles.formGrid}>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.label}>Título interno</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Ej: Referencia para María García – beca Ramón y Cajal 2026"
              value={form.titulo}
              onChange={e => setField('titulo', e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Tipo de carta</label>
            <div className={styles.tipoGrid}>
              {TIPO_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.tipoBtn} ${form.tipo === opt.value ? styles.tipoBtnActive : ''}`}
                  onClick={() => setField('tipo', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Idioma</label>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${form.idioma === 'en' ? styles.toggleBtnActive : ''}`}
                onClick={() => setField('idioma', 'en')}
              >
                🇬🇧 English
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${form.idioma === 'es' ? styles.toggleBtnActive : ''}`}
                onClick={() => setField('idioma', 'es')}
              >
                🇪🇸 Castellano
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Plantilla institucional</label>
            <div className={styles.templateGrid}>
              {TEMPLATE_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.templateBtn} ${form.template === opt.value ? styles.templateBtnActive : ''}`}
                  onClick={() => setField('template', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Fecha</label>
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
                type="button"
                className={`${styles.toggleBtn} ${form.firmaTipo === 'manuscrita' ? styles.toggleBtnActive : ''}`}
                onClick={() => setField('firmaTipo', 'manuscrita')}
              >
                ✍️ Manuscrita (imagen)
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${form.firmaTipo === 'digital' ? styles.toggleBtnActive : ''}`}
                onClick={() => setField('firmaTipo', 'digital')}
              >
                📄 Digital (espacio en blanco)
              </button>
            </div>
          </div>
        </div>

        <div className={styles.saveRow}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando…' : isNew ? 'Crear carta' : 'Guardar'}
          </button>
          {saved && <span className={styles.savedMsg}>✅ Guardado</span>}
        </div>
      </section>

      {/* ── Section 2: Datos del firmante ──────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🖊️ Datos del firmante</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nombre</label>
            <input
              className={styles.input}
              type="text"
              value={form.firmante.nombre}
              onChange={e => setFirmante('nombre', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Título / Cargo</label>
            <input
              className={styles.input}
              type="text"
              value={form.firmante.titulo1}
              onChange={e => setFirmante('titulo1', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={form.firmante.email}
              onChange={e => setFirmante('email', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: Destinatario ────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📬 Destinatario</h2>

        <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${form.destinatario.tipo === 'abierto' ? styles.toggleBtnActive : ''}`}
              onClick={() => setDestinatario('tipo', 'abierto')}
            >
              {form.idioma === 'es' ? 'A quien corresponda' : 'To Whom It May Concern'}
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${form.destinatario.tipo === 'especifico' ? styles.toggleBtnActive : ''}`}
              onClick={() => setDestinatario('tipo', 'especifico')}
            >
              Persona específica
            </button>
          </div>
        </div>

        {form.destinatario.tipo === 'especifico' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tratamiento</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Dr. / Prof. / Ms. / Mr."
                value={form.destinatario.tratamiento}
                onChange={e => setDestinatario('tratamiento', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre completo</label>
              <input
                className={styles.input}
                type="text"
                value={form.destinatario.nombre}
                onChange={e => setDestinatario('nombre', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Cargo</label>
              <input
                className={styles.input}
                type="text"
                value={form.destinatario.cargo}
                onChange={e => setDestinatario('cargo', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Departamento</label>
              <input
                className={styles.input}
                type="text"
                value={form.destinatario.departamento}
                onChange={e => setDestinatario('departamento', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Organización</label>
              <input
                className={styles.input}
                type="text"
                value={form.destinatario.organizacion}
                onChange={e => setDestinatario('organizacion', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>País</label>
              <input
                className={styles.input}
                type="text"
                value={form.destinatario.pais}
                onChange={e => setDestinatario('pais', e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Section 4: Persona referenciada ───────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>👤 Persona referenciada</h2>
        <div className={styles.formGrid}>
          <div className={`${styles.formGroup} ${styles.highlighted}`}>
            <label className={styles.label}>Nombre completo ✦</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Nombre completo de la persona referenciada"
              value={form.referencia.nombre}
              onChange={e => setReferencia('nombre', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Cargo actual</label>
            <input
              className={styles.input}
              type="text"
              value={form.referencia.cargo_actual}
              onChange={e => setReferencia('cargo_actual', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Organización actual</label>
            <input
              className={styles.input}
              type="text"
              value={form.referencia.organizacion_actual}
              onChange={e => setReferencia('organizacion_actual', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Periodo de conocimiento</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Ej: 2019–2023, más de 5 años…"
              value={form.referencia.periodo}
              onChange={e => setReferencia('periodo', e.target.value)}
            />
          </div>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.label}>Relación con el firmante</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="¿Cómo se conocen? ¿Qué rol tuvo esta persona contigo?"
              value={form.referencia.relacion}
              onChange={e => setReferencia('relacion', e.target.value)}
            />
          </div>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.label}>Logros y contribuciones</label>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="Principales logros, habilidades destacadas, contribuciones…"
              value={form.referencia.logros}
              onChange={e => setReferencia('logros', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Section 5: Notas adicionales para IA ──────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🤖 Contexto adicional para la IA</h2>
        <div className={styles.formGroup}>
          <label className={styles.label}>Notas adicionales</label>
          <textarea
            className={styles.textarea}
            rows={5}
            placeholder="Cualquier información relevante que quieras que la IA incluya en la carta: anécdotas, proyectos concretos, características especiales…"
            value={form.notas_ia}
            onChange={e => setField('notas_ia', e.target.value)}
          />
          <span className={styles.hint}>Cualquier información relevante que quieras que la IA incluya en la carta.</span>
        </div>
      </section>

      {/* ── Section 6: Cuerpo de la carta ─────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📝 Cuerpo de la carta</h2>

        <div className={styles.aiRow}>
          <button
            type="button"
            className={styles.aiBtnClaude}
            disabled={!!aiLoading}
            onClick={() => handleAIGenerate('claude')}
          >
            {aiLoading === 'claude' ? 'Generando…' : '⚡ Generar con Claude'}
          </button>
          <button
            type="button"
            className={styles.aiBtnOpenai}
            disabled={!!aiLoading}
            onClick={() => handleAIGenerate('openai')}
          >
            {aiLoading === 'openai' ? 'Generando…' : '⚡ Generar con ChatGPT'}
          </button>
          <button
            type="button"
            className={styles.aiBtnGemini}
            disabled={!!aiLoading}
            onClick={() => handleAIGenerate('gemini')}
          >
            {aiLoading === 'gemini' ? 'Generando…' : '⚡ Generar con Gemini'}
          </button>
          <button
            type="button"
            className={styles.aiBtnClear}
            disabled={!!aiLoading}
            onClick={() => setField('cuerpo', '')}
          >
            ✕ Limpiar
          </button>
        </div>

        {aiError && <div className={styles.aiError}>{aiError}</div>}

        <div className={styles.formGroup}>
          <textarea
            className={styles.textareaBody}
            rows={15}
            placeholder="Escribe aquí el cuerpo de la carta o usa los botones de arriba para generarlo con IA…"
            value={form.cuerpo}
            onChange={e => setField('cuerpo', e.target.value)}
          />
          <span className={styles.hint}>
            Solo el cuerpo — sin saludo inicial, sin cierre ni firma. Párrafos separados por línea en blanco.
          </span>
        </div>
      </section>

      {/* ── Section 7: Enviar y descargar ─────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📤 Enviar y descargar</h2>

        <div className={styles.emailRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Enviar copia por email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="destinatario@ejemplo.com"
              value={form.email_destino}
              onChange={e => setField('email_destino', e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSendEmail}
            disabled={emailSending || !cartaId}
          >
            {emailSending ? 'Enviando…' : '✉ Enviar PDF'}
          </button>
        </div>

        {emailMsg && (
          <p className={`${styles.resultMsg} ${emailMsg.ok ? styles.resultOk : styles.resultErr}`}>
            {emailMsg.ok ? '✅ ' : '❌ '}{emailMsg.text}
          </p>
        )}

        <div className={styles.actions}>
          <button
            className="btn btn-primary"
            onClick={() => handleDownload('docx')}
            disabled={!cartaId}
          >
            ⬇ Descargar .docx
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleDownload('pdf')}
            disabled={!cartaId}
          >
            ⬇ Descargar .pdf
          </button>
        </div>

        {!cartaId && (
          <p className={styles.hint} style={{ marginTop: '0.75rem' }}>
            Guarda la carta primero para poder descargarla.
          </p>
        )}
      </section>
    </div>
  )
}
