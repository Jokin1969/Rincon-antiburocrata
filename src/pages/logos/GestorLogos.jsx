import { useState, useRef, useEffect, useCallback } from 'react'
import PageHeader from '../../components/PageHeader'
import { useLogoStore } from '../../hooks/useLogoStore'
import { MIME_EXT, formatBytes, getImageInfo, fileToArrayBuffer, downloadLogo, arrayBufferToBase64 } from '../../utils/imageUtils'
import styles from './GestorLogos.module.css'

const PREDEFINED_NAMES = [
  'ATLAS molecular pharma',
  'CIC bioGUNE',
  'FEEP',
  'Universidad de Deusto',
  'POCTEFA (Neurocoop)',
  'CIBER',
  'CIBERINFEC',
  'IKERBasque',
  'AEI',
  'Gobierno vasco',
  'Ministerio de Ciencia Innovación y Universidades',
  'CIMA',
  'Fundación Tatiana',
  'CReSA (IRTA)',
]

const CATEGORIES = [
  { id: 'institucional', label: 'Institucional' },
  { id: 'proyecto',      label: 'Proyecto' },
  { id: 'fundacion',     label: 'Fundación' },
  { id: 'organismo',     label: 'Organismo' },
  { id: 'universidad',   label: 'Universidad' },
  { id: 'empresa',       label: 'Empresa' },
]

const ACCEPTED_MIME = Object.keys(MIME_EXT)

function blobUrl(data, mime) {
  return URL.createObjectURL(new Blob([data], { type: mime }))
}

function bumpVersion(v) {
  const parts = String(v || '1').split('.')
  if (parts.length === 1) return `${parts[0]}.1`
  return [...parts.slice(0, -1), parseInt(parts[parts.length - 1], 10) + 1].join('.')
}

// ── OpenAI enhance panel ──────────────────────────────────────────────────────

