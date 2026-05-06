import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import styles from './SeccionAForm.module.css'
import ExportButton from '../../../components/animalario/ExportButton'
import CollapsibleBlock from '../../../components/animalario/CollapsibleBlock'
import AutoExpandTextarea from '../../../components/animalario/AutoExpandTextarea'

// ── Constants ─────────────────────────────────────────────────────────────────

const FUNCIONES_ECC = [
  { value: 'A', label: 'A. Cuidado de los animales' },
  { value: 'B', label: 'B. Eutanasia' },
  { value: 'C', label: 'C. Realización de procedimientos' },
  { value: 'D', label: 'D. Diseño de proyectos y procedimientos' },
  { value: 'E', label: 'E. Responsabilidad supervisión in situ' },
  { value: 'F', label: 'F. Veterinario Designado' },
  { value: '',  label: 'Ninguna' },
]

const FINALIDADES = [
  { value: 'a', label: 'a. Investigación básica' },
  { value: 'b', label: 'b. Investigación traslacional' },
  { value: 'c', label: 'c. Utilización reglamentaria y producción rutinaria' },
  { value: 'd', label: 'd. Protección del medio ambiente natural' },
  { value: 'e', label: 'e. Preservación de especies' },
  { value: 'f', label: 'f. Enseñanza superior o formación' },
  { value: 'g', label: 'g. Investigaciones forenses' },
]

