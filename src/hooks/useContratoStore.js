import { useState, useCallback } from 'react'

const KEY = 'contratomenos-store'

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeStore(records) {
  localStorage.setItem(KEY, JSON.stringify(records))
}

export function useContratoStore() {
  const [records, setRecords] = useState(readStore)

  const saveRecord = useCallback((codigo, formData) => {
    const next = [
      { codigo, savedAt: new Date().toISOString(), form: formData },
      ...readStore().filter(r => r.codigo !== codigo),
    ]
    writeStore(next)
    setRecords(next)
  }, [])

  const deleteRecord = useCallback((codigo) => {
    const next = readStore().filter(r => r.codigo !== codigo)
    writeStore(next)
    setRecords(next)
  }, [])

  return { records, saveRecord, deleteRecord }
}
