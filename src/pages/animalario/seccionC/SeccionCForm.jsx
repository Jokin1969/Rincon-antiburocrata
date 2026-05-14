import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import s from './SeccionCForm.module.css'
import ExportButton from '../../../components/animalario/ExportButton'
import CollapsibleBlock from '../../../components/animalario/CollapsibleBlock'
import AutoExpandTextarea from '../../../components/animalario/AutoExpandTextarea'

// ── Helpers ───────────────────────────────────────────────────────────────────

function clone(o) { return JSON.parse(JSON.stringify(o)) }

const TEXTO_ESTANDAR_CRIA =
  'Los machos se separan y tras 5 días se establecen las parejas de cría. ' +
  'Las parejas se renuevan cada 6 meses aproximadamente. Las crías se destetan a los 21 días de vida. ' +
  'Los machos y las hembras se separan y alojan en grupos del mismo sexo. ' +
  'El genotipaje se realiza en el momento del destete.'

const IDENTIFICACION_OPTS = [
  'Rotulador indeleble',
  'Crotal (oreja)',
  'Perforación auricular',
  'Etiquetado jaula',
  'Tatuaje',
  'Microchip',
  'Otro',
]

const EMPTY_CRUCE = { codigo_cbba: '', fecha_aprobacion: '' }

