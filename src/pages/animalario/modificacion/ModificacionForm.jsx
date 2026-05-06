import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import s from './ModificacionForm.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const FUNCIONES_ECC = [
  { value: '',  label: '— Seleccionar función' },
  { value: 'A', label: 'A. Cuidado de los animales' },
  { value: 'B', label: 'B. Eutanasia' },
  { value: 'C', label: 'C. Realización de procedimientos' },
  { value: 'D', label: 'D. Diseño de proyectos y procedimientos' },
  { value: 'E', label: 'E. Responsabilidad supervisión in situ' },
  { value: 'F', label: 'F. Veterinario Designado' },
]

const TIPOS_CAMBIO_CONFIG = [
  { key: 'alta_baja_investigadores', label: 'Alta/Baja de investigadores' },
  { key: 'adicion_animales',         label: 'Adición de animales' },
  { key: 'adicion_procedimientos',   label: 'Adición de procedimientos' },
  { key: 'cambios_procedimientos',   label: 'Cambios en procedimientos originales' },
  { key: 'adicion_linea_animal',     label: 'Adición de línea de animales nueva' },
  { key: 'adicion_lugar',            label: 'Adición de un lugar de realización del proyecto' },
  { key: 'cambio_alojamiento',       label: 'Cambio en condiciones de alojamiento, zootécnicas y de cuidado de animales' },
]

const SEVERITY_ORDER = { none: 0, low: 1, medium: 2, high: 3 }

const EMPTY_INVESTIGADOR = { nombre_apellidos: '', funcion: '', nif_pasaporte: '' }
const EMPTY_CAMBIO_PROC  = { numero_procedimiento: '', descripcion_cambio: '' }
const EMPTY_LINEA        = { nomenclatura_internacional: '', acronimo: '', hay_cria: false }

function clone(o) { return JSON.parse(JSON.stringify(o)) }

