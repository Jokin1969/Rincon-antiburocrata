import { useState, useEffect } from 'react'
import styles from './ReplicarModal.module.css'

/**
 * Modal para replicar una sección (B/C/D) desde cualquier proyecto del repositorio.
 *
 * Props:
 *  tipo        : 'procedimiento' | 'cria' | 'seccion-d'
 *  proyectoId  : ID del proyecto destino
 *  onClose     : () => void
 *  onReplicated: (result) => void   — llamado tras replicar con éxito
 */
export default function ReplicarModal({ tipo, proyectoId, onClose, onReplicated }) {
  const [proyectos,  setProyectos]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [selected,   setSelected]   = useState(null)   // { proyectoId, itemId? }
  const [replicando, setReplicando] = useState(false)
  const [busqueda,   setBusqueda]   = useState('')

  useEffect(() => {
    fetch('/api/animalario/proyectos-resumen')
      .then(r => r.json())
      .then(data => {
        // Excluir el proyecto actual y los que no tienen secciones del tipo pedido
        const filtrados = data.filter(p => {
          if (p.id === proyectoId) return false
          if (tipo === 'procedimiento') return p.procedimientos.length > 0
          if (tipo === 'cria')          return p.crias.length > 0
          if (tipo === 'seccion-d')     return p.tieneSeccionD
          return false
        })
        setProyectos(filtrados)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [proyectoId, tipo])

  async function handleReplicar() {
    if (!selected) return
    setReplicando(true)
    try {
      let url
      if (tipo === 'procedimiento') {
        url = `/api/animalario/proyectos/${proyectoId}/procedimientos/replicar/${selected.itemId}`
      } else if (tipo === 'cria') {
        url = `/api/animalario/proyectos/${proyectoId}/crias/replicar/${selected.itemId}`
      } else {
        url = `/api/animalario/proyectos/${proyectoId}/seccion-d/replicar/${selected.proyectoId}`
      }
      const res  = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      onReplicated(data)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setReplicando(false)
    }
  }

  const tipoLabel = tipo === 'procedimiento' ? 'Sección B (Procedimiento)'
    : tipo === 'cria' ? 'Sección C (Cría)'
    : 'Sección D (Productos con riesgo)'

  const proyectosFiltrados = proyectos.filter(p =>
    p.titulo.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Replicar {tipoLabel}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p className={styles.subtitle}>
          Selecciona la sección que quieres copiar al proyecto actual. Se creará una réplica independiente.
        </p>

        {loading && <p className={styles.info}>Cargando proyectos…</p>}
        {error   && <p className={styles.errorMsg}>{error}</p>}

        {!loading && !error && (
          <>
            <input
              className={styles.search}
              type="text"
              placeholder="Buscar proyecto…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />

            {proyectosFiltrados.length === 0 ? (
              <p className={styles.info}>No hay proyectos con {tipoLabel} disponibles.</p>
            ) : (
              <ul className={styles.list}>
                {proyectosFiltrados.map(p => (
                  <li key={p.id} className={styles.proyectoItem}>
                    <div className={styles.proyectoTitulo}>{p.titulo}</div>

                    {tipo === 'seccion-d' && (
                      <button
                        className={`${styles.itemBtn} ${selected?.proyectoId === p.id ? styles.itemBtnSelected : ''}`}
                        onClick={() => setSelected({ proyectoId: p.id })}
                      >
                        Sección D de este proyecto
                      </button>
                    )}

                    {(tipo === 'procedimiento' ? p.procedimientos : p.crias).map(item => {
                      const label = tipo === 'procedimiento'
                        ? item.titulo
                        : (item.acronimo || item.nomenclatura || item.id)
                      const isSelected = selected?.itemId === item.id
                      return (
                        <button
                          key={item.id}
                          className={`${styles.itemBtn} ${isSelected ? styles.itemBtnSelected : ''}`}
                          onClick={() => setSelected({ proyectoId: p.id, itemId: item.id })}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose} disabled={replicando}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleReplicar}
            disabled={!selected || replicando}
          >
            {replicando ? 'Replicando…' : 'Replicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
