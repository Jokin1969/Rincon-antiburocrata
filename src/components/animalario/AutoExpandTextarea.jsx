import { useState, useEffect, useRef } from 'react'
import ta from './AutoExpandTextarea.module.css'

const ExpandIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4.5V1h3.5M11 4.5V1H7.5M1 7.5V11h3.5M11 7.5V11H7.5"/>
  </svg>
)
const CollapseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 1v3.5H1M7.5 1v3.5H11M4.5 11V7.5H1M7.5 11V7.5H11"/>
  </svg>
)
const CopyFromIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="7" height="7" rx="1"/>
    <path d="M4 4V3a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H9"/>
  </svg>
)

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj) ?? ''
}

// storageKey  — unique key for both localStorage expand state and (when copyFrom=true) field path lookup
// copyFrom    — enable the "copy from another procedure" dropdown (SeccionB only)
// fieldPath   — optional override for the copy-from field path (defaults to storageKey)
export default function AutoExpandTextarea({ value, onChange, rows = 3, placeholder, storageKey, copyFrom = false, fieldPath }) {
  const ref     = useRef(null)
  const wrapRef = useRef(null)

  const [expanded,    setExpanded]    = useState(() => {
    try { return localStorage.getItem(`ta-exp:${storageKey}`) === '1' } catch { return false }
  })
  const [showCopy,    setShowCopy]    = useState(false)
  const [copyProcs,   setCopyProcs]   = useState(null)
  const [copyLoading, setCopyLoading] = useState(false)
  const [selecting,   setSelecting]   = useState(null)
  const [openUp,      setOpenUp]      = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (expanded) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    } else {
      el.style.height = ''
    }
  }, [expanded, value])

  useEffect(() => {
    if (!showCopy) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowCopy(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showCopy])

  function toggleExpand() {
    const next = !expanded
    setExpanded(next)
    try { localStorage.setItem(`ta-exp:${storageKey}`, next ? '1' : '0') } catch {}
  }

  async function openCopyDropdown() {
    if (showCopy) { setShowCopy(false); return }
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      setOpenUp(window.innerHeight - rect.bottom < 240)
    }
    setShowCopy(true)
    if (copyProcs !== null) return
    setCopyLoading(true)
    try {
      const r = await fetch('/api/animalario/procedimientos')
      setCopyProcs(r.ok ? await r.json() : [])
    } catch {
      setCopyProcs([])
    } finally {
      setCopyLoading(false)
    }
  }

  async function selectProc(proc) {
    setSelecting(proc.id)
    const path = fieldPath ?? storageKey
    try {
      const r    = await fetch(`/api/animalario/procedimientos/${proc.id}`)
      const data = await r.json()
      const val  = getByPath(data, path)
      if (val) onChange({ target: { value: val } })
    } catch {}
    setSelecting(null)
    setShowCopy(false)
  }

  const prPad = copyFrom ? '3.6rem' : '1.8rem'

  return (
    <div className={ta.taWrap} ref={wrapRef}>
      <textarea
        ref={ref}
        className="form-group input"
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ width: '100%', paddingRight: prPad, resize: 'none' }}
      />

      <div className={ta.taBtns}>
        {copyFrom && (
          <button
            type="button"
            aria-label="Copiar de otro procedimiento"
            title="Copiar de otro procedimiento"
            onClick={openCopyDropdown}
            className={`${ta.taBtn} ${showCopy ? ta.taBtnActive : ''}`}
          >
            <CopyFromIcon />
          </button>
        )}
        <button
          type="button"
          aria-label={expanded ? 'Contraer' : 'Expandir'}
          title={expanded ? 'Contraer' : 'Expandir para ver todo el contenido'}
          onClick={toggleExpand}
          className={`${ta.taBtn} ${expanded ? ta.taBtnActive : ''}`}
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </div>

      {showCopy && (
        <div className={`${ta.copyDropdown} ${openUp ? ta.copyDropdownUp : ''}`}>
          {copyLoading && <div className={ta.copyEmpty}>Cargando…</div>}
          {!copyLoading && copyProcs?.length === 0 && (
            <div className={ta.copyEmpty}>No hay procedimientos guardados.</div>
          )}
          {!copyLoading && copyProcs?.map(p => (
            <button
              key={p.id}
              type="button"
              className={ta.copyItem}
              onClick={() => selectProc(p)}
              disabled={selecting === p.id}
            >
              <span className={ta.copyItemTitle}>
                {selecting === p.id ? 'Cargando…' : (p.titulo || '(Sin título)')}
              </span>
              <span className={ta.copyItemProject}>{p.proyecto_titulo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
