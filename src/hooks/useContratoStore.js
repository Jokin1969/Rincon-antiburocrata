import { useState, useEffect, useCallback } from 'react'

const COL = 'contrato'

export function useContratoStore() {
  const [records, setRecords] = useState([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/store/${COL}`)
      setRecords(await res.json())
    } catch {
      setRecords([])
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveRecord = useCallback(async (codigo, formData) => {
    try {
      await fetch(`/api/store/${COL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: codigo, codigo, savedAt: new Date().toISOString(), form: formData }),
      })
    } catch (err) {
      console.error('saveRecord:', err)
    }
    await refresh()
  }, [refresh])

  const deleteRecord = useCallback(async (codigo) => {
    try {
      await fetch(`/api/store/${COL}/${encodeURIComponent(codigo)}`, { method: 'DELETE' })
    } catch (err) {
      console.error('deleteRecord:', err)
    }
    await refresh()
  }, [refresh])

  return { records, saveRecord, deleteRecord }
}
