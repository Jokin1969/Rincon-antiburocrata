import { useState, useEffect, useCallback } from 'react'
import { arrayBufferToBase64 } from '../utils/imageUtils'

function b64ToBuf(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr.buffer
}

export function useLogoStore() {
  const [logos, setLogos]   = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/store/logos')
      const raw = await res.json()
      setLogos(raw.map(l => ({ ...l, data: b64ToBuf(l.data) })))
    } catch {
      setLogos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveLogo = useCallback(async (entry) => {
    try {
      await fetch('/api/store/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, data: arrayBufferToBase64(entry.data) }),
      })
    } catch (err) {
      console.error('saveLogo:', err)
    }
    await refresh()
  }, [refresh])

  const deleteLogo = useCallback(async (id) => {
    try {
      await fetch(`/api/store/logos/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('deleteLogo:', err)
    }
    await refresh()
  }, [refresh])

  return { logos, loading, saveLogo, deleteLogo, refresh }
}
