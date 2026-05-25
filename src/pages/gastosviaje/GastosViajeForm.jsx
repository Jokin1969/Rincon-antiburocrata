import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import styles from './GastosViajeForm.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const CECO_OPTIONS = [
  { code: '324P0894', label: 'CJD-Foundation (324P0894)' },
  { code: '324P0862', label: 'PN-2025 (324P0862)' },
  { code: '324P0887', label: '2026 Proof-of-Concept (324P0887)' },
  { code: '324P0749', label: 'POCTEFA (2024-2027) (324P0749)' },
]

const TICKET_TIPOS = {
  autopista: { label: 'Autopista / Peaje', icon: '🛣️' },
  avion:     { label: 'Avión',             icon: '✈️' },
  tren:      { label: 'Tren',              icon: '🚂' },
  autobus:   { label: 'Autobús',           icon: '🚌' },
  parking:   { label: 'Parking',           icon: '🅿️' },
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function toNum(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

function eur(v) {
  const n = toNum(v)
  return n === 0 ? '0,00 €' : n.toFixed(2).replace('.', ',') + ' €'
}

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return d }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mimeIcon(mime) {
  if (!mime) return '📎'
  if (mime === 'application/pdf') return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.includes('word')) return '📝'
  return '📎'
}

// ── Sub-component: ItemAdjuntoRow ─────────────────────────────────────────────

