import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import styles from './AutorizacionImagenList.module.css'

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return d }
}

export default function AutorizacionImagenList() {
  const navigate = useNavigate()
  const [eventos, setEventos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function loadEventos() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/certificados/eventos')
      const data = await res.json()
      setEventos(data)
    } catch {
      setError('No se pudieron cargar los eventos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEventos() }, [])

  async function handleDelete(id, nombre) {
    if (!window.confirm(`¿Eliminar el evento "${nombre || 'este evento'}"? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    try {
      await fetch(`/api/certificados/eventos/${id}`, { method: 'DELETE' })
      setEventos(prev => prev.filter(e => e.id !== id))
    } catch {
      alert('Error al eliminar el evento.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        back="/autorizaciones"
        backLabel="Certificados"
        title="Autorización de imagen"
        subtitle="Gestiona los eventos y recoge autorizaciones de captación de imagen."
      />

      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => navigate('/autorizaciones/autorizacion-imagen/nuevo')}>
          + Nuevo evento
        </button>
      </div>

      <section>
        <h2 className={styles.sectionLabel}>📋 Eventos</h2>

        {loading && <p className={styles.status}>Cargando eventos…</p>}
        {error   && <div className="alert alert-error">{error}</div>}

        {!loading && !error && eventos.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📸</span>
            <p>No hay ningún evento registrado todavía.</p>
            <p className={styles.emptyHint}>Crea un evento para empezar a recoger autorizaciones de imagen.</p>
            <button className="btn btn-primary" onClick={() => navigate('/autorizaciones/autorizacion-imagen/nuevo')}>
              + Crear primer evento
            </button>
          </div>
        )}

        {!loading && !error && eventos.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre del evento</th>
                  <th>Fecha</th>
                  <th>Lugar</th>
                  <th>Participantes</th>
                  <th>Firmas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map(ev => (
                  <tr key={ev.id} className={styles.row}>
                    <td>
                      <Link to={`/autorizaciones/autorizacion-imagen/${ev.id}`} className={styles.nameLink}>
                        {ev.nombre || '(sin nombre)'}
                      </Link>
                    </td>
                    <td>{formatDate(ev.fecha)}</td>
                    <td>{ev.lugar || '—'}</td>
                    <td className={styles.centered}>
                      <span className={styles.badge}>{(ev.participantes || []).length}</span>
                    </td>
                    <td className={styles.centered}>
                      <span className={`${styles.badge} ${(ev.firmasCount || 0) > 0 ? styles.badgeGreen : ''}`}>
                        {ev.firmasCount || 0}
                      </span>
                    </td>
                    <td className={styles.actions}>
                      <button
                        className="btn btn-sm"
                        onClick={() => navigate(`/autorizaciones/autorizacion-imagen/${ev.id}`)}
                      >
                        Abrir
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={deleting === ev.id}
                        onClick={() => handleDelete(ev.id, ev.nombre)}
                      >
                        {deleting === ev.id ? '…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
