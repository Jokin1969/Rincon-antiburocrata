import { useState, useEffect } from 'react'
import ModuleCard from '../components/ModuleCard'
import { useAuth } from '../contexts/AuthContext'
import styles from './Home.module.css'

const MODULES = [
  {
    id: 'qr',
    name: 'Generador de QRs',
    description: 'Códigos QR estilizados con logo, marcos y exportación a PNG, JPEG, WEBP, SVG y PDF.',
    icon: '🔳',
    href: '/qr',
    status: 'ready',
  },
  {
    id: 'genscript',
    name: 'GenScript',
    description: 'Documentación de cumplimiento para síntesis de plásmidos con características reguladas.',
    icon: '🧬',
    href: '/genscript',
    status: 'ready',
  },
  {
    id: 'adaptar-carta',
    name: 'Adaptar carta',
    description: 'Adapta un texto al modelo de carta oficial de CIC bioGUNE, ATLAS molecular pharma o FEEP. Descarga en .docx o .pdf con firma incluida.',
    icon: '📝',
    href: '/adaptar-carta',
    status: 'ready',
  },
  {
    id: 'logos',
    name: 'Gestor de logos',
    description: 'Almacena y organiza los logos de todas las instituciones. Descarga en PNG, WebP, JPG o SVG con tamaño, fondo y color personalizados.',
    icon: '🖼',
    href: '/logos',
    status: 'ready',
  },
  {
    id: 'documentos-cic',
    name: 'Documentos CIC bioGUNE',
    description: 'Documentos y expedientes internos de CIC bioGUNE: contrato menor, justificaciones, comparativas de proveedores y otros trámites administrativos.',
    icon: '🏛️',
    href: '/documentos-cic',
    status: 'ready',
  },
  {
    id: 'aduanas',
    name: 'Aduanas',
    description: 'Documentación para envíos y recepciones internacionales de material biológico.',
    icon: '📦',
    href: '/aduanas',
    status: 'ready',
  },
  {
    id: 'gastos-viaje',
    name: 'Gastos de viaje',
    description: 'Registra y gestiona los gastos de desplazamiento: transporte, manutención, alojamiento y otros. Genera el informe firmado en DOCX o PDF.',
    icon: '✈️',
    href: '/gastos-viaje',
    status: 'ready',
  },
  {
    id: 'animalario',
    name: 'Animalario',
    description: 'Gestión de proyectos de experimentación animal: secciones A–D, procedimientos, cría y modificaciones.',
    icon: '🐭',
    href: '/animalario',
    status: 'ready',
  },
  {
    id: 'autorizaciones',
    name: 'Autorizaciones',
    description: 'Gestiona autorizaciones de todo tipo para eventos, reuniones y actividades: imagen, asistencia, consentimientos… con firma digital desde móvil y registro permanente.',
    icon: '📋',
    href: '/autorizaciones',
    status: 'ready',
  },
  {
    id: 'cartas-referencia',
    name: 'Cartas de referencia',
    description: 'Genera cartas de referencia profesionales, de apoyo a proyectos o para Green Card/Visa. IA integrada (Claude, ChatGPT, Gemini), descarga en DOCX/PDF y envío por email.',
    icon: '📜',
    href: '/cartas-referencia',
    status: 'ready',
  },
]

export default function Home() {
  const { user } = useAuth()
  const visibleApps = user?.visibleApps || []

  const visibleModules = user?.is_admin
    ? MODULES
    : MODULES.filter(m => visibleApps.includes(m.id))

  const [moduleOrder, setModuleOrder] = useState(null)
  const [dragSrc,     setDragSrc]     = useState(null)
  const [dragOver,    setDragOver]    = useState(null)

  useEffect(() => {
    if (user?.module_order?.length) setModuleOrder(user.module_order)
  }, [user?.module_order])

  const sortedModules = moduleOrder
    ? [...visibleModules].sort((a, b) => {
        const ai = moduleOrder.indexOf(a.id)
        const bi = moduleOrder.indexOf(b.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : visibleModules

  function handleDragStart(e, idx) {
    setDragSrc(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== dragOver) setDragOver(idx)
  }

  function handleDrop(e, idx) {
    e.preventDefault()
    if (dragSrc === null || dragSrc === idx) { setDragSrc(null); setDragOver(null); return }

    const next = [...sortedModules]
    const [moved] = next.splice(dragSrc, 1)
    next.splice(idx, 0, moved)
    const ids = next.map(m => m.id)

    setModuleOrder(ids)
    setDragSrc(null)
    setDragOver(null)

    fetch('/api/auth/me/module-order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_order: ids }),
    })
  }

  function handleDragEnd() {
    setDragSrc(null)
    setDragOver(null)
  }

  return (
    <div>
      <div className={styles.intro}>
        <p className={styles.tagline}>
          ¡Acelera los trámites burocráticos!{' '}
          <span className="accent">Sin errores.</span>
        </p>
      </div>

      <section>
        <h2 className={styles.sectionLabel}>Módulos disponibles</h2>
        <div className={styles.grid}>
          {sortedModules.map((mod, idx) => (
            <div
              key={mod.id}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              className={[
                styles.cardWrapper,
                dragSrc === idx                     ? styles.dragging : '',
                dragOver === idx && dragSrc !== idx ? styles.dragOver : '',
              ].join(' ')}
            >
              <span
                className={styles.dragHandle}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragEnd={handleDragEnd}
                aria-hidden="true"
                title="Arrastrar para reordenar"
              >⠿</span>
              <ModuleCard {...mod} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
