import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './QrHome.module.css'

function clientNormalizeUrl(raw) {
  if (!raw) return null
  let s = raw.trim()
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (!['http:', 'https:'].includes(u.protocol)) return null
    const host = u.hostname
    if (!/^[a-z0-9.-]+$/i.test(host)) return null
    const isIp    = /^\d+\.\d+\.\d+\.\d+$/.test(host)
    const isLocal = host === 'localhost'
    const hasTld  = /\.[a-z]{2,}$/i.test(host)
    if (!isIp && !isLocal && !hasTld) return null
    return u.toString()
  } catch { return null }
}

function resizeLogo(file) {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      const MAX   = 300
      const nw    = img.naturalWidth  || MAX
      const nh    = img.naturalHeight || MAX
      const scale = Math.min(MAX / nw, MAX / nh, 1)
      const w     = Math.max(1, Math.round(nw * scale))
      const h     = Math.max(1, Math.round(nh * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Error al cargar imagen')) }
    img.src = blobUrl
  })
}

const FORMATS = ['png', 'jpeg', 'webp', 'svg', 'pdf']

const DEFAULT_CONFIG = {
  url: '', style: 'classic', fg: '#111111', bg: '#ffffff',
  transparent: false, gradient: false, grad2: '#1B6CB0',
  ecc: 'M', logo: null, logoScale: 22, logoShape: 'circle',
  logoInner: 90, frame: false, frameText: 'Escáneame',
}

