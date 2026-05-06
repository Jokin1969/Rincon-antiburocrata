import { useState, useEffect, useRef } from 'react'

const DROPDOWN_ITEM = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  padding: '0.55rem 1rem',
  fontSize: '0.85rem',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

/**
 * ExportButton — small dropdown for docx / pdf / ambos (zip).
 *
 * Props:
 *   endpoint  — API URL (without ?formato=)
 *   basename  — suggested filename (without extension)
 *   label     — button label (default "⬇ Exportar")
 */
export default function ExportButton({ endpoint, basename, label = '⬇ Exportar' }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef               = useRef(null)

  useEffect(() => {
    function onOut(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  async function doExport(formato) {
    setOpen(false)
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?formato=${formato}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const cd   = res.headers.get('Content-Disposition') ?? ''
      const name = cd.match(/filename="(.+?)"/)?.[1]
        ?? `${basename}.${formato === 'pdf' ? 'pdf' : formato === 'ambos' ? 'zip' : 'docx'}`
      const a = document.createElement('a')
      a.href     = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`No se pudo exportar: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        title="Exportar documento"
        style={{ minWidth: 110 }}
      >
        {loading ? '…' : label}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 4px)',
          zIndex: 100,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          minWidth: 170,
          overflow: 'hidden',
        }}>
          <button type="button" style={DROPDOWN_ITEM}
            onMouseEnter={e => e.target.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.target.style.background = 'none'}
            onClick={() => doExport('docx')}>
            📄 Word (.docx)
          </button>
          <button type="button" style={DROPDOWN_ITEM}
            onMouseEnter={e => e.target.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.target.style.background = 'none'}
            onClick={() => doExport('pdf')}>
            📕 PDF
          </button>
          <button type="button" style={{ ...DROPDOWN_ITEM, borderTop: '1px solid var(--border)' }}
            onMouseEnter={e => e.target.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.target.style.background = 'none'}
            onClick={() => doExport('ambos')}>
            📦 Ambos (ZIP)
          </button>
        </div>
      )}
    </div>
  )
}
