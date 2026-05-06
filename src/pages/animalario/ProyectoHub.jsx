import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import styles from '../../styles/animalario/animalario.module.css'

const TIPO_LABELS = {
  alta_baja_investigadores:  'Investigadores',
  adicion_animales:          '+ Animales',
  adicion_procedimientos:    '+ Procedimientos',
  cambios_procedimientos:    'Cambios proced.',
  adicion_linea_animal:      '+ Línea animal',
  adicion_lugar:             '+ Lugar',
  cambio_alojamiento:        'Alojamiento',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatusDot({ ok, warn }) {
  let cls = styles.statusDotPending
  if (ok)   cls = styles.statusDotOk
  if (warn) cls = styles.statusDotWarn
  return <span className={`${styles.statusDot} ${cls}`} />
}

function SectionCard({ label, name, detail, ok, warn, actions }) {
  return (
    <div className={styles.sectionCard}>
      <StatusDot ok={ok} warn={warn} />
      <div className={styles.sectionInfo}>
        <div className={styles.sectionLabel}>{label}</div>
        <div className={styles.sectionName}>{name}</div>
        {detail && <div className={styles.sectionDetail}>{detail}</div>}
      </div>
      <div className={styles.sectionActions}>
        {ok   && <span className={styles.statusBadgeOk}>Completada</span>}
        {warn && <span className={styles.statusBadgePending}>Pendiente</span>}
        {actions}
      </div>
    </div>
  )
}

function ModificacionesSection({ proyectoId, modificaciones, navigate, onDelete }) {
  return (
    <div className={styles.modifSection}>
      <div className={styles.modifSectionHeader}>
        <div className={styles.modifSectionTitle}>
          <StatusDot ok={modificaciones.length > 0} />
          <div>
            <div className={styles.modifSectionLabel}>Modificaciones</div>
            <div className={styles.modifSectionName}>Modificaciones del proyecto</div>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => navigate(`/animalario/proyecto/${proyectoId}/modificacion/nueva`)}
        >
          ＋ Nueva modificación
        </button>
      </div>

      {modificaciones.length === 0 && (
        <div className={styles.modifEmpty}>
          Este proyecto no tiene modificaciones registradas.
        </div>
      )}

      {modificaciones.map(m => {
        const tipos = Object.entries(m.tipos_cambio ?? {})
          .filter(([, v]) => v === true)
          .map(([k]) => TIPO_LABELS[k] ?? k)

        return (
          <div key={m.id} className={styles.modifItem}>
            <div className={styles.modifItemInfo}>
              <span className={styles.modifItemNum}>Mod. {m.numero_modificacion}</span>
              <span className={styles.modifItemDate}>{formatDate(m.fecha_creacion)}</span>
              {tipos.length > 0 && (
                <div className={styles.modifBadges}>
                  {tipos.map(t => <span key={t} className={styles.modifBadge}>{t}</span>)}
                </div>
              )}
            </div>
            <div className={styles.modifItemActions}>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/animalario/proyecto/${proyectoId}/modificacion/${m.id}`)}
              >
                Editar
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onDelete(m.id)}
                style={{ color: 'var(--accent)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProyectoHub() {
  const { proyectoId } = useParams()
  const navigate       = useNavigate()
  const [proyecto, setProyecto] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const load = useCallback(() => {
    fetch(`/api/animalario/proyectos/${proyectoId}`)
      .then(r => { if (!r.ok) throw new Error('Proyecto no encontrado'); return r.json() })
      .then(data => { setProyecto(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [proyectoId])

  useEffect(() => { load() }, [load])

  async function handleDeleteModif(mId) {
    if (!confirm('¿Eliminar esta modificación? Esta acción no se puede deshacer.')) return
    try {
      const r = await fetch(`/api/animalario/modificaciones/${mId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Error al eliminar')
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  if (loading) return <p className={styles.empty}>Cargando proyecto…</p>
  if (error)   return <p className={`alert alert-error ${styles.empty}`}>{error}</p>

  const p = proyecto

  const hasSeccionA    = Boolean(p.seccionA)
  const hasCria        = p.seccionA?.hay_cria === true
  const numProcs       = Array.isArray(p.procedimientos) ? p.procedimientos.length : 0
  const hasProductos   = Boolean(p.hay_productos_riesgo)
  const seccionDOk     = Boolean(p.seccionD_id)
  const modificaciones = Array.isArray(p.modificaciones) ? p.modificaciones : []

  // Map cepa_idx → cría reference
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

      {/* Warning banner — Sección D pendiente */}
      {hasProductos && !seccionDOk && (
        <div className={styles.warningBanner}>
          ⚠ Uno o más procedimientos declaran sustancias con riesgo. Completa la Sección D.
        </div>
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

        {/* Sección B */}
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

        {/* Sección C — una card por cepa */}
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

        {/* Sección D */}
        {hasProductos && (
          <SectionCard
            label="Sección D"
            name="Productos con riesgo"
            ok={seccionDOk}
            warn={!seccionDOk}
            actions={
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/animalario/proyecto/${proyectoId}/productos`)}
              >
                {seccionDOk ? 'Editar' : 'Crear'}
              </button>
            }
          />
        )}

        {/* Modificaciones — expanded list */}
        <ModificacionesSection
          proyectoId={proyectoId}
          modificaciones={modificaciones}
          navigate={navigate}
          onDelete={handleDeleteModif}
        />

      </div>

      {/* Exportar */}
      <button className="btn btn-ghost" disabled title="Próximamente">
        ⬇ Exportar proyecto completo
      </button>
    </div>
  )
}
