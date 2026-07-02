import { useState, useEffect } from 'react'
import styles from './PrinterSelect.module.css'

const LS_KEY = 'printHub_printer'
let printerCache = null

export default function PrinterSelect() {
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState(() => localStorage.getItem(LS_KEY) || '')

  useEffect(() => {
    if (printerCache) {
      setPrinters(printerCache.known || [])
      if (!localStorage.getItem(LS_KEY) && printerCache.default) {
        setSelected(printerCache.default)
        localStorage.setItem(LS_KEY, printerCache.default)
      }
      return
    }
    fetch('/api/impresoras')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        printerCache = data
        setPrinters(data.known || [])
        const saved = localStorage.getItem(LS_KEY)
        if (!saved && data.default) {
          setSelected(data.default)
          localStorage.setItem(LS_KEY, data.default)
        }
      })
      .catch(() => {})
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setSelected(val)
    if (val) localStorage.setItem(LS_KEY, val)
    else localStorage.removeItem(LS_KEY)
  }

  if (printers.length === 0) return null

  return (
    <select
      value={selected}
      onChange={handleChange}
      className={styles.select}
      title="Selecciona impresora"
    >
      <option value="">Impresora por defecto</option>
      {printers.map(p => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  )
}
