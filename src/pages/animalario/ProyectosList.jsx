import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from '../../styles/animalario/animalario.module.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ProyectosList() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const navigate = useNavigate()

  function handleDelete(p) {
    if (!window.confirm(`¿Eliminar el proyecto "${p.titulo}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(p.id)
    fetch(`/api/animalario/proyectos/${p.id}`, { method: 'DELETE' })
      .then(r => { if (!r.ok) throw new Error('Error al eliminar'); return r.json() })
      .then(() => setProyectos(prev => prev.filter(x => x.id !== p.id)))
      .catch(err => alert(err.message))
      .finally(() => setDeletingId(null))
  }

  useEffect(() => {
    fetch('/api/animalario/proyectos')
      .then(r => { if (!r.ok) throw new Error('Error al cargar proyectos'); return r.json() })
      .then(data => { setProyectos(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  const filtered = proyectos.filter(p => {
    const q = search.toLowerCase()
    return (
      p.titulo?.toLowerCase().includes(q) ||
      p.referencia_cbba?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <PageHeader
        back="/animalario"
        backLabel="Animalario"
        title="Proyectos"
        subtitle="Lista de proyectos de experimentación animal registrados."
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/animalario/proyecto/nuevo')}>
          ＋ Nuevo proyecto
        </button>
      </div>

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar por título o referencia CBBA…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className={styles.empty}>Cargando proyectos…</p>}
      {error   && <p className={`alert alert-error ${styles.empty}`}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className={styles.empty}>
          {proyectos.length === 0
            ? 'Todavía no hay proyectos. Crea el primero.'
            : 'No hay proyectos que coincidan con la búsqueda.'}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className={styles.projectList}>
          {filtered.map(p => (
            <div key={p.id} className={styles.projectCard}>
              <div className={styles.projectInfo}>
                <div className={styles.projectTitle}>{p.titulo}</div>
                <div className={styles.projectMeta}>
                  {p.referencia_cbba && (
                    <span className={styles.projectMetaItem}>
                      <strong>Ref. CBBA:</strong> {p.referencia_cbba}
                    </span>
                  )}
                  {p.responsable_nombre && (
                    <span className={styles.projectMetaItem}>
                      <strong>Responsable:</strong> {p.responsable_nombre}
                    </span>
                  )}
                  <span className={styles.projectMetaItem}>
                    <strong>Procedimientos:</strong> {p.num_procedimientos}
                  </span>
                  <span className={styles.projectMetaItem}>
                    <strong>Actualizado:</strong> {formatDate(p.fecha_actualizacion)}
                  </span>
                </div>
              </div>
              <div className={styles.projectActions}>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/animalario/proyecto/${p.id}`)}
                >
                  Abrir
                </button>
                <button
                  className="btn btn-ghost"
                  disabled
                  title="Próximamente"
                >
                  Exportar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(p)}
                  disabled={deletingId === p.id}
                  title="Eliminar proyecto"
                >
                  {deletingId === p.id ? 'Eliminando…' : 'Borrar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
