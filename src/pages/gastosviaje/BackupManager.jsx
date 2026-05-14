import { useState, useEffect, useCallback } from 'react'
import bk from '../../styles/animalario/backup.module.css'

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function fmtDate(iso) {
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default function BackupManager() {
  const [open,     setOpen]     = useState(false)
  const [backups,  setBackups]  = useState([])
  const [info,     setInfo]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [creating, setCreating] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [msg,      setMsg]      = useState(null)

  const flash = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/gastos-viaje/backup/list')
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      setBackups(data.backups ?? [])
      setInfo(data)
    } catch (e) {
      flash('Error al cargar backups: ' + e.message, false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function handleCreate() {
    setCreating(true)
    try {
      const r = await fetch('/api/gastos-viaje/backup/create', { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || r.statusText)
      flash(`Backup creado: ${data.backup.filename}`)
      load()
    } catch (e) {
      flash('Error al crear backup: ' + e.message, false)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(filename) {
    if (!window.confirm(`¿Eliminar el backup "${filename}"?\nEsta acción no se puede deshacer.`)) return
    setActionId(filename)
    try {
      const r = await fetch(`/api/gastos-viaje/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || r.statusText)
      flash('Backup eliminado.')
      load()
    } catch (e) {
      flash('Error al eliminar: ' + e.message, false)
    } finally {
      setActionId(null)
    }
  }

  async function handleRestore(filename) {
    if (!window.confirm(
      `¿Restaurar desde "${filename}"?\n\n` +
      `ATENCIÓN: Los datos actuales de Gastos de viaje serán reemplazados por los del backup. ` +
      `Esta acción no se puede deshacer.`
    )) return
    setActionId(filename)
    try {
      const r = await fetch(`/api/gastos-viaje/backup/restore/${encodeURIComponent(filename)}`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || r.statusText)
      flash('Datos restaurados correctamente. Recarga la página para ver los cambios.')
    } catch (e) {
      flash('Error al restaurar: ' + e.message, false)
    } finally {
      setActionId(null)
    }
  }

  function handleDownload(filename) {
    window.location.href = `/api/gastos-viaje/backup/download/${encodeURIComponent(filename)}`
  }

  return (
    <div className={bk.root}>
      <button className={bk.toggle} onClick={() => setOpen(o => !o)}>
        <span className={bk.toggleIcon}>{open ? '▲' : '▼'}</span>
        <span>Copias de seguridad</span>
        {backups.length > 0 && !open && (
          <span className={bk.toggleCount}>{backups.length}</span>
        )}
      </button>

      {open && (
        <div className={bk.panel}>
          {info && (
            <div className={bk.configBar}>
              <span className={bk.configItem}>
                <span className={bk.configLabel}>Carpeta Dropbox</span>
                <code className={bk.configVal}>{info.dropboxFolder}</code>
              </span>
              <span className={bk.configItem}>
                <span className={bk.configLabel}>Intervalo</span>
                <span className={bk.configVal}>cada {info.intervalHours} h</span>
              </span>
              <span className={bk.configItem}>
                <span className={bk.configLabel}>Rotación</span>
                <span className={bk.configVal}>máx. {info.maxCount} copias</span>
              </span>
            </div>
          )}

          <div className={bk.actionsBar}>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating}
              style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
            >
              {creating ? 'Creando…' : '+ Crear backup ahora'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={load}
              disabled={loading}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem' }}
            >
              ↺ Actualizar
            </button>
          </div>

          {msg && (
            <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ margin: '0.5rem 1.25rem 0.75rem' }}>
              {msg.text}
            </div>
          )}

          {loading && <div className={bk.empty}>Cargando…</div>}

          {!loading && backups.length === 0 && (
            <div className={bk.empty}>No hay copias de seguridad todavía.</div>
          )}

          {!loading && backups.length > 0 && (
            <div className={bk.list}>
              {backups.map(b => (
                <div key={b.filename} className={bk.item}>
                  <div className={bk.itemInfo}>
                    <span className={bk.itemDate}>{fmtDate(b.createdAt)}</span>
                    <span className={bk.itemSize}>{fmtSize(b.size)}</span>
                  </div>
                  <div className={bk.itemActions}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      onClick={() => handleDownload(b.filename)}
                      disabled={actionId === b.filename}
                    >
                      ↓ Descargar
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      onClick={() => handleRestore(b.filename)}
                      disabled={actionId === b.filename}
                    >
                      {actionId === b.filename ? 'Procesando…' : '↩ Restaurar'}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      onClick={() => handleDelete(b.filename)}
                      disabled={actionId === b.filename}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
