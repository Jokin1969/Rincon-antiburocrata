import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import styles from '../../styles/animalario/animalario.module.css'

function StatusDot({ ok }) {
  return <span className={`${styles.statusDot} ${ok ? styles.statusDotOk : styles.statusDotPending}`} />
}

function SectionCard({ label, name, detail, ok, actions }) {
  return (
    <div className={styles.sectionCard}>
      <StatusDot ok={ok} />
      <div className={styles.sectionInfo}>
        <div className={styles.sectionLabel}>{label}</div>
        <div className={styles.sectionName}>{name}</div>
        {detail && <div className={styles.sectionDetail}>{detail}</div>}
      </div>
      <div className={styles.sectionActions}>
        {ok && <span className={styles.statusBadgeOk}>Completada</span>}
        {actions}
      </div>
    </div>
  )
}

export default function ProyectoHub() {
  const { proyectoId } = useParams()
  const navigate       = useNavigate()
  const [proyecto, setProyecto] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetch(`/api/animalario/proyectos/${proyectoId}`)
      .then(r => { if (!r.ok) throw new Error('Proyecto no encontrado'); return r.json() })
      .then(data => { setProyecto(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [proyectoId])

  if (loading) return <p className={styles.empty}>Cargando proyecto…</p>
  if (error)   return <p className={`alert alert-error ${styles.empty}`}>{error}</p>

  const p = proyecto

  const hasSeccionA    = Boolean(p.seccionA)
  const hasCria        = p.seccionA?.tiene_cria === true
  const numProcs       = Array.isArray(p.procedimientos) ? p.procedimientos.length : 0
  const hasProductos   = Array.isArray(p.procedimientos) && p.procedimientos.some(b => b.tiene_productos_riesgo)
  const numCrias       = Array.isArray(p.crias) ? p.crias.length : 0
  const modificaciones = Array.isArray(p.modificaciones) ? p.modificaciones : []

  return (
    <div>
      {/* Logos bar */}
      <div className={styles.logosBar}>
        <img src="/logos/animalario/cicbiogune.png" alt="CIC bioGUNE" className={styles.logoImg} />
        <div className={styles.logosBarCenter}>
          <div className={styles.logosBarTitle}>Animalario</div>
          <div className={styles.logosBarSub}>CIC bioGUNE · Gestión de experimentación animal</div>
        </div>
        <img src="/logos/animalario/aaalac.png" alt="AAALAC International" className={styles.logoImg} />
      </div>

      {/* Project title */}
      <div className={styles.projectTitle2}>{p.titulo}</div>
      {p.referencia_cbba && (
        <div className={styles.projectRef}>Ref. CBBA: {p.referencia_cbba}</div>
      )}

      {/* Sections */}
      <div className={styles.sectionGrid}>

        {/* Sección A */}
        <SectionCard
          label="Sección A"
          name="Información general del proyecto"
          ok={hasSeccionA}
          actions={
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/animalario/proyecto/${proyectoId}/editar`)}
            >
              {hasSeccionA ? 'Editar' : 'Crear'}
            </button>
          }
        />

        {/* Sección B — Procedimientos */}
        <SectionCard
          label="Sección B"
          name="Procedimientos"
          detail={`${numProcs} procedimiento${numProcs !== 1 ? 's' : ''} definido${numProcs !== 1 ? 's' : ''}`}
          ok={numProcs > 0}
          actions={
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/animalario/proyecto/${proyectoId}/procedimientos`)}
            >
              Gestionar →
            </button>
          }
        />

        {/* Sección C — Cría (solo si seccionA.tiene_cria) */}
        {hasCria && (
          <SectionCard
            label="Sección C"
            name="Cría de animales"
            detail={`${numCrias} cepa${numCrias !== 1 ? 's' : ''}/línea${numCrias !== 1 ? 's' : ''} definida${numCrias !== 1 ? 's' : ''}`}
            ok={numCrias > 0}
            actions={
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/animalario/proyecto/${proyectoId}/cria/nueva`)}
              >
                Gestionar →
              </button>
            }
          />
        )}

        {/* Sección D — Productos con riesgo (solo si algún procedimiento lo tiene) */}
        {hasProductos && (
          <SectionCard
            label="Sección D"
            name="Productos con riesgo"
            ok={Boolean(p.seccionD)}
            actions={
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/animalario/proyecto/${proyectoId}/productos`)}
              >
                Gestionar →
              </button>
            }
          />
        )}

        {/* Modificaciones */}
        <SectionCard
          label="Modificaciones"
          name="Modificaciones del proyecto"
          detail={
            modificaciones.length === 0
              ? 'Sin modificaciones registradas'
              : `${modificaciones.length} modificación${modificaciones.length !== 1 ? 'es' : ''}`
          }
          ok={modificaciones.length > 0}
          actions={
            <button
              className="btn btn-ghost"
              onClick={() => navigate(`/animalario/proyecto/${proyectoId}/modificacion/nueva`)}
            >
              Nueva modificación
            </button>
          }
        />

      </div>

      {/* Exportar */}
      <button className="btn btn-ghost" disabled title="Próximamente">
        ⬇ Exportar proyecto completo
      </button>
    </div>
  )
}
