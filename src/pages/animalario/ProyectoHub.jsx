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
  const hasCria        = p.seccionA?.hay_cria === true
  const numProcs       = Array.isArray(p.procedimientos) ? p.procedimientos.length : 0
  const hasProductos   = Boolean(p.hay_productos_riesgo)
  const modificaciones = Array.isArray(p.modificaciones) ? p.modificaciones : []

  // Map cepa_idx → cría reference so we can match per-cepa
  const criasByCepaIdx = {}
  for (const c of p.crias ?? []) {
    if (c.cepa_idx != null) criasByCepaIdx[c.cepa_idx] = c
  }

  const cepas = p.seccionA?.cepas_cria ?? []

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

        {/* Sección C — Cría: one card per cepa declared in Sección A */}
        {hasCria && cepas.length === 0 && (
          <SectionCard
            label="Sección C"
            name="Cría de animales"
            detail="No hay cepas/líneas declaradas en Sección A"
            ok={false}
            actions={
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/animalario/proyecto/${proyectoId}/editar`)}
              >
                Añadir en Sección A →
              </button>
            }
          />
        )}
        {hasCria && cepas.map((cepa, idx) => {
          const cria   = criasByCepaIdx[idx]
          const nombre = cepa.acronimo || cepa.nomenclatura_internacional || `Cepa ${idx + 1}`
          const detalle = cepa.acronimo && cepa.nomenclatura_internacional && cepa.acronimo !== cepa.nomenclatura_internacional
            ? cepa.nomenclatura_internacional
            : null

          return (
            <SectionCard
              key={idx}
              label={`Sección C · Cepa ${idx + 1}`}
              name={nombre}
              detail={detalle}
              ok={Boolean(cria)}
              actions={
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    cria
                      ? navigate(`/animalario/proyecto/${proyectoId}/cria/${cria.id}`)
                      : navigate(`/animalario/proyecto/${proyectoId}/cria/nueva?cepaIdx=${idx}`)
                  }
                >
                  {cria ? 'Editar' : 'Crear'}
                </button>
              }
            />
          )
        })}

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
