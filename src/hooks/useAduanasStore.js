import { useState, useEffect, useCallback } from 'react'

function makeApiHooks(col) {
  return function useStore() {
    const [records, setRecords] = useState([])

    const refresh = useCallback(async () => {
      try {
        const res = await fetch(`/api/store/${col}`)
        const data = await res.json()
        setRecords(Array.isArray(data) ? data : [])
      } catch {
        setRecords([])
      }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const saveRecord = useCallback(async (id, formData) => {
      let ok = false
      try {
        const res = await fetch(`/api/store/${col}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, savedAt: new Date().toISOString(), form: formData }),
        })
        ok = res.ok
        if (!ok) {
          const body = await res.text().catch(() => '')
          console.error(`saveRecord ${col} HTTP ${res.status}`, body)
        }
      } catch (err) {
        console.error('saveRecord:', err)
      }
      await refresh()
      return ok
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

export const useFacturaProformaStore    = makeApiHooks('proforma')
export const usePqpImportStore          = makeApiHooks('pqp-import')
export const useDocumento1403Store      = makeApiHooks('documento-1403')
export const useDeclaracionExentaStore  = makeApiHooks('declaracion-exenta')
