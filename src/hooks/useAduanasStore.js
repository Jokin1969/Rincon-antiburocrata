import { useState, useCallback } from 'react'

function makeHooks(KEY) {
  const read  = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
  const write = (recs) => localStorage.setItem(KEY, JSON.stringify(recs))

  return function useStore() {
    const [records, setRecords] = useState(read)

    const saveRecord = useCallback((id, formData) => {
      const next = [
        { id, savedAt: new Date().toISOString(), form: formData },
        ...read().filter(r => r.id !== id),
      ]
      write(next)
      setRecords(next)
    }, [])

    const deleteRecord = useCallback((id) => {
      const next = read().filter(r => r.id !== id)
      write(next)
      setRecords(next)
    }, [])

    return { records, saveRecord, deleteRecord }
  }
}

export const useFacturaProformaStore = makeHooks('aduanas-proforma-store')
