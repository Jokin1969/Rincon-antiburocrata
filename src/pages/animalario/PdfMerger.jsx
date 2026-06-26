import { useState, useEffect, useRef } from 'react'
import s from './PdfMerger.module.css'

function buildDocItems(proyecto) {
  const items = []
  if (proyecto.seccionA) {
    items.push({ key: 'doc:seccionA', origin: 'doc', type: 'seccionA', ref: null, label: 'Sección A — Información general', enabled: true })
  }
  const procs = proyecto.procedimientos ?? []
  procs.forEach((procId, i) => {
    const titulo = proyecto._procTitulos?.[procId] ?? `Procedimiento ${i + 1}`
    items.push({ key: `doc:seccionB_${procId}`, origin: 'doc', type: 'seccionB', ref: procId, label: `Sección B — ${titulo}`, enabled: true })
  })
  const crias = proyecto.crias ?? []
  crias.forEach(cria => {
    const nombre = cria.acronimo || cria.nomenclatura_internacional || `Cría ${cria.id.slice(0, 6)}`
    items.push({ key: `doc:seccionC_${cria.id}`, origin: 'doc', type: 'seccionC', ref: cria.id, label: `Sección C — ${nombre}`, enabled: true })
  })
  if (proyecto.hay_productos_riesgo && proyecto.seccionD_id) {
    items.push({ key: 'doc:seccionD', origin: 'doc', type: 'seccionD', ref: null, label: 'Sección D — Productos con riesgo', enabled: true })
  }
  return items
}

export default function PdfMerger({ proyecto }) {
  const [items,     setItems]     = useState(() => buildDocItems(proyecto))
  const [merging,   setMerging]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [open,      setOpen]      = useState(false)
  // Drag state — ref for src key (no re-render needed in handler), state for visual feedback
  const dragSrcRef                = useRef(null)
  const [dragSrc,   setDragSrc]   = useState(null)
  const [dragOver,  setDragOver]  = useState(null)
  const fileInputRef              = useRef(null)

  // Load server-stored extras on mount
  useEffect(() => {
    fetch(`/api/animalario/proyectos/${proyecto.id}/extra-pdfs`)
      .then(r => r.json())
      .then(({ items: serverExtras = [] }) => {
        if (!serverExtras.length) return
        setItems(prev => [
          ...prev,
          ...serverExtras.map(e => ({
            key:    `extra:${e.name}`,
            origin: 'extra',
            name:   e.name,
            label:  e.label,
            enabled: true,
          })),
        ])
      })
      .catch(() => {})
  }, [proyecto.id])

  // ── Item helpers ─────────────────────────────────────────────────────────────

  function toggleEnabled(key, val) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, enabled: val } : i))
  }

  async function removeItem(key) {
    const item = items.find(i => i.key === key)
    if (item?.origin === 'extra') {
      await fetch(`/api/animalario/proyectos/${proyecto.id}/extra-pdfs/${item.name}`, { method: 'DELETE' })
        .catch(() => {})
    }
    setItems(prev => prev.filter(i => i.key !== key))
  }

  // ── Upload extra PDF ─────────────────────────────────────────────────────────

  async function onFileChange(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      const results = await Promise.all(files.map(async file => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('label', file.name.replace(/\.pdf$/i, ''))
        const res  = await fetch(`/api/animalario/proyectos/${proyecto.id}/extra-pdfs`, { method: 'POST', body: fd })
        if (!res.ok) throw new Error(`Error subiendo ${file.name}`)
        const { item } = await res.json()
        return { key: `extra:${item.name}`, origin: 'extra', name: item.name, label: item.label, enabled: true }
      }))
      setItems(prev => [...prev, ...results])
    } catch (err) {
      alert(`Error al subir PDF: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  // dragSrcRef: never stale in handlers; dragSrc/dragOver: state for CSS classes

  function onDragStart(e, key) {
    dragSrcRef.current = key
    setDragSrc(key)
    setDragOver(null)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, key) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== key) setDragOver(key)
  }

  function onDrop(e, key) {
    e.preventDefault()
    const src = dragSrcRef.current
    clearDrag()
    if (!src || src === key) return
    setItems(prev => {
      const from = prev.findIndex(i => i.key === src)
      const to   = prev.findIndex(i => i.key === key)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function clearDrag() {
    dragSrcRef.current = null
    setDragSrc(null)
    setDragOver(null)
  }

  // ── Merge & download ─────────────────────────────────────────────────────────

  async function handleMerge() {
    const enabled = items.filter(i => i.enabled)
    if (!enabled.length) return alert('Selecciona al menos un documento.')
    setMerging(true)
    try {
      const formData = new FormData()
      formData.append('items', JSON.stringify(
        enabled.map(item =>
          item.origin === 'extra'
            ? { type: 'extra', name: item.name, enabled: true }
            : { type: item.type, ref: item.ref, enabled: true }
        )
      ))

      const res = await fetch(`/api/animalario/proyectos/${proyecto.id}/exportar/pdf-unificado`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Error ${res.status}`)
      }
      const blob        = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match       = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i)
      const filename    = match ? decodeURIComponent(match[1]) : 'Proyecto_unificado.pdf'
      const url         = URL.createObjectURL(blob)
      const a           = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Error al generar el PDF: ${err.message}`)
    } finally {
      setMerging(false)
    }
  }

  const enabledCount = items.filter(i => i.enabled).length

  return (
    <div className={s.merger}>
      <button className={s.header} onClick={() => setOpen(o => !o)}>
        <span>📎 Generar PDF unificado del proyecto</span>
        <span className={s.chevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div className={s.body}>
          <p className={s.hint}>
            Activa, desactiva y arrastra los documentos para establecer el orden.
            Los PDFs externos se guardan en el servidor y son visibles para todos los usuarios.
          </p>

          <div className={s.list}>
            {items.map(item => (
              <div
                key={item.key}
                draggable
                onDragStart={e => onDragStart(e, item.key)}
                onDragOver={e  => onDragOver(e,  item.key)}
                onDrop={e      => onDrop(e,       item.key)}
                onDragEnd={clearDrag}
                className={[
                  s.row,
                  dragSrc  === item.key                    ? s.dragging   : '',
                  dragOver === item.key && dragSrc !== item.key ? s.dragTarget : '',
                ].filter(Boolean).join(' ')}
              >
                <span className={s.handle} title="Arrastrar para reordenar">⠿</span>
                <input
                  type="checkbox"
                  className={s.check}
                  checked={item.enabled}
                  onChange={e => toggleEnabled(item.key, e.target.checked)}
                />
                <span className={`${s.rowLabel} ${!item.enabled ? s.disabled : ''}`}>
                  {item.origin === 'extra' && <span className={s.badge}>PDF externo</span>}
                  {item.label}
                </span>
                {item.origin === 'extra' && (
                  <button className={s.removeBtn} onClick={() => removeItem(item.key)} title="Eliminar">×</button>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <p className={s.empty}>No hay documentos disponibles. Completa primero las secciones del proyecto.</p>
            )}
          </div>

          <div className={s.footer}>
            <button
              className={s.addBtn}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Subiendo…' : '＋ Añadir PDF externo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
            <button
              className={s.mergeBtn}
              disabled={merging || enabledCount === 0}
              onClick={handleMerge}
            >
              {merging ? 'Generando…' : `⬇ Generar PDF unificado (${enabledCount} doc${enabledCount !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
