import { useState, useEffect, useCallback } from 'react'

const DB_NAME = 'rincon-logos'
const DB_VERSION = 1
const STORE = 'logos'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    const req = fn(store)
    if (mode === 'readonly') {
      // resolve with the request result once the read completes
      req.onsuccess = e => resolve(e.target.result)
      req.onerror  = e => reject(e.target.error)
    } else {
      // wait for full transaction commit before resolving
      if (req) req.onerror = e => reject(e.target.error)
      t.oncomplete = () => resolve()
      t.onerror    = e => reject(e.target.error)
    }
  })
}

export function useLogoStore() {
  const [logos, setLogos] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const db = await openDB()
      const all = await tx(db, 'readonly', s => s.getAll())
      all.sort((a, b) => a.name.localeCompare(b.name))
      setLogos(all)
    } catch (err) {
      console.error('useLogoStore refresh:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveLogo = useCallback(async (entry) => {
    const db = await openDB()
    await tx(db, 'readwrite', s => s.put(entry))
    await refresh()
  }, [refresh])

  const deleteLogo = useCallback(async (id) => {
    const db = await openDB()
    await tx(db, 'readwrite', s => s.delete(id))
    await refresh()
  }, [refresh])

  return { logos, loading, saveLogo, deleteLogo, refresh }
}
