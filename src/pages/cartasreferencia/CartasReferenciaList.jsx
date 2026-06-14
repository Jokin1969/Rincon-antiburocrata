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
    return new Date(d).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return d }
}

export default function CartasReferenciaList() {
  const navigate = useNavigate()
  const [cartas, setCartas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function loadCartas() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/cartas-referencia')
      const data = await res.json()
      setCartas(data)
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
        subtitle="Gestiona tus cartas de referencia, recomendación y apoyo a proyectos."
      />

      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => navigate('/cartas-referencia/nueva')}>
          + Nueva carta
        </button>
      </div>

      <section>
        <h2 className={styles.sectionLabel}>
          📜 Cartas guardadas
        </h2>

        {loading && <p className={styles.status}>Cargando cartas…</p>}
        {error   && <div className="alert alert-error">{error}</div>}

        {!loading && !error && cartas.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📜</span>
            <p>No hay ninguna carta registrada todavía.</p>
            <p className={styles.emptyHint}>
              Pulsa <strong>+ Nueva carta</strong> para crear tu primera carta de referencia o recomendación.
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
                    <span className={styles.langBadge}>
                      {c.idioma === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
                    </span>
                    {c.refNombre && (
                      <span>Para: {c.refNombre}</span>
                    )}
                    {c.actualizado && (
                      <span>
                        Última edición: {formatDate(c.actualizado)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/cartas-referencia/${c.id}`)}
                  >
                    Abrir
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
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
