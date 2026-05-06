import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import s from './SeccionBForm.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function clone(o) { return JSON.parse(JSON.stringify(o)) }

const BASE_ESPECIES = ['Mus musculus', 'Rattus norvegicus', 'Oryctolagus cuniculus', 'Sus scrofa', 'Gallus gallus']

const EMPTY_FORM = {
  datos_generales: {
    titulo_procedimiento: '',
    especies: [],
    cepa_linea: '',
    sexo: '',
    edad_peso: '',
    num_animales: '',
    origen: '',
    aclimatacion: '',
    identificacion: '',
    condiciones_especiales: '',
  },
  metodologia: {
    descripcion: '',
    justificacion_procedimiento: '',
  },
  tamano_muestral: {
    metodo: '',
    justificacion: '',
    grupos: [],
  },
  aislamiento_ayuno: {
    hay_aislamiento: '',
    duracion_aislamiento: '',
    hay_ayuno: '',
    duracion_ayuno: '',
    justificacion: '',
  },
  tecnicas: [],
  analgesia_anestesia: {
    hay_analgesia: '',
    protocolo_analgesia: '',
    hay_anestesia: '',
    protocolo_anestesia: '',
    monitorizacion: '',
    recuperacion: '',
  },
  otras_sustancias: {
    hay_riesgo: false,
    sustancias: [],
  },
  parametros: [],
  muestras_antemortem: [],
  finalizacion: {
    criterios_humanos: '',
    metodos_eutanasia: [],
    justificacion_eutanasia: '',
    destino_carcasas: '',
  },
  reutilizacion: {
    hay_reutilizacion: '',
    descripcion: '',
    justificacion: '',
  },
  clasificacion_severidad: 'none',
  firma: {
    nombre: '',
    fecha: '',
    observaciones: '',
  },
}

const EMPTY_GRUPO     = { nombre: '', n: '', justificacion: '' }
const EMPTY_TECNICA   = { nombre: '', frecuencia: '', via: '', volumen: '', duracion: '', observaciones: '' }
const EMPTY_SUSTANCIA = { nombre: '', tipo: '', cantidad: '', via: '', frecuencia: '', riesgo_desc: '' }
const EMPTY_PARAMETRO = { parametro: '', metodo_medida: '', frecuencia: '', unidad: '', n_por_grupo: '' }
const EMPTY_MUESTRA   = { tipo: '', volumen_cantidad: '', frecuencia: '', procedimiento: '' }

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
  const [show, setShow] = useState(false)
  const wrapRef = useRef(null)

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
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = suggestions.filter(s => s.toLowerCase().includes((value || '').toLowerCase()))

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

