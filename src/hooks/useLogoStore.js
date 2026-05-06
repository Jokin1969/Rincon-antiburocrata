import { useState, useEffect, useCallback } from 'react'
import { arrayBufferToBase64 } from '../utils/imageUtils'

export function useLogoStore() {
  const [logos, setLogos]     = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/store/logos')
      setLogos(await res.json()) // metadata + imageUrl, no binary
    } catch {
      setLogos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Fetch raw binary for a single logo (used by download and AI panels)
  const fetchLogoData = useCallback(async (id) => {
    const res = await fetch(`/api/store/logos/${id}/image`)
    if (!res.ok) throw new Error('Error al cargar imagen')
    return res.arrayBuffer()
  }, [])

  const saveLogo = useCallback(async (entry) => {
    const { imageUrl, ...rest } = entry
    try {
      await fetch('/api/store/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          rest.data ? { ...rest, data: arrayBufferToBase64(rest.data) } : rest
        ),
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

  const saveOrder = useCallback(async (ids) => {
    try {
      await fetch('/api/store/logos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch (err) {
      console.error('saveOrder:', err)
    }
    await refresh()
  }, [refresh])

  return { logos, loading, saveLogo, deleteLogo, saveOrder, refresh, fetchLogoData }
}