const EMPTY_FORM = {
  titulo:          '',
  referencia_cbba: '',
  responsable: {
    nif_pasaporte:        '16287336R',
    nombre_apellidos:     'Joaquín Castilla',
    telefono:             '+34 956 572 525',
    email:                'jcastilla@cicbiogune.es',
    funcion_ecc566:       'D',
    autoridad_competente: 'Convalidado por el Ministerio de Agricultura, Pesca y Alimentación (RD 1201/2005)',
    fecha_acreditacion:   '2023-12-27',
  },
  participantes: [],
  duracion: { fecha_inicio: '', fecha_fin: '' },
  financiacion: {
    entidad_programa:    'Plan Nacional (P. of Concept)',
    estado:              'aprobada',
    numero_proyecto:     'PDC2025-165940-I00',
    ip_es_responsable:   true,
    ip_responsable_otro: '',
  },
  lugar_realizacion: {
    animalario_cicbiogune: true,
    otro:                  true,
    descripcion:           'Inoculaciones de diferentes cepas de priones en el animalario BSL3 de NEIKER - Instituto Vasco de Investigación y Desarrollo Agrario. Código REGA: ES489010006099, en el animalario BSL-3 del Centre de Recerca en Sanitat Animal (CReSA). Código REGA: ES082660037069 y en el animalario de Centro de Investigación en Encefalopatías y Enfermedades Transmisibles de la Universidad de Zaragoza (UNIZAR). Código REGA: ES502970012009',
  },
  objetivos: {
    objetivo_principal: '',
    resumen:            '',
    dano_beneficio:     '',
  },
  tipo_proyecto: 'II',
  finalidad:     ['a', 'b'],
  tres_rs: { reemplazo: '', reduccion: '', refinamiento: '' },
  hay_cria:    false,
  cepas_cria:  [],
  condiciones_alojamiento: {
    estandar:    true,
    variaciones: true,
    descripcion: 'Una vez los animales se hayan administrado con AAV se mantendrán en la zona limpia (rack ventilado) durante 10 días. Pasado este tiempo, los animales se trasladarán a la zona sucia del SDA para su perfusión o su traslado a Neiker, CReSA o UNIZAR para la inoculación de priones.',
  },
  firmante: 'Joaquín Castilla',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(text) {
  return text?.trim() ? text.trim().split(/\s+/).length : 0
}

function durationWarning(inicio, fin) {
  if (!inicio || !fin) return null
  const years = (new Date(fin) - new Date(inicio)) / (1000 * 60 * 60 * 24 * 365.25)
  return years > 5 ? 'La duración máxima del proyecto es 5 años' : null
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

// ── Sub-components ────────────────────────────────────────────────────────────


// Input with quick-fill preset options (▾ dropdown button, flips upward near bottom)
function QuickFillInput({ value, onChange, presets = [], type = 'text', placeholder, disabled }) {
  const [show,   setShow]   = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const wrapRef             = useRef(null)

  useEffect(() => {
    const onOut = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  function toggleDropdown() {
    if (!show && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      setOpenUp(window.innerHeight - rect.bottom < 220)
    }
    setShow(o => !o)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', gap: '0.3rem' }}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      {presets.length > 0 && (
        <button
          type="button"
          onClick={toggleDropdown}
          title="Opciones rápidas"
          style={{
            padding: '0 0.55rem', fontSize: '0.78rem', lineHeight: 1,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            color: 'var(--muted)', flexShrink: 0, fontFamily: 'inherit',
          }}
        >▾</button>
      )}
      {show && (
        <ul style={{
          position: 'absolute', right: 0, zIndex: 60,
          ...(openUp ? { bottom: 'calc(100% + 2px)' } : { top: 'calc(100% + 2px)' }),
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          listStyle: 'none', margin: 0, padding: '0.2rem 0', minWidth: 220,
        }}>
          {presets.map(opt => (
            <li
              key={opt}
              onMouseDown={() => { onChange(opt); setShow(false) }}
              style={{
                padding: '0.45rem 0.85rem', cursor: 'pointer',
                fontSize: '0.855rem', color: 'var(--text)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >{opt}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AutocompleteInput({ campo, value, onChange, placeholder, presets = [] }) {
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow]               = useState(false)
  const wrapRef                       = useRef(null)

  useEffect(() => {
    fetch(`/api/animalario/repositorio/campo/${campo}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [campo])

  useEffect(() => {
    const onOut = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const combined = [...new Set([...presets, ...suggestions])]
  const filtered = combined.filter(
    s => s.toLowerCase().includes((value || '').toLowerCase()) && s !== value
  )

  return (
    <div className={styles.acWrap} ref={wrapRef}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setShow(true)}
        autoComplete="off"
      />
      {show && filtered.length > 0 && (
        <ul className={styles.suggestions}>
          {filtered.map(s => (
            <li key={s} className={styles.suggestion} onMouseDown={() => { onChange(s); setShow(false) }}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [])
  return <div className={styles.toast}>{message}</div>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SeccionAForm() {
  const { proyectoId } = useParams()
  const navigate       = useNavigate()
  const isEdit         = Boolean(proyectoId)

  const [proyecto,      setProyecto]   = useState(null)
  const [form,          setForm]       = useState(clone(EMPTY_FORM))
  const [loading,       setLoading]    = useState(isEdit)
  const [saving,        setSaving]     = useState(false)
  const [toast,         setToast]      = useState(null)
  const [errors,        setErrors]     = useState({})
  const [saveError,     setSaveError]  = useState(null)
  const [showErrPanel,  setShowErrPanel] = useState(false)

  // Load existing data in edit mode
  useEffect(() => {
    if (!isEdit) return
    fetch(`/api/animalario/proyectos/${proyectoId}`)
      .then(r => { if (!r.ok) throw new Error('Proyecto no encontrado'); return r.json() })
      .then(data => {
        setProyecto(data)
        if (data.seccionA) {
          const secA = data.seccionA
          // Migrate old lugar_realizacion model (tipo string → checkboxes)
          if (secA.lugar_realizacion && !('animalario_cicbiogune' in secA.lugar_realizacion)) {
            secA.lugar_realizacion = {
              animalario_cicbiogune: true,
              otro:                  true,
              descripcion:           secA.lugar_realizacion.descripcion ?? EMPTY_FORM.lugar_realizacion.descripcion,
            }
          }
          // Migrate old condiciones_alojamiento model (tipo string → checkboxes)
          if (secA.condiciones_alojamiento && !('estandar' in secA.condiciones_alojamiento)) {
            secA.condiciones_alojamiento = {
              estandar:    true,
              variaciones: true,
              descripcion: secA.condiciones_alojamiento.descripcion ?? EMPTY_FORM.condiciones_alojamiento.descripcion,
            }
          }
          setForm({ ...clone(EMPTY_FORM), ...secA })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [proyectoId])

  // Generic deep updater — supports dot-paths: update('responsable.email', val)
  function update(path, value) {
    setForm(prev => {
      const next  = clone(prev)
      const parts = path.split('.')
      let cursor  = next
      for (let i = 0; i < parts.length - 1; i++) cursor = cursor[parts[i]]
      cursor[parts[parts.length - 1]] = value
      return next
    })
  }

  // Finalidad toggle
  function toggleFinalidad(val) {
    setForm(prev => ({
      ...prev,
      finalidad: prev.finalidad.includes(val)
        ? prev.finalidad.filter(f => f !== val)
        : [...prev.finalidad, val],
    }))
  }

  // Participantes
  function addParticipante() {
    setForm(prev => ({
      ...prev,
      participantes: [...prev.participantes, { nombre_apellidos: '', funciones: '', nif_pasaporte: '' }],
    }))
  }
  function updateParticipante(i, field, value) {
    setForm(prev => ({
      ...prev,
      participantes: prev.participantes.map((p, idx) => idx === i ? { ...p, [field]: value } : p),
    }))
  }
  function removeParticipante(i) {
    setForm(prev => ({ ...prev, participantes: prev.participantes.filter((_, idx) => idx !== i) }))
  }

  // Cepas
  function addCepa() {
    setForm(prev => ({
      ...prev,
      cepas_cria: [...prev.cepas_cria, { nomenclatura_internacional: '', acronimo: '', num_animales: 0 }],
    }))
  }
  function updateCepa(i, field, value) {
    setForm(prev => ({
      ...prev,
      cepas_cria: prev.cepas_cria.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
    }))
  }
  function removeCepa(i) {
    setForm(prev => ({ ...prev, cepas_cria: prev.cepas_cria.filter((_, idx) => idx !== i) }))
  }

  // Toggle funciones participante (comma-separated)
  function toggleFuncionParticipante(i, funcion) {
    const current = (form.participantes[i].funciones || '').split(',').filter(Boolean)
    const next    = current.includes(funcion)
      ? current.filter(f => f !== funcion)
      : [...current, funcion]
    updateParticipante(i, 'funciones', next.join(','))
  }

  // Validation — returns map of field → message
  function validate() {
    const errs = {}
    if (!form.titulo?.trim())
      errs.titulo = 'Título del proyecto obligatorio'
    if (!form.responsable.nombre_apellidos?.trim())
      errs.responsable_nombre = 'Nombre y apellidos del responsable obligatorio'
    if (!form.duracion.fecha_inicio)
      errs.fecha_inicio = 'Fecha de inicio obligatoria'
    if (!form.duracion.fecha_fin)
      errs.fecha_fin = 'Fecha de fin obligatoria'
    if (!form.lugar_realizacion.animalario_cicbiogune && !form.lugar_realizacion.otro)
      errs.lugar = 'Debe indicarse al menos un lugar de realización'
    setErrors(errs)
    return errs
  }

  async function saveFrequent(campo, valor) {
    if (!valor?.trim()) return
    try {
      await fetch(`/api/animalario/repositorio/campo/${campo}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ valor: valor.trim() }),
      })
    } catch {}
  }

  async function doSave(andContinue = false) {
    setSaveError(null)
    setShowErrPanel(false)
    if (andContinue) {
      const errs = validate()
      if (Object.keys(errs).length > 0) {
        setShowErrPanel(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    setSaving(true)
    try {
      await saveFrequent('fuente_financiacion', form.financiacion.entidad_programa)
      for (const c of form.cepas_cria) {
        await saveFrequent('cepa_linea', c.nomenclatura_internacional)
      }

      const body = isEdit
        ? { ...(proyecto || {}), seccionA: form }
        : { seccionA: form, procedimientos: [], crias: [], modificaciones: [] }

      const res = await fetch(
        isEdit ? `/api/animalario/proyectos/${proyectoId}` : '/api/animalario/proyectos',
        {
          method:  isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }
      const saved = await res.json()
      setToast('Proyecto guardado correctamente')
      if (andContinue) navigate(`/animalario/proyecto/${saved.id}`)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ padding: '2rem', color: 'var(--muted-light)' }}>Cargando…</p>

  const procedimientos = proyecto?.procedimientos ?? []
  const durWarn        = durationWarning(form.duracion.fecha_inicio, form.duracion.fecha_fin)

  return (
    <div>
      <PageHeader
        back={isEdit ? `/animalario/proyecto/${proyectoId}` : '/animalario/proyectos'}
        backLabel={isEdit ? 'Proyecto' : 'Proyectos'}
        title={isEdit ? 'Editar — Sección A' : 'Nuevo proyecto — Sección A'}
        subtitle="Información general del proyecto de experimentación animal."
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Panel de errores de validación ──────────────────────────────── */}
      {showErrPanel && Object.keys(errors).length > 0 && (
        <div className={styles.errPanel}>
          <strong>No se puede continuar. Corrige los siguientes campos:</strong>
          <ul className={styles.errList}>
            {Object.values(errors).map(msg => (
              <li key={msg}>⚠ {msg}</li>
            ))}
          </ul>
        </div>
      )}

      {saveError && (
        <p className="alert alert-error" style={{ marginTop: '1rem' }}>{saveError}</p>
      )}

      {/* ── Bloque 1: Identificación ─────────────────────────────────────── */}
      <CollapsibleBlock
        title="1 · Identificación del proyecto"
        storageKey="secA:id"
        requiredFields={[form.titulo]}
      >
        <div className={styles.grid2}>
          <div className={`form-group ${styles.fullRow}`}>
            <label>Título del proyecto *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={e => update('titulo', e.target.value)}
              placeholder="Título completo del proyecto"
              className={errors.titulo ? styles.inputError : undefined}
            />
            {errors.titulo && <span className={styles.error}>{errors.titulo}</span>}
          </div>
          <div className="form-group">
            <label>Referencia CBBA</label>
            <input
              type="text"
              value={form.referencia_cbba}
              onChange={e => update('referencia_cbba', e.target.value)}
              placeholder="Ej. CBBA-2024-001"
            />
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── Bloque A.1: Responsable ──────────────────────────────────────── */}
      <CollapsibleBlock
        title="A.1 · Responsable del proyecto"
        storageKey="secA:resp"
        requiredFields={[form.responsable.nombre_apellidos, form.responsable.email]}
      >
        <div className={styles.grid2}>
          <div className="form-group">
            <label>NIF / Pasaporte</label>
            <QuickFillInput
              value={form.responsable.nif_pasaporte}
              onChange={v => update('responsable.nif_pasaporte', v)}
              presets={['16287336R', '74520022E']}
            />
          </div>
          <div className="form-group">
            <label>Nombre y apellidos *</label>
            <QuickFillInput
              value={form.responsable.nombre_apellidos}
              onChange={v => update('responsable.nombre_apellidos', v)}
              presets={['Joaquín Castilla', 'Jorge Moreno']}
              placeholder="Nombre Apellidos"
            />
            {errors.responsable_nombre && <span className={styles.error}>{errors.responsable_nombre}</span>}
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <QuickFillInput
              type="tel"
              value={form.responsable.telefono}
              onChange={v => update('responsable.telefono', v)}
              presets={['+34 956 572 525', '+34 956 572 526']}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <QuickFillInput
              type="email"
              value={form.responsable.email}
              onChange={v => update('responsable.email', v)}
              presets={['jcastilla@cicbiogune.es', 'jmoreno@cicbiogune.es']}
            />
          </div>
          <div className="form-group">
            <label>Función según ECC/566/2015</label>
            <select value={form.responsable.funcion_ecc566}
              onChange={e => update('responsable.funcion_ecc566', e.target.value)}>
              {FUNCIONES_ECC.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Autoridad Competente</label>
            <QuickFillInput
              value={form.responsable.autoridad_competente}
              onChange={v => update('responsable.autoridad_competente', v)}
              presets={[
                'Convalidado por el Ministerio de Agricultura, Pesca y Alimentación (RD 1201/2005)',
                'Capacidad reconocida por la Dirección General de Medio Ambiente, Vivienda y Agricultura de la Comunidad de Madrid',
              ]}
            />
          </div>
          <div className="form-group">
            <label>Fecha de acreditación</label>
            <input type="date" value={form.responsable.fecha_acreditacion}
              onChange={e => update('responsable.fecha_acreditacion', e.target.value)} />
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── Bloque A.2: Participantes ────────────────────────────────────── */}
      <CollapsibleBlock title="A.2 · Participantes" storageKey="secA:part">
        {form.participantes.length === 0 && (
          <p className={styles.emptyNote}>No hay participantes añadidos.</p>
        )}
        {form.participantes.map((p, i) => (
          <div key={i} className={styles.participantRow}>
            <div className={styles.grid3}>
              <div className="form-group">
                <label>Nombre y apellidos</label>
                <input type="text" value={p.nombre_apellidos}
                  onChange={e => updateParticipante(i, 'nombre_apellidos', e.target.value)} />
              </div>
              <div className="form-group">
                <label>NIF / Pasaporte</label>
                <input type="text" value={p.nif_pasaporte}
                  onChange={e => updateParticipante(i, 'nif_pasaporte', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Función/es (ECC/566/2015)</label>
                <div className={styles.checkboxGroup} style={{ marginTop: '0.25rem' }}>
                  {FUNCIONES_ECC.filter(f => f.value).map(f => (
                    <label key={f.value} className={styles.checkboxLabel}>
                      <input type="checkbox"
                        checked={(p.funciones || '').split(',').includes(f.value)}
                        onChange={() => toggleFuncionParticipante(i, f.value)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" className={styles.removeBtn} onClick={() => removeParticipante(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addParticipante}>
          ＋ Añadir participante
        </button>
      </CollapsibleBlock>

      {/* ── Bloque A.3: Duración, financiación y localización ───────────── */}
      <CollapsibleBlock
        title="A.3 · Duración, financiación y localización"
        storageKey="secA:dur"
        requiredFields={[form.duracion.fecha_inicio, form.duracion.fecha_fin]}
      >
        <div className={styles.grid2}>
          <div className="form-group">
            <label>Fecha de inicio *</label>
            <input type="date" value={form.duracion.fecha_inicio}
              onChange={e => update('duracion.fecha_inicio', e.target.value)}
              className={errors.fecha_inicio ? styles.inputError : undefined} />
            {errors.fecha_inicio && <span className={styles.error}>{errors.fecha_inicio}</span>}
          </div>
          <div className="form-group">
            <label>Fecha de fin *</label>
            <input type="date" value={form.duracion.fecha_fin}
              onChange={e => update('duracion.fecha_fin', e.target.value)}
              className={errors.fecha_fin ? styles.inputError : undefined} />
            {errors.fecha_fin && <span className={styles.error}>{errors.fecha_fin}</span>}
            {durWarn && <span className={styles.warning}>{durWarn}</span>}
          </div>

          <div className={`form-group ${styles.fullRow}`}>
            <label>Entidad financiadora y programa</label>
            <QuickFillInput
              value={form.financiacion.entidad_programa}
              onChange={v => update('financiacion.entidad_programa', v)}
              placeholder="Ej. Ministerio de Ciencia — PID2023-..."
              presets={['Plan Nacional (P. of Concept)', 'Plan Nacional']}
            />
          </div>

          <div className="form-group">
            <label>Estado de la financiación</label>
            <div className={styles.radioGroup}>
              {[['solicitada', 'Solicitada'], ['aprobada', 'Aprobada']].map(([v, l]) => (
                <label key={v} className={styles.radioLabel}>
                  <input type="radio"
                    checked={form.financiacion.estado === v}
                    onChange={() => update('financiacion.estado', v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {form.financiacion.estado === 'aprobada' && (
            <div className="form-group">
              <label>Número de proyecto</label>
              <QuickFillInput
                value={form.financiacion.numero_proyecto}
                onChange={v => update('financiacion.numero_proyecto', v)}
                presets={['PDC2025-165940-I00', 'PID2024-160022OB-I00']}
                placeholder="Ej. PID2023-123456AB-I00"
              />
            </div>
          )}

          <div className={`form-group ${styles.fullRow}`}>
            <label>¿El IP es el responsable de la financiación?</label>
            <div className={styles.radioGroup}>
              {[['true', 'Sí'], ['false', 'No']].map(([v, l]) => (
                <label key={v} className={styles.radioLabel}>
                  <input type="radio"
                    checked={String(form.financiacion.ip_es_responsable) === v}
                    onChange={() => update('financiacion.ip_es_responsable', v === 'true')} />
                  {l}
                </label>
              ))}
            </div>
            {form.financiacion.ip_es_responsable === false && (
              <input type="text" style={{ marginTop: '0.5rem' }}
                value={form.financiacion.ip_responsable_otro}
                onChange={e => update('financiacion.ip_responsable_otro', e.target.value)}
                placeholder="Indicar quién es el responsable" />
            )}
          </div>

          {/* Lugar de realización — checkboxes */}
          <div className={`form-group ${styles.fullRow}`}>
            <label>Lugar de realización</label>
            {errors.lugar && <span className={styles.error} style={{ display: 'block', marginBottom: '0.35rem' }}>{errors.lugar}</span>}
            <div className={styles.checkboxGroup} style={{ flexDirection: 'column', gap: '0.6rem' }}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox"
                  checked={form.lugar_realizacion.animalario_cicbiogune}
                  onChange={e => update('lugar_realizacion.animalario_cicbiogune', e.target.checked)} />
                Animalario CIC bioGUNE
              </label>
              <div>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox"
                    checked={form.lugar_realizacion.otro}
                    onChange={e => update('lugar_realizacion.otro', e.target.checked)} />
                  Otro
                </label>
                {form.lugar_realizacion.otro && (
                  <AutoExpandTextarea
                    storageKey="secA:lugar_realizacion.descripcion"
                    rows={4}
                    style={{ marginTop: '0.5rem' }}
                    value={form.lugar_realizacion.descripcion}
                    onChange={e => update('lugar_realizacion.descripcion', e.target.value)}
                    placeholder="Describir el lugar de realización"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── Bloque A.4: Resumen y objetivos ─────────────────────────────── */}
      <CollapsibleBlock
        title="A.4 · Resumen y objetivos"
        storageKey="secA:obj"
        requiredFields={[form.objetivos.objetivo_principal, form.objetivos.resumen]}
      >
        <div className="form-group">
          <label>Objetivo científico principal</label>
          <AutoExpandTextarea
            storageKey="secA:objetivos.objetivo_principal"
            rows={3}
            value={form.objetivos.objetivo_principal}
            onChange={e => update('objetivos.objetivo_principal', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Resumen</label>
          <AutoExpandTextarea
            storageKey="secA:objetivos.resumen"
            rows={5}
            value={form.objetivos.resumen}
            onChange={e => update('objetivos.resumen', e.target.value)}
          />
          <span className={`${styles.wordCount} ${wordCount(form.objetivos.resumen) > 300 ? styles.wordCountOver : ''}`}>
            {wordCount(form.objetivos.resumen)} palabras {wordCount(form.objetivos.resumen) > 300 ? '(supera las 300 recomendadas)' : '/ 300 recomendadas'}
          </span>
        </div>

        <div className="form-group">
          <label>Análisis daño/beneficio</label>
          <AutoExpandTextarea
            storageKey="secA:objetivos.dano_beneficio"
            rows={5}
            value={form.objetivos.dano_beneficio}
            onChange={e => update('objetivos.dano_beneficio', e.target.value)}
          />
          <span className={`${styles.wordCount} ${wordCount(form.objetivos.dano_beneficio) > 300 ? styles.wordCountOver : ''}`}>
            {wordCount(form.objetivos.dano_beneficio)} palabras {wordCount(form.objetivos.dano_beneficio) > 300 ? '(supera las 300 recomendadas)' : '/ 300 recomendadas'}
          </span>
        </div>

        <div className="form-group">
          <label>Tipo de proyecto según Art. 31 RD 53/2013</label>
          <div className={styles.radioGroup}>
            {['I', 'II', 'III'].map(t => (
              <label key={t} className={styles.radioLabel}>
                <input type="radio"
                  checked={form.tipo_proyecto === t}
                  onChange={() => update('tipo_proyecto', t)} />
                Tipo {t}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Finalidad del proyecto</label>
          <div className={styles.checkboxGroup}>
            {FINALIDADES.map(f => (
              <label key={f.value} className={styles.checkboxLabel}>
                <input type="checkbox"
                  checked={form.finalidad.includes(f.value)}
                  onChange={() => toggleFinalidad(f.value)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── Bloque A.5: 3Rs ─────────────────────────────────────────────── */}
      <CollapsibleBlock
        title="A.5 · Cumplimiento de las 3Rs"
        storageKey="secA:3rs"
        requiredFields={[form.tres_rs.reemplazo, form.tres_rs.reduccion, form.tres_rs.refinamiento]}
      >
        {[
          {
            key:   'reemplazo',
            label: 'Reemplazo',
            help:  '¿Por qué no es posible alcanzar los objetivos sin usar animales? ¿Qué alternativas ha considerado?',
          },
          {
            key:   'reduccion',
            label: 'Reducción',
            help:  '¿Qué medidas se han tomado para usar el menor número posible de animales?',
          },
          {
            key:   'refinamiento',
            label: 'Refinamiento',
            help:  'Explique su elección de especie(s), cepa(s) y método(s).',
          },
        ].map(({ key, label, help }) => (
          <div key={key} className="form-group">
            <label>{label}</label>
            <span className={styles.helpText}>{help}</span>
            <AutoExpandTextarea
              storageKey={`secA:tres_rs.${key}`}
              rows={4}
              value={form.tres_rs[key]}
              onChange={e => update(`tres_rs.${key}`, e.target.value)}
            />
          </div>
        ))}
      </CollapsibleBlock>

      {/* ── Bloque A.6: Procedimientos (solo lectura) + Cría ────────────── */}
      <CollapsibleBlock title="A.6 · Resumen de procedimientos" storageKey="secA:proc">
        {procedimientos.length === 0 ? (
          <p className={styles.emptyNote}>
            Aún no hay procedimientos. Podrás añadirlos desde el hub del proyecto.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Título</th>
                <th>Especie</th>
                <th>Nº animales</th>
                <th>Severidad</th>
              </tr>
            </thead>
            <tbody>
              {procedimientos.map((proc, i) => (
                <tr key={proc.id || i}>
                  <td>{i + 1}</td>
                  <td>{proc.titulo       ?? '—'}</td>
                  <td>{proc.especie      ?? '—'}</td>
                  <td>{proc.num_animales ?? '—'}</td>
                  <td>{proc.severidad    ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <label className={styles.checkboxLabel} style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            <input type="checkbox"
              checked={form.hay_cria}
              onChange={e => update('hay_cria', e.target.checked)} />
            ¿Contempla un procedimiento de cría de animales?
          </label>

          {form.hay_cria && (
            <div style={{ marginTop: '1rem' }}>
              {form.cepas_cria.length > 0 && (
                <div className={styles.cepaList}>
                  {form.cepas_cria.map((cepa, i) => (
                    <div key={i} className={styles.cepaRow}>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Nomenclatura internacional</label>
                        <AutocompleteInput
                          campo="cepa_linea"
                          value={cepa.nomenclatura_internacional}
                          onChange={v => updateCepa(i, 'nomenclatura_internacional', v)}
                          placeholder="Ej. C57BL/6J"
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Acrónimo</label>
                        <input type="text" value={cepa.acronimo}
                          onChange={e => updateCepa(i, 'acronimo', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Nº animales a generar</label>
                        <input type="number" min="0" value={cepa.num_animales}
                          onChange={e => updateCepa(i, 'num_animales', Number(e.target.value))} />
                      </div>
                      <button type="button" className={styles.removeBtn} onClick={() => removeCepa(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-ghost" onClick={addCepa}
                style={{ marginTop: '0.75rem' }}>
                ＋ Añadir cepa / línea
              </button>
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* ── Bloque A.7: Condiciones de alojamiento — checkboxes ─────────── */}
      <CollapsibleBlock title="A.7 · Condiciones de alojamiento" storageKey="secA:cond">
        <div className="form-group">
          <div className={styles.checkboxGroup} style={{ flexDirection: 'column', gap: '0.6rem' }}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox"
                checked={form.condiciones_alojamiento.estandar}
                onChange={e => update('condiciones_alojamiento.estandar', e.target.checked)} />
              Según condiciones estándar del CIC bioGUNE
            </label>
            <div>
              <label className={styles.checkboxLabel}>
                <input type="checkbox"
                  checked={form.condiciones_alojamiento.variaciones}
                  onChange={e => update('condiciones_alojamiento.variaciones', e.target.checked)} />
                Con las siguientes variaciones
              </label>
              {form.condiciones_alojamiento.variaciones && (
                <AutoExpandTextarea
                  storageKey="secA:condiciones_alojamiento.descripcion"
                  rows={4}
                  value={form.condiciones_alojamiento.descripcion}
                  onChange={e => update('condiciones_alojamiento.descripcion', e.target.value)}
                  placeholder="Describe las variaciones sobre las condiciones estándar…"
                />
              )}
            </div>
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── Bloque 9: Firma ──────────────────────────────────────────────── */}
      <CollapsibleBlock title="9 · Firma" storageKey="secA:firma">
        <div className="form-group" style={{ maxWidth: '380px' }}>
          <label>Nombre del firmante</label>
          <QuickFillInput
            value={form.firmante}
            onChange={v => update('firmante', v)}
            presets={['Joaquín Castilla', 'Jorge Moreno']}
            placeholder="Nombre y apellidos del firmante"
          />
        </div>
      </CollapsibleBlock>

      {/* ── Save actions ─────────────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost"
          disabled={saving} onClick={() => doSave(false)}>
          {saving ? 'Guardando…' : '💾 Guardar borrador'}
        </button>
        <button type="button" className="btn btn-primary"
          disabled={saving} onClick={() => doSave(true)}>
          {saving ? 'Guardando…' : 'Guardar y continuar →'}
        </button>
        {isEdit && (
          <ExportButton
            endpoint={`/api/animalario/proyectos/${proyectoId}/exportar/seccionA`}
            basename={`SeccionA_${proyectoId}`}
          />
        )}
      </div>
    </div>
  )
}