function DynTable({ columns, rows, onUpdate, onRemove, onAdd, addLabel = '＋ Añadir fila' }) {
  return (
    <div>
      <div className={s.dynTable}>
        <div className={s.dynHeader}>
          {columns.map(col => (
            <span key={col.key} style={{ flex: col.flex ?? 1 }}>{col.label}</span>
          ))}
          <span style={{ width: 28, flexShrink: 0 }} />
        </div>
        {rows.map((row, i) => (
          <div key={i} className={s.dynRow}>
            {columns.map(col => (
              <div key={col.key} className={s.dynCell} style={{ flex: col.flex ?? 1 }}>
                {col.tipo === 'select' ? (
                  <select
                    value={row[col.key] ?? ''}
                    onChange={e => onUpdate(i, col.key, e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">—</option>
                    {(col.opciones ?? []).map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : col.tipo === 'autocomplete' ? (
                  <AutocompleteInput
                    campo={col.campo}
                    value={row[col.key] ?? ''}
                    onChange={v => onUpdate(i, col.key, v)}
                    placeholder={col.ph ?? ''}
                    initialSuggestions={col.initialSuggestions ?? []}
                  />
                ) : (
                  <input
                    type={col.tipo ?? 'text'}
                    value={row[col.key] ?? ''}
                    placeholder={col.ph ?? ''}
                    onChange={e => onUpdate(i, col.key, e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            ))}
            <button type="button" className={s.removeBtn} onClick={() => onRemove(i)} title="Eliminar fila">×</button>
          </div>
        ))}
      </div>
      <button type="button" className={s.addRowBtn} onClick={onAdd}>{addLabel}</button>
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

export default function SeccionBForm() {
  const { proyectoId, procId } = useParams()
  const navigate = useNavigate()
  const isEdit   = Boolean(procId)

  const [form, setForm]       = useState(clone(EMPTY_FORM))
  const [proyecto, setProyecto] = useState(null)
  const [especies, setEspecies] = useState([...BASE_ESPECIES])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [toast, setToast]     = useState(null)

  // Load species from repositorio and existing procedure if editing
  useEffect(() => {
    const fetches = [
      fetch(`/api/animalario/proyectos/${proyectoId}`).then(r => r.json()),
      fetch('/api/animalario/repositorio/campo/especie').then(r => r.json()),
    ]
    if (isEdit) fetches.push(fetch(`/api/animalario/procedimientos/${procId}`).then(r => r.json()))

    Promise.all(fetches)
      .then(([proy, especiesRepo, existing]) => {
        setProyecto(proy)
        const merged = [...new Set([...BASE_ESPECIES, ...(Array.isArray(especiesRepo) ? especiesRepo : [])])]
        setEspecies(merged)
        if (existing) setForm(existing)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [proyectoId, procId])

  // Generic nested updater
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

  // Array ops factory
  function makeOps(key, emptyRow) {
    return {
      add:    ()          => setForm(p => { const n = clone(p); n[key] = [...(n[key]||[]), clone(emptyRow)]; return n }),
      remove: (i)         => setForm(p => { const n = clone(p); n[key] = n[key].filter((_, j) => j !== i);  return n }),
      upd:    (i, k, v)   => setForm(p => { const n = clone(p); n[key][i][k] = v; return n }),
    }
  }

  const tecnicaOps    = makeOps('tecnicas',           EMPTY_TECNICA)
  const sustanciaOps  = makeOps('otras_sustancias.sustancias', null) // handled manually
  const parametroOps  = makeOps('parametros',          EMPTY_PARAMETRO)
  const muestraOps    = makeOps('muestras_antemortem', EMPTY_MUESTRA)
  const grupoOps      = makeOps('tamano_muestral.grupos', EMPTY_GRUPO)

  // otras_sustancias.sustancias needs special ops since it's nested
  function addSustancia()       { setForm(p => { const n = clone(p); n.otras_sustancias.sustancias.push(clone(EMPTY_SUSTANCIA)); return n }) }
  function removeSustancia(i)   { setForm(p => { const n = clone(p); n.otras_sustancias.sustancias = n.otras_sustancias.sustancias.filter((_,j)=>j!==i); return n }) }
  function updSustancia(i,k,v)  { setForm(p => { const n = clone(p); n.otras_sustancias.sustancias[i][k] = v; return n }) }

  // tamano_muestral.grupos ops
  function addGrupo()      { setForm(p => { const n = clone(p); n.tamano_muestral.grupos.push(clone(EMPTY_GRUPO)); return n }) }
  function removeGrupo(i)  { setForm(p => { const n = clone(p); n.tamano_muestral.grupos = n.tamano_muestral.grupos.filter((_,j)=>j!==i); return n }) }
  function updGrupo(i,k,v) { setForm(p => { const n = clone(p); n.tamano_muestral.grupos[i][k] = v; return n }) }

  function toggleEspecie(esp) {
    const cur = form.datos_generales.especies ?? []
    const next = cur.includes(esp) ? cur.filter(e => e !== esp) : [...cur, esp]
    update('datos_generales.especies', next)
  }

  function toggleEutanasia(metodo) {
    const cur  = form.finalizacion.metodos_eutanasia ?? []
    const next = cur.includes(metodo) ? cur.filter(m => m !== metodo) : [...cur, metodo]
    update('finalizacion.metodos_eutanasia', next)
  }

  // Save to repositorio helper
  async function saveToRepo(campo, valor) {
    if (!valor?.trim()) return
    await fetch(`/api/animalario/repositorio/campo/${campo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor }),
    }).catch(() => {})
  }

  async function doSave(andContinue = false) {
    setSaving(true)
    setError(null)
    try {
      // Save frequent values
      if (form.datos_generales.cepa_linea) await saveToRepo('cepa_linea', form.datos_generales.cepa_linea)
      for (const t of form.tecnicas) {
        if (t.nombre) await saveToRepo('tecnica_experimental', t.nombre)
        if (t.via)    await saveToRepo('via_administracion', t.via)
        if (t.frecuencia) await saveToRepo('frecuencia_tecnica', t.frecuencia)
      }
      for (const s of form.otras_sustancias.sustancias ?? []) {
        if (s.nombre) await saveToRepo('producto_administrado', s.nombre)
      }
      for (const p of form.parametros ?? []) {
        if (p.parametro) await saveToRepo('parametro_medido', p.parametro)
      }
      if (form.finalizacion.metodos_eutanasia?.length) {
        for (const m of form.finalizacion.metodos_eutanasia) await saveToRepo('metodo_eutanasia', m)
      }

      // Persist
      let savedProc
      if (isEdit) {
        const r = await fetch(`/api/animalario/procedimientos/${procId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, proyecto_id: proyectoId }),
        })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error al guardar')
        savedProc = await r.json()
      } else {
        const r = await fetch(`/api/animalario/proyectos/${proyectoId}/procedimientos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error al crear')
        savedProc = await r.json()
      }

      setToast('Procedimiento guardado')
      if (andContinue) {
        navigate(`/animalario/proyecto/${proyectoId}/procedimientos`)
      } else if (!isEdit) {
        navigate(`/animalario/proyecto/${proyectoId}/procedimientos/${savedProc.id}`, { replace: true })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const cepasProyecto = (proyecto?.seccionA?.cepas_cria ?? []).map(c => c.cepa_linea).filter(Boolean)

  if (loading) return <p>Cargando…</p>

  const vias = ['oral', 'subcutánea', 'intraperitoneal', 'intravenosa', 'intracraneal', 'tópica', 'inhalatoria', 'otra']

  return (
    <div>
      <PageHeader
        back={`/animalario/proyecto/${proyectoId}/procedimientos`}
        backLabel="Procedimientos"
        title={isEdit ? 'Editar procedimiento' : 'Nuevo procedimiento'}
        subtitle={proyecto?.seccionA?.titulo ?? ''}
      />

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── 1. Datos generales ─────────────────────────────────── */}
      <CollapsibleBlock title="1. Datos generales del procedimiento">
        <div className={s.grid2}>
          <div className={`form-group ${s.fullRow}`}>
            <label>Título del procedimiento</label>
            <input
              className="form-group input"
              value={form.datos_generales.titulo_procedimiento}
              onChange={e => update('datos_generales.titulo_procedimiento', e.target.value)}
              placeholder="Nombre descriptivo del procedimiento"
            />
          </div>

          <div className={`form-group ${s.fullRow}`}>
            <label>Especies utilizadas</label>
            <div className={s.checkboxGroup}>
              {especies.map(esp => (
                <label key={esp} className={s.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={(form.datos_generales.especies ?? []).includes(esp)}
                    onChange={() => toggleEspecie(esp)}
                  />
                  {esp}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Cepa / línea</label>
            <AutocompleteInput
              campo="cepa_linea"
              value={form.datos_generales.cepa_linea}
              onChange={v => update('datos_generales.cepa_linea', v)}
              placeholder="Ej. C57BL/6J"
              initialSuggestions={cepasProyecto}
            />
          </div>

          <div className="form-group">
            <label>Sexo</label>
            <div className={s.radioGroup}>
              {['Macho', 'Hembra', 'Ambos'].map(opt => (
                <label key={opt} className={s.radioLabel}>
                  <input
                    type="radio"
                    name="sexo"
                    value={opt}
                    checked={form.datos_generales.sexo === opt}
                    onChange={() => update('datos_generales.sexo', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Edad / peso al inicio</label>
            <input
              className="form-group input"
              value={form.datos_generales.edad_peso}
              onChange={e => update('datos_generales.edad_peso', e.target.value)}
              placeholder="Ej. 8-10 semanas, 20-25 g"
            />
          </div>

          <div className="form-group">
            <label>Número de animales</label>
            <input
              type="number"
              className="form-group input"
              value={form.datos_generales.num_animales}
              onChange={e => update('datos_generales.num_animales', e.target.value)}
              min="1"
              placeholder="Nº total de animales"
            />
          </div>

          <div className="form-group">
            <label>Origen de los animales</label>
            <input
              className="form-group input"
              value={form.datos_generales.origen}
              onChange={e => update('datos_generales.origen', e.target.value)}
              placeholder="Ej. Envigo, Charles River, colonia propia…"
            />
          </div>

          <div className="form-group">
            <label>Periodo de aclimatación</label>
            <input
              className="form-group input"
              value={form.datos_generales.aclimatacion}
              onChange={e => update('datos_generales.aclimatacion', e.target.value)}
              placeholder="Ej. 7 días"
            />
          </div>

          <div className="form-group">
            <label>Sistema de identificación</label>
            <input
              className="form-group input"
              value={form.datos_generales.identificacion}
              onChange={e => update('datos_generales.identificacion', e.target.value)}
              placeholder="Ej. microchip, tatuaje, orejera…"
            />
          </div>

          <div className={`form-group ${s.fullRow}`}>
            <label>Condiciones especiales de alojamiento</label>
            <textarea
              className="form-group input"
              rows={2}
              value={form.datos_generales.condiciones_especiales}
              onChange={e => update('datos_generales.condiciones_especiales', e.target.value)}
              placeholder="Indicar si requiere aislamiento, SPF, etc."
            />
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── 2. Metodología ─────────────────────────────────────── */}
      <CollapsibleBlock title="2. Metodología y justificación">
        <div className="form-group">
          <label>Descripción del procedimiento</label>
          <textarea
            className="form-group input"
            rows={5}
            value={form.metodologia.descripcion}
            onChange={e => update('metodologia.descripcion', e.target.value)}
            placeholder="Descripción detallada paso a paso del procedimiento experimental"
          />
        </div>
        <div className="form-group">
          <label>Justificación del procedimiento</label>
          <textarea
            className="form-group input"
            rows={3}
            value={form.metodologia.justificacion_procedimiento}
            onChange={e => update('metodologia.justificacion_procedimiento', e.target.value)}
            placeholder="Por qué es necesario este procedimiento para alcanzar los objetivos científicos"
          />
        </div>
      </CollapsibleBlock>

      {/* ── 3. Tamaño muestral ─────────────────────────────────── */}
      <CollapsibleBlock title="3. Tamaño muestral">
        <div className="form-group">
          <label>Método de cálculo del tamaño muestral</label>
          <div className={s.radioGroup}>
            {['Análisis de potencia estadística', 'Datos históricos / literatura', 'Estudio piloto', 'Estimación experta', 'Otro'].map(opt => (
              <label key={opt} className={s.radioLabel}>
                <input
                  type="radio"
                  name="metodo_muestral"
                  value={opt}
                  checked={form.tamano_muestral.metodo === opt}
                  onChange={() => update('tamano_muestral.metodo', opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Justificación del tamaño muestral</label>
          <textarea
            className="form-group input"
            rows={3}
            value={form.tamano_muestral.justificacion}
            onChange={e => update('tamano_muestral.justificacion', e.target.value)}
            placeholder="Explicar por qué el número de animales es el mínimo necesario (3Rs — Reducción)"
          />
        </div>
        <div className="form-group">
          <label>Grupos experimentales</label>
          <DynTable
            columns={[
              { key: 'nombre',        label: 'Grupo',         flex: 2, ph: 'Ej. Control, Tratamiento A…' },
              { key: 'n',             label: 'N animales',    flex: 1, tipo: 'number', ph: 'n' },
              { key: 'justificacion', label: 'Justificación', flex: 3, ph: 'Breve descripción' },
            ]}
            rows={form.tamano_muestral.grupos ?? []}
            onUpdate={(i, k, v) => { setForm(p => { const n=clone(p); n.tamano_muestral.grupos[i][k]=v; return n }) }}
            onRemove={(i)       => { setForm(p => { const n=clone(p); n.tamano_muestral.grupos=n.tamano_muestral.grupos.filter((_,j)=>j!==i); return n }) }}
            onAdd={()           => { setForm(p => { const n=clone(p); n.tamano_muestral.grupos.push(clone(EMPTY_GRUPO)); return n }) }}
            addLabel="＋ Añadir grupo"
          />
        </div>
      </CollapsibleBlock>

      {/* ── 4. Aislamiento / ayuno ──────────────────────────────── */}
      <CollapsibleBlock title="4. Aislamiento y ayuno" defaultOpen={false}>
        <div className={s.grid2}>
          <div className="form-group">
            <label>¿Hay aislamiento previo?</label>
            <div className={s.radioGroup}>
              {['Sí', 'No'].map(opt => (
                <label key={opt} className={s.radioLabel}>
                  <input
                    type="radio"
                    name="hay_aislamiento"
                    value={opt}
                    checked={form.aislamiento_ayuno.hay_aislamiento === opt}
                    onChange={() => update('aislamiento_ayuno.hay_aislamiento', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {form.aislamiento_ayuno.hay_aislamiento === 'Sí' && (
            <div className="form-group">
              <label>Duración del aislamiento</label>
              <input
                className="form-group input"
                value={form.aislamiento_ayuno.duracion_aislamiento}
                onChange={e => update('aislamiento_ayuno.duracion_aislamiento', e.target.value)}
                placeholder="Ej. 24 horas"
              />
            </div>
          )}

          <div className="form-group">
            <label>¿Hay ayuno previo?</label>
            <div className={s.radioGroup}>
              {['Sí', 'No'].map(opt => (
                <label key={opt} className={s.radioLabel}>
                  <input
                    type="radio"
                    name="hay_ayuno"
                    value={opt}
                    checked={form.aislamiento_ayuno.hay_ayuno === opt}
                    onChange={() => update('aislamiento_ayuno.hay_ayuno', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {form.aislamiento_ayuno.hay_ayuno === 'Sí' && (
            <div className="form-group">
              <label>Duración del ayuno</label>
              <input
                className="form-group input"
                value={form.aislamiento_ayuno.duracion_ayuno}
                onChange={e => update('aislamiento_ayuno.duracion_ayuno', e.target.value)}
                placeholder="Ej. 12 horas (agua ad libitum)"
              />
            </div>
          )}

          {(form.aislamiento_ayuno.hay_aislamiento === 'Sí' || form.aislamiento_ayuno.hay_ayuno === 'Sí') && (
            <div className={`form-group ${s.fullRow}`}>
              <label>Justificación</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.aislamiento_ayuno.justificacion}
                onChange={e => update('aislamiento_ayuno.justificacion', e.target.value)}
                placeholder="Razón científica para el aislamiento/ayuno"
              />
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* ── 5. Técnicas experimentales ─────────────────────────── */}
      <CollapsibleBlock title="5. Técnicas experimentales y administración">
        <DynTable
          columns={[
            { key: 'nombre',       label: 'Técnica / sustancia',  flex: 2, tipo: 'autocomplete', campo: 'tecnica_experimental', ph: 'Nombre de la técnica' },
            { key: 'via',          label: 'Vía admin.',           flex: 1, tipo: 'autocomplete', campo: 'via_administracion', ph: 'Vía', initialSuggestions: vias },
            { key: 'frecuencia',   label: 'Frecuencia',           flex: 1, tipo: 'autocomplete', campo: 'frecuencia_tecnica', ph: 'Ej. diaria' },
            { key: 'volumen',      label: 'Volumen / dosis',      flex: 1, ph: 'Ej. 10 ml/kg' },
            { key: 'duracion',     label: 'Duración',             flex: 1, ph: 'Ej. 4 semanas' },
            { key: 'observaciones', label: 'Observaciones',       flex: 2, ph: '' },
          ]}
          rows={form.tecnicas}
          onUpdate={tecnicaOps.upd}
          onRemove={tecnicaOps.remove}
          onAdd={tecnicaOps.add}
          addLabel="＋ Añadir técnica"
        />
        <p className={s.helpText}>
          Incluir cada técnica o administración de sustancias con su vía, frecuencia y volumen. Los valores introducidos se guardarán en el repositorio para autocompletar en futuros formularios.
        </p>
      </CollapsibleBlock>

      {/* ── 6. Analgesia / anestesia ───────────────────────────── */}
      <CollapsibleBlock title="6. Analgesia y anestesia" defaultOpen={false}>
        <div className={s.grid2}>
          <div className="form-group">
            <label>¿Se utiliza analgesia?</label>
            <div className={s.radioGroup}>
              {['Sí', 'No', 'No procede'].map(opt => (
                <label key={opt} className={s.radioLabel}>
                  <input
                    type="radio"
                    name="hay_analgesia"
                    value={opt}
                    checked={form.analgesia_anestesia.hay_analgesia === opt}
                    onChange={() => update('analgesia_anestesia.hay_analgesia', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {form.analgesia_anestesia.hay_analgesia === 'Sí' && (
            <div className="form-group">
              <label>Protocolo de analgesia</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.analgesia_anestesia.protocolo_analgesia}
                onChange={e => update('analgesia_anestesia.protocolo_analgesia', e.target.value)}
                placeholder="Fármaco, dosis, vía, frecuencia"
              />
            </div>
          )}

          <div className="form-group">
            <label>¿Se utiliza anestesia?</label>
            <div className={s.radioGroup}>
              {['Sí', 'No', 'No procede'].map(opt => (
                <label key={opt} className={s.radioLabel}>
                  <input
                    type="radio"
                    name="hay_anestesia"
                    value={opt}
                    checked={form.analgesia_anestesia.hay_anestesia === opt}
                    onChange={() => update('analgesia_anestesia.hay_anestesia', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {form.analgesia_anestesia.hay_anestesia === 'Sí' && (
            <div className="form-group">
              <label>Protocolo de anestesia</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.analgesia_anestesia.protocolo_anestesia}
                onChange={e => update('analgesia_anestesia.protocolo_anestesia', e.target.value)}
                placeholder="Fármaco/mezcla, dosis, vía, inducción/mantenimiento"
              />
            </div>
          )}

          {(form.analgesia_anestesia.hay_anestesia === 'Sí') && (
            <>
              <div className="form-group">
                <label>Monitorización durante la anestesia</label>
                <textarea
                  className="form-group input"
                  rows={2}
                  value={form.analgesia_anestesia.monitorizacion}
                  onChange={e => update('analgesia_anestesia.monitorizacion', e.target.value)}
                  placeholder="Parámetros monitorizados (FR, FC, temperatura…)"
                />
              </div>
              <div className="form-group">
                <label>Recuperación post-anestésica</label>
                <textarea
                  className="form-group input"
                  rows={2}
                  value={form.analgesia_anestesia.recuperacion}
                  onChange={e => update('analgesia_anestesia.recuperacion', e.target.value)}
                  placeholder="Medidas de recuperación y criterios de alta"
                />
              </div>
            </>
          )}
        </div>
      </CollapsibleBlock>

      {/* ── 7. Otras sustancias / productos con riesgo ─────────── */}
      <CollapsibleBlock title="7. Otras sustancias y productos con riesgo" defaultOpen={false}>
        <div className="form-group">
          <label className={s.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.otras_sustancias.hay_riesgo === true}
              onChange={e => update('otras_sustancias.hay_riesgo', e.target.checked)}
            />
            Este procedimiento utiliza sustancias que requieren declaración de riesgo (Sección D)
          </label>
          {form.otras_sustancias.hay_riesgo && (
            <p className={s.warning}>
              Al marcar esta opción el procedimiento quedará vinculado a la Sección D del proyecto.
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Sustancias administradas (distintas a analgesia/anestesia)</label>
          <DynTable
            columns={[
              { key: 'nombre',    label: 'Sustancia',      flex: 2, tipo: 'autocomplete', campo: 'producto_administrado', ph: 'Nombre' },
              { key: 'tipo',      label: 'Tipo',           flex: 1, ph: 'Ej. vector viral, tóxico…' },
              { key: 'cantidad',  label: 'Cantidad / dosis', flex: 1, ph: 'Ej. 1×10⁹ vp/ml' },
              { key: 'via',       label: 'Vía admin.',     flex: 1, tipo: 'autocomplete', campo: 'via_administracion', ph: 'Vía', initialSuggestions: vias },
              { key: 'frecuencia', label: 'Frecuencia',    flex: 1, ph: 'Ej. única dosis' },
              { key: 'riesgo_desc', label: 'Riesgo',       flex: 2, ph: 'Descripción del riesgo si procede' },
            ]}
            rows={form.otras_sustancias.sustancias ?? []}
            onUpdate={updSustancia}
            onRemove={removeSustancia}
            onAdd={addSustancia}
            addLabel="＋ Añadir sustancia"
          />
        </div>
      </CollapsibleBlock>

      {/* ── 8. Parámetros medidos ──────────────────────────────── */}
      <CollapsibleBlock title="8. Parámetros medidos" defaultOpen={false}>
        <DynTable
          columns={[
            { key: 'parametro',    label: 'Parámetro',           flex: 2, tipo: 'autocomplete', campo: 'parametro_medido', ph: 'Ej. peso corporal, glucemia…' },
            { key: 'metodo_medida', label: 'Método de medida',   flex: 2, ph: 'Ej. glucómetro, balanza…' },
            { key: 'frecuencia',   label: 'Frecuencia',          flex: 1, ph: 'Ej. semanal' },
            { key: 'unidad',       label: 'Unidad',              flex: 1, ph: 'Ej. g, mg/dl…' },
            { key: 'n_por_grupo',  label: 'N/grupo',             flex: 1, tipo: 'number', ph: 'n' },
          ]}
          rows={form.parametros}
          onUpdate={parametroOps.upd}
          onRemove={parametroOps.remove}
          onAdd={parametroOps.add}
          addLabel="＋ Añadir parámetro"
        />
        <p className={s.helpText}>
          Ejemplo: peso corporal · balanza · semanal · g · 10/grupo
        </p>
      </CollapsibleBlock>

      {/* ── 9. Muestras ante mortem ────────────────────────────── */}
      <CollapsibleBlock title="9. Muestras ante mortem" defaultOpen={false}>
        <DynTable
          columns={[
            { key: 'tipo',              label: 'Tipo de muestra',   flex: 2, ph: 'Ej. sangre, orina, LCR…' },
            { key: 'volumen_cantidad',  label: 'Volumen / cantidad', flex: 1, ph: 'Ej. 200 µl' },
            { key: 'frecuencia',        label: 'Frecuencia',        flex: 1, ph: 'Ej. mensual' },
            { key: 'procedimiento',     label: 'Método de obtención', flex: 2, ph: 'Ej. venopunción submandibular' },
          ]}
          rows={form.muestras_antemortem}
          onUpdate={muestraOps.upd}
          onRemove={muestraOps.remove}
          onAdd={muestraOps.add}
          addLabel="＋ Añadir muestra"
        />
      </CollapsibleBlock>

      {/* ── 10. Finalización ───────────────────────────────────── */}
      <CollapsibleBlock title="10. Finalización y eutanasia">
        <div className="form-group">
          <label>Criterios humanitarios de finalización</label>
          <textarea
            className="form-group input"
            rows={3}
            value={form.finalizacion.criterios_humanos}
            onChange={e => update('finalizacion.criterios_humanos', e.target.value)}
            placeholder="Criterios clínicos o de bienestar que determinarán la finalización anticipada del experimento"
          />
        </div>
        <div className="form-group">
          <label>Método(s) de eutanasia</label>
          <p className={s.helpText}>Pueden combinarse varios métodos (p.ej. sobredosis anestésica + dislocación cervical).</p>
          <div className={s.checkboxGroupCol}>
            {['Sobredosis anestésica', 'Dislocación cervical', 'CO₂', 'Decapitación', 'Perfusión transcardíaca', 'Otro'].map(m => (
              <label key={m} className={s.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(form.finalizacion.metodos_eutanasia ?? []).includes(m)}
                  onChange={() => toggleEutanasia(m)}
                />
                {m}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Justificación del método de eutanasia</label>
          <textarea
            className="form-group input"
            rows={2}
            value={form.finalizacion.justificacion_eutanasia}
            onChange={e => update('finalizacion.justificacion_eutanasia', e.target.value)}
            placeholder="Justificación según las 3Rs (Refinamiento)"
          />
        </div>
        <div className="form-group">
          <label>Destino de las carcasas</label>
          <input
            className="form-group input"
            value={form.finalizacion.destino_carcasas}
            onChange={e => update('finalizacion.destino_carcasas', e.target.value)}
            placeholder="Ej. incineración, archivo histológico, muestras para otros proyectos…"
          />
        </div>
      </CollapsibleBlock>

      {/* ── 11. Reutilización ──────────────────────────────────── */}
      <CollapsibleBlock title="11. Reutilización de animales" defaultOpen={false}>
        <div className="form-group">
          <label>¿Se reutilizan animales de otro procedimiento?</label>
          <div className={s.radioGroup}>
            {['Sí', 'No'].map(opt => (
              <label key={opt} className={s.radioLabel}>
                <input
                  type="radio"
                  name="hay_reutilizacion"
                  value={opt}
                  checked={form.reutilizacion.hay_reutilizacion === opt}
                  onChange={() => update('reutilizacion.hay_reutilizacion', opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        {form.reutilizacion.hay_reutilizacion === 'Sí' && (
          <>
            <div className="form-group">
              <label>Descripción de la reutilización</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.reutilizacion.descripcion}
                onChange={e => update('reutilizacion.descripcion', e.target.value)}
                placeholder="De qué procedimiento provienen y qué se hizo previamente"
              />
            </div>
            <div className="form-group">
              <label>Justificación de la reutilización</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.reutilizacion.justificacion}
                onChange={e => update('reutilizacion.justificacion', e.target.value)}
                placeholder="Por qué es necesario reutilizar y cómo se garantiza el bienestar"
              />
            </div>
          </>
        )}
      </CollapsibleBlock>

      {/* ── 12. Clasificación de severidad ─────────────────────── */}
      <CollapsibleBlock title="12. Clasificación de severidad">
        <div className="form-group">
          <label>Severidad del procedimiento según la Directiva 2010/63/UE</label>
          <div className={s.severityRow}>
            {[
              { value: 'none',   label: 'Sin clasificar' },
              { value: 'low',    label: 'Leve' },
              { value: 'medium', label: 'Moderado' },
              { value: 'high',   label: 'Severo' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`${s.severityBtn} ${s[`severityBtn${opt.value.charAt(0).toUpperCase()+opt.value.slice(1)}`]} ${form.clasificacion_severidad === opt.value ? s.active : ''}`}
                onClick={() => update('clasificacion_severidad', opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className={s.helpText} style={{ marginTop: '0.5rem' }}>
            Leve: mínimo sufrimiento. Moderado: sufrimiento significativo de corta duración. Severo: sufrimiento intenso o prolongado.
          </p>
        </div>
      </CollapsibleBlock>

      {/* ── 13. Firma ──────────────────────────────────────────── */}
      <CollapsibleBlock title="13. Firma del responsable" defaultOpen={false}>
        <div className={s.grid2}>
          <div className="form-group">
            <label>Nombre y apellidos</label>
            <input
              className="form-group input"
              value={form.firma.nombre}
              onChange={e => update('firma.nombre', e.target.value)}
              placeholder="Investigador responsable del procedimiento"
            />
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              className="form-group input"
              value={form.firma.fecha}
              onChange={e => update('firma.fecha', e.target.value)}
            />
          </div>
          <div className={`form-group ${s.fullRow}`}>
            <label>Observaciones</label>
            <textarea
              className="form-group input"
              rows={2}
              value={form.firma.observaciones}
              onChange={e => update('firma.observaciones', e.target.value)}
              placeholder="Observaciones adicionales sobre el procedimiento"
            />
          </div>
        </div>
      </CollapsibleBlock>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className={s.actions}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/animalario/proyecto/${proyectoId}/procedimientos`)}
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
          {saving ? 'Guardando…' : 'Guardar y volver'}
        </button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
