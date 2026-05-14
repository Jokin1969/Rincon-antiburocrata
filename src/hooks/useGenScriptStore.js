import { useState, useEffect, useCallback } from 'react'

function makeApiHooks(col) {
  return function useStore() {
    const [records, setRecords] = useState([])

    const refresh = useCallback(async () => {
      try {
        const res = await fetch(`/api/store/${col}`)
        setRecords(await res.json())
      } catch {
        setRecords([])
      }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const saveRecord = useCallback(async (id, formData) => {
      try {
        await fetch(`/api/store/${col}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, savedAt: new Date().toISOString(), form: formData }),
        })
      } catch (err) {
        console.error('saveRecord:', err)
      }
      await refresh()
    }, [refresh])

    const deleteRecord = useCallback(async (id) => {
      try {
        await fetch(`/api/store/${col}/${encodeURIComponent(id)}`, { method: 'DELETE' })
      } catch (err) {
        console.error('deleteRecord:', err)
      }
      await refresh()
    }, [refresh])

    return { records, saveRecord, deleteRecord }
  }
}

export const useEUSStore = makeApiHooks('genscript-eus')
export const useMOHStore = makeApiHooks('genscript-moh')
