import { useState, useRef } from 'react'
import s from './PdfMerger.module.css'

function buildDocs(proyecto) {
  const docs = []
  let key = 0

  if (proyecto.seccionA) {
    docs.push({ key: key++, id: 'seccionA', type: 'seccionA', ref: null, label: 'Sección A — Información general', enabled: true })
  }

  const procs = proyecto.procedimientos ?? []
  procs.forEach((procId, i) => {
    const titulo = proyecto._procTitulos?.[procId] ?? `Procedimiento ${i + 1}`
    docs.push({ key: key++, id: `seccionB_${procId}`, type: 'seccionB', ref: procId, label: `Sección B — ${titulo}`, enabled: true })
  })

  const crias = proyecto.crias ?? []
  crias.forEach(cria => {
    const nombre = cria.acronimo || cria.nomenclatura_internacional || `Cría ${cria.id.slice(0, 6)}`
    docs.push({ key: key++, id: `seccionC_${cria.id}`, type: 'seccionC', ref: cria.id, label: `Sección C — ${nombre}`, enabled: true })
  })

  if (proyecto.hay_productos_riesgo && proyecto.seccionD_id) {
    docs.push({ key: key++, id: 'seccionD', type: 'seccionD', ref: null, label: 'Sección D — Productos con riesgo', enabled: true })
  }

  return docs
}

export default function PdfMerger({ proyecto }) {
  const [docs, setDocs]         = useState(() => buildDocs(proyecto))
  const [extras, setExtras]     = useState([])   // [{key, file, label, enabled}]
  const [merging, setMerging]   = useState(false)
  const [dragKey, setDragKey]   = useState(null)
  const [open, setOpen]         = useState(false)
  const fileInputRef            = useRef(null)
  // Start extra keys beyond all doc keys to avoid collisions
  const extraKeyRef             = useRef(docs.length)

  // ── All items combined (docs + extras) ──────────────────────────────────────
  const allItems = [
    ...docs.map(d => ({ ...d, origin: 'doc' })),
    ...extras.map(e => ({ ...e, origin: 'extra' })),
  ]

  function setItemEnabled(key, val) {
    setDocs(prev => prev.map(d => d.key === key ? { ...d, enabled: val } : d))
    setExtras(prev => prev.map(e => e.key === key ? { ...e, enabled: val } : e))
  }

  function removeItem(key) {
    setDocs(prev => prev.filter(d => d.key !== key))
    setExtras(prev => prev.filter(e => e.key !== key))
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  function onDragStart(key) { setDragKey(key) }

  function onDrop(targetKey) {
    if (dragKey === null || dragKey === targetKey) return
    const combined = [...allItems]
    const fromIdx  = combined.findIndex(i => i.key === dragKey)
    const toIdx    = combined.findIndex(i => i.key === targetKey)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...combined]
    const [moved]   = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    setDocs(reordered.filter(i => i.origin === 'doc').map(({ origin, ...rest }) => rest))
    setExtras(reordered.filter(i => i.origin === 'extra').map(({ origin, ...rest }) => rest))
    setDragKey(null)
  }

  // ── Add extra PDF ────────────────────────────────────────────────────────────
  function onFileChange(e) {
    const files = Array.from(e.target.files)
    const newExtras = files.map(file => ({
      key:     extraKeyRef.current++,
      file,
      label:   file.name.replace(/\.pdf$/i, ''),
      enabled: true,
    }))
    setExtras(prev => [...prev, ...newExtras])
    e.target.value = ''
  }

  // ── Merge & download ─────────────────────────────────────────────────────────
  async function handleMerge() {
    const combined = allItems
    const enabledItems = combined.filter(i => i.enabled)
    if (!enabledItems.length) return alert('Selecciona al menos un documento.')

    setMerging(true)
    try {
      const formData = new FormData()

      let fileIndex = 0
      const itemsMeta = enabledItems.map(item => {
        if (item.origin === 'extra') {
          formData.append(`file_${fileIndex}`, item.file)
          return { type: 'upload', fileIndex: fileIndex++, enabled: true }
        }
        return { type: item.type, ref: item.ref, enabled: true }
      })

      formData.append('items', JSON.stringify(itemsMeta))

      const res = await fetch(`/api/animalario/proyectos/${proyecto.id}/exportar/pdf-unificado`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Error ${res.status}`)
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i)
      const filename = match ? decodeURIComponent(match[1]) : 'Proyecto_unificado.pdf'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Error al generar el PDF: ${e.message}`)
    } finally {
      setMerging(false)
    }
  }

  const enabledCount = allItems.filter(i => i.enabled).length

  return (
    <div className={s.merger}>
      <button className={s.header} onClick={() => setOpen(o => !o)}>
        <span>📎 Generar PDF unificado del proyecto</span>
        <span className={s.chevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div className={s.body}>
          <p className={s.hint}>
            Activa, desactiva y arrastra los documentos para establecer el orden. Puedes añadir artículos u otros PDFs externos.
          </p>

          <div className={s.list}>
            {allItems.map(item => (
              <div
                key={item.key}
                className={`${s.row} ${dragKey === item.key ? s.dragging : ''}`}
                draggable
                onDragStart={() => onDragStart(item.key)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(item.key)}
                onDragEnd={() => setDragKey(null)}
              >
                <span className={s.handle} title="Arrastrar para reordenar">⠿</span>
                <input
                  type="checkbox"
                  className={s.check}
                  checked={item.enabled}
                  onChange={e => setItemEnabled(item.key, e.target.checked)}
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

            {allItems.length === 0 && (
              <p className={s.empty}>No hay documentos disponibles. Completa primero las secciones del proyecto.</p>
            )}
          </div>

          <div className={s.footer}>
            <button
              className={s.addBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              ＋ Añadir PDF externo
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
