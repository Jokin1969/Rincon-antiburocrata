import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from './GastosViajeList.module.css'

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return d }
}

export default function GastosViajeList() {
  const navigate = useNavigate()
  const [viajes, setViajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function loadViajes() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/gastos-viaje')
      const data = await res.json()
      setViajes(data)
    } catch {
      setError('No se pudieron cargar los viajes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadViajes() }, [])

  async function handleDelete(id, nombre) {
    if (!window.confirm(`¿Eliminar "${nombre || 'este viaje'}"? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    try {
      await fetch(`/api/gastos-viaje/${id}`, { method: 'DELETE' })
      setViajes(prev => prev.filter(v => v.id !== id))
    } catch {
      alert('Error al eliminar el viaje.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Gastos de viaje"
        subtitle="Registra y gestiona los gastos de tus desplazamientos: transporte, manutención, alojamiento y otros."
      />

      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => navigate('/gastos-viaje/nuevo')}>
          + Nuevo viaje
        </button>
      </div>

      {loading && <p className={styles.status}>Cargando viajes…</p>}
      {error   && <div className="alert alert-error">{error}</div>}

      {!loading && !error && viajes.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>✈️</span>
          <p>No hay ningún viaje registrado todavía.</p>
          <button className="btn btn-primary" onClick={() => navigate('/gastos-viaje/nuevo')}>
            Registrar primer viaje
          </button>
        </div>
      )}

      {!loading && viajes.length > 0 && (
        <div className={styles.list}>
          {viajes.map(v => (
            <div key={v.id} className={styles.card}>
              <div className={styles.cardMain} onClick={() => navigate(`/gastos-viaje/${v.id}`)}>
                <div className={styles.cardTitle}>{v.nombre || <em>Sin título</em>}</div>
                <div className={styles.cardMeta}>
                  {v.fechaInicio && (
                    <span>
                      {formatDate(v.fechaInicio)}
                      {v.fechaFin ? ` – ${formatDate(v.fechaFin)}` : ''}
                    </span>
                  )}
                  {v.updatedAt && (
                    <span className={styles.updatedAt}>
                      Guardado: {new Date(v.updatedAt).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate(`/gastos-viaje/${v.id}`)}
                >
                  Editar
                </button>
                <button
                  className={`btn btn-ghost ${styles.deleteBtn}`}
                  onClick={() => handleDelete(v.id, v.nombre)}
                  disabled={deleting === v.id}
                >
                  {deleting === v.id ? '…' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