function OpenAIPanel({ logo, onAccept, onClose }) {
  const [phase, setPhase] = useState('loading') // loading | result | refine | error
  const [svgResult, setSvgResult] = useState(null)
  const [error, setError] = useState(null)
  const [instrucciones, setInstrucciones] = useState('')
  const [accepting, setAccepting] = useState(false)

  async function fetchEnhancement(extraInstr = '') {
    setPhase('loading')
    setError(null)
    try {
      const base64 = arrayBufferToBase64(logo.data)
      const res = await fetch('/api/logos/openai-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: logo.mimeType,
          nombre: logo.name,
          instrucciones: extraInstr || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setSvgResult(data.svg)
      setPhase('result')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  useEffect(() => { fetchEnhancement() }, [])

  async function handleAccept() {
    setAccepting(true)
    const encoder = new TextEncoder()
    const buf = encoder.encode(svgResult).buffer
    await onAccept({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: logo.name,
      version: bumpVersion(logo.version),
      categories: logo.categories || [],
      mimeType: 'image/svg+xml',
      width: null,
      height: null,
      fileSize: encoder.encode(svgResult).byteLength,
      data: buf,
      uploadedAt: Date.now(),
      origin: 'OpenAI',
    })
    setAccepting(false)
    onClose()
  }

  const svgDataUrl = svgResult
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgResult)}`
    : null

  return (
    <div className={styles.openaiOverlay}>
      <div className={styles.openaiPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>✦ OpenAI — {logo.name}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.panelBody}>
          {phase === 'loading' && (
            <div className={styles.openaiLoading}>
              <span className={styles.openaiSpinner} />
              <p>OpenAI está analizando el logo y generando SVG…</p>
              <p className={styles.openaiHint}>Puede tardar hasta 30 segundos.</p>
            </div>
          )}

          {phase === 'error' && (
            <div className={styles.openaiError}>
              <p className={styles.openaiErrorMsg}>{error}</p>
              <button className="btn btn-ghost" onClick={() => fetchEnhancement()}>Reintentar</button>
            </div>
          )}

          {(phase === 'result' || phase === 'refine') && svgResult && (
            <>
              <div className={styles.openaiCompare}>
                <div className={styles.openaiCompareCol}>
                  <span className={styles.openaiCompareLabel}>Original</span>
                  <div className={styles.openaiPreview}>
                    <img src={blobUrl(logo.data, logo.mimeType)} alt="original" />
                  </div>
                </div>
                <div className={styles.openaiCompareCol}>
                  <span className={styles.openaiCompareLabel}>OpenAI SVG</span>
                  <div className={styles.openaiPreview}>
                    <img src={svgDataUrl} alt="openai svg" />
                  </div>
                </div>
              </div>

              <p className={styles.openaiMeta}>
                Nueva versión: <strong>v{bumpVersion(logo.version)}</strong> · Formato: <strong>SVG</strong> · Origen: <strong>OpenAI</strong>
              </p>
            </>
          )}

          {phase === 'refine' && (
            <div className={styles.openaiRefine}>
              <label className={styles.openaiRefineLabel}>Indicaciones para OpenAI</label>
              <textarea
                className={styles.openaiRefineTextarea}
                rows={4}
                value={instrucciones}
                onChange={e => setInstrucciones(e.target.value)}
                placeholder="Describe qué mejorar o corregir en el SVG generado…"
                autoFocus
              />
              <button
                className="btn btn-primary"
                disabled={!instrucciones.trim()}
                onClick={() => { fetchEnhancement(instrucciones); setInstrucciones('') }}
              >
                Volver a pedir a OpenAI
              </button>
            </div>
          )}
        </div>

        {phase === 'result' && (
          <div className={styles.panelActions}>
            <button
              className="btn btn-primary"
              disabled={accepting}
              onClick={handleAccept}
            >
              {accepting ? 'Guardando…' : '✓ Aceptar y guardar nueva versión'}
            </button>
            <button className="btn btn-ghost" onClick={() => setPhase('refine')}>
              ✎ Rechazar con modificaciones
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Rechazar
            </button>
          </div>
        )}

        {phase === 'refine' && (
          <div className={styles.panelActions}>
            <button className="btn btn-ghost" onClick={() => setPhase('result')}>
              ← Volver al resultado
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Upload panel ─────────────────────────────────────────────────────────────

function UploadPanel({ onSave, onClose, existingNames }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.0')
  const [cats, setCats] = useState([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  async function applyFile(f) {
    if (!f || !ACCEPTED_MIME.includes(f.type)) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
    setFile(f)
    if (!name) {
      const stem = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      const match = PREDEFINED_NAMES.find(n =>
        n.toLowerCase().includes(stem.toLowerCase()) ||
        stem.toLowerCase().includes(n.toLowerCase().split(' ')[0])
      )
      setName(match || stem)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) applyFile(f)
  }

  async function handleSave() {
    if (!file || !name.trim()) return
    setSaving(true)
    const [buf, info] = await Promise.all([fileToArrayBuffer(file), getImageInfo(file)])
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    await onSave({
      id,
      name: name.trim(),
      version: version.trim() || '1',
      categories: cats,
      mimeType: file.type,
      width: info.width,
      height: info.height,
      fileSize: file.size,
      data: buf,
      uploadedAt: Date.now(),
    })
    setSaving(false)
    onClose()
  }

  function toggleCat(id) {
    setCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Subir logo</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.panelBody}>
          {/* Drop / click zone */}
          <div
            className={`${styles.uploadCard} ${dragging ? styles.uploadCardDragging : ''}`}
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {preview
              ? <div className={styles.uploadThumb}><img src={preview} alt="preview" /></div>
              : <>
                  <span className={styles.uploadIcon}>📁</span>
                  <span>Haz clic, arrastra o pega (Ctrl+V)</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>PNG · WebP · JPG · SVG · GIF</span>
                </>
            }
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              style={{ display: 'none' }}
              onChange={e => applyFile(e.target.files[0])}
            />
          </div>

          {/* Metadata */}
          <div className={styles.editRow}>
            <label>Nombre</label>
            <input
              list="predefined-names"
              className={styles.editInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del logo / institución"
            />
            <datalist id="predefined-names">
              {PREDEFINED_NAMES.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className={styles.editRow}>
            <label>Versión</label>
            <input
              className={styles.editInput}
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="1.0"
              style={{ maxWidth: 120 }}
            />
          </div>

          <div className={styles.editRow}>
            <label>Categorías</label>
            <div className={styles.catCheckboxes}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.chip} ${cats.includes(c.id) ? styles.chipActive : ''}`}
                  onClick={() => toggleCat(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.panelActions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!file || !name.trim() || saving}
            onClick={handleSave}
          >
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Detail / download panel ───────────────────────────────────────────────────

function DetailPanel({ logo, onClose, onSave, onSaveNew, onDelete }) {
  const [name, setName] = useState(logo.name)
  const [version, setVersion] = useState(logo.version)
  const [cats, setCats] = useState(logo.categories || [])
  const [saving, setSaving] = useState(false)
  const [showOpenAI, setShowOpenAI] = useState(false)

  // Download opts
  const [fmt, setFmt] = useState('png')
  const [bg, setBg] = useState('transparent')
  const [mono, setMono] = useState(false)
  const [lockAR, setLockAR] = useState(true)
  const [dlW, setDlW] = useState(logo.width  ? String(logo.width)  : '')
  const [dlH, setDlH] = useState(logo.height ? String(logo.height) : '')

  // Live preview state and refs
  const [previewSrc, setPreviewSrc] = useState(null)
  const imgRef      = useRef(null)   // original HTMLImageElement
  const origUrlRef  = useRef(null)   // blob URL for the raw file
  const canvasUrlRef = useRef(null)  // blob URL for canvas-rendered version

  const isSvg = logo.mimeType === 'image/svg+xml'
  const ar = logo.width && logo.height ? logo.width / logo.height : null

  // Load original image once; initial preview = original blob URL
  useEffect(() => {
    const blob = new Blob([logo.data], { type: logo.mimeType })
    const url  = URL.createObjectURL(blob)
    origUrlRef.current = url
    setPreviewSrc(url)

    const img = new Image()
    img.onload = () => { imgRef.current = img }
    img.src = url

    return () => {
      URL.revokeObjectURL(url)
      origUrlRef.current = null
      if (canvasUrlRef.current) {
        URL.revokeObjectURL(canvasUrlRef.current)
        canvasUrlRef.current = null
      }
    }
  }, [logo])

  // Re-render preview when mono or bg changes
  useEffect(() => {
    if (!imgRef.current) return

    if (!mono && bg === 'transparent') {
      // Revert to original blob URL
      if (canvasUrlRef.current) {
        URL.revokeObjectURL(canvasUrlRef.current)
        canvasUrlRef.current = null
      }
      setPreviewSrc(origUrlRef.current)
      return
    }

    const img = imgRef.current
    const w   = img.naturalWidth  || 256
    const h   = img.naturalHeight || 256
    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    if (bg === 'white') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0)

    if (mono) {
      const data = ctx.getImageData(0, 0, w, h)
      const d = data.data
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        d[i] = d[i + 1] = d[i + 2] = g
      }
      ctx.putImageData(data, 0, 0)
    }

    canvas.toBlob(outBlob => {
      if (!outBlob) return
      if (canvasUrlRef.current) URL.revokeObjectURL(canvasUrlRef.current)
      canvasUrlRef.current = URL.createObjectURL(outBlob)
      setPreviewSrc(canvasUrlRef.current)
    })
  }, [mono, bg])

  function onWChange(v) {
    setDlW(v)
    if (lockAR && ar && v) setDlH(String(Math.round(Number(v) / ar)))
  }
  function onHChange(v) {
    setDlH(v)
    if (lockAR && ar && v) setDlW(String(Math.round(Number(v) * ar)))
  }

  function toggleCat(id) {
    setCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ ...logo, name: name.trim(), version: version.trim(), categories: cats })
    setSaving(false)
  }

  function handleDownload() {
    downloadLogo(logo, {
      format: fmt,
      width:  dlW ? parseInt(dlW) : null,
      height: dlH ? parseInt(dlH) : null,
      mono,
      background: bg,
    })
  }

  const fmtOptions = isSvg
    ? ['svg', 'png', 'webp', 'jpg']
    : ['png', 'webp', 'jpg']

  return (
    <>
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>{logo.name}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.panelBody}>

          {/* Live preview */}
          <div className={styles.preview}>
            {previewSrc && <img src={previewSrc} alt={logo.name} />}
          </div>

          {/* Meta */}
          <div className={styles.metaList}>
            <span className={styles.metaKey}>Formato</span>
            <span className={styles.metaVal}>{MIME_EXT[logo.mimeType]?.toUpperCase() ?? logo.mimeType}</span>
            {logo.width && <>
              <span className={styles.metaKey}>Dimensiones</span>
              <span className={styles.metaVal}>{logo.width} × {logo.height} px</span>
            </>}
            <span className={styles.metaKey}>Tamaño</span>
            <span className={styles.metaVal}>{formatBytes(logo.fileSize)}</span>
            <span className={styles.metaKey}>Versión</span>
            <span className={styles.metaVal}>{logo.version}</span>
            <span className={styles.metaKey}>Subido</span>
            <span className={styles.metaVal}>{new Date(logo.uploadedAt).toLocaleDateString('es-ES')}</span>
          </div>

          {/* Edit metadata */}
          <div className={styles.editRow}>
            <label>Nombre</label>
            <input
              list="predefined-names"
              className={styles.editInput}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className={styles.editRow}>
            <label>Versión</label>
            <input
              className={styles.editInput}
              value={version}
              onChange={e => setVersion(e.target.value)}
              style={{ maxWidth: 120 }}
            />
          </div>

          <div className={styles.editRow}>
            <label>Categorías</label>
            <div className={styles.catCheckboxes}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.chip} ${cats.includes(c.id) ? styles.chipActive : ''}`}
                  onClick={() => toggleCat(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Download options */}
          <div>
            <div className={styles.optLabel}>Opciones de descarga</div>
            <div className={styles.downloadGrid}>
              <div>
                <div className={styles.optLabel}>Formato</div>
                <div className={styles.segmented}>
                  {fmtOptions.map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`${styles.segBtn} ${fmt === f ? styles.segBtnActive : ''}`}
                      onClick={() => setFmt(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className={styles.optLabel}>Fondo</div>
                <div className={styles.segmented}>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${bg === 'transparent' ? styles.segBtnActive : ''}`}
                    onClick={() => setBg('transparent')}
                  >
                    Transp.
                  </button>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${bg === 'white' ? styles.segBtnActive : ''}`}
                    onClick={() => setBg('white')}
                  >
                    Blanco
                  </button>
                </div>
              </div>

              <div>
                <div className={styles.optLabel}>Color</div>
                <div className={styles.segmented}>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${!mono ? styles.segBtnActive : ''}`}
                    onClick={() => setMono(false)}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${mono ? styles.segBtnActive : ''}`}
                    onClick={() => setMono(true)}
                  >
                    Mono
                  </button>
                </div>
              </div>

              <div>
                <div className={styles.optLabel}>Tamaño (px)</div>
                <div className={styles.sizeRow}>
                  <input
                    className={styles.sizeInput}
                    type="number"
                    min="1"
                    placeholder="W"
                    value={dlW}
                    onChange={e => onWChange(e.target.value)}
                  />
                  <span className={styles.sizeSep}>×</span>
                  <input
                    className={styles.sizeInput}
                    type="number"
                    min="1"
                    placeholder="H"
                    value={dlH}
                    onChange={e => onHChange(e.target.value)}
                  />
                  <button
                    type="button"
                    title="Bloquear proporción"
                    className={`${styles.lockBtn} ${lockAR ? styles.lockBtnActive : ''}`}
                    onClick={() => setLockAR(p => !p)}
                  >
                    {lockAR ? '🔒' : '🔓'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.panelActions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Guardando…' : '💾 Guardar cambios'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleDownload}
          >
            ⬇ Descargar
          </button>
          <button
            type="button"
            className={styles.openaiBtn}
            onClick={() => setShowOpenAI(true)}
          >
            ✦ OpenAI
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={() => { if (window.confirm(`¿Eliminar "${logo.name}"?`)) { onDelete(logo.id); onClose() } }}
          >
            🗑 Eliminar
          </button>
        </div>
      </div>
    </div>

    {showOpenAI && (
      <OpenAIPanel
        logo={logo}
        onClose={() => setShowOpenAI(false)}
        onAccept={onSaveNew}
      />
    )}
    </>
  )
}

// ── Logo card ─────────────────────────────────────────────────────────────────

function LogoCard({ logo, onClick }) {
  const url = useRef(blobUrl(logo.data, logo.mimeType))
  useEffect(() => () => URL.revokeObjectURL(url.current), [])

  const ext = MIME_EXT[logo.mimeType]?.toUpperCase() ?? '?'
  const dims = logo.width ? `${logo.width}×${logo.height}` : null

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.thumb}>
        <img src={url.current} alt={logo.name} />
        <span className={styles.versionBadge}>v{logo.version}</span>
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardName}>{logo.name}</span>
        <span className={styles.cardMeta}>
          {ext}{dims ? ` · ${dims}` : ''} · {formatBytes(logo.fileSize)}
        </span>
        {logo.categories?.length > 0 && (
          <div className={styles.cardCats}>
            {logo.categories.map(c => (
              <span key={c} className={styles.catTag}>
                {CATEGORIES.find(x => x.id === c)?.label ?? c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GestorLogos() {
  const { logos, loading, saveLogo, deleteLogo } = useLogoStore()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [selected, setSelected] = useState(null)
  const [dragging, setDragging] = useState(false)
  const dropRef = useRef()
  const fileRef = useRef()

  // Global paste listener
  useEffect(() => {
    function onPaste(e) {
      const file = [...(e.clipboardData?.files ?? [])].find(f => ACCEPTED_MIME.includes(f.type))
      if (file) { setShowUpload(true); /* paste handled inside UploadPanel */ }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  function onDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }
  function onDragLeave() { setDragging(false) }
  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && ACCEPTED_MIME.includes(f.type)) setShowUpload(true)
  }

  const filtered = logos.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || (l.categories ?? []).includes(catFilter)
    return matchSearch && matchCat
  })

  return (
    <div
      ref={dropRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Gestor de logos"
        subtitle="Almacena, organiza y descarga los logos de las instituciones con formato y tamaño personalizados."
      />

      <div className={styles.page}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <input
            className={styles.searchBox}
            type="search"
            placeholder="Buscar logos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUpload(true)}
          >
            ＋ Subir logo
          </button>
        </div>

        {/* Category chips */}
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip} ${!catFilter ? styles.chipActive : ''}`}
            onClick={() => setCatFilter(null)}
          >
            Todos
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={`${styles.chip} ${catFilter === c.id ? styles.chipActive : ''}`}
              onClick={() => setCatFilter(prev => prev === c.id ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {/* Upload drop card */}
          <div
            className={`${styles.uploadCard} ${dragging ? styles.uploadCardDragging : ''}`}
            onClick={() => setShowUpload(true)}
          >
            <span className={styles.uploadIcon}>＋</span>
            <span>Subir logo</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>o arrastra aquí</span>
          </div>

          {loading && (
            <p className={styles.empty} style={{ gridColumn: 'span 4' }}>Cargando…</p>
          )}

          {!loading && filtered.length === 0 && logos.length > 0 && (
            <p className={styles.empty}>No hay resultados para esa búsqueda.</p>
          )}

          {!loading && logos.length === 0 && (
            <p className={styles.empty}>
              Aún no hay logos. Sube el primero haciendo clic en la tarjeta de la izquierda o arrastrando un archivo.
            </p>
          )}

          {filtered.map(logo => (
            <LogoCard
              key={logo.id}
              logo={logo}
              onClick={() => setSelected(logo)}
            />
          ))}
        </div>
      </div>

      {showUpload && (
        <UploadPanel
          onSave={saveLogo}
          onClose={() => setShowUpload(false)}
          existingNames={logos.map(l => l.name)}
        />
      )}

      {selected && (
        <DetailPanel
          logo={selected}
          onClose={() => setSelected(null)}
          onSave={async entry => { await saveLogo(entry); setSelected(null) }}
          onSaveNew={saveLogo}
          onDelete={deleteLogo}
        />
      )}
    </div>
  )
}