const EMPTY_SECCION_C = {
  identificacion: {
    nomenclatura_internacional: '',
    acronimo: '',
  },
  es_omg: false,
  fenotipo_anormal: {
    estado: 'no',
    descripcion: '',
  },
  condiciones_especiales: {
    requiere: 'no',
    descripcion: '',
  },
  sistema_cria: '',
  genotipaje: {
    procedimiento: '',
    puesto_a_punto: false,
    tipo_muestra: '',
  },
  identificacion_animales: [],
  identificacion_animales_otro: '',
  animales_a_generar: {
    numero_total: '',
    justificacion: '',
  },
  procedimiento_cria: {
    tipo: 'estandar_cicbiogune',
    descripcion: '',
  },
  omg: {
    usado_anteriormente: false,
    numero_procedimiento_previo: '',
    clasificacion_actividad: '',
    descripcion_operaciones: '',
    lugar_manipulacion: {
      tipo: 'animalario_cicbiogune',
      descripcion: '',
    },
    donde_manipulacion_genetica: '',
    es_cruce_omgs: false,
    cruces: [],
    modificacion_genetica: {
      tipo_modificacion: '',
      metodo_descripcion: '',
      caracteristicas_vector: '',
      tipo_identidad_vector: '',
      inserto: {
        organismo_origen: '',
        dimensiones_mapa_secuencias: '',
        funcion_especifica: '',
        genes_estructurales: '',
        elementos_reguladores: '',
        secuenciado_completamente: false,
      },
    },
    omg_resultante: {
      denominacion: '',
      medidas_seguridad_especiales: {
        requiere: false,
        detalle: '',
      },
      descripcion_breve: '',
      estado_expresion_material_genetico: '',
      insercion: {
        conoce_numero_localizacion: false,
        num_copias: '',
        localizacion_cromosomica: '',
        secuencias_laterales: '',
      },
      inactiva_gen: {
        estado: 'no',
        descripcion: '',
      },
      identificacion: {
        descripcion_metodos: '',
        marcadores_especificos: '',
        tecnicas_disponibles: {
          disponible: false,
          descripcion: '',
        },
      },
    },
  },
  firma: {
    nombre: '',
    fecha: '',
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

export default function SeccionCForm() {
  const { proyectoId, cId } = useParams()
  const [searchParams]      = useSearchParams()
  const navigate            = useNavigate()
  const isEdit              = Boolean(cId)
  const cepaIdxParam        = searchParams.get('cepaIdx')
  const cepaIdx             = cepaIdxParam != null ? parseInt(cepaIdxParam, 10) : null

  const [form, setForm]         = useState(clone(EMPTY_SECCION_C))
  const [proyecto, setProyecto] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [toast, setToast]       = useState(null)

  useEffect(() => {
    const fetches = [
      fetch(`/api/animalario/proyectos/${proyectoId}`).then(r => r.json()),
    ]
    if (isEdit) fetches.push(fetch(`/api/animalario/crias/${cId}`).then(r => r.json()))

    Promise.all(fetches)
      .then(([proy, existing]) => {
        setProyecto(proy)
        if (existing) {
          // Editing: load saved seccionC
          setForm(existing.seccionC ?? clone(EMPTY_SECCION_C))
        } else if (cepaIdx != null) {
          // Creating: pre-fill from Sección A cepa
          const cepa = proy.seccionA?.cepas_cria?.[cepaIdx]
          if (cepa) {
            setForm(prev => ({
              ...prev,
              identificacion: {
                nomenclatura_internacional: cepa.nomenclatura_internacional ?? '',
                acronimo:                  cepa.acronimo                   ?? '',
              },
              animales_a_generar: {
                ...prev.animales_a_generar,
                numero_total: cepa.num_animales ? String(cepa.num_animales) : '',
              },
            }))
          }
        }
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [proyectoId, cId])

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

  function toggleIdentificacion(opt) {
    const cur  = form.identificacion_animales ?? []
    const next = cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt]
    setForm(prev => ({ ...prev, identificacion_animales: next }))
  }

  function addCruce()      { setForm(p => { const n=clone(p); n.omg.cruces.push(clone(EMPTY_CRUCE)); return n }) }
  function removeCruce(i)  { setForm(p => { const n=clone(p); n.omg.cruces=n.omg.cruces.filter((_,j)=>j!==i); return n }) }
  function updCruce(i,k,v) { setForm(p => { const n=clone(p); n.omg.cruces[i][k]=v; return n }) }

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
      // Save to repositorio
      await saveToRepo('cepa_linea',         form.identificacion.nomenclatura_internacional)
      await saveToRepo('muestra_genotipaje', form.genotipaje.tipo_muestra)
      if (form.omg?.modificacion_genetica?.tipo_modificacion) {
        await saveToRepo('tipo_modificacion_omg', form.omg.modificacion_genetica.tipo_modificacion)
      }

      const payload = {
        seccionC:   form,
        proyecto_id: proyectoId,
        cepa_idx:   cepaIdx,
      }

      let savedCria
      if (isEdit) {
        const r = await fetch(`/api/animalario/crias/${cId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error al guardar')
        savedCria = await r.json()
      } else {
        const r = await fetch(`/api/animalario/proyectos/${proyectoId}/crias`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error al crear')
        savedCria = await r.json()
      }

      setToast('Cría guardada correctamente')
      if (andContinue) {
        navigate(`/animalario/proyecto/${proyectoId}`)
      } else if (!isEdit) {
        navigate(`/animalario/proyecto/${proyectoId}/cria/${savedCria.id}`, { replace: true })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Derivados para simplificar el JSX
  const cepaSeccionA = proyecto?.seccionA?.cepas_cria?.[cepaIdx ?? -1]
  const numAnimalSeccionA = cepaSeccionA?.num_animales
  const numActual = parseInt(form.animales_a_generar.numero_total, 10)
  const numMismatch = numAnimalSeccionA != null
    && form.animales_a_generar.numero_total !== ''
    && !isNaN(numActual)
    && numActual !== numAnimalSeccionA

  const nombreCepa = form.identificacion.acronimo || form.identificacion.nomenclatura_internacional || 'Nueva cepa'
  const omgActivo  = form.es_omg === true
  const usadoAnteriormente = omgActivo && form.omg.usado_anteriormente === true

  async function actualizarNumEnSeccionA() {
    if (!proyecto || cepaIdx == null) return
    const cepas = clone(proyecto.seccionA?.cepas_cria ?? [])
    if (!cepas[cepaIdx]) return
    cepas[cepaIdx].num_animales = numActual
    const body = { ...proyecto, seccionA: { ...proyecto.seccionA, cepas_cria: cepas } }
    await fetch(`/api/animalario/proyectos/${proyectoId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setProyecto(body)
    setToast('Número actualizado en Sección A')
  }

  if (loading) return <p style={{ padding: '2rem', color: 'var(--muted-light)' }}>Cargando…</p>

  return (
    <div>
      <PageHeader
        back={`/animalario/proyecto/${proyectoId}`}
        backLabel="Proyecto"
        title={isEdit ? `Editar cría — ${nombreCepa}` : `Nueva cría — ${nombreCepa}`}
        subtitle={proyecto?.seccionA?.titulo ?? ''}
      />

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ════════════════════════════════════════════════
          BLOQUE BASE — DATOS DE CRÍA
          ════════════════════════════════════════════════ */}

      {/* Bloque 1: Identificación */}
      <CollapsibleBlock
        title="1 · Identificación de la cepa"
        storageKey="secC:id"
        requiredFields={[form.identificacion.nomenclatura_internacional]}
      >
        <div className={s.grid2}>
          <div className="form-group">
            <label>Nomenclatura internacional</label>
            <AutocompleteInput
              campo="cepa_linea"
              value={form.identificacion.nomenclatura_internacional}
              onChange={v => update('identificacion.nomenclatura_internacional', v)}
              placeholder="Ej. C57BL/6JRj"
            />
            <p className={s.helpText}>
              Nomenclature for Mouse Strains. Jackson Laboratories
            </p>
          </div>
          <div className="form-group">
            <label>Acrónimo de la cepa/línea</label>
            <input
              className="form-group input"
              value={form.identificacion.acronimo}
              onChange={e => update('identificacion.acronimo', e.target.value)}
              placeholder="Ej. B6"
            />
            <p className={s.helpText}>
              Nombre con el que se referirá a la cepa en el proyecto y en el animalario del CIC bioGUNE
            </p>
          </div>
        </div>
      </CollapsibleBlock>

      {/* Bloque 2: OMG */}
      <CollapsibleBlock title="2 · ¿Es un organismo modificado genéticamente (OMG)?" storageKey="secC:omg">
        <div className="form-group">
          <div className={s.radioGroup}>
            <label className={s.radioLabel}>
              <input
                type="radio"
                name="es_omg"
                checked={form.es_omg === false}
                onChange={() => update('es_omg', false)}
              />
              No
            </label>
            <label className={s.radioLabel}>
              <input
                type="radio"
                name="es_omg"
                checked={form.es_omg === true}
                onChange={() => update('es_omg', true)}
              />
              Sí
            </label>
          </div>
        </div>
      </CollapsibleBlock>

      {/* Bloque 3: Fenotipo */}
      <CollapsibleBlock title="3 · Fenotipo" storageKey="secC:feno">
        <div className="form-group">
          <label>
            ¿El fenotipo de los reproductores o de la descendencia está asociado con alguna anormalidad
            física, mayor susceptibilidad a padecer enfermedad o acortamiento de la longevidad?
          </label>
          <div className={s.radioGroup}>
            {[
              { value: 'no',          label: 'No' },
              { value: 'desconocido', label: 'Se desconoce' },
              { value: 'si',          label: 'Sí' },
            ].map(opt => (
              <label key={opt.value} className={s.radioLabel}>
                <input
                  type="radio"
                  name="fenotipo_estado"
                  value={opt.value}
                  checked={form.fenotipo_anormal.estado === opt.value}
                  onChange={() => update('fenotipo_anormal.estado', opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {form.fenotipo_anormal.estado === 'si' && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Especificar</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.fenotipo_anormal.descripcion}
                onChange={e => update('fenotipo_anormal.descripcion', e.target.value)}
                placeholder="Describir la anormalidad fenotípica"
              />
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* Bloque 4: Condiciones especiales */}
      <CollapsibleBlock title="4 · Condiciones especiales de mantenimiento" storageKey="secC:cond">
        <div className="form-group">
          <label>
            ¿Los animales necesitan ser mantenidos/manipulados en condiciones especiales?
          </label>
          <div className={s.radioGroup}>
            {[
              { value: 'no',          label: 'No' },
              { value: 'desconocido', label: 'Se desconoce' },
              { value: 'si',          label: 'Sí' },
            ].map(opt => (
              <label key={opt.value} className={s.radioLabel}>
                <input
                  type="radio"
                  name="condiciones_req"
                  value={opt.value}
                  checked={form.condiciones_especiales.requiere === opt.value}
                  onChange={() => update('condiciones_especiales.requiere', opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {form.condiciones_especiales.requiere === 'si' && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Especificar</label>
              <textarea
                className="form-group input"
                rows={2}
                value={form.condiciones_especiales.descripcion}
                onChange={e => update('condiciones_especiales.descripcion', e.target.value)}
                placeholder="Describir las condiciones especiales requeridas"
              />
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* Bloque 5: Sistema de cría */}
      <CollapsibleBlock title="5 · Sistema de cría" storageKey="secC:cria">
        <div className="form-group">
          <AutoExpandTextarea
            storageKey="secC:sistema_cria"
            rows={3}
            value={form.sistema_cria}
            onChange={e => update('sistema_cria', e.target.value)}
            placeholder="Ej. HOxHE — cruces heterocigotos para mantener la línea"
          />
          <p className={s.helpText}>
            Indicar sistema (HOxHO, HOxHE, HOxWT, …) y estrategia de mantenimiento
          </p>
        </div>
      </CollapsibleBlock>

      {/* Bloque 6: Genotipaje */}
      <CollapsibleBlock title="6 · Genotipaje" storageKey="secC:geno">
        <div className={s.grid2}>
          <div className="form-group">
            <label>Procedimiento de genotipaje</label>
            <input
              className="form-group input"
              value={form.genotipaje.procedimiento}
              onChange={e => update('genotipaje.procedimiento', e.target.value)}
              placeholder="Ej. PCR, Southern blot…"
            />
            <p className={s.helpText}>PCR, Southern, etc.</p>
          </div>
          <div className="form-group">
            <label>Tipo de muestra</label>
            <AutocompleteInput
              campo="muestra_genotipaje"
              value={form.genotipaje.tipo_muestra}
              onChange={v => update('genotipaje.tipo_muestra', v)}
              placeholder="Ej. biopsia cola"
              initialSuggestions={['biopsia cola', 'sangre', 'saliva', 'pelo']}
            />
            <p className={s.helpText}>biopsia cola, sangre, etc.</p>
          </div>
          <div className="form-group">
            <label>¿Protocolo puesto a punto?</label>
            <div className={s.radioGroup}>
              <label className={s.radioLabel}>
                <input
                  type="radio"
                  name="genotipaje_pp"
                  checked={form.genotipaje.puesto_a_punto === true}
                  onChange={() => update('genotipaje.puesto_a_punto', true)}
                />
                Sí
              </label>
              <label className={s.radioLabel}>
                <input
                  type="radio"
                  name="genotipaje_pp"
                  checked={form.genotipaje.puesto_a_punto === false}
                  onChange={() => update('genotipaje.puesto_a_punto', false)}
                />
                No
              </label>
            </div>
          </div>
        </div>
      </CollapsibleBlock>

      {/* Bloque 7: Identificación de los animales */}
      <CollapsibleBlock title="7 · Identificación de los animales" storageKey="secC:idanim">
        <div className="form-group">
          <label>Métodos de identificación (pueden combinarse)</label>
          <div className={s.checkboxGroupCol}>
            {IDENTIFICACION_OPTS.map(opt => (
              <label key={opt} className={s.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(form.identificacion_animales ?? []).includes(opt)}
                  onChange={() => toggleIdentificacion(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
          {(form.identificacion_animales ?? []).includes('Otro') && (
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label>Especificar</label>
              <input
                className="form-group input"
                value={form.identificacion_animales_otro}
                onChange={e => setForm(p => ({ ...p, identificacion_animales_otro: e.target.value }))}
                placeholder="Describir el método de identificación"
              />
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* Bloque 8: Animales a generar */}
      <CollapsibleBlock title="8 · Animales a generar" storageKey="secC:anim">
        <div className={s.grid2}>
          <div className="form-group">
            <label>Número total de animales a generar</label>
            <input
              type="number"
              className="form-group input"
              value={form.animales_a_generar.numero_total}
              onChange={e => update('animales_a_generar.numero_total', e.target.value)}
              min="0"
              placeholder="0"
            />
            {numMismatch && (
              <div className={s.warning}>
                El número no coincide con el declarado en Sección A ({numAnimalSeccionA} animales).{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', padding: 0 }}
                  onClick={actualizarNumEnSeccionA}
                >
                  Actualizar en Sección A
                </button>
              </div>
            )}
          </div>
          <div className={`form-group ${s.fullRow}`}>
            <label>Justificación del número de animales</label>
            <AutoExpandTextarea
              storageKey="secC:animales_a_generar.justificacion"
              rows={3}
              value={form.animales_a_generar.justificacion}
              onChange={e => update('animales_a_generar.justificacion', e.target.value)}
              placeholder="Justificar por qué este número es el mínimo necesario"
            />
          </div>
        </div>
      </CollapsibleBlock>

      {/* Bloque 9: Procedimiento de cría */}
      <CollapsibleBlock title="9 · Procedimiento de cría" storageKey="secC:proccria">
        <div className="form-group">
          <div className={s.radioGroup}>
            <label className={s.radioLabel}>
              <input
                type="radio"
                name="proc_cria_tipo"
                value="estandar_cicbiogune"
                checked={form.procedimiento_cria.tipo === 'estandar_cicbiogune'}
                onChange={() => update('procedimiento_cria.tipo', 'estandar_cicbiogune')}
              />
              Según normas internas del CIC bioGUNE
            </label>
            <label className={s.radioLabel}>
              <input
                type="radio"
                name="proc_cria_tipo"
                value="otro"
                checked={form.procedimiento_cria.tipo === 'otro'}
                onChange={() => update('procedimiento_cria.tipo', 'otro')}
              />
              Otro
            </label>
          </div>

          {form.procedimiento_cria.tipo === 'estandar_cicbiogune' && (
            <p className={s.helpText} style={{ marginTop: '0.65rem' }}>
              {TEXTO_ESTANDAR_CRIA}
            </p>
          )}

          {form.procedimiento_cria.tipo === 'otro' && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Describir el procedimiento de cría</label>
              <AutoExpandTextarea
                storageKey="secC:procedimiento_cria.descripcion"
                rows={4}
                value={form.procedimiento_cria.descripcion}
                onChange={e => update('procedimiento_cria.descripcion', e.target.value)}
                placeholder="Describir detalladamente el procedimiento de cría utilizado"
              />
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* ════════════════════════════════════════════════
          BLOQUE OMG — solo visible si es_omg = true
          ════════════════════════════════════════════════ */}

      {omgActivo && (
        <>
          {/* OMG-0: ¿Usado anteriormente? */}
          <CollapsibleBlock title="OMG-0 · ¿Utilizado anteriormente en procedimiento aprobado?" storageKey="secC:omg0">
            <div className="form-group">
              <label>
                ¿Ha sido utilizado anteriormente este OMG, en las mismas condiciones, en otro
                procedimiento ya aprobado?
              </label>
              <div className={s.radioGroup}>
                <label className={s.radioLabel}>
                  <input
                    type="radio"
                    name="omg_usado"
                    checked={form.omg.usado_anteriormente === false}
                    onChange={() => update('omg.usado_anteriormente', false)}
                  />
                  No
                </label>
                <label className={s.radioLabel}>
                  <input
                    type="radio"
                    name="omg_usado"
                    checked={form.omg.usado_anteriormente === true}
                    onChange={() => update('omg.usado_anteriormente', true)}
                  />
                  Sí
                </label>
              </div>

              {form.omg.usado_anteriormente === true && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label>Nº de procedimiento previo</label>
                    <input
                      className="form-group input"
                      value={form.omg.numero_procedimiento_previo}
                      onChange={e => update('omg.numero_procedimiento_previo', e.target.value)}
                      placeholder="Número o referencia del procedimiento aprobado"
                    />
                  </div>
                  <div
                    style={{
                      background: 'rgba(22,163,74,0.08)',
                      border: '1px solid rgba(22,163,74,0.3)',
                      borderRadius: '4px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.82rem',
                      color: '#15803d',
                      marginTop: '0.5rem',
                    }}
                  >
                    No es necesario rellenar el resto de esta sección.
                  </div>
                </div>
              )}
            </div>
          </CollapsibleBlock>

          {/* Detail blocks — hidden if usado_anteriormente */}
          {!usadoAnteriormente && (
            <>
              {/* OMG-1: Información general */}
              <CollapsibleBlock title="OMG-1 · Información general del OMG" storageKey="secC:omg1">
                <div className="form-group">
                  <label>Clasificación de la actividad (según Directivas 98/81/CE y 2000/608/CE)</label>
                  <input
                    className="form-group input"
                    value={form.omg.clasificacion_actividad}
                    onChange={e => update('omg.clasificacion_actividad', e.target.value)}
                    placeholder="Ej. Clase 1 — sin riesgo o riesgo despreciable"
                  />
                </div>
                <div className="form-group">
                  <label>Descripción de las operaciones a realizar</label>
                  <AutoExpandTextarea
                    storageKey="secC:omg.descripcion_operaciones"
                    rows={3}
                    value={form.omg.descripcion_operaciones}
                    onChange={e => update('omg.descripcion_operaciones', e.target.value)}
                    placeholder="Descripción de las operaciones con el OMG"
                  />
                </div>
                <div className="form-group">
                  <label>Lugar de manipulación del OMG</label>
                  <div className={s.radioGroup}>
                    <label className={s.radioLabel}>
                      <input
                        type="radio"
                        name="lugar_manip"
                        value="animalario_cicbiogune"
                        checked={form.omg.lugar_manipulacion.tipo === 'animalario_cicbiogune'}
                        onChange={() => update('omg.lugar_manipulacion.tipo', 'animalario_cicbiogune')}
                      />
                      Animalario CIC bioGUNE
                    </label>
                    <label className={s.radioLabel}>
                      <input
                        type="radio"
                        name="lugar_manip"
                        value="otro"
                        checked={form.omg.lugar_manipulacion.tipo === 'otro'}
                        onChange={() => update('omg.lugar_manipulacion.tipo', 'otro')}
                      />
                      Otro
                    </label>
                  </div>
                  {form.omg.lugar_manipulacion.tipo === 'otro' && (
                    <input
                      className="form-group input"
                      style={{ marginTop: '0.5rem' }}
                      value={form.omg.lugar_manipulacion.descripcion}
                      onChange={e => update('omg.lugar_manipulacion.descripcion', e.target.value)}
                      placeholder="Especificar el lugar"
                    />
                  )}
                  <p className={s.helpText}>Especifique la zona del animalario si procede</p>
                </div>
              </CollapsibleBlock>

              {/* OMG-2: Origen de la manipulación genética */}
              <CollapsibleBlock title="OMG-2 · Origen de la manipulación genética" storageKey="secC:omg2" defaultOpen={false}>
                <div className="form-group">
                  <label>¿Dónde se realizó la manipulación genética?</label>
                  <AutoExpandTextarea
                    storageKey="secC:omg.donde_manipulacion_genetica"
                    rows={3}
                    value={form.omg.donde_manipulacion_genetica}
                    onChange={e => update('omg.donde_manipulacion_genetica', e.target.value)}
                    placeholder="Indicar institución y laboratorio donde se generó el OMG"
                  />
                </div>
              </CollapsibleBlock>

              {/* OMG-3: Cruce entre OMGs */}
              <CollapsibleBlock title="OMG-3 · ¿Es resultado de un cruce entre OMGs?" storageKey="secC:omg3" defaultOpen={false}>
                <div className="form-group">
                  <div className={s.radioGroup}>
                    <label className={s.radioLabel}>
                      <input
                        type="radio"
                        name="es_cruce"
                        checked={form.omg.es_cruce_omgs === false}
                        onChange={() => update('omg.es_cruce_omgs', false)}
                      />
                      No
                    </label>
                    <label className={s.radioLabel}>
                      <input
                        type="radio"
                        name="es_cruce"
                        checked={form.omg.es_cruce_omgs === true}
                        onChange={() => update('omg.es_cruce_omgs', true)}
                      />
                      Sí
                    </label>
                  </div>

                  {form.omg.es_cruce_omgs === true && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div className={s.dynTable}>
                        <div className={s.dynHeader}>
                          <span style={{ flex: 2 }}>Código CBBA asignado</span>
                          <span style={{ flex: 2 }}>Fecha de aprobación</span>
                          <span style={{ width: 28, flexShrink: 0 }} />
                        </div>
                        {(form.omg.cruces ?? []).map((cruce, i) => (
                          <div key={i} className={s.dynRow}>
                            <div className={s.dynCell} style={{ flex: 2 }}>
                              <input
                                value={cruce.codigo_cbba}
                                placeholder="Código CBBA"
                                onChange={e => updCruce(i, 'codigo_cbba', e.target.value)}
                                style={{ width: '100%' }}
                              />
                            </div>
                            <div className={s.dynCell} style={{ flex: 2 }}>
                              <input
                                type="date"
                                value={cruce.fecha_aprobacion}
                                onChange={e => updCruce(i, 'fecha_aprobacion', e.target.value)}
                                style={{ width: '100%' }}
                              />
                            </div>
                            <button type="button" className={s.removeBtn} onClick={() => removeCruce(i)}>×</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" className={s.addRowBtn} onClick={addCruce}>
                        ＋ Añadir OMG progenitor
                      </button>
                    </div>
                  )}
                </div>
              </CollapsibleBlock>

              {/* OMG-4: Modificación genética */}
              <CollapsibleBlock title="OMG-4 · Modificación genética" storageKey="secC:omg4" defaultOpen={false}>
                <div className={s.grid2}>
                  <div className="form-group">
                    <label>Tipo de modificación</label>
                    <AutocompleteInput
                      campo="tipo_modificacion_omg"
                      value={form.omg.modificacion_genetica.tipo_modificacion}
                      onChange={v => update('omg.modificacion_genetica.tipo_modificacion', v)}
                      placeholder="Ej. inserción, knock-out…"
                      initialSuggestions={['inserción','deleción','sustitución','transgénesis','knock-in','knock-out']}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipo/identidad del vector</label>
                    <input
                      className="form-group input"
                      value={form.omg.modificacion_genetica.tipo_identidad_vector}
                      onChange={e => update('omg.modificacion_genetica.tipo_identidad_vector', e.target.value)}
                      placeholder="Ej. pAAV, lentiviral, CRISPR…"
                    />
                  </div>
                  <div className={`form-group ${s.fullRow}`}>
                    <label>Descripción breve del método</label>
                    <AutoExpandTextarea
                      storageKey="secC:omg.modificacion_genetica.metodo_descripcion"
                      rows={3}
                      value={form.omg.modificacion_genetica.metodo_descripcion}
                      onChange={e => update('omg.modificacion_genetica.metodo_descripcion', e.target.value)}
                      placeholder="Describir el método empleado para la modificación genética"
                    />
                  </div>
                  <div className={`form-group ${s.fullRow}`}>
                    <label>Características del vector</label>
                    <AutoExpandTextarea
                      storageKey="secC:omg.modificacion_genetica.caracteristicas_vector"
                      rows={3}
                      value={form.omg.modificacion_genetica.caracteristicas_vector}
                      onChange={e => update('omg.modificacion_genetica.caracteristicas_vector', e.target.value)}
                      placeholder="Describir las características del vector (tamaño, selección, promotor, etc.)"
                    />
                    <p className={s.helpText}>
                      Aportar mapa de restricción del vector en formato PDF adjunto al proyecto
                    </p>
                  </div>
                </div>

                {/* Sub-sección: Información del inserto */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                    Información del inserto
                  </div>
                  <div className={s.grid2}>
                    <div className="form-group">
                      <label>Organismo de origen del inserto</label>
                      <input
                        className="form-group input"
                        value={form.omg.modificacion_genetica.inserto.organismo_origen}
                        onChange={e => update('omg.modificacion_genetica.inserto.organismo_origen', e.target.value)}
                        placeholder="Ej. Homo sapiens, GFP (Aequorea victoria)…"
                      />
                    </div>
                    <div className="form-group">
                      <label>¿Ha sido secuenciado completamente?</label>
                      <div className={s.radioGroup}>
                        <label className={s.radioLabel}>
                          <input
                            type="radio"
                            name="secuenciado"
                            checked={form.omg.modificacion_genetica.inserto.secuenciado_completamente === true}
                            onChange={() => update('omg.modificacion_genetica.inserto.secuenciado_completamente', true)}
                          />
                          Sí
                        </label>
                        <label className={s.radioLabel}>
                          <input
                            type="radio"
                            name="secuenciado"
                            checked={form.omg.modificacion_genetica.inserto.secuenciado_completamente === false}
                            onChange={() => update('omg.modificacion_genetica.inserto.secuenciado_completamente', false)}
                          />
                          No
                        </label>
                      </div>
                    </div>
                    <div className={`form-group ${s.fullRow}`}>
                      <label>Dimensiones, mapa de restricción y secuencias</label>
                      <textarea
                        className="form-group input"
                        rows={2}
                        value={form.omg.modificacion_genetica.inserto.dimensiones_mapa_secuencias}
                        onChange={e => update('omg.modificacion_genetica.inserto.dimensiones_mapa_secuencias', e.target.value)}
                        placeholder="Indicar tamaño del inserto, enzimas de restricción relevantes y acceso a secuencias"
                      />
                    </div>
                    <div className="form-group">
                      <label>¿Tiene función específica conocida?</label>
                      <textarea
                        className="form-group input"
                        rows={2}
                        value={form.omg.modificacion_genetica.inserto.funcion_especifica}
                        onChange={e => update('omg.modificacion_genetica.inserto.funcion_especifica', e.target.value)}
                        placeholder="Describir la función biológica del inserto"
                      />
                    </div>
                    <div className="form-group">
                      <label>Información sobre genes estructurales</label>
                      <textarea
                        className="form-group input"
                        rows={2}
                        value={form.omg.modificacion_genetica.inserto.genes_estructurales}
                        onChange={e => update('omg.modificacion_genetica.inserto.genes_estructurales', e.target.value)}
                        placeholder="Genes estructurales presentes en el inserto"
                      />
                    </div>
                    <div className="form-group">
                      <label>Información sobre elementos reguladores</label>
                      <textarea
                        className="form-group input"
                        rows={2}
                        value={form.omg.modificacion_genetica.inserto.elementos_reguladores}
                        onChange={e => update('omg.modificacion_genetica.inserto.elementos_reguladores', e.target.value)}
                        placeholder="Promotores, enhancers, silenciadores, etc."
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleBlock>

              {/* OMG-5: OMG resultante */}
              <CollapsibleBlock title="OMG-5 · OMG resultante" storageKey="secC:omg5" defaultOpen={false}>
                <div className={s.grid2}>
                  <div className="form-group">
                    <label>Denominación del OMG</label>
                    <input
                      className="form-group input"
                      value={form.omg.omg_resultante.denominacion}
                      onChange={e => update('omg.omg_resultante.denominacion', e.target.value)}
                      placeholder="Denominación según nomenclatura internacional"
                    />
                    <p className={s.helpText}>
                      Use nomenclatura internacional recomendada para ratones modificados genéticamente
                    </p>
                  </div>
                  <div className="form-group">
                    <label>¿Requiere medidas de seguridad especiales?</label>
                    <div className={s.radioGroup}>
                      <label className={s.radioLabel}>
                        <input
                          type="radio"
                          name="medidas_seg"
                          checked={form.omg.omg_resultante.medidas_seguridad_especiales.requiere === false}
                          onChange={() => update('omg.omg_resultante.medidas_seguridad_especiales.requiere', false)}
                        />
                        No
                      </label>
                      <label className={s.radioLabel}>
                        <input
                          type="radio"
                          name="medidas_seg"
                          checked={form.omg.omg_resultante.medidas_seguridad_especiales.requiere === true}
                          onChange={() => update('omg.omg_resultante.medidas_seguridad_especiales.requiere', true)}
                        />
                        Sí
                      </label>
                    </div>
                    {form.omg.omg_resultante.medidas_seguridad_especiales.requiere === true && (
                      <textarea
                        className="form-group input"
                        rows={2}
                        style={{ marginTop: '0.5rem' }}
                        value={form.omg.omg_resultante.medidas_seguridad_especiales.detalle}
                        onChange={e => update('omg.omg_resultante.medidas_seguridad_especiales.detalle', e.target.value)}
                        placeholder="Detallar las medidas de seguridad especiales"
                      />
                    )}
                  </div>
                  <div className={`form-group ${s.fullRow}`}>
                    <label>Descripción breve del OMG</label>
                    <AutoExpandTextarea
                      storageKey="secC:omg.omg_resultante.descripcion_breve"
                      rows={3}
                      value={form.omg.omg_resultante.descripcion_breve}
                      onChange={e => update('omg.omg_resultante.descripcion_breve', e.target.value)}
                      placeholder="Descripción del OMG resultante y sus características principales"
                    />
                  </div>
                  <div className={`form-group ${s.fullRow}`}>
                    <label>Estado y expresión del material genético</label>
                    <textarea
                      className="form-group input"
                      rows={2}
                      value={form.omg.omg_resultante.estado_expresion_material_genetico}
                      onChange={e => update('omg.omg_resultante.estado_expresion_material_genetico', e.target.value)}
                      placeholder="Patrón de expresión, tejidos diana, nivel de expresión…"
                    />
                  </div>
                </div>

                {/* Sub-sección: Inserción */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                    Inserción
                  </div>
                  <div className="form-group">
                    <label>¿Conoce el número y localización de la inserción?</label>
                    <div className={s.radioGroup}>
                      <label className={s.radioLabel}>
                        <input
                          type="radio"
                          name="conoce_insercion"
                          checked={form.omg.omg_resultante.insercion.conoce_numero_localizacion === false}
                          onChange={() => update('omg.omg_resultante.insercion.conoce_numero_localizacion', false)}
                        />
                        No
                      </label>
                      <label className={s.radioLabel}>
                        <input
                          type="radio"
                          name="conoce_insercion"
                          checked={form.omg.omg_resultante.insercion.conoce_numero_localizacion === true}
                          onChange={() => update('omg.omg_resultante.insercion.conoce_numero_localizacion', true)}
                        />
                        Sí
                      </label>
                    </div>
                    {form.omg.omg_resultante.insercion.conoce_numero_localizacion === true && (
                      <div className={s.grid3} style={{ marginTop: '0.75rem' }}>
                        <div className="form-group">
                          <label>Número de copias</label>
                          <input
                            className="form-group input"
                            value={form.omg.omg_resultante.insercion.num_copias}
                            onChange={e => update('omg.omg_resultante.insercion.num_copias', e.target.value)}
                            placeholder="Ej. 1"
                          />
                        </div>
                        <div className="form-group">
                          <label>Localización cromosómica</label>
                          <input
                            className="form-group input"
                            value={form.omg.omg_resultante.insercion.localizacion_cromosomica}
                            onChange={e => update('omg.omg_resultante.insercion.localizacion_cromosomica', e.target.value)}
                            placeholder="Ej. Chr 3q21"
                          />
                        </div>
                        <div className="form-group">
                          <label>Secuencias laterales conocidas</label>
                          <input
                            className="form-group input"
                            value={form.omg.omg_resultante.insercion.secuencias_laterales}
                            onChange={e => update('omg.omg_resultante.insercion.secuencias_laterales', e.target.value)}
                            placeholder="Sí / No / Descripción"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-sección: ¿Inactiva un gen? */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div className="form-group">
                    <label>¿Inactiva la inserción la expresión de algún gen?</label>
                    <div className={s.radioGroup}>
                      {[
                        { value: 'no',        label: 'No' },
                        { value: 'no_se_sabe', label: 'No se sabe' },
                        { value: 'si',         label: 'Sí' },
                      ].map(opt => (
                        <label key={opt.value} className={s.radioLabel}>
                          <input
                            type="radio"
                            name="inactiva_gen"
                            value={opt.value}
                            checked={form.omg.omg_resultante.inactiva_gen.estado === opt.value}
                            onChange={() => update('omg.omg_resultante.inactiva_gen.estado', opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    {form.omg.omg_resultante.inactiva_gen.estado === 'si' && (
                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <label>Indicar qué gen queda inactivado</label>
                        <input
                          className="form-group input"
                          value={form.omg.omg_resultante.inactiva_gen.descripcion}
                          onChange={e => update('omg.omg_resultante.inactiva_gen.descripcion', e.target.value)}
                          placeholder="Nombre del gen inactivado"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-sección: Identificación del OMG */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                    Identificación del OMG
                  </div>
                  <div className={s.grid2}>
                    <div className={`form-group ${s.fullRow}`}>
                      <label>Descripción de métodos de identificación del OMG</label>
                      <textarea
                        className="form-group input"
                        rows={2}
                        value={form.omg.omg_resultante.identificacion.descripcion_metodos}
                        onChange={e => update('omg.omg_resultante.identificacion.descripcion_metodos', e.target.value)}
                        placeholder="Métodos utilizados para identificar el OMG (PCR, secuenciación, etc.)"
                      />
                    </div>
                    <div className="form-group">
                      <label>Marcadores específicos del OMG</label>
                      <input
                        className="form-group input"
                        value={form.omg.omg_resultante.identificacion.marcadores_especificos}
                        onChange={e => update('omg.omg_resultante.identificacion.marcadores_especificos', e.target.value)}
                        placeholder="Ej. GFP, resistencia a neomicina…"
                      />
                    </div>
                    <div className="form-group">
                      <label>¿Se dispone de técnicas para identificación?</label>
                      <div className={s.radioGroup}>
                        <label className={s.radioLabel}>
                          <input
                            type="radio"
                            name="tecnicas_disp"
                            checked={form.omg.omg_resultante.identificacion.tecnicas_disponibles.disponible === false}
                            onChange={() => update('omg.omg_resultante.identificacion.tecnicas_disponibles.disponible', false)}
                          />
                          No
                        </label>
                        <label className={s.radioLabel}>
                          <input
                            type="radio"
                            name="tecnicas_disp"
                            checked={form.omg.omg_resultante.identificacion.tecnicas_disponibles.disponible === true}
                            onChange={() => update('omg.omg_resultante.identificacion.tecnicas_disponibles.disponible', true)}
                          />
                          Sí
                        </label>
                      </div>
                      {form.omg.omg_resultante.identificacion.tecnicas_disponibles.disponible === true && (
                        <input
                          className="form-group input"
                          style={{ marginTop: '0.5rem' }}
                          value={form.omg.omg_resultante.identificacion.tecnicas_disponibles.descripcion}
                          onChange={e => update('omg.omg_resultante.identificacion.tecnicas_disponibles.descripcion', e.target.value)}
                          placeholder="Especificar las técnicas disponibles"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleBlock>
            </>
          )}
        </>
      )}

      {/* Bloque final: Firma */}
      <CollapsibleBlock
        title="Firma del responsable"
        storageKey="secC:firma"
        defaultOpen={false}
        requiredFields={[form.firma.nombre, form.firma.fecha]}
      >
        <div className={s.grid2}>
          <div className="form-group">
            <label>Nombre y apellidos</label>
            <input
              className="form-group input"
              value={form.firma.nombre}
              onChange={e => update('firma.nombre', e.target.value)}
              placeholder="Responsable de la cría"
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
        {isEdit && (
          <ExportButton
            endpoint={`/api/animalario/crias/${cId}/exportar`}
            basename={`SeccionC_${cId}`}
          />
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
