import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import styles from '../../../styles/animalario/animalario.module.css'
import hubStyles from './ProcedimientosHub.module.css'
import ManualUsuario from '../../../components/animalario/ManualUsuario'
import ReplicarModal from '../../../components/animalario/ReplicarModal'

const SEVERITY_LABELS = { none: 'Sin clasificar', low: 'Leve', medium: 'Moderado', high: 'Severo' }

function slug(str, fallback = 'sin_titulo') {
  const s = (str ?? '').replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ ]/g, '').replace(/ /g, '_').substring(0, 60).trim()
  return s || fallback
}

async function descargarFichero(url, nombreSugerido) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? `Error ${res.status}`)
    }
    const blob    = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const cd      = res.headers.get('Content-Disposition') ?? ''
    const name    = cd.match(/filename="(.+?)"/)?.[1] ?? nombreSugerido
    const a = document.createElement('a')
    a.href = blobUrl; a.download = name
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(blobUrl)
  } catch (e) {
    alert(`No se pudo exportar: ${e.message}`)
  }
}
const SEVERITY_CLASSES = {
  none:   styles.severityNone,
  low:    styles.severityLow,
  medium: styles.severityMedium,
  high:   styles.severityHigh,
}

function SeverityBadge({ value }) {
  const v = value || 'none'
  return (
    <span className={`${styles.severityBadge} ${SEVERITY_CLASSES[v] ?? styles.severityNone}`}>
      {SEVERITY_LABELS[v] ?? v}
    </span>
  )
}

export default function ProcedimientosHub() {
  const { proyectoId } = useParams()
  const navigate = useNavigate()

  const [proyecto, setProyecto]       = useState(null)
  const [procs, setProcs]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [deleting, setDeleting]       = useState(null)
  const [duplicating, setDuplicating] = useState(null)
  const [exporting, setExporting]     = useState(null)
  const [manualAbierto, setManualAbierto] = useState(false)
  const [replicarOpen, setReplicarOpen]   = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/animalario/proyectos/${proyectoId}`).then(r => r.json()),
      fetch(`/api/animalario/proyectos/${proyectoId}/procedimientos`).then(r => r.json()),
    ])
      .then(([proy, ps]) => {
        setProyecto(proy)
        setProcs(Array.isArray(ps) ? ps : [])
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }

  useEffect(() => { load() }, [proyectoId])

  async function handleDelete(procId) {
    if (!confirm('¿Eliminar este procedimiento? Esta acción no se puede deshacer.')) return
    setDeleting(procId)
    try {
      const r = await fetch(`/api/animalario/procedimientos/${procId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Error al eliminar')
      setProcs(prev => prev.filter(p => p.id !== procId))
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(null)
    }
  }

  async function handleExport(procId, formato, titulo) {
    const key = `${procId}-${formato}`
    setExporting(key)
    await descargarFichero(
      `/api/animalario/procedimientos/${procId}/exportar?formato=${formato}`,
      `Procedimiento_${slug(titulo, 'procedimiento')}.${formato}`
    )
    setExporting(null)
  }

  async function handleDuplicate(procId) {
    setDuplicating(procId)
    try {
      const r = await fetch(`/api/animalario/procedimientos/${procId}/duplicar`, { method: 'POST' })
      if (!r.ok) throw new Error('Error al duplicar')
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setDuplicating(null)
    }
  }

  const totalAnimals = procs.reduce((sum, p) => {
    const n = parseInt(p.datos_generales?.num_animales ?? 0, 10)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const hasRiesgo = procs.some(p => p.otras_sustancias?.hay_riesgo)

  if (loading) return <p className={styles.empty}>Cargando procedimientos…</p>
  if (error)   return <p className={`alert alert-error ${styles.empty}`}>{error}</p>

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <PageHeader
          back={`/animalario/proyecto/${proyectoId}`}
          backLabel="Proyecto"
          title="Sección B — Procedimientos"
          subtitle={proyecto?.seccionA?.titulo ?? ''}
        />
        <button
          type="button"
          className={hubStyles.botonManual}
          onClick={() => setManualAbierto(true)}
          title="Manual de usuario"
          aria-label="Abrir manual de usuario"
        >
          📖
        </button>
      </div>

      <ManualUsuario abierto={manualAbierto} onCerrar={() => setManualAbierto(false)} />

      {/* Summary bar */}
      {procs.length > 0 && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryBarItem}>
            <strong>{procs.length}</strong>
            procedimiento{procs.length !== 1 ? 's' : ''}
          </div>
          <div className={styles.summaryBarItem}>
            <strong>{totalAnimals}</strong>
            animales totales
          </div>
          {hasRiesgo && (
            <div className={styles.summaryBarItem}>
              <strong>⚠</strong>
              hay productos con riesgo (Sección D requerida)
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--muted-light)' }}>
          {procs.length === 0 ? 'Todavía no hay procedimientos registrados.' : ''}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => setReplicarOpen(true)}
        >
          ⎘ Replicar de otro proyecto
        </button>
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/animalario/proyecto/${proyectoId}/procedimientos/nuevo`)}
        >
          ＋ Nuevo procedimiento
        </button>
      </div>

      {replicarOpen && (
        <ReplicarModal
          tipo="procedimiento"
          proyectoId={proyectoId}
          onClose={() => setReplicarOpen(false)}
          onReplicated={() => { setReplicarOpen(false); load() }}
        />
      )}

      {/* Procedure cards */}
      {procs.length > 0 && (
        <div className={styles.projectList}>
          {procs.map((proc, idx) => {
            const titulo     = proc.datos_generales?.titulo_procedimiento || `Procedimiento ${idx + 1}`
            const especie    = proc.datos_generales?.especies?.join(', ') || '—'
            const numAnimales = proc.datos_generales?.num_animales ?? '—'
            const severidad  = proc.clasificacion_severidad || 'none'

            return (
              <div key={proc.id} className={styles.projectCard}>
                <div className={styles.projectInfo}>
                  <div className={styles.projectTitle}>{titulo}</div>
                  <div className={styles.projectMeta}>
                    <span className={styles.projectMetaItem}>
                      <strong>Especie:</strong> {especie}
                    </span>
                    <span className={styles.projectMetaItem}>
                      <strong>Nº animales:</strong> {numAnimales}
                    </span>
                    {proc.otras_sustancias?.hay_riesgo && (
                      <span className={styles.projectMetaItem} style={{ color: '#92400e' }}>
                        ⚠ productos con riesgo
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.projectActions}>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/animalario/proyecto/${proyectoId}/procedimientos/${proc.id}`)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={exporting === `${proc.id}-docx`}
                    onClick={() => handleExport(proc.id, 'docx', titulo)}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {exporting === `${proc.id}-docx` ? '…' : '⬇ Word'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={exporting === `${proc.id}-pdf`}
                    onClick={() => handleExport(proc.id, 'pdf', titulo)}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {exporting === `${proc.id}-pdf` ? '…' : '⬇ PDF'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={duplicating === proc.id}
                    onClick={() => handleDuplicate(proc.id)}
                  >
                    {duplicating === proc.id ? '…' : 'Duplicar'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={deleting === proc.id}
                    onClick={() => handleDelete(proc.id)}
                    style={{ color: 'var(--accent)' }}
                  >
                    {deleting === proc.id ? '…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
