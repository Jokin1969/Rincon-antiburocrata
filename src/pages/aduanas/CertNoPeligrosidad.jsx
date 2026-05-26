import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/PageHeader'
import { useCertNoPeligrosidadStore } from '../../hooks/useAduanasStore'
import { svgUrlToPng } from '../../utils/imageUtils'
import styles from './FacturaProforma.module.css'

const DEFAULTS = {
  numero:       '',
  lang:         'es+en',
  lugar:        'Derio',
  nombre:       'Joaquín Castilla',
  dni:          '16287336R',
  centro:       'CIC bioGUNE',
  cif:          'G95229142',
  vat:          'ESG95229142',
  material:     '',
  materialEn:   '',
  hsCode:       '',
  incluirFirma: true,
  incluirSello: true,
  incluirLogo:  true,
}

export default function CertNoPeligrosidad() {
  const [form, setForm]           = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error, setError]         = useState(null)
  const [showRepo, setShowRepo]   = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [savedMsg, setSavedMsg]   = useState(false)
  const [logoData, setLogoData]   = useState(null)
  const [logoStatus, setLogoStatus] = useState(null)
  const [translateLoading, setTranslateLoading] = useState(null)
  const [translateError, setTranslateError]     = useState(null)
  const [sendingEmail, setSendingEmail]         = useState(false)
  const [emailMsg, setEmailMsg]                 = useState(null)
  const logoFileRef = useRef(null)
  const numeroRef   = useRef(null)

  const { records, saveRecord, deleteRecord } = useCertNoPeligrosidadStore()

  // Auto-cargar logo CIC bioGUNE al montar — dimensiones pequeñas para documento
  useEffect(() => {
    setLogoStatus('loading')
    const url = '/logos/animalario/cicbiogune.png'
    svgUrlToPng(url, 190, 65)
      .then(d => { setLogoData({ ...d, previewUrl: url }); setLogoStatus('ok') })
      .catch(() => {
        // Fallback al SVG de assets
        const fallback = '/assets/logos/CIC_bioGUNE.svg'
        svgUrlToPng(fallback, 190, 65)
          .then(d => { setLogoData({ ...d, previewUrl: fallback }); setLogoStatus('ok') })
          .catch(() => setLogoStatus('none'))
      })
  }, [])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await new Promise(resolve => {
      const r = new FileReader()
      r.onload = ev => resolve(ev.target.result)
      r.readAsDataURL(file)
    })
    setLogoStatus('loading')
    try {
      const d = await svgUrlToPng(dataUrl, 600, 200)
      setLogoData({ ...d, previewUrl: dataUrl })
      setLogoStatus('ok')
    } catch { setLogoStatus('error') }
    e.target.value = ''
  }

  async function handleTranslate(provider) {
    if (!form.material.trim()) return
    setTranslateLoading(provider)
    setTranslateError(null)
    try {
      const res = await fetch('/api/ia/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: form.material, provider }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const { traduccion } = await res.json()
      setField('materialEn', traduccion)
    } catch (err) {
      setTranslateError(err.message)
    } finally {
      setTranslateLoading(null)
    }
  }

  async function handleSave() {
    if (!form.numero.trim()) {
      setError('Asigna un número de referencia (interno) para poder guardar.')
      numeroRef.current?.focus()
      return
    }
    const ok = await saveRecord(form.numero, { ...form })
    if (ok) {
      setError(null)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } else {
      setError('No se pudo guardar. Inténtalo de nuevo.')
    }
  }

  function loadRecord(record) {
    setForm({ ...DEFAULTS, ...record.form })
    setLogoData(null); setLogoStatus(null)
    setShowRepo(false); setError(null)
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)
    try {
      const payload = {
        ...form,
        esCIC:      true,
        logoBase64: form.incluirLogo && logoData ? logoData.base64  : null,
        logoWidth:  logoData?.width,
        logoHeight: logoData?.height,
      }
      const res = await fetch(`/api/aduanas/cert-no-peligrosidad?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      const num = (form.numero || 'CertNoPeligrosidad').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)
      a.download = `${num}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    setEmailMsg(null)
    try {
      const payload = {
        ...form,
        esCIC:      true,
        logoBase64: form.incluirLogo && logoData ? logoData.base64  : null,
        logoWidth:  logoData?.width,
        logoHeight: logoData?.height,
      }
      const res = await fetch('/api/aduanas/cert-no-peligrosidad/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setEmailMsg({ ok: true, text: `✓ Email enviado a ${d.to}` })
    } catch (err) {
      setEmailMsg({ ok: false, text: err.message })
    } finally {
      setSendingEmail(false)
      setTimeout(() => setEmailMsg(null), 5000)
    }
  }

  const isValid = form.material.trim() && form.hsCode.trim()
  const busy    = loadingFmt !== null

  const filteredRecords = records.filter(r => {
    if (!repoSearch) return true
    const q = repoSearch.toLowerCase()
    return r.id.toLowerCase().includes(q) ||
      r.form?.material?.toLowerCase().includes(q) ||
      r.form?.nombre?.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        back="/aduanas"
        backLabel="Aduanas"
        title="Certificado de No Peligrosidad"
        subtitle="Certifica que el material biológico enviado no es tóxico, explosivo ni infeccioso para el transporte."
      />

      {/* ── Repositorio ──────────────────────────────────────────────────────── */}
      <div className={styles.repoPanel}>
        <button type="button" className={styles.repoPanelToggle} onClick={() => setShowRepo(v => !v)}>
          {showRepo ? '▲' : '▼'} Repositorio de certificados
          {records.length > 0 && <span className={styles.repoBadge}>{records.length}</span>}
        </button>
        {showRepo && (
          <div className={styles.repoPanelBody}>
            {records.length === 0 ? (
              <p className={styles.repoEmpty}>Sin certificados guardados aún.</p>
            ) : (
              <>
                <input
                  type="text"
                  className={styles.repoSearch}
                  placeholder="Buscar por número, material, nombre…"
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                />
                {filteredRecords.length === 0 ? (
                  <p className={styles.repoEmpty}>Sin resultados para «{repoSearch}».</p>
                ) : (
                  <ul className={styles.repoList}>
                    {filteredRecords.map(r => (
                      <li key={r.id} className={styles.repoItem}>
                        <div className={styles.repoItemMeta}>
                          <span className={styles.repoItemCode}>
                            {r.id}
                            {r.form?.nombre && ` · ${r.form.nombre}`}
                            {r.form?.material && ` — ${r.form.material.slice(0, 60)}…`}
                          </span>
                          <span className={styles.repoItemSub}>
                            Guardado el {new Date(r.savedAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className={styles.repoItemActions}>
                          <button type="button" className={styles.repoLoadBtn} onClick={() => loadRecord(r)}>Cargar</button>
                          <button
                            type="button"
                            className={styles.repoDeleteBtn}
                            onClick={() => { if (window.confirm(`¿Eliminar «${r.id}»?`)) deleteRecord(r.id) }}
                            title="Eliminar"
                          >×</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Formulario ───────────────────────────────────────────────────────── */}
      <form onSubmit={e => e.preventDefault()} className={styles.form}>

        {/* Nº + lugar + idioma */}
        <div className={styles.topControls}>
          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label htmlFor="numero">Número (interno)</label>
            <input
              id="numero"
              ref={numeroRef}
              type="text"
              value={form.numero}
              onChange={e => setField('numero', e.target.value)}
              placeholder="CERT-2026-001"
              autoComplete="off"
              style={!form.numero.trim() ? { background: '#fff7d6', borderColor: '#e8b800' } : undefined}
            />
          </div>

          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label htmlFor="lugar">Lugar de emisión</label>
            <input
              id="lugar"
              type="text"
              value={form.lugar}
              onChange={e => setField('lugar', e.target.value)}
              placeholder="Derio"
              autoComplete="off"
            />
          </div>

          <div className={styles.toggleGroup}>
            <span className={styles.toggleLabel}>Idioma del documento</span>
            <div className={styles.toggleRow}>
              {[
                { v: 'es',    l: '🇪🇸 Español' },
                { v: 'en',    l: '🇬🇧 English' },
                { v: 'es+en', l: '🇪🇸+🇬🇧 Bilingüe' },
              ].map(({ v, l }) => (
                <label key={v} className={`${styles.toggleBtn} ${form.lang === v ? styles.toggleBtnOn : ''}`}>
                  <input type="radio" name="lang" value={v} checked={form.lang === v} onChange={() => setField('lang', v)} className={styles.srOnly} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className={styles.personaSection} style={{ maxWidth: '480px' }}>
          <div className={styles.personaHeader}>
            <h3 className={styles.personaTitle}>Logo del documento</h3>
            <button type="button" className={styles.logoChangeBtn} onClick={() => logoFileRef.current?.click()}>
              ↑ {logoStatus === 'ok' ? 'Cambiar logo' : 'Adjuntar logo'}
            </button>
          </div>
          {logoStatus === 'loading' && <span className={styles.logoLoading}>Cargando logo…</span>}
          {logoStatus === 'ok' && logoData && (
            <div className={styles.logoPreview}>
              <img src={logoData.previewUrl} alt="logo" className={styles.logoPreviewImg} />
              <span className={styles.logoOk}>✓ Logo cargado</span>
            </div>
          )}
          {(logoStatus === 'none' || logoStatus === 'error') && (
            <div className={styles.logoWarning}>
              <span>⚠ Sin logo. Adjunta uno si lo deseas.</span>
            </div>
          )}
        </div>

        <input
          ref={logoFileRef}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleLogoUpload}
        />

        {/* Firmante */}
        <div className={styles.topControls}>
          <div className="form-group" style={{ flex: '2 1 260px' }}>
            <label htmlFor="nombre">Nombre del firmante</label>
            <input
              id="nombre"
              type="text"
              value={form.nombre}
              onChange={e => setField('nombre', e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="off"
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 160px', maxWidth: '220px' }}>
            <label htmlFor="dni">DNI / Pasaporte</label>
            <input
              id="dni"
              type="text"
              value={form.dni}
              onChange={e => setField('dni', e.target.value)}
              placeholder="16287336R"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Centro + CIF + VAT */}
        <div className={styles.topControls}>
          <div className="form-group" style={{ flex: '3 1 260px' }}>
            <label htmlFor="centro">Centro / Organización</label>
            <input
              id="centro"
              type="text"
              value={form.centro}
              onChange={e => setField('centro', e.target.value)}
              placeholder="CIC bioGUNE"
              autoComplete="off"
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', maxWidth: '200px' }}>
            <label htmlFor="cif">CIF (para texto en español)</label>
            <input
              id="cif"
              type="text"
              value={form.cif}
              onChange={e => setField('cif', e.target.value)}
              placeholder="G95229142"
              autoComplete="off"
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', maxWidth: '200px' }}>
            <label htmlFor="vat">VAT (para texto en inglés)</label>
            <input
              id="vat"
              type="text"
              value={form.vat}
              onChange={e => setField('vat', e.target.value)}
              placeholder="ESG95229142"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Material */}
        <div className="form-group">
          <label htmlFor="material">
            Descripción del material{' '}
            <span style={{ color: '#c97a00' }}>*</span>
          </label>
          <textarea
            id="material"
            rows={3}
            value={form.material}
            onChange={e => setField('material', e.target.value)}
            placeholder="Ej: 160 tubes of 0.5 ml each containing mouse plasma for research and diagnosis"
            style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }}
          />
        </div>

        {/* Descripción en inglés + botones IA — sólo en modo bilingüe */}
        {form.lang === 'es+en' && (
          <div className="form-group">
            <label htmlFor="materialEn">
              Descripción en inglés{' '}
              <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.8em' }}>(para el texto en inglés del documento bilingüe)</span>
            </label>
            <div className={styles.translateRow}>
              <span className={styles.translateLabel}>Traducir con IA:</span>
              {[{ v: 'claude', l: 'Claude' }, { v: 'openai', l: 'GPT-4o' }, { v: 'gemini', l: 'Gemini' }].map(p => (
                <button
                  key={p.v}
                  type="button"
                  className={styles.translateBtn}
                  disabled={!form.material.trim() || translateLoading !== null}
                  onClick={() => handleTranslate(p.v)}
                >
                  {translateLoading === p.v ? 'Traduciendo…' : `✦ ${p.l}`}
                </button>
              ))}
            </div>
            {translateError && <p className={styles.translateErr}>{translateError}</p>}
            <textarea
              id="materialEn"
              rows={3}
              value={form.materialEn}
              onChange={e => setField('materialEn', e.target.value)}
              placeholder="Ej: 160 tubes of 0.5 ml each containing mouse plasma for research and diagnosis"
              style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }}
            />
          </div>
        )}

        {/* Código HS */}
        <div className="form-group" style={{ maxWidth: '260px' }}>
          <label htmlFor="hsCode">
            Código HS{' '}
            <span style={{ color: '#c97a00' }}>*</span>
          </label>
          <input
            id="hsCode"
            type="text"
            value={form.hsCode}
            onChange={e => setField('hsCode', e.target.value)}
            placeholder="30021229"
            autoComplete="off"
          />
        </div>

        {/* Toggles */}
        <div className={styles.togglesRow}>
          {logoData && (
            <label className={styles.checkToggle}>
              <input type="checkbox" checked={form.incluirLogo} onChange={e => setField('incluirLogo', e.target.checked)} />
              <span>Incluir logo en el documento</span>
            </label>
          )}
          <label className={styles.checkToggle}>
            <input type="checkbox" checked={form.incluirFirma} onChange={e => setField('incluirFirma', e.target.checked)} />
            <span>Incluir firma manuscrita (Joaquín Castilla)</span>
          </label>
          <label className={styles.checkToggle}>
            <input type="checkbox" checked={form.incluirSello} onChange={e => setField('incluirSello', e.target.checked)} />
            <span>Incluir sello CIC bioGUNE</span>
          </label>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" disabled={!isValid || busy} onClick={() => handleDownload('docx')}>
            {loadingFmt === 'docx' ? 'Generando…' : '⬇ .docx'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={!isValid || busy} onClick={() => handleDownload('pdf')}>
            {loadingFmt === 'pdf' ? 'Generando…' : '⬇ PDF'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleSave}>
            Guardar certificado
          </button>
          <button type="button" className={styles.emailBtn} disabled={!isValid || busy || sendingEmail} onClick={handleSendEmail}>
            {sendingEmail ? 'Enviando…' : '✉ Enviar PDF por email'}
          </button>
          {savedMsg && <span className={styles.savedMsg}>✓ Guardado</span>}
          {emailMsg && <span className={emailMsg.ok ? styles.emailOk : styles.emailErr}>{emailMsg.text}</span>}
          <span className={styles.meta}>Fecha: {new Date().toLocaleDateString('es-ES')} · incluida automáticamente</span>
        </div>
      </form>
    </div>
  )
}
