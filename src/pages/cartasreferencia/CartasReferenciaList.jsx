import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from './CartasReferenciaList.module.css'

const TIPO_LABELS = {
  profesional:  'Referencia profesional',
  proyecto:     'Apoyo a proyecto',
  'green-card': 'Green Card / Visa',
  otro:         'Otro',
}

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return d }
}

export default function CartasReferenciaList() {
  const navigate = useNavigate()
  const [cartas, setCartas]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function loadCartas() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/cartas-referencia')
      const data = await res.json()
      setCartas(Array.isArray(data) ? data : [])
    } catch {
      setError('No se pudieron cargar las cartas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCartas() }, [])

  async function handleDelete(id, titulo) {
    if (!window.confirm(`¿Eliminar "${titulo || 'esta carta'}"? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    try {
      await fetch(`/api/cartas-referencia/${id}`, { method: 'DELETE' })
      setCartas(prev => prev.filter(c => c.id !== id))
    } catch {
      alert('Error al eliminar la carta.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Cartas de referencia"
        subtitle="Genera y gestiona cartas de referencia, recomendación y apoyo a proyectos."
      />

      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => navigate('/cartas-referencia/nueva')}>
          + Nueva carta
        </button>
      </div>

      <section>
        <h2 className={styles.sectionLabel}>📜 Cartas guardadas</h2>

        {loading && <p className={styles.status}>Cargando cartas…</p>}
        {error   && <div className="alert alert-error">{error}</div>}

        {!loading && !error && cartas.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📜</span>
            <p>No hay ninguna carta de referencia todavía.</p>
            <p className={styles.emptyHint}>
              Pulsa <strong>+ Nueva carta</strong> para crear tu primera carta.
            </p>
          </div>
        )}

        {!loading && cartas.length > 0 && (
          <div className={styles.list}>
            {cartas.map(c => (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardMain} onClick={() => navigate(`/cartas-referencia/${c.id}`)}>
                  <div className={styles.cardTitle}>{c.titulo || <em>Sin título</em>}</div>
                  <div className={styles.cardMeta}>
                    <span className={styles.typeBadge}>{TIPO_LABELS[c.tipo] || c.tipo}</span>
                    <span className={styles.langBadge}>{c.idioma === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}</span>
                    {c.referenciaNombre && <span>Para: <strong>{c.referenciaNombre}</strong></span>}
                    {c.fecha && <span>📅 {formatDate(c.fecha)}</span>}
                    {c.actualizado && (
                      <span className={styles.updatedAt}>
                        Editada: {new Date(c.actualizado).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className="btn btn-primary" onClick={() => navigate(`/cartas-referencia/${c.id}`)}>
                    Abrir
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDelete(c.id, c.titulo)}
                    disabled={deleting === c.id}
                  >
                    {deleting === c.id ? '…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