function ItemAdjuntoRow({ item, viajeId, onEdit }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState(null)
  const fileRef                   = useRef()

  async function handleFile(file) {
    if (!file) return
    if (!viajeId) { alert('Guarda el viaje primero para poder adjuntar documentos.'); return }
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(`/api/gastos-viaje/${viajeId}/adjunto-item`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      onEdit?.(item.id, { adjunto: data })
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemove() {
    const adj = item.adjunto
    if (!adj) return
    try {
      await fetch(`/api/gastos-viaje/${viajeId}/adjunto-item/${adj.id}`, { method: 'DELETE' })
    } catch {}
    onEdit?.(item.id, { adjunto: null })
  }

  const adj = item.adjunto

  return (
    <div className={styles.itemAdjunto}>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
      {adj ? (
        <>
          <a
            href={`/api/gastos-viaje/${viajeId}/adjuntos/${adj.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.adjuntoItemLink}
            title={adj.originalName}
          >
            {mimeIcon(adj.mime)} {adj.originalName}
          </a>
          <button className={styles.adjuntoItemRemove} onClick={handleRemove} title="Eliminar adjunto">✕</button>
        </>
      ) : (
        <button
          className={styles.adjuntoItemBtn}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Subiendo…' : '📎 Adjuntar ticket / factura'}
        </button>
      )}
      {error && <span className={styles.adjuntoItemError}>{error}</span>}
    </div>
  )
}

// ── Sub-component: TicketUploader ─────────────────────────────────────────────

function TicketUploader({ tipo, onExtracted }) {
  const [file, setFile]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const fileRef = useRef()

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setError(null)
  }

  async function handleExtract() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tipo', tipo)
      const res  = await fetch('/api/gastos-viaje/ia-ticket', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      onExtracted(data)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.uploader}>
      <div
        className={styles.dropZone}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
      >
        {file
          ? <span className={styles.fileName}>{file.name}</span>
          : <>
              <span className={styles.dropIcon}>📎</span>
              <span>Arrastra un archivo o toca para seleccionar</span>
              <span className={styles.dropHint}>PDF, PNG o JPG · también cámara del móvil</span>
            </>
        }
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={e => handleFile(e.target.files[0])}
      />
      {file && (
        <button
          className="btn btn-primary"
          onClick={handleExtract}
          disabled={loading}
        >
          {loading ? 'Extrayendo con IA…' : '✨ Extraer datos con IA'}
        </button>
      )}
      {error && <div className={`alert alert-error ${styles.uploaderError}`}>{error}</div>}
    </div>
  )
}

// ── Sub-component: TicketForm (fields + uploader) ─────────────────────────────

function TicketForm({ tipo, onAdd }) {
  const [fields, setFields] = useState({ nombre: '', fecha: TODAY, sinIva: '', conIva: '' })

  function set(k, v) { setFields(prev => ({ ...prev, [k]: v })) }

  function handleExtracted(data) {
    setFields(prev => ({
      nombre: data.nombre || prev.nombre,
      fecha:  data.fecha  || prev.fecha,
      sinIva: data.sinIva || prev.sinIva,
      conIva: data.conIva || prev.conIva,
    }))
  }

  function handleAdd() {
    if (!fields.conIva) return
    onAdd({ ...fields, id: uid() })
    setFields({ nombre: '', fecha: TODAY, sinIva: '', conIva: '' })
  }

  return (
    <div className={styles.subForm}>
      <TicketUploader tipo={tipo} onExtracted={handleExtracted} />

      <div className={styles.fieldRow}>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Nombre / descripción</label>
          <input type="text" value={fields.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Nombre del ticket o establecimiento" autoComplete="off" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Fecha</label>
          <input type="date" value={fields.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Importe sin IVA</label>
          <input type="text" inputMode="decimal" value={fields.sinIva}
            onChange={e => set('sinIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Importe con IVA</label>
          <input type="text" inputMode="decimal" value={fields.conIva}
            onChange={e => set('conIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className={styles.addBtnWrapper}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!fields.conIva}>
            + Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-component: TicketList ─────────────────────────────────────────────────

function TicketList({ items, onRemove, onEdit, onDuplicate, viajeId }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft]         = useState({})

  if (items.length === 0) return null
  const total = items.reduce((acc, it) => acc + toNum(it.conIva), 0)

  function startEdit(it) {
    setEditingId(it.id)
    setDraft({ nombre: it.nombre || '', fecha: it.fecha || TODAY, sinIva: it.sinIva || '', conIva: it.conIva || '' })
  }

  function saveEdit() {
    onEdit?.(editingId, draft)
    setEditingId(null)
  }

  return (
    <div className={styles.itemList}>
      {items.map(it => (
        editingId === it.id ? (
          <div key={it.id} className={styles.inlineEdit}>
            <div className={styles.fieldRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nombre / descripción</label>
                <input type="text" value={draft.nombre} autoFocus
                  onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={draft.fecha}
                  onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Sin IVA</label>
                <input type="text" inputMode="decimal" value={draft.sinIva}
                  onChange={e => setDraft(d => ({ ...d, sinIva: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Con IVA</label>
                <input type="text" inputMode="decimal" value={draft.conIva}
                  onChange={e => setDraft(d => ({ ...d, conIva: e.target.value }))} />
              </div>
              <div className={styles.inlineEditActions}>
                <button className="btn btn-primary" onClick={saveEdit}>✓ Guardar</button>
                <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        ) : (
          <div key={it.id} className={styles.itemBlock}>
            <div className={styles.itemRow}>
              <span className={styles.itemName}>{it.nombre || '—'}</span>
              <span className={styles.itemDate}>{formatDate(it.fecha)}</span>
              <span className={styles.itemAmount}>{eur(it.sinIva)} / {eur(it.conIva)}</span>
              <div className={styles.itemActions}>
                {onDuplicate && <button className={styles.dupBtn} onClick={() => onDuplicate(it.id)} title="Duplicar">⧉</button>}
                {onEdit      && <button className={styles.editBtn} onClick={() => startEdit(it)}     title="Editar">✏️</button>}
                <button className={styles.removeBtn} onClick={() => onRemove(it.id)}>✕</button>
              </div>
            </div>
            <ItemAdjuntoRow item={it} viajeId={viajeId} onEdit={onEdit} />
          </div>
        )
      ))}
      <div className={styles.itemTotal}>
        <span>Total</span>
        <span>{eur(total)}</span>
      </div>
    </div>
  )
}

// ── Sub-component: CocheForm ──────────────────────────────────────────────────

function CocheForm({ onAdd }) {
  const [fields, setFields] = useState({
    desde: '', hasta: '', kmIda: '', kmVuelta: '', precioPorKm: 0.29, precioCustom: false,
  })

  function set(k, v) { setFields(prev => ({ ...prev, [k]: v })) }

  const totalKm   = toNum(fields.kmIda) + toNum(fields.kmVuelta)
  const totalEur  = totalKm * toNum(fields.precioPorKm)

  function handleAdd() {
    if (!fields.kmIda && !fields.kmVuelta) return
    onAdd({ desde: fields.desde, hasta: fields.hasta, kmIda: fields.kmIda,
            kmVuelta: fields.kmVuelta, precioPorKm: fields.precioPorKm, id: uid() })
    setFields({ desde: '', hasta: '', kmIda: '', kmVuelta: '', precioPorKm: 0.29, precioCustom: false })
  }

  return (
    <div className={styles.subForm}>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Desde <span className={styles.optional}>(opcional)</span></label>
          <input type="text" value={fields.desde} onChange={e => set('desde', e.target.value)}
            placeholder="Ciudad o lugar de origen" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Hasta <span className={styles.optional}>(opcional)</span></label>
          <input type="text" value={fields.hasta} onChange={e => set('hasta', e.target.value)}
            placeholder="Ciudad o destino" autoComplete="off" />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Km de ida</label>
          <input type="text" inputMode="decimal" value={fields.kmIda}
            onChange={e => set('kmIda', e.target.value)} placeholder="0" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Km de vuelta</label>
          <input type="text" inputMode="decimal" value={fields.kmVuelta}
            onChange={e => set('kmVuelta', e.target.value)} placeholder="0" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>€/km</label>
          <div className={styles.kmToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${!fields.precioCustom && fields.precioPorKm === 0.29 ? styles.toggleActive : ''}`}
              onClick={() => setFields(p => ({ ...p, precioPorKm: 0.29, precioCustom: false }))}
            >0,29 €</button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${!fields.precioCustom && fields.precioPorKm === 0.26 ? styles.toggleActive : ''}`}
              onClick={() => setFields(p => ({ ...p, precioPorKm: 0.26, precioCustom: false }))}
            >0,26 €</button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${fields.precioCustom ? styles.toggleActive : ''}`}
              onClick={() => setFields(p => ({ ...p, precioCustom: !p.precioCustom }))}
            >Otro</button>
          </div>
          {fields.precioCustom && (
            <input type="text" inputMode="decimal" value={fields.precioPorKm}
              onChange={e => set('precioPorKm', e.target.value)}
              placeholder="0.29" style={{ marginTop: '0.4rem' }} autoComplete="off" />
          )}
        </div>
      </div>
      <div className={styles.cocheCalc}>
        <span>Total km: <strong>{totalKm}</strong></span>
        <span>Importe: <strong>{eur(totalEur)}</strong></span>
        <button className="btn btn-primary" onClick={handleAdd}
          disabled={!fields.kmIda && !fields.kmVuelta}>
          + Añadir
        </button>
      </div>
    </div>
  )
}

function CocheList({ items, onRemove, onEdit, onDuplicate, viajeId }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft]         = useState({})

  if (items.length === 0) return null
  const total = items.reduce((acc, it) => {
    return acc + (toNum(it.kmIda) + toNum(it.kmVuelta)) * toNum(it.precioPorKm ?? 0.29)
  }, 0)

  function startEdit(it) {
    setEditingId(it.id)
    setDraft({ desde: it.desde || '', hasta: it.hasta || '', kmIda: it.kmIda || '', kmVuelta: it.kmVuelta || '', precioPorKm: it.precioPorKm ?? 0.29 })
  }

  function saveEdit() {
    onEdit?.(editingId, draft)
    setEditingId(null)
  }

  return (
    <div className={styles.itemList}>
      {items.map(it => {
        const km  = toNum(it.kmIda) + toNum(it.kmVuelta)
        const imp = km * toNum(it.precioPorKm ?? 0.29)
        return editingId === it.id ? (
          <div key={it.id} className={styles.inlineEdit}>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Desde</label>
                <input type="text" value={draft.desde} autoFocus
                  onChange={e => setDraft(d => ({ ...d, desde: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Hasta</label>
                <input type="text" value={draft.hasta}
                  onChange={e => setDraft(d => ({ ...d, hasta: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Km ida</label>
                <input type="text" inputMode="decimal" value={draft.kmIda}
                  onChange={e => setDraft(d => ({ ...d, kmIda: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Km vuelta</label>
                <input type="text" inputMode="decimal" value={draft.kmVuelta}
                  onChange={e => setDraft(d => ({ ...d, kmVuelta: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>€/km</label>
                <input type="text" inputMode="decimal" value={draft.precioPorKm}
                  onChange={e => setDraft(d => ({ ...d, precioPorKm: e.target.value }))} />
              </div>
              <div className={styles.inlineEditActions}>
                <button className="btn btn-primary" onClick={saveEdit}>✓ Guardar</button>
                <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        ) : (
          <div key={it.id} className={styles.itemBlock}>
            <div className={styles.itemRow}>
              <span className={styles.itemName}>
                {[it.desde, it.hasta].filter(Boolean).join(' → ') || 'Desplazamiento'}
              </span>
              <span className={styles.itemDate}>{km} km × {toNum(it.precioPorKm ?? 0.29).toFixed(2)} €</span>
              <span className={styles.itemAmount}>{eur(imp)}</span>
              <div className={styles.itemActions}>
                {onDuplicate && <button className={styles.dupBtn} onClick={() => onDuplicate(it.id)} title="Duplicar">⧉</button>}
                {onEdit      && <button className={styles.editBtn} onClick={() => startEdit(it)}     title="Editar">✏️</button>}
                <button className={styles.removeBtn} onClick={() => onRemove(it.id)}>✕</button>
              </div>
            </div>
            <ItemAdjuntoRow item={it} viajeId={viajeId} onEdit={onEdit} />
          </div>
        )
      })}
      <div className={styles.itemTotal}>
        <span>Total</span>
        <span>{eur(total)}</span>
      </div>
    </div>
  )
}

// ── Sub-component: ManutencioList ─────────────────────────────────────────────

function ManutencioList({ items, onRemove, onEdit, onDuplicate, viajeId }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft]         = useState({})

  if (items.length === 0) return null
  const total = items.reduce((acc, it) => acc + toNum(it.conIva), 0)

  function displayName(it) {
    return [it.tipo ? (it.tipo.charAt(0).toUpperCase() + it.tipo.slice(1)) : '', it.nombre || it.lugar].filter(Boolean).join(' – ')
  }

  function startEdit(it) {
    setEditingId(it.id)
    setDraft({ tipo: it.tipo || 'comida', nombre: it.nombre || '', lugar: it.lugar || '', fecha: it.fecha || TODAY, sinIva: it.sinIva || '', conIva: it.conIva || '' })
  }

  function saveEdit() {
    onEdit?.(editingId, draft)
    setEditingId(null)
  }

  return (
    <div className={styles.itemList}>
      {items.map(it => (
        editingId === it.id ? (
          <div key={it.id} className={styles.inlineEdit}>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Tipo</label>
                <div className={styles.tipoSelector}>
                  {['desayuno', 'comida', 'cena'].map(t => (
                    <button key={t} type="button"
                      className={`${styles.tipoBtn} ${draft.tipo === t ? styles.tipoBtnActive : ''}`}
                      onClick={() => setDraft(d => ({ ...d, tipo: t }))}>
                      {t === 'desayuno' ? '☀️ Desayuno' : t === 'comida' ? '🍽️ Comida' : '🌙 Cena'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={draft.fecha}
                  onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Establecimiento</label>
                <input type="text" value={draft.nombre} autoFocus
                  onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Lugar</label>
                <input type="text" value={draft.lugar}
                  onChange={e => setDraft(d => ({ ...d, lugar: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Sin IVA</label>
                <input type="text" inputMode="decimal" value={draft.sinIva}
                  onChange={e => setDraft(d => ({ ...d, sinIva: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Con IVA</label>
                <input type="text" inputMode="decimal" value={draft.conIva}
                  onChange={e => setDraft(d => ({ ...d, conIva: e.target.value }))} />
              </div>
              <div className={styles.inlineEditActions}>
                <button className="btn btn-primary" onClick={saveEdit}>✓ Guardar</button>
                <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        ) : (
          <div key={it.id} className={styles.itemBlock}>
            <div className={styles.itemRow}>
              <span className={styles.itemName}>{displayName(it) || '—'}</span>
              <span className={styles.itemDate}>{formatDate(it.fecha)}</span>
              <span className={styles.itemAmount}>{eur(it.sinIva)} / {eur(it.conIva)}</span>
              <div className={styles.itemActions}>
                {onDuplicate && <button className={styles.dupBtn} onClick={() => onDuplicate(it.id)} title="Duplicar">⧉</button>}
                {onEdit      && <button className={styles.editBtn} onClick={() => startEdit(it)}     title="Editar">✏️</button>}
                <button className={styles.removeBtn} onClick={() => onRemove(it.id)}>✕</button>
              </div>
            </div>
            <ItemAdjuntoRow item={it} viajeId={viajeId} onEdit={onEdit} />
          </div>
        )
      ))}
      <div className={styles.itemTotal}>
        <span>Total</span>
        <span>{eur(total)}</span>
      </div>
    </div>
  )
}

// ── Sub-component: OtrosList ──────────────────────────────────────────────────

function OtrosList({ items, onRemove, onEdit, onDuplicate, viajeId }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft]         = useState({})

  if (items.length === 0) return null
  const total = items.reduce((acc, it) => acc + toNum(it.conIva), 0)

  function displayName(it) {
    return [it.tipo, it.descripcion].filter(Boolean).join(' – ') || '—'
  }

  function startEdit(it) {
    setEditingId(it.id)
    setDraft({ tipo: it.tipo || '', descripcion: it.descripcion || '', fecha: it.fecha || TODAY, sinIva: it.sinIva || '', conIva: it.conIva || '' })
  }

  function saveEdit() {
    onEdit?.(editingId, draft)
    setEditingId(null)
  }

  return (
    <div className={styles.itemList}>
      {items.map(it => (
        editingId === it.id ? (
          <div key={it.id} className={styles.inlineEdit}>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Tipo de gasto</label>
                <input type="text" value={draft.tipo} autoFocus
                  onChange={e => setDraft(d => ({ ...d, tipo: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={draft.fecha}
                  onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input type="text" value={draft.descripcion}
                onChange={e => setDraft(d => ({ ...d, descripcion: e.target.value }))} />
            </div>
            <div className={styles.fieldRow}>
              <div className="form-group">
                <label>Sin IVA</label>
                <input type="text" inputMode="decimal" value={draft.sinIva}
                  onChange={e => setDraft(d => ({ ...d, sinIva: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Con IVA</label>
                <input type="text" inputMode="decimal" value={draft.conIva}
                  onChange={e => setDraft(d => ({ ...d, conIva: e.target.value }))} />
              </div>
              <div className={styles.inlineEditActions}>
                <button className="btn btn-primary" onClick={saveEdit}>✓ Guardar</button>
                <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        ) : (
          <div key={it.id} className={styles.itemBlock}>
            <div className={styles.itemRow}>
              <span className={styles.itemName}>{displayName(it)}</span>
              <span className={styles.itemDate}>{formatDate(it.fecha)}</span>
              <span className={styles.itemAmount}>{eur(it.sinIva)} / {eur(it.conIva)}</span>
              <div className={styles.itemActions}>
                {onDuplicate && <button className={styles.dupBtn} onClick={() => onDuplicate(it.id)} title="Duplicar">⧉</button>}
                {onEdit      && <button className={styles.editBtn} onClick={() => startEdit(it)}     title="Editar">✏️</button>}
                <button className={styles.removeBtn} onClick={() => onRemove(it.id)}>✕</button>
              </div>
            </div>
            <ItemAdjuntoRow item={it} viajeId={viajeId} onEdit={onEdit} />
          </div>
        )
      ))}
      <div className={styles.itemTotal}>
        <span>Total</span>
        <span>{eur(total)}</span>
      </div>
    </div>
  )
}

// ── Sub-component: ManutencioForm ─────────────────────────────────────────────

function ManutencioForm({ onAdd }) {
  const [fields, setFields] = useState({ tipo: 'comida', nombre: '', lugar: '', fecha: TODAY, sinIva: '', conIva: '' })

  function set(k, v) { setFields(prev => ({ ...prev, [k]: v })) }

  function handleExtracted(data) {
    setFields(prev => ({
      ...prev,
      nombre: data.nombre || prev.nombre,
      fecha:  data.fecha  || prev.fecha,
      sinIva: data.sinIva || prev.sinIva,
      conIva: data.conIva || prev.conIva,
    }))
  }

  function handleAdd() {
    if (!fields.conIva) return
    onAdd({ ...fields, id: uid() })
    setFields({ tipo: 'comida', nombre: '', lugar: '', fecha: TODAY, sinIva: '', conIva: '' })
  }

  return (
    <div className={styles.subForm}>
      <TicketUploader tipo="manutencion" onExtracted={handleExtracted} />

      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Tipo de comida</label>
          <div className={styles.tipoSelector}>
            {['desayuno','comida','cena'].map(t => (
              <button key={t} type="button"
                className={`${styles.tipoBtn} ${fields.tipo === t ? styles.tipoBtnActive : ''}`}
                onClick={() => set('tipo', t)}>
                {t === 'desayuno' ? '☀️ Desayuno' : t === 'comida' ? '🍽️ Comida' : '🌙 Cena'}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Fecha</label>
          <input type="date" value={fields.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Establecimiento <span className={styles.optional}>(opcional)</span></label>
          <input type="text" value={fields.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Nombre del restaurante, cafetería…" autoComplete="off" />
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Lugar <span className={styles.optional}>(opcional)</span></label>
          <input type="text" value={fields.lugar} onChange={e => set('lugar', e.target.value)}
            placeholder="Ciudad o dirección" autoComplete="off" />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Importe sin IVA</label>
          <input type="text" inputMode="decimal" value={fields.sinIva}
            onChange={e => set('sinIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Importe con IVA</label>
          <input type="text" inputMode="decimal" value={fields.conIva}
            onChange={e => set('conIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className={styles.addBtnWrapper}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!fields.conIva}>
            + Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-component: HotelForm ──────────────────────────────────────────────────

function HotelForm({ onAdd }) {
  const [fields, setFields] = useState({ nombre: '', fechaCheckin: '', fecha: TODAY, sinIva: '', conIva: '' })

  function set(k, v) { setFields(prev => ({ ...prev, [k]: v })) }

  function handleExtracted(data) {
    setFields(prev => ({
      ...prev,
      nombre: data.nombre || prev.nombre,
      fecha:  data.fecha  || prev.fecha,
      sinIva: data.sinIva || prev.sinIva,
      conIva: data.conIva || prev.conIva,
    }))
  }

  function handleAdd() {
    if (!fields.conIva) return
    onAdd({ ...fields, id: uid() })
    setFields({ nombre: '', fechaCheckin: '', fecha: TODAY, sinIva: '', conIva: '' })
  }

  return (
    <div className={styles.subForm}>
      <TicketUploader tipo="hotel" onExtracted={handleExtracted} />
      <div className={styles.fieldRow}>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Hotel / Alojamiento</label>
          <input type="text" value={fields.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Nombre del hotel" autoComplete="off" />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Fecha check-in <span className={styles.optional}>(opcional)</span></label>
          <input type="date" value={fields.fechaCheckin} onChange={e => set('fechaCheckin', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Fecha check-out</label>
          <input type="date" value={fields.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Importe sin IVA</label>
          <input type="text" inputMode="decimal" value={fields.sinIva}
            onChange={e => set('sinIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Importe con IVA</label>
          <input type="text" inputMode="decimal" value={fields.conIva}
            onChange={e => set('conIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className={styles.addBtnWrapper}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!fields.conIva}>
            + Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-component: OtrosGastoForm ─────────────────────────────────────────────

function OtrosGastoForm({ onAdd }) {
  const [fields, setFields] = useState({ tipo: '', descripcion: '', fecha: TODAY, sinIva: '', conIva: '' })

  function set(k, v) { setFields(prev => ({ ...prev, [k]: v })) }

  function handleAdd() {
    if (!fields.conIva && !fields.descripcion) return
    onAdd({ ...fields, id: uid() })
    setFields({ tipo: '', descripcion: '', fecha: TODAY, sinIva: '', conIva: '' })
  }

  return (
    <div className={styles.subForm}>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Tipo de gasto</label>
          <input type="text" value={fields.tipo} onChange={e => set('tipo', e.target.value)}
            placeholder="Ej: taxi, seguro viaje, visado…" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Fecha</label>
          <input type="date" value={fields.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label>Descripción <span className={styles.optional}>(opcional)</span></label>
        <input type="text" value={fields.descripcion} onChange={e => set('descripcion', e.target.value)}
          placeholder="Detalle adicional" autoComplete="off" />
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Importe sin IVA</label>
          <input type="text" inputMode="decimal" value={fields.sinIva}
            onChange={e => set('sinIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Importe con IVA</label>
          <input type="text" inputMode="decimal" value={fields.conIva}
            onChange={e => set('conIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className={styles.addBtnWrapper}>
          <button className="btn btn-primary" onClick={handleAdd}
            disabled={!fields.conIva && !fields.descripcion}>
            + Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-component: AdjuntosSection ───────────────────────────────────────────

function AdjuntosSection({ viajeId, adjuntos, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState(null)
  const fileRef = useRef()

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(`/api/gastos-viaje/${viajeId}/adjuntos`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      onChange([...adjuntos, data])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(adj) {
    if (!window.confirm(`¿Eliminar "${adj.originalName}"?`)) return
    try {
      await fetch(`/api/gastos-viaje/${viajeId}/adjuntos/${adj.id}`, { method: 'DELETE' })
      onChange(adjuntos.filter(a => a.id !== adj.id))
    } catch {
      setError('Error al eliminar el adjunto.')
    }
  }

  const MIME_ICON = mime => {
    if (mime === 'application/pdf') return '📄'
    if (mime.startsWith('image/')) return '🖼️'
    if (mime.includes('word')) return '📝'
    return '📎'
  }

  return (
    <div className={styles.adjuntosSection}>
      <p className={styles.adjuntosHint}>
        Añade imágenes, PDF o documentos Word que se incluirán como páginas al final del informe PDF.
      </p>
      <div
        className={styles.dropZone}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files[0]) }}
      >
        {uploading
          ? <span>Subiendo…</span>
          : <>
              <span className={styles.dropIcon}>📎</span>
              <span>Arrastra o toca para añadir documento</span>
              <span className={styles.dropHint}>PDF · PNG · JPG · DOCX · también cámara del móvil</span>
            </>
        }
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        capture="environment"
        className={styles.hiddenInput}
        onChange={e => handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      {error && <div className={`alert alert-error ${styles.uploaderError}`}>{error}</div>}
      {adjuntos.length > 0 && (
        <div className={styles.itemList}>
          {(() => {
            let pageOffset = 2 // informe es página 1
            return adjuntos.map(adj => {
              const pages   = adj.pageCount || 1
              const fromPg  = pageOffset
              const toPg    = pageOffset + pages - 1
              pageOffset   += pages
              const pageLabel = pages === 1
                ? `Pág. ${fromPg}`
                : `Págs. ${fromPg}–${toPg} (${pages} pág.)`
              return (
                <div key={adj.id} className={styles.itemRow}>
                  <span className={styles.adjIcon}>{MIME_ICON(adj.mime)}</span>
                  <a
                    href={`/api/gastos-viaje/${viajeId}/adjuntos/${adj.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.adjLink}
                  >
                    {adj.originalName}
                  </a>
                  <span className={styles.itemDate}>{pageLabel}</span>
                  <button className={styles.removeBtn} onClick={() => handleRemove(adj)}>✕</button>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}

// ── Sub-component: OtrosTrForm (Otros transporte) ─────────────────────────────

function OtrosTrForm({ onAdd }) {
  const [fields, setFields] = useState({ nombre: '', fecha: TODAY, sinIva: '', conIva: '' })

  function set(k, v) { setFields(prev => ({ ...prev, [k]: v })) }

  function handleAdd() {
    if (!fields.conIva) return
    onAdd({ ...fields, id: uid() })
    setFields({ nombre: '', fecha: TODAY, sinIva: '', conIva: '' })
  }

  return (
    <div className={styles.subForm}>
      <div className={styles.fieldRow}>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Tipo / descripción de transporte</label>
          <input type="text" value={fields.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Ej: taxi, ferry, metro, funicular…" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Fecha</label>
          <input type="date" value={fields.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className="form-group">
          <label>Importe sin IVA</label>
          <input type="text" inputMode="decimal" value={fields.sinIva}
            onChange={e => set('sinIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className="form-group">
          <label>Importe con IVA</label>
          <input type="text" inputMode="decimal" value={fields.conIva}
            onChange={e => set('conIva', e.target.value)} placeholder="0.00" autoComplete="off" />
        </div>
        <div className={styles.addBtnWrapper}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!fields.conIva}>
            + Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ icon, label, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <button type="button" className={styles.sectionBtn} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionLabel}>{label}</span>
        {badge > 0 && <span className={styles.badge}>{badge}</span>}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

function SubSection({ icon, label, badge, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.subSection} ${open ? styles.subSectionOpen : ''}`}>
      <button type="button" className={styles.subSectionBtn} onClick={() => setOpen(o => !o)}>
        <span>{icon}</span>
        <span>{label}</span>
        {badge > 0 && <span className={styles.badge}>{badge}</span>}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.subSectionBody}>{children}</div>}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

const EMPTY_VIAJE = {
  nombre:       '',
  fechaInicio:  TODAY,
  fechaFin:     '',
  logoCustom:   null,
  ceco:         '',
  numeroPedido: '',
  transporte:   { autopista: [], coche: [], avion: [], tren: [], autobus: [], parking: [], taxi: [], otros: [] },
  manutencion:  [],
  hotel:        [],
  otros:        [],
  adjuntos:     [],
}

export default function GastosViajeForm() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const isNew    = !id || id === 'nuevo'

  const [viaje, setViaje]       = useState(EMPTY_VIAJE)
  const [viajeId, setViajeId]   = useState(isNew ? null : id)
  const [loading, setLoading]   = useState(!isNew)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState(null)
  const [generating, setGenerating] = useState(null)
  const [sending, setSending]       = useState(false)
  const [cecoManual, setCecoManual] = useState(false)
  const logoRef = useRef()

  const isStandardCeco = code => CECO_OPTIONS.some(o => o.code === code)

  // Load existing viaje
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`/api/gastos-viaje/${id}`)
      .then(r => r.json())
      .then(data => {
        setViaje({
          ...EMPTY_VIAJE,
          ...data,
          transporte: { ...EMPTY_VIAJE.transporte, ...data.transporte },
          adjuntos:   data.adjuntos || [],
        })
        setViajeId(data.id)
        if (data.ceco && !CECO_OPTIONS.some(o => o.code === data.ceco)) {
          setCecoManual(true)
        }
      })
      .catch(() => setError('No se pudo cargar el viaje.'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // ── Setters ─────────────────────────────────────────────────────────────────
  function setField(k, v) {
    setViaje(prev => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  function setTransporte(tipo, fn) {
    setViaje(prev => ({
      ...prev,
      transporte: { ...prev.transporte, [tipo]: fn(prev.transporte[tipo] || []) },
    }))
    setSaved(false)
  }

  function addTransporte(tipo, item) {
    setTransporte(tipo, list => [...list, item])
  }

  function removeTransporte(tipo, itemId) {
    setTransporte(tipo, list => list.filter(i => i.id !== itemId))
  }

  function setSection(key, fn) {
    setViaje(prev => ({ ...prev, [key]: fn(prev[key] || []) }))
    setSaved(false)
  }

  function editTransporte(tipo, itemId, changes) {
    setTransporte(tipo, list => list.map(i => i.id === itemId ? { ...i, ...changes } : i))
  }

  function dupTransporte(tipo, itemId) {
    setTransporte(tipo, list => {
      const it = list.find(i => i.id === itemId)
      return it ? [...list, { ...it, id: uid() }] : list
    })
  }

  function editSection(key, itemId, changes) {
    setViaje(prev => ({ ...prev, [key]: prev[key].map(i => i.id === itemId ? { ...i, ...changes } : i) }))
    setSaved(false)
  }

  function dupSection(key, itemId) {
    setViaje(prev => {
      const it = (prev[key] || []).find(i => i.id === itemId)
      return it ? { ...prev, [key]: [...prev[key], { ...it, id: uid() }] } : prev
    })
    setSaved(false)
  }

  // ── Logo upload ─────────────────────────────────────────────────────────────
  function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setField('logoCustom', ev.target.result)
    reader.readAsDataURL(file)
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // Apply date defaults
      const toSave = {
        ...viaje,
        fechaInicio: viaje.fechaInicio || TODAY,
      }

      let res
      if (!viajeId) {
        res = await fetch('/api/gastos-viaje', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave),
        })
      } else {
        res = await fetch(`/api/gastos-viaje/${viajeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      if (!viajeId) {
        setViajeId(data.id)
        navigate(`/gastos-viaje/${data.id}`, { replace: true })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Clear all data ──────────────────────────────────────────────────────────
  function handleClear() {
    if (!window.confirm('¿Seguro que quieres limpiar todos los datos del formulario? Esta acción no se puede deshacer.')) return
    setViaje(EMPTY_VIAJE)
    setViajeId(null)
    setSaved(false)
    setError(null)
    navigate('/gastos-viaje/nuevo', { replace: true })
  }

  // ── Send report by email ────────────────────────────────────────────────────
  async function handleSendEmail() {
    if (!viajeId) {
      alert('Guarda el viaje primero antes de enviar el informe.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/gastos-viaje/${viajeId}/enviar-email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      alert(`✓ Informe enviado correctamente a ${data.to}`)
    } catch (err) {
      setError(`Error al enviar el email: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  // ── Generate report ─────────────────────────────────────────────────────────
  async function handleGenerate(format) {
    if (!viajeId) {
      alert('Guarda el viaje primero antes de generar el informe.')
      return
    }
    setGenerating(format)
    setError(null)
    try {
      const res = await fetch(`/api/gastos-viaje/${viajeId}/generar?format=${format}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      const safe = (viaje.nombre || 'GastosViaje').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40)
      a.download = `GastosViaje_${safe}_${viaje.fechaInicio || TODAY}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(null)
    }
  }

  // ── Computed totals for display ─────────────────────────────────────────────
  const tr = viaje.transporte
  const totalTransporte = [
    ...tr.autopista, ...tr.avion, ...tr.tren, ...tr.autobus, ...tr.parking, ...tr.taxi, ...tr.otros,
  ].reduce((a, it) => a + toNum(it.conIva), 0) +
  tr.coche.reduce((a, it) => a + (toNum(it.kmIda) + toNum(it.kmVuelta)) * toNum(it.precioPorKm ?? 0.29), 0)

  const totalManutencion = viaje.manutencion.reduce((a, it) => a + toNum(it.conIva), 0)
  const totalHotel       = viaje.hotel.reduce((a, it) => a + toNum(it.conIva), 0)
  const totalOtros       = viaje.otros.reduce((a, it) => a + toNum(it.conIva), 0)
  const totalGeneral     = totalTransporte + totalManutencion + totalHotel + totalOtros

  const countTr = Object.values(tr).reduce((a, arr) => a + arr.length, 0)

  if (loading) return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</p>

  return (
    <div>
      <PageHeader
        back="/gastos-viaje"
        backLabel="Gastos de viaje"
        title={viaje.nombre || (isNew ? 'Nuevo viaje' : 'Editar viaje')}
        subtitle="Registra todos los gastos del desplazamiento y genera el informe."
      />

      {/* ── Acceso al repositorio ──────────────────────────────────────────── */}
      <Link to="/gastos-viaje" className={styles.repoLink}>
        📂 Ver todos los viajes guardados
      </Link>

      {/* ── Header fields ─────────────────────────────────────────────────── */}
      <div className={styles.headerCard}>

        {/* Logo */}
        <div className={styles.logoRow}>
          <div className={styles.logoPreview} onClick={() => logoRef.current?.click()}>
            {viaje.logoCustom
              ? <img src={viaje.logoCustom} alt="Logo" className={styles.logoImg} />
              : <img src="/logos/animalario/cicbiogune.png" alt="CIC bioGUNE" className={styles.logoImg} />
            }
            <span className={styles.logoHint}>Toca para cambiar</span>
          </div>
          <input ref={logoRef} type="file" accept="image/*" className={styles.hiddenInput}
            onChange={handleLogoChange} />
          {viaje.logoCustom && (
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
              onClick={() => setField('logoCustom', null)}>
              Usar logo por defecto
            </button>
          )}
        </div>

        {/* Nombre */}
        <div className="form-group">
          <label htmlFor="nombre">Nombre del documento</label>
          <input id="nombre" type="text" value={viaje.nombre}
            onChange={e => setField('nombre', e.target.value)}
            placeholder="Ej: Viaje a Madrid – Congreso PRION 2026"
            autoComplete="off" maxLength={120} />
        </div>

        {/* Fechas */}
        <div className={styles.fieldRow}>
          <div className="form-group">
            <label htmlFor="fechaInicio">Fecha de inicio</label>
            <input id="fechaInicio" type="date" value={viaje.fechaInicio}
              onChange={e => {
                setField('fechaInicio', e.target.value)
                if (viaje.fechaFin && e.target.value > viaje.fechaFin)
                  setField('fechaFin', '')
              }} />
          </div>
          <div className="form-group">
            <label htmlFor="fechaFin">
              Fecha de fin <span className={styles.optional}>(dejar vacío si es un solo día)</span>
            </label>
            <input id="fechaFin" type="date" value={viaje.fechaFin}
              min={viaje.fechaInicio || TODAY}
              onChange={e => setField('fechaFin', e.target.value)}
              disabled={!viaje.fechaInicio} />
          </div>
        </div>

        {/* CeCO */}
        <div className="form-group" style={{ maxWidth: '480px' }}>
          <label htmlFor="ceco">Código CeCO</label>
          <select
            id="ceco"
            value={cecoManual ? '__custom__' : (viaje.ceco || '')}
            onChange={e => {
              if (e.target.value === '__custom__') {
                setCecoManual(true)
                setField('ceco', '')
              } else {
                setCecoManual(false)
                setField('ceco', e.target.value)
              }
            }}
          >
            <option value="">— Sin especificar —</option>
            {CECO_OPTIONS.map(o => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
            <option value="__custom__">✏️ Introducir código manualmente…</option>
          </select>
          {cecoManual && (
            <input
              type="text"
              value={viaje.ceco}
              onChange={e => setField('ceco', e.target.value)}
              placeholder="Ej. 324P0123"
              autoComplete="off"
              style={{ marginTop: '0.5rem' }}
            />
          )}
          <span className={styles.hint}>
            En el informe aparece solo el código (ej. 324P0749)
          </span>
        </div>
      </div>

      {/* ── Secciones de gastos ────────────────────────────────────────────── */}

      {/* Transporte */}
      <Section icon="🚗" label="Transporte" badge={countTr}>
        {/* Autopista */}
        <SubSection icon="🛣️" label="Autopista / Peaje" badge={tr.autopista.length}>
          <TicketForm tipo="autopista" onAdd={item => addTransporte('autopista', item)} />
          <TicketList items={tr.autopista} onRemove={id => removeTransporte('autopista', id)}
            onEdit={(id, ch) => editTransporte('autopista', id, ch)} onDuplicate={id => dupTransporte('autopista', id)} viajeId={viajeId} />
        </SubSection>

        {/* Coche */}
        <SubSection icon="🚗" label="Coche (vehículo propio)" badge={tr.coche.length}>
          <CocheForm onAdd={item => addTransporte('coche', item)} />
          <CocheList items={tr.coche} onRemove={id => removeTransporte('coche', id)}
            onEdit={(id, ch) => editTransporte('coche', id, ch)} onDuplicate={id => dupTransporte('coche', id)} viajeId={viajeId} />
        </SubSection>

        {/* Avión */}
        <SubSection icon="✈️" label="Avión" badge={tr.avion.length}>
          <TicketForm tipo="avion" onAdd={item => addTransporte('avion', item)} />
          <TicketList items={tr.avion} onRemove={id => removeTransporte('avion', id)}
            onEdit={(id, ch) => editTransporte('avion', id, ch)} onDuplicate={id => dupTransporte('avion', id)} viajeId={viajeId} />
        </SubSection>

        {/* Tren */}
        <SubSection icon="🚂" label="Tren" badge={tr.tren.length}>
          <TicketForm tipo="tren" onAdd={item => addTransporte('tren', item)} />
          <TicketList items={tr.tren} onRemove={id => removeTransporte('tren', id)}
            onEdit={(id, ch) => editTransporte('tren', id, ch)} onDuplicate={id => dupTransporte('tren', id)} viajeId={viajeId} />
        </SubSection>

        {/* Autobús */}
        <SubSection icon="🚌" label="Autobús" badge={tr.autobus.length}>
          <TicketForm tipo="autobus" onAdd={item => addTransporte('autobus', item)} />
          <TicketList items={tr.autobus} onRemove={id => removeTransporte('autobus', id)}
            onEdit={(id, ch) => editTransporte('autobus', id, ch)} onDuplicate={id => dupTransporte('autobus', id)} viajeId={viajeId} />
        </SubSection>

        {/* Parking */}
        <SubSection icon="🅿️" label="Parking" badge={tr.parking.length}>
          <TicketForm tipo="parking" onAdd={item => addTransporte('parking', item)} />
          <TicketList items={tr.parking} onRemove={id => removeTransporte('parking', id)}
            onEdit={(id, ch) => editTransporte('parking', id, ch)} onDuplicate={id => dupTransporte('parking', id)} viajeId={viajeId} />
        </SubSection>

        {/* Taxi */}
        <SubSection icon="🚕" label="Taxi / VTC" badge={tr.taxi.length}>
          <TicketForm tipo="taxi" onAdd={item => addTransporte('taxi', item)} />
          <TicketList items={tr.taxi} onRemove={id => removeTransporte('taxi', id)}
            onEdit={(id, ch) => editTransporte('taxi', id, ch)} onDuplicate={id => dupTransporte('taxi', id)} viajeId={viajeId} />
        </SubSection>

        {/* Otros transporte */}
        <SubSection icon="🛺" label="Otros transportes" badge={tr.otros.length}>
          <OtrosTrForm onAdd={item => addTransporte('otros', item)} />
          <TicketList items={tr.otros} onRemove={id => removeTransporte('otros', id)}
            onEdit={(id, ch) => editTransporte('otros', id, ch)} onDuplicate={id => dupTransporte('otros', id)} viajeId={viajeId} />
        </SubSection>

        {totalTransporte > 0 && (
          <div className={styles.sectionTotal}>
            Total transporte: <strong>{eur(totalTransporte)}</strong>
          </div>
        )}
      </Section>

      {/* Manutención */}
      <Section icon="🍽️" label="Manutención" badge={viaje.manutencion.length}>
        <ManutencioForm onAdd={item => setSection('manutencion', list => [...list, item])} />
        <ManutencioList
          items={viaje.manutencion}
          onRemove={id => setSection('manutencion', list => list.filter(i => i.id !== id))}
          onEdit={(id, ch) => editSection('manutencion', id, ch)}
          onDuplicate={id => dupSection('manutencion', id)}
          viajeId={viajeId}
        />
        {totalManutencion > 0 && (
          <div className={styles.sectionTotal}>
            Total manutención: <strong>{eur(totalManutencion)}</strong>
          </div>
        )}
      </Section>

      {/* Hotel */}
      <Section icon="🏨" label="Alojamiento / Hotel" badge={viaje.hotel.length}>
        <HotelForm onAdd={item => setSection('hotel', list => [...list, item])} />
        <TicketList
          items={viaje.hotel}
          onRemove={id => setSection('hotel', list => list.filter(i => i.id !== id))}
          onEdit={(id, ch) => editSection('hotel', id, ch)}
          onDuplicate={id => dupSection('hotel', id)}
          viajeId={viajeId}
        />
        {totalHotel > 0 && (
          <div className={styles.sectionTotal}>
            Total alojamiento: <strong>{eur(totalHotel)}</strong>
          </div>
        )}
      </Section>

      {/* Otros gastos */}
      <Section icon="📋" label="Otros gastos" badge={viaje.otros.length}>
        <OtrosGastoForm onAdd={item => setSection('otros', list => [...list, item])} />
        <OtrosList
          items={viaje.otros}
          onRemove={id => setSection('otros', list => list.filter(i => i.id !== id))}
          onEdit={(id, ch) => editSection('otros', id, ch)}
          onDuplicate={id => dupSection('otros', id)}
          viajeId={viajeId}
        />
        {totalOtros > 0 && (
          <div className={styles.sectionTotal}>
            Total otros: <strong>{eur(totalOtros)}</strong>
          </div>
        )}
      </Section>

      {/* ── Resumen y acciones ─────────────────────────────────────────────── */}
      {totalGeneral > 0 && (
        <div className={styles.totalCard}>
          <div className={styles.totalRow}>
            {totalTransporte  > 0 && <span>Transporte: <strong>{eur(totalTransporte)}</strong></span>}
            {totalManutencion > 0 && <span>Manutención: <strong>{eur(totalManutencion)}</strong></span>}
            {totalHotel       > 0 && <span>Alojamiento: <strong>{eur(totalHotel)}</strong></span>}
            {totalOtros       > 0 && <span>Otros: <strong>{eur(totalOtros)}</strong></span>}
          </div>
          <div className={styles.totalGeneral}>
            TOTAL GENERAL: <strong>{eur(totalGeneral)}</strong>
          </div>
        </div>
      )}

      {/* ── Número de pedido ──────────────────────────────────────────────── */}
      <div className={styles.pedidoCard}>
        <div className="form-group" style={{ maxWidth: '360px' }}>
          <label htmlFor="numeroPedido">
            N.º de pedido <span className={styles.optional}>(opcional — aparece en el informe)</span>
          </label>
          <input
            id="numeroPedido"
            type="text"
            value={viaje.numeroPedido || ''}
            onChange={e => setField('numeroPedido', e.target.value)}
            placeholder="Ej. PO-2026-0123"
            autoComplete="off"
          />
        </div>
      </div>

      {/* ── Documentos adjuntos ────────────────────────────────────────────── */}
      <Section icon="📎" label="Documentos adjuntos" badge={viaje.adjuntos.length}>
        {!viajeId
          ? <p className={styles.adjuntosHint} style={{ color: 'var(--text-muted)', padding: '0.5rem 0' }}>
              Guarda el viaje primero para poder añadir documentos adjuntos.
            </p>
          : <AdjuntosSection
              viajeId={viajeId}
              adjuntos={viaje.adjuntos}
              onChange={list => { setField('adjuntos', list); setSaved(false) }}
            />
        }
      </Section>

      {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}

      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : '💾 Guardar'}
        </button>
        <button className="btn btn-primary" onClick={() => handleGenerate('docx')}
          disabled={!!generating || !viajeId}>
          {generating === 'docx' ? 'Generando…' : '⬇ Informe .docx'}
        </button>
        <button className="btn btn-ghost" onClick={() => handleGenerate('pdf')}
          disabled={!!generating || !viajeId}>
          {generating === 'pdf' ? 'Generando…' : '⬇ Informe PDF'}
        </button>
        <button className={styles.btnEmail} onClick={handleSendEmail}
          disabled={sending || !viajeId}>
          {sending ? 'Enviando…' : '📧 Enviar por email'}
        </button>
        <button className={styles.btnClear} onClick={handleClear}>
          🗑 Limpiar / Borrar
        </button>
        {!viajeId && (
          <span className={styles.saveHint}>Guarda primero para poder generar el informe</span>
        )}
      </div>
    </div>
  )
}