function buildEmptyMod(proyecto, numeroMod) {
  return {
    identificacion: {
      titulo_proyecto:            proyecto?.seccionA?.titulo        ?? '',
      referencia_cbba:            proyecto?.seccionA?.referencia_cbba ?? '',
      numero_modificacion:        numeroMod,
      fecha_aprobacion_proyecto:  '',
    },
    tipos_cambio: {
      alta_baja_investigadores: false,
      adicion_animales:         false,
      adicion_procedimientos:   false,
      cambios_procedimientos:   false,
      adicion_linea_animal:     false,
      adicion_lugar:            false,
      cambio_alojamiento:       false,
    },
    investigadores: { altas: [], bajas: [] },
    adicion_animales: {
      num_original_aprobados:               '',
      num_aprobados_otras_modificaciones:   '',
      num_aumentar_esta_modificacion:       '',
      porcentaje_incremento_total:          0,
    },
    procedimientos_nuevos:             [],
    cambios_procedimientos_existentes: [],
    lineas_animales_nuevas:            [],
    lugar_nuevo:                       '',
    cambio_alojamiento_descripcion:    '',
    justificacion_general:             '',
    firmante:                          '',
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CollapsibleBlock({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={s.block}>
      <button type="button" className={s.blockHeader} onClick={() => setOpen(o => !o)}>
        {title}
        <span className={s.chevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {open && <div className={s.blockBody}>{children}</div>}
    </div>
  )
}

function AutocompleteInput({ campo, value, onChange, placeholder, initialSuggestions = [] }) {
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow]               = useState(false)
  const wrapRef                       = useRef(null)

  useEffect(() => {
    fetch(`/api/animalario/repositorio/campo/${campo}`)
      .then(r => r.json())
      .then(data => {
        const merged = [...new Set([...initialSuggestions, ...(Array.isArray(data) ? data : [])])]
        setSuggestions(merged)
      })
      .catch(() => setSuggestions(initialSuggestions))
  }, [campo])

  useEffect(() => {
    function onOut(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const filtered = suggestions.filter(sg => sg.toLowerCase().includes((value || '').toLowerCase()))

  return (
    <div className={s.acWrap} ref={wrapRef}>
      <input
        className="form-group input"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setShow(true) }}
        onFocus={() => setShow(true)}
        style={{ width: '100%' }}
      />
      {show && filtered.length > 0 && (
        <ul className={s.suggestions}>
          {filtered.map(sg => (
            <li key={sg} className={s.suggestion} onMouseDown={() => { onChange(sg); setShow(false) }}>
              {sg}
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
  return <div className={s.toast}>{message}</div>
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function ModificacionForm() {
  const { proyectoId, mId } = useParams()
  const navigate            = useNavigate()
  const isEdit              = Boolean(mId)

  const [form, setForm]         = useState(null)
  const [proyecto, setProyecto] = useState(null)
  const [procs, setProcs]       = useState([])
  const [worstSeverity, setWorstSeverity] = useState('none')
  const [numeroMod, setNumeroMod] = useState(1)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [toast, setToast]       = useState(null)

  useEffect(() => {
    const fetches = [
      fetch(`/api/animalario/proyectos/${proyectoId}`).then(r => r.json()),
      fetch(`/api/animalario/proyectos/${proyectoId}/procedimientos`).then(r => r.json()),
    ]
    if (isEdit) fetches.push(fetch(`/api/animalario/modificaciones/${mId}`).then(r => r.json()))

    Promise.all(fetches)
      .then(([proy, ps, existing]) => {
        setProyecto(proy)
        const procsList = Array.isArray(ps) ? ps : []
        setProcs(procsList)

        // Compute worst severity across all procedures
        const worst = procsList.reduce((best, p) => {
          const sv = p.clasificacion_severidad ?? 'none'
          return (SEVERITY_ORDER[sv] ?? 0) > (SEVERITY_ORDER[best] ?? 0) ? sv : best
        }, 'none')
        setWorstSeverity(worst)

        if (existing) {
          setForm(existing.modificacion)
          setNumeroMod(existing.numero_modificacion)
        } else {
          const mods  = Array.isArray(proy.modificaciones) ? proy.modificaciones : []
          const maxN  = mods.reduce((m, r) => Math.max(m, r.numero_modificacion ?? 0), 0)
          const nextN = maxN + 1
          setNumeroMod(nextN)
          setForm(buildEmptyMod(proy, nextN))
        }
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [proyectoId, mId])

  // Generic nested state updater
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

  function toggleTipo(key) {
    setForm(prev => ({
      ...prev,
      tipos_cambio: { ...prev.tipos_cambio, [key]: !prev.tipos_cambio[key] },
    }))
  }

  // Investigadores ops
  function addInvestigador(subtipo) {
    setForm(p => { const n = clone(p); n.investigadores[subtipo].push(clone(EMPTY_INVESTIGADOR)); return n })
  }
  function removeInvestigador(subtipo, i) {
    setForm(p => { const n = clone(p); n.investigadores[subtipo] = n.investigadores[subtipo].filter((_, j) => j !== i); return n })
  }
  function updInvestigador(subtipo, i, k, v) {
    setForm(p => { const n = clone(p); n.investigadores[subtipo][i][k] = v; return n })
  }

  // Cambios en procedimientos existentes ops
  function addCambioProc() {
    setForm(p => { const n = clone(p); n.cambios_procedimientos_existentes.push(clone(EMPTY_CAMBIO_PROC)); return n })
  }
  function removeCambioProc(i) {
    setForm(p => { const n = clone(p); n.cambios_procedimientos_existentes = n.cambios_procedimientos_existentes.filter((_, j) => j !== i); return n })
  }
  function updCambioProc(i, k, v) {
    setForm(p => { const n = clone(p); n.cambios_procedimientos_existentes[i][k] = v; return n })
  }

  // Líneas nuevas ops
  function addLinea() {
    setForm(p => { const n = clone(p); n.lineas_animales_nuevas.push(clone(EMPTY_LINEA)); return n })
  }
  function removeLinea(i) {
    setForm(p => { const n = clone(p); n.lineas_animales_nuevas = n.lineas_animales_nuevas.filter((_, j) => j !== i); return n })
  }
  function updLinea(i, k, v) {
    setForm(p => { const n = clone(p); n.lineas_animales_nuevas[i][k] = v; return n })
  }

  // Porcentaje de incremento — computed from form fields
  const origNum    = parseFloat(form?.adicion_animales?.num_original_aprobados)   || 0
  const otrasNum   = parseFloat(form?.adicion_animales?.num_aprobados_otras_modificaciones) || 0
  const aumentarNum = parseFloat(form?.adicion_animales?.num_aumentar_esta_modificacion) || 0
  const base       = origNum + otrasNum
  const pct        = base > 0 ? Math.round((aumentarNum / base) * 10000) / 100 : 0

  // Percentage limits by severity
  const pctLimit   = worstSeverity === 'medium' ? 10 : worstSeverity === 'low' ? 25 : null
  const pctBlocked = pctLimit != null && pct > pctLimit && form?.tipos_cambio?.adicion_animales

  async function doSave(andContinue = false) {
    if (pctBlocked) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        modificacion: { ...form, adicion_animales: { ...form.adicion_animales, porcentaje_incremento_total: pct } },
      }

      let saved
      if (isEdit) {
        const r = await fetch(`/api/animalario/modificaciones/${mId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error al guardar')
        saved = await r.json()
      } else {
        const r = await fetch(`/api/animalario/proyectos/${proyectoId}/modificaciones`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error al crear')
        saved = await r.json()
      }

      setToast('Modificación guardada correctamente')
      if (andContinue) {
        navigate(`/animalario/proyecto/${proyectoId}`)
      } else if (!isEdit) {
        navigate(`/animalario/proyecto/${proyectoId}/modificacion/${saved.id}`, { replace: true })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Participants dropdown for "bajas"
  const participantes = proyecto?.seccionA?.participantes ?? []

  // Proc options for dropdowns
  const procOpciones = procs.map((p, idx) => ({
    value: p.id,
    label: `Proc. ${idx + 1}${p.datos_generales?.titulo_procedimiento ? ' – ' + p.datos_generales.titulo_procedimiento : ''}`,
  }))

  if (loading || !form) return <p style={{ padding: '2rem', color: 'var(--muted-light)' }}>Cargando…</p>

  const tc = form.tipos_cambio

  return (
    <div>
      <PageHeader
        back={`/animalario/proyecto/${proyectoId}`}
        backLabel="Proyecto"
        title={isEdit ? `Modificación ${numeroMod}` : 'Nueva modificación'}
        subtitle={proyecto?.seccionA?.titulo ?? ''}
      />

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── Cabecera: datos del proyecto y establecimiento ──────── */}
      <CollapsibleBlock title="Datos del proyecto y del establecimiento">
        <div className={s.grid2}>
          <div className={`form-group ${s.fullRow}`}>
            <label>Título del proyecto</label>
            <input
              className="form-group input"
              value={form.identificacion.titulo_proyecto}
              readOnly
              style={{ background: 'var(--bg)', color: 'var(--muted)' }}
            />
          </div>
          <div className="form-group">
            <label>Referencia CBBA</label>
            <input
              className="form-group input"
              value={form.identificacion.referencia_cbba}
              readOnly
              style={{ background: 'var(--bg)', color: 'var(--muted)' }}
            />
          </div>
          <div className="form-group">
            <label>Nº de modificación</label>
            <input
              className="form-group input"
              value={numeroMod}
              readOnly
              style={{ background: 'var(--bg)', color: 'var(--muted)' }}
            />
          </div>
          <div className="form-group">
            <label>Fecha de aprobación del proyecto</label>
            <input
              type="date"
              className="form-group input"
              value={form.identificacion.fecha_aprobacion_proyecto}
              onChange={e => update('identificacion.fecha_aprobacion_proyecto', e.target.value)}
            />
          </div>
        </div>

        {/* Datos del establecimiento — solo lectura */}
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: 'var(--text)' }}>Establecimiento usuario:</strong>{' '}
          CIC bioGUNE · ES489010006106 · 4/3/2011<br />
          <strong style={{ color: 'var(--text)' }}>Responsable EU:</strong> Juan Anguita Castillo<br />
          <strong style={{ color: 'var(--text)' }}>Responsable bienestar animal:</strong> Juan Rodríguez Cuesta<br />
          <strong style={{ color: 'var(--text)' }}>Veterinario designado:</strong> Juan Rodríguez Cuesta
        </div>
      </CollapsibleBlock>

      {/* ── Selección de tipos de cambio ─────────────────────────── */}
      <CollapsibleBlock title="Selecciona los cambios que deseas introducir">
        <div className={s.checkboxGroupCol}>
          {TIPOS_CAMBIO_CONFIG.map(({ key, label }) => (
            <label key={key} className={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={tc[key] === true}
                onChange={() => toggleTipo(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </CollapsibleBlock>

      {/* ════════════════════════════════════════════════
          BLOQUES CONDICIONALES
          ════════════════════════════════════════════════ */}

      {/* Bloque 1: Investigadores */}
      {tc.alta_baja_investigadores && (
        <CollapsibleBlock title="1 · Alta/Baja de investigadores">

          {/* Altas */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.5rem' }}>
              Altas
            </div>
            {form.investigadores.altas.length === 0 && (
              <p className={s.emptyNote}>No se han añadido investigadores.</p>
            )}
            {form.investigadores.altas.map((inv, i) => (
              <div key={i} className={s.dynRow} style={{ marginBottom: '0.4rem' }}>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <input
                    value={inv.nombre_apellidos}
                    placeholder="Nombre y apellidos"
                    onChange={e => updInvestigador('altas', i, 'nombre_apellidos', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <select
                    value={inv.funcion}
                    onChange={e => updInvestigador('altas', i, 'funcion', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {FUNCIONES_ECC.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className={s.dynCell} style={{ flex: 1 }}>
                  <input
                    value={inv.nif_pasaporte}
                    placeholder="NIF / Pasaporte"
                    onChange={e => updInvestigador('altas', i, 'nif_pasaporte', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <button type="button" className={s.removeBtn} onClick={() => removeInvestigador('altas', i)}>×</button>
              </div>
            ))}
            <button type="button" className={s.addRowBtn} onClick={() => addInvestigador('altas')}>
              ＋ Añadir investigador
            </button>
          </div>

          {/* Bajas */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.5rem' }}>
              Bajas
            </div>
            {form.investigadores.bajas.length === 0 && (
              <p className={s.emptyNote}>No se han añadido bajas.</p>
            )}
            {form.investigadores.bajas.map((inv, i) => (
              <div key={i} className={s.dynRow} style={{ marginBottom: '0.4rem' }}>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  {participantes.length > 0 ? (
                    <select
                      value={inv.nombre_apellidos}
                      onChange={e => updInvestigador('bajas', i, 'nombre_apellidos', e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">— Participante</option>
                      {participantes.map((p, pi) => (
                        <option key={pi} value={p.nombre_apellidos}>{p.nombre_apellidos}</option>
                      ))}
                      <option value="__otro__">Otro…</option>
                    </select>
                  ) : (
                    <input
                      value={inv.nombre_apellidos}
                      placeholder="Nombre y apellidos"
                      onChange={e => updInvestigador('bajas', i, 'nombre_apellidos', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  )}
                  {inv.nombre_apellidos === '__otro__' && (
                    <input
                      value={inv._nombre_libre ?? ''}
                      placeholder="Nombre y apellidos"
                      onChange={e => updInvestigador('bajas', i, '_nombre_libre', e.target.value)}
                      style={{ width: '100%', marginTop: '0.3rem' }}
                    />
                  )}
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <select
                    value={inv.funcion}
                    onChange={e => updInvestigador('bajas', i, 'funcion', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {FUNCIONES_ECC.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className={s.dynCell} style={{ flex: 1 }}>
                  <input
                    value={inv.nif_pasaporte}
                    placeholder="NIF / Pasaporte"
                    onChange={e => updInvestigador('bajas', i, 'nif_pasaporte', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <button type="button" className={s.removeBtn} onClick={() => removeInvestigador('bajas', i)}>×</button>
              </div>
            ))}
            <button type="button" className={s.addRowBtn} onClick={() => addInvestigador('bajas')}>
              ＋ Añadir investigador a dar de baja
            </button>
          </div>
        </CollapsibleBlock>
      )}

      {/* Bloque 2: Adición de animales */}
      {tc.adicion_animales && (
        <CollapsibleBlock title="2 · Adición de animales">
          <div className={s.grid2}>
            <div className="form-group">
              <label>Número original de animales aprobados</label>
              <input
                type="number"
                className="form-group input"
                value={form.adicion_animales.num_original_aprobados}
                onChange={e => update('adicion_animales.num_original_aprobados', e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Animales aprobados en otras modificaciones</label>
              <input
                type="number"
                className="form-group input"
                value={form.adicion_animales.num_aprobados_otras_modificaciones}
                onChange={e => update('adicion_animales.num_aprobados_otras_modificaciones', e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Animales a aumentar en esta modificación</label>
              <input
                type="number"
                className="form-group input"
                value={form.adicion_animales.num_aumentar_esta_modificacion}
                onChange={e => update('adicion_animales.num_aumentar_esta_modificacion', e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Porcentaje de incremento total (calculado)</label>
              <input
                className="form-group input"
                value={`${pct} %`}
                readOnly
                style={{ background: 'var(--bg)', color: pctBlocked ? '#dc2626' : 'var(--text)', fontWeight: 700 }}
              />
            </div>
          </div>

          {pctBlocked && (
            <div className={s.error} style={{ padding: '0.5rem 0.75rem', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '4px', marginTop: '0.25rem' }}>
              ⛔ El incremento supera el {pctLimit}% permitido para proyectos de severidad{' '}
              {worstSeverity === 'medium' ? 'moderada' : 'leve'}. Necesitas un proyecto nuevo.
              No se puede guardar esta modificación.
            </div>
          )}

          <p className={s.helpText} style={{ marginTop: '0.5rem' }}>
            Si el incremento supera el 25% (severidad leve) o el 10% (severidad moderada), se requiere un
            proyecto nuevo en lugar de una modificación.
          </p>
        </CollapsibleBlock>
      )}

      {/* Bloque 3: Adición de procedimientos */}
      {tc.adicion_procedimientos && (
        <CollapsibleBlock title="3 · Adición de procedimientos">
          <div
            style={{
              padding: '0.55rem 0.9rem',
              background: 'rgba(37,99,235,0.06)',
              border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: '#1d4ed8',
              marginBottom: '0.75rem',
            }}
          >
            ℹ Cada nuevo procedimiento requiere un formulario Sección B independiente.
          </div>

          {(form.procedimientos_nuevos ?? []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {form.procedimientos_nuevos.map((procId, idx) => {
                const proc = procs.find(p => p.id === procId)
                const titulo = proc?.datos_generales?.titulo_procedimiento || `Procedimiento ${idx + 1}`
                return (
                  <div key={procId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text)' }}>
                      <strong>Proc. nuevo {idx + 1}:</strong> {titulo}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(`/animalario/proyecto/${proyectoId}/procedimientos/${procId}`)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setForm(p => { const n = clone(p); n.procedimientos_nuevos = n.procedimientos_nuevos.filter(id => id !== procId); return n })}
                      style={{ color: 'var(--accent)' }}
                    >
                      Quitar
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {isEdit ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(`/animalario/proyecto/${proyectoId}/procedimientos/nuevo?modificacion_id=${mId}`)}
            >
              ＋ Crear nuevo procedimiento (Sección B)
            </button>
          ) : (
            <p className={s.helpText}>
              Guarda primero la modificación para poder añadir procedimientos nuevos vinculados a ella.
            </p>
          )}
        </CollapsibleBlock>
      )}

      {/* Bloque 4: Cambios en procedimientos originales */}
      {tc.cambios_procedimientos && (
        <CollapsibleBlock title="4 · Cambios en procedimientos originales">
          <div
            style={{
              padding: '0.55rem 0.9rem',
              background: 'rgba(37,99,235,0.06)',
              border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: '#1d4ed8',
              marginBottom: '0.75rem',
            }}
          >
            ℹ Si la severidad de los procedimientos a añadir es superior a la del proyecto original, necesitas
            un proyecto nuevo.
          </div>

          {form.cambios_procedimientos_existentes.length === 0 && (
            <p className={s.emptyNote}>No se han añadido cambios.</p>
          )}

          {form.cambios_procedimientos_existentes.length > 0 && (
            <div className={s.dynTable}>
              <div className={s.dynHeader}>
                <span style={{ flex: 2 }}>Procedimiento</span>
                <span style={{ flex: 3 }}>Descripción del cambio</span>
                <span style={{ width: 28, flexShrink: 0 }} />
              </div>
              {form.cambios_procedimientos_existentes.map((c, i) => (
                <div key={i} className={s.dynRow}>
                  <div className={s.dynCell} style={{ flex: 2 }}>
                    <select
                      value={c.numero_procedimiento}
                      onChange={e => updCambioProc(i, 'numero_procedimiento', e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">— Procedimiento</option>
                      {procOpciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className={s.dynCell} style={{ flex: 3 }}>
                    <input
                      value={c.descripcion_cambio}
                      placeholder="Describir el cambio"
                      onChange={e => updCambioProc(i, 'descripcion_cambio', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <button type="button" className={s.removeBtn} onClick={() => removeCambioProc(i)}>×</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className={s.addRowBtn} onClick={addCambioProc} style={{ marginTop: '0.5rem' }}>
            ＋ Añadir cambio
          </button>
        </CollapsibleBlock>
      )}

      {/* Bloque 5: Adición de línea de animales nueva */}
      {tc.adicion_linea_animal && (
        <CollapsibleBlock title="5 · Adición de línea de animales nueva">
          {form.lineas_animales_nuevas.length === 0 && (
            <p className={s.emptyNote}>No se han añadido líneas.</p>
          )}

          {form.lineas_animales_nuevas.map((linea, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', padding: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label style={{ fontSize: '0.75rem' }}>Nomenclatura internacional</label>
                <AutocompleteInput
                  campo="cepa_linea"
                  value={linea.nomenclatura_internacional}
                  onChange={v => updLinea(i, 'nomenclatura_internacional', v)}
                  placeholder="Ej. C57BL/6JRj"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem' }}>Acrónimo</label>
                <input
                  className="form-group input"
                  value={linea.acronimo}
                  onChange={e => updLinea(i, 'acronimo', e.target.value)}
                  placeholder="Ej. B6"
                />
              </div>
              <div className="form-group" style={{ flexShrink: 0 }}>
                <label className={s.checkboxLabel} style={{ marginBottom: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={linea.hay_cria === true}
                    onChange={e => updLinea(i, 'hay_cria', e.target.checked)}
                  />
                  Contempla cría
                </label>
                {linea.hay_cria && (
                  <p className={s.helpText} style={{ marginTop: 0, fontSize: '0.72rem' }}>
                    Deberás completar un formulario Sección C desde el hub del proyecto.
                  </p>
                )}
              </div>
              <button type="button" className={s.removeBtn} onClick={() => removeLinea(i)} style={{ marginBottom: 1 }}>×</button>
            </div>
          ))}
          <button type="button" className={s.addRowBtn} onClick={addLinea}>
            ＋ Añadir línea
          </button>
        </CollapsibleBlock>
      )}

      {/* Bloque 6: Adición de lugar */}
      {tc.adicion_lugar && (
        <CollapsibleBlock title="6 · Adición de lugar de realización">
          <div className="form-group">
            <label>Descripción del nuevo lugar</label>
            <textarea
              className="form-group input"
              rows={3}
              value={form.lugar_nuevo}
              onChange={e => update('lugar_nuevo', e.target.value)}
              placeholder="Indicar el nuevo lugar de realización del proyecto y su justificación"
            />
          </div>
        </CollapsibleBlock>
      )}

      {/* Bloque 7: Cambio en alojamiento */}
      {tc.cambio_alojamiento && (
        <CollapsibleBlock title="7 · Cambio en condiciones de alojamiento">
          <div className="form-group">
            <label>Descripción de los cambios</label>
            <textarea
              className="form-group input"
              rows={4}
              value={form.cambio_alojamiento_descripcion}
              onChange={e => update('cambio_alojamiento_descripcion', e.target.value)}
              placeholder="Describir los cambios en condiciones de alojamiento, zootécnicas y de cuidado de los animales"
            />
          </div>
        </CollapsibleBlock>
      )}

      {/* ── Justificación general (siempre visible) ──────────────── */}
      <CollapsibleBlock title="Justificación general de la modificación">
        <div className="form-group">
          <textarea
            className="form-group input"
            rows={6}
            value={form.justificacion_general}
            onChange={e => update('justificacion_general', e.target.value)}
            placeholder={
              'Describa los cambios que desea introducir:\n' +
              '· ¿Qué se va a realizar? (nuevo procedimiento, técnica...)\n' +
              '· ¿Cuándo? (cronología)\n' +
              '· ¿Cómo? (nueva estrategia experimental, nuevos grupos...)\n' +
              '· ¿Quién? (si se incorpora nuevo personal)\n' +
              'Adjunte información complementaria al exportar (certificados, esquemas, fichas de seguridad, etc.)'
            }
          />
        </div>
      </CollapsibleBlock>

      {/* ── Firma ──────────────────────────────────────────────────── */}
      <CollapsibleBlock title="Firma del responsable" defaultOpen={false}>
        <div className={s.grid2}>
          <div className="form-group">
            <label>Nombre y apellidos</label>
            <input
              className="form-group input"
              value={form.firmante}
              onChange={e => update('firmante', e.target.value)}
              placeholder="Responsable del proyecto"
            />
          </div>
        </div>
      </CollapsibleBlock>

      {/* Actions */}
      <div className={s.actions}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/animalario/proyecto/${proyectoId}`)}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={saving || pctBlocked}
          onClick={() => doSave(false)}
        >
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || pctBlocked}
          onClick={() => doSave(true)}
        >
          {saving ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