export default function QrHome() {
  const [styleList,  setStyleList]  = useState([])
  const [config,     setConfig]     = useState(DEFAULT_CONFIG)
  const [urlNorm,    setUrlNorm]    = useState(null)
  const [urlValid,   setUrlValid]   = useState(null)
  const [svgPreview, setSvgPreview] = useState(null)
  const [format,     setFormat]     = useState('png')
  const [emailTo,    setEmailTo]    = useState('')
  const [name,       setName]       = useState('')
  const [repoItems,  setRepoItems]  = useState([])
  const [logos,      setLogos]      = useState([])
  const [status,     setStatus]     = useState(null)
  const [busy,       setBusy]       = useState({})
  const logoFileRef = useRef(null)

  useEffect(() => {
    fetch('/api/qr/meta').then(r => r.json()).then(d => {
      setStyleList(d.styles || [])
      if (d.defaultEmail) setEmailTo(d.defaultEmail)
    }).catch(() => {})
    loadRepo()
    loadLogos()
  }, [])

  function loadRepo()  { fetch('/api/qr/list').then(r => r.json()).then(d => setRepoItems(d.items || [])).catch(() => {}) }
  function loadLogos() { fetch('/api/qr/logos').then(r => r.json()).then(d => setLogos(d.items || [])).catch(() => {}) }

  function handleUrlChange(val) {
    setConfig(c => ({ ...c, url: val }))
    if (!val.trim()) { setUrlNorm(null); setUrlValid(null); return }
    const norm = clientNormalizeUrl(val)
    setUrlNorm(norm); setUrlValid(norm !== null)
  }

  useEffect(() => {
    if (!urlNorm) { setSvgPreview(null); return }
    const t = setTimeout(() => {
      fetch('/api/qr/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, url: urlNorm }),
      }).then(r => r.json()).then(d => { if (d.svg) setSvgPreview(d.svg) }).catch(() => {})
    }, 320)
    return () => clearTimeout(t)
  }, [config, urlNorm])

  function setField(key, val) { setConfig(c => ({ ...c, [key]: val })) }

  async function handleLogoFile(file) {
    if (!file) return
    try {
      const dataUrl = await resizeLogo(file)
      setConfig(c => ({ ...c, logo: dataUrl, ecc: (c.ecc === 'L' || c.ecc === 'M') ? 'H' : c.ecc }))
    } catch { showStatus('err', 'Error al cargar el logo') }
  }

  async function handleSaveLogo() {
    if (!config.logo) return
    const n = prompt('Nombre para este logo:', 'Logo')
    if (n === null) return
    await fetch('/api/qr/logos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n || 'Logo', data: config.logo }),
    })
    loadLogos()
  }

  function showStatus(type, msg) {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 3500)
  }

  function effectiveCfg() { return { ...config, url: urlNorm ?? config.url } }

  async function handleDownload() {
    if (!urlNorm) return
    setBusy(b => ({ ...b, download: true }))
    try {
      const res = await fetch('/api/qr/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: effectiveCfg(), format, name }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al exportar')
      const blob = await res.blob()
      const cd   = res.headers.get('Content-Disposition') || ''
      const fn   = (cd.match(/filename="?([^";\n]+)"?/) || [])[1] || `qr.${format === 'jpeg' ? 'jpg' : format}`
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) { showStatus('err', e.message) }
    setBusy(b => ({ ...b, download: false }))
  }

  async function handleCopy() {
    if (!urlNorm) return
    setBusy(b => ({ ...b, copy: true }))
    try {
      const res  = await fetch('/api/qr/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: effectiveCfg(), format: 'png', name }),
      })
      const blob = await res.blob()
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        showStatus('ok', 'Copiado al portapapeles')
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'qr.png'; a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch { showStatus('err', 'No se pudo copiar') }
    setBusy(b => ({ ...b, copy: false }))
  }

  async function handleEmail() {
    if (!urlNorm || !emailTo) return
    setBusy(b => ({ ...b, email: true }))
    try {
      const res  = await fetch('/api/qr/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: effectiveCfg(), format, name, to: emailTo }),
      })
      const data = await res.json()
      if (data.ok) showStatus('ok', `Enviado a ${data.to}`)
      else showStatus('err', data.error || 'Error al enviar')
    } catch (e) { showStatus('err', e.message) }
    setBusy(b => ({ ...b, email: false }))
  }

  async function handleSave() {
    if (!urlNorm) return
    setBusy(b => ({ ...b, save: true }))
    try {
      const res  = await fetch('/api/qr/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: effectiveCfg(), name }),
      })
      const data = await res.json()
      if (data.item) { showStatus('ok', `Guardado: ${data.item.name}`); loadRepo() }
      else showStatus('err', data.error || 'Error al guardar')
    } catch (e) { showStatus('err', e.message) }
    setBusy(b => ({ ...b, save: false }))
  }

  function handleRestore(item) {
    const cfg = typeof item.config === 'string' ? JSON.parse(item.config) : item.config
    setConfig({ ...DEFAULT_CONFIG, ...cfg })
    setName(item.name)
    const norm = clientNormalizeUrl(cfg.url)
    setUrlNorm(norm); setUrlValid(norm !== null)
  }

  async function handleDeleteQr(id) {
    await fetch(`/api/qr/${id}`, { method: 'DELETE' })
    loadRepo()
  }

  async function handleDeleteLogo(id) {
    await fetch(`/api/qr/logos/${id}`, { method: 'DELETE' })
    loadLogos()
  }

  async function handleRenameLogo(id, current) {
    const n = prompt('Nuevo nombre:', current)
    if (!n || n === current) return
    await fetch(`/api/qr/logos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    })
    loadLogos()
  }

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Generador de QRs"
        subtitle="Crea códigos QR estilizados con logo, marcos y exportación a PNG, JPEG, WEBP, SVG y PDF."
      />

      <div className={styles.layout}>
        <div className={styles.controls}>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>URL</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Dirección web</label>
              <div className={styles.urlRow}>
                <input type="text" className={styles.input} placeholder="ejemplo.com o https://…"
                  value={config.url} onChange={e => handleUrlChange(e.target.value)} />
                {urlValid !== null && (
                  <span className={urlValid ? styles.urlOk : styles.urlErr}>{urlValid ? '✓' : '✕'}</span>
                )}
              </div>
              {urlNorm && <p className={styles.urlNorm}>{urlNorm}</p>}
            </div>
            <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
              <label className={styles.label}>Nombre (opcional)</label>
              <input type="text" className={styles.input} placeholder="Nombre en el repositorio"
                maxLength={120} value={name} onChange={e => setName(e.target.value)} />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Estilo</h2>
            <div className={styles.styleGrid}>
              {styleList.map(s => (
                <button key={s.id} title={s.label}
                  className={`${styles.styleBtn} ${config.style === s.id ? styles.styleBtnActive : ''}`}
                  onClick={() => setConfig(c => ({ ...c, style: s.id, gradient: s.gradient ?? c.gradient }))}>
                  <span className={styles.styleSvg} dangerouslySetInnerHTML={{ __html: s.svg }} />
                  <span className={styles.styleLabel}>{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Colores y corrección</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Módulos</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorInput} value={config.fg} onChange={e => setField('fg', e.target.value)} />
                  <span className={styles.colorHex}>{config.fg}</span>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Fondo</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorInput}
                    value={config.transparent ? '#ffffff' : config.bg} disabled={config.transparent}
                    onChange={e => setField('bg', e.target.value)} />
                  <span className={styles.colorHex}>{config.transparent ? 'transparente' : config.bg}</span>
                </div>
              </div>
            </div>
            <div className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={config.transparent} onChange={e => setField('transparent', e.target.checked)} />
                Fondo transparente
              </label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={config.gradient} onChange={e => setField('gradient', e.target.checked)} />
                Degradado
              </label>
            </div>
            {config.gradient && (
              <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                <label className={styles.label}>2.º color</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorInput} value={config.grad2} onChange={e => setField('grad2', e.target.value)} />
                  <span className={styles.colorHex}>{config.grad2}</span>
                </div>
              </div>
            )}
            <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
              <label className={styles.label}>Corrección de errores</label>
              <select className={styles.select} value={config.ecc} onChange={e => setField('ecc', e.target.value)}>
                {['L','M','Q','H'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Logo central</h2>
            <div className={styles.logoActions}>
              <button className={styles.btn} onClick={() => logoFileRef.current?.click()}>Elegir imagen…</button>
              <input ref={logoFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }} onChange={e => handleLogoFile(e.target.files?.[0])} />
              {config.logo && (
                <>
                  <button className={styles.btn} onClick={() => setField('logo', null)}>Quitar</button>
                  <button className={styles.btn} onClick={handleSaveLogo}>★ Guardar logo</button>
                </>
              )}
            </div>
            {config.logo && (
              <div className={styles.logoPreview}>
                <img src={config.logo} alt="Logo" className={styles.logoPreviewImg} />
                <div className={styles.formGrid} style={{ marginTop: '0.75rem' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Forma</label>
                    <div className={styles.radioRow}>
                      {[['circle','Círculo'],['square','Cuadrado']].map(([v,l]) => (
                        <label key={v} className={styles.radioLabel}>
                          <input type="radio" name="logoShape" value={v} checked={config.logoShape === v} onChange={() => setField('logoShape', v)} />{l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tamaño recuadro: {config.logoScale}%</label>
                    <input type="range" className={styles.range} min={12} max={34} value={config.logoScale}
                      onChange={e => setField('logoScale', Number(e.target.value))} />
                  </div>
                  <div className={styles.formGroup} style={{ gridColumn: '1/-1' }}>
                    <label className={styles.label}>Zoom logo: {config.logoInner}%</label>
                    <input type="range" className={styles.range} min={50} max={250} value={config.logoInner}
                      onChange={e => setField('logoInner', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            )}
            {logos.length > 0 && (
              <div className={styles.logoLibrary}>
                <p className={styles.libraryTitle}>Tus logos</p>
                <div className={styles.logoGrid}>
                  {logos.map(l => (
                    <div key={l.id} className={styles.logoCard}>
                      <img src={l.data} alt={l.name} className={styles.logoThumb} title={`Usar: ${l.name}`}
                        onClick={() => setConfig(c => ({ ...c, logo: l.data, ecc: (c.ecc === 'L' || c.ecc === 'M') ? 'H' : c.ecc }))} />
                      <span className={styles.logoCardName}>{l.name}</span>
                      <div className={styles.logoCardActions}>
                        <button className={styles.iconBtn} title="Renombrar" onClick={() => handleRenameLogo(l.id, l.name)}>✎</button>
                        <button className={styles.iconBtn} title="Eliminar"  onClick={() => handleDeleteLogo(l.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Marco</h2>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={config.frame} onChange={e => setField('frame', e.target.checked)} />
              Añadir marco con etiqueta
            </label>
            {config.frame && (
              <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                <label className={styles.label}>Texto del marco (máx 28 car.)</label>
                <input type="text" className={styles.input} maxLength={28}
                  value={config.frameText} onChange={e => setField('frameText', e.target.value)} />
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Exportar</h2>
            <div className={styles.exportRow}>
              <select className={styles.select} value={format} onChange={e => setFormat(e.target.value)}>
                {FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
              <button className={styles.btnPrimary} onClick={handleDownload} disabled={!urlNorm || busy.download}>
                {busy.download ? 'Generando…' : '⬇ Descargar'}
              </button>
              <button className={styles.btn} onClick={handleCopy} disabled={!urlNorm || busy.copy}>
                {busy.copy ? '…' : '⧉ Copiar PNG'}
              </button>
            </div>
            <div className={styles.emailRow}>
              <input type="email" className={styles.input} placeholder="email@ejemplo.com"
                value={emailTo} onChange={e => setEmailTo(e.target.value)} />
              <button className={styles.btn} onClick={handleEmail} disabled={!urlNorm || !emailTo || busy.email}>
                {busy.email ? 'Enviando…' : '✉ Enviar'}
              </button>
            </div>
            <button className={styles.btnPrimary} style={{ marginTop: '0.5rem', width: '100%' }}
              onClick={handleSave} disabled={!urlNorm || busy.save}>
              {busy.save ? 'Guardando…' : '★ Guardar en repositorio'}
            </button>
            {status && <p className={status.type === 'ok' ? styles.statusOk : styles.statusErr}>{status.msg}</p>}
          </section>
        </div>

        <div className={styles.previewCol}>
          <div className={styles.previewBox}>
            {svgPreview
              ? <div className={styles.svgWrap} dangerouslySetInnerHTML={{ __html: svgPreview }} />
              : <div className={styles.previewEmpty}>
                  {urlValid === null ? 'Introduce una URL válida' : urlValid === false ? '✕ URL inválida' : 'Generando…'}
                </div>
            }
          </div>
        </div>
      </div>

      {repoItems.length > 0 && (
        <section className={styles.section} style={{ marginTop: '2rem' }}>
          <div className={styles.repoHeader}>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Repositorio</h2>
            <button className={styles.btn} onClick={loadRepo}>↻ Actualizar</button>
          </div>
          <div className={styles.repoGrid}>
            {repoItems.map(item => (
              <div key={item.id} className={styles.repoCard}>
                {item.thumb && <div className={styles.repoThumb} dangerouslySetInnerHTML={{ __html: item.thumb }} />}
                <div className={styles.repoInfo}>
                  <span className={styles.repoName}>{item.name}</span>
                  <span className={styles.repoUrl}>{item.url}</span>
                </div>
                <div className={styles.repoActions}>
                  <button className={styles.btn} onClick={() => handleRestore(item)}>Recuperar</button>
                  <button className={styles.iconBtn} title="Eliminar" onClick={() => handleDeleteQr(item.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
