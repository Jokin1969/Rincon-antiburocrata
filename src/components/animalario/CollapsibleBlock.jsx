import { useState } from 'react'
import s from './CollapsibleBlock.module.css'

export default function CollapsibleBlock({ title, children, defaultOpen = true, storageKey, requiredFields }) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen
    try {
      const stored = localStorage.getItem(`cb-open:${storageKey}`)
      if (stored === null) return defaultOpen
      return stored === '1'
    } catch { return defaultOpen }
  })

  function toggle() {
    const next = !open
    setOpen(next)
    if (storageKey) {
      try { localStorage.setItem(`cb-open:${storageKey}`, next ? '1' : '0') } catch {}
    }
  }

  // Green dot = all required fields filled; orange blinking = any empty
  let dotClass = null
  if (requiredFields && requiredFields.length > 0) {
    const allFilled = requiredFields.every(v =>
      Array.isArray(v) ? v.length > 0 : (v !== '' && v !== null && v !== undefined && v !== false)
    )
    dotClass = allFilled ? s.statusDotGreen : s.statusDotOrange
  }

  return (
    <div className={s.block}>
      <button type="button" className={s.blockHeader} onClick={toggle}>
        <span className={s.blockHeaderLeft}>
          {dotClass && <span className={`${s.statusDot} ${dotClass}`} />}
          <span>{title}</span>
        </span>
        <span className={s.chevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {open && <div className={s.blockBody}>{children}</div>}
    </div>
  )
}
