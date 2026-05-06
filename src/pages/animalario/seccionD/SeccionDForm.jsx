import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import s from './SeccionDForm.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function clone(o) { return JSON.parse(JSON.stringify(o)) }

const EMPTY_BIOLOGICO = {
  nombre_cientifico:     '',
  descripcion:           '',
  grupo_riesgo:          '',
  lugar_manipulacion:    '',
  numero_procedimiento:  '',
}

const EMPTY_QUIMICO = {
  nombre:                    '',
  identificacion_riesgo:     '',
  condiciones_manipulacion:  '',
  numero_procedimiento:      '',
}

const EMPTY_D = { agentes_biologicos: [], agentes_quimicos: [], firmante: '' }

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

function AutocompleteInput({ campo, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow]               = useState(false)
  const wrapRef                       = useRef(null)

  useEffect(() => {
    fetch(`/api/animalario/repositorio/campo/${campo}`)
      .then(r => r.json())
      .then(data => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => {})
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

export default function SeccionDForm() {
  const { proyectoId } = useParams()
  const navigate       = useNavigate()

  const [form, setForm]         = useState(clone(EMPTY_D))
  const [proyecto, setProyecto] = useState(null)
  const [procs, setProcs]       = useState([])
  const [isNew, setIsNew]       = useState(true)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [toast, setToast]       = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/animalario/proyectos/${proyectoId}`).then(r => r.json()),
      fetch(`/api/animalario/proyectos/${proyectoId}/procedimientos`).then(r => r.json()),
      fetch(`/api/animalario/proyectos/${proyectoId}/productos`).then(r => r.json()),
    ])
      .then(([proy, ps, doc]) => {
        setProyecto(proy)
        setProcs(Array.isArray(ps) ? ps : [])
        if (doc?.seccionD) {
          setForm(doc.seccionD)
          setIsNew(!proy.seccionD_id)
        }
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [proyectoId])

  // Generic list ops factory
  function makeOps(key, emptyRow) {
    return {
      add:    ()        => setForm(p => { const n = clone(p); n[key].push(clone(emptyRow)); return n }),
      remove: i         => setForm(p => { const n = clone(p); n[key] = n[key].filter((_, j) => j !== i); return n }),
      upd:    (i, k, v) => setForm(p => { const n = clone(p); n[key][i][k] = v; return n }),
    }
  }

  const bioOps  = makeOps('agentes_biologicos', EMPTY_BIOLOGICO)
  const quimOps = makeOps('agentes_quimicos',   EMPTY_QUIMICO)

  async function saveToRepo(campo, valor) {
    if (!valor?.trim()) return
    await fetch(`/api/animalario/repositorio/campo/${campo}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ valor }),
    }).catch(() => {})
  }

  async function doSave(andContinue = false) {
    setSaving(true)
    setError(null)
    try {
      // Persist to repositorio
      for (const ag of form.agentes_biologicos) {
        await saveToRepo('agente_biologico', ag.nombre_cientifico)
      }
      for (const aq of form.agentes_quimicos) {
        await saveToRepo('agente_quimico', aq.nombre)
      }

      const method = isNew ? 'POST' : 'PUT'
      const r = await fetch(`/api/animalario/proyectos/${proyectoId}/productos`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ seccionD: form }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Error al guardar')

      setIsNew(false)
      setToast('Sección D guardada correctamente')
      if (andContinue) navigate(`/animalario/proyecto/${proyectoId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Build procedure options for the select
  const procOpciones = procs.map((proc, idx) => ({
    value: proc.id,
    label: `Proc. ${idx + 1}${proc.datos_generales?.titulo_procedimiento ? ' – ' + proc.datos_generales.titulo_procedimiento : ''}`,
  }))

  if (loading) return <p style={{ padding: '2rem', color: 'var(--muted-light)' }}>Cargando…</p>

  return (
    <div>
      <PageHeader
        back={`/animalario/proyecto/${proyectoId}`}
        backLabel="Proyecto"
        title="Sección D — Productos con riesgo"
        subtitle={proyecto?.seccionA?.titulo ?? ''}
      />

      {/* Info banner */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.75rem 1rem',
        background: 'rgba(37, 99, 235, 0.06)',
        border: '1px solid rgba(37, 99, 235, 0.25)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.82rem',
        color: '#1d4ed8',
        marginBottom: '1.5rem',
        lineHeight: 1.5,
      }}>
        ℹ Esta sección recoge los productos administrados que suponen un riesgo para la salud o el medio
        ambiente. Recuerda adjuntar la ficha de seguridad de cada producto químico al exportar el proyecto.
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Warning: no procedures yet */}
      {procs.length === 0 && (
        <div className={s.warning} style={{ marginBottom: '1rem' }}>
          Este proyecto no tiene procedimientos definidos. Define al menos un procedimiento en Sección B
          antes de completar esta sección.
        </div>
      )}

      {/* ── D.1 Agentes biológicos ──────────────────────────────── */}
      <CollapsibleBlock title="D.1 · Agentes biológicos">
        {form.agentes_biologicos.length === 0 && (
          <p className={s.emptyNote}>No se han declarado agentes biológicos.</p>
        )}

        {form.agentes_biologicos.length > 0 && (
          <div className={s.dynTable}>
            <div className={s.dynHeader}>
              <span style={{ flex: 2 }}>Nombre científico</span>
              <span style={{ flex: 2 }}>Descripción</span>
              <span style={{ flex: 1 }}>Grupo riesgo</span>
              <span style={{ flex: 2 }}>Lugar manipulación</span>
              <span style={{ flex: 2 }}>Procedimiento</span>
              <span style={{ width: 28, flexShrink: 0 }} />
            </div>
            {form.agentes_biologicos.map((ag, i) => (
              <div key={i} className={s.dynRow}>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <AutocompleteInput
                    campo="agente_biologico"
                    value={ag.nombre_cientifico}
                    onChange={v => bioOps.upd(i, 'nombre_cientifico', v)}
                    placeholder="Nombre científico"
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <input
                    value={ag.descripcion}
                    placeholder="Descripción breve"
                    onChange={e => bioOps.upd(i, 'descripcion', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 1 }}>
                  <select
                    value={ag.grupo_riesgo}
                    onChange={e => bioOps.upd(i, 'grupo_riesgo', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">—</option>
                    {['1', '2', '3', '4'].map(g => (
                      <option key={g} value={g}>Grupo {g}</option>
                    ))}
                  </select>
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <input
                    value={ag.lugar_manipulacion}
                    placeholder="Zona del animalario"
                    onChange={e => bioOps.upd(i, 'lugar_manipulacion', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <select
                    value={ag.numero_procedimiento}
                    onChange={e => bioOps.upd(i, 'numero_procedimiento', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">— Procedimiento</option>
                    {procOpciones.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <button type="button" className={s.removeBtn} onClick={() => bioOps.remove(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className={s.addRowBtn} onClick={bioOps.add}>
          ＋ Añadir agente biológico
        </button>
        <p className={s.helpText} style={{ marginTop: '0.5rem' }}>
          Especifique la zona del animalario del CIC bioGUNE donde se llevará a cabo la manipulación
        </p>
      </CollapsibleBlock>

      {/* ── D.2 Agentes químicos ────────────────────────────────── */}
      <CollapsibleBlock title="D.2 · Agentes químicos">
        {form.agentes_quimicos.length === 0 && (
          <p className={s.emptyNote}>No se han declarado agentes químicos.</p>
        )}

        {form.agentes_quimicos.length > 0 && (
          <div className={s.dynTable}>
            <div className={s.dynHeader}>
              <span style={{ flex: 2 }}>Nombre del producto</span>
              <span style={{ flex: 2 }}>Identificación del riesgo</span>
              <span style={{ flex: 2 }}>Condiciones de manipulación</span>
              <span style={{ flex: 2 }}>Procedimiento</span>
              <span style={{ width: 28, flexShrink: 0 }} />
            </div>
            {form.agentes_quimicos.map((aq, i) => (
              <div key={i} className={s.dynRow}>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <AutocompleteInput
                    campo="agente_quimico"
                    value={aq.nombre}
                    onChange={v => quimOps.upd(i, 'nombre', v)}
                    placeholder="Nombre del producto"
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <input
                    value={aq.identificacion_riesgo}
                    placeholder="Según ficha de seguridad"
                    onChange={e => quimOps.upd(i, 'identificacion_riesgo', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <input
                    value={aq.condiciones_manipulacion}
                    placeholder="Condiciones especiales"
                    onChange={e => quimOps.upd(i, 'condiciones_manipulacion', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className={s.dynCell} style={{ flex: 2 }}>
                  <select
                    value={aq.numero_procedimiento}
                    onChange={e => quimOps.upd(i, 'numero_procedimiento', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">— Procedimiento</option>
                    {procOpciones.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <button type="button" className={s.removeBtn} onClick={() => quimOps.remove(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        <button type="button" className={s.addRowBtn} onClick={quimOps.add}>
          ＋ Añadir agente químico
        </button>
        <p className={s.helpText} style={{ marginTop: '0.5rem' }}>
          Según ficha de seguridad del producto
        </p>
      </CollapsibleBlock>

      {/* ── Firma ──────────────────────────────────────────────── */}
      <CollapsibleBlock title="Firma del responsable" defaultOpen={false}>
        <div className={s.grid2}>
          <div className="form-group">
            <label>Nombre y apellidos</label>
            <input
              className="form-group input"
              value={form.firmante}
              onChange={e => setForm(p => ({ ...p, firmante: e.target.value }))}
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
          disabled={saving}
          onClick={() => doSave(false)}
        >
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => doSave(true)}
        >
          {saving ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
