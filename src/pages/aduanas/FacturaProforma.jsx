import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/PageHeader'
import { useFacturaProformaStore } from '../../hooks/useAduanasStore'
import { svgUrlToPng } from '../../utils/imageUtils'
import styles from './FacturaProforma.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const EMPTY_PERSONA = {
  nombre: '', organizacion: '', address1: '', address2: '',
  ciudad: '', cp: '', pais: '', telefono: '', fax: '', email: '', vat: '',
  es_cicbiogune: false,
  logo: '',
}

const EMPTY_LINEA = { descripcion: '', cantidad: '', precioUnitario: '' }

const DEFAULT_RESEARCH_TEXT = 'For research purposes only. Not for human or veterinary use. No commercial value, not for re-sale. Contents packed on dry ice. Non-infectious, non-pathogenic, non-toxic, biological material'

const DEFAULTS = {
  numero: '',
  moneda: 'EUR',
  lang: 'en',
  shipper: { ...EMPTY_PERSONA },
  consignee: { ...EMPTY_PERSONA },
  paisOrigen: 'Spain',
  lineas: [{ ...EMPTY_LINEA }],
  hsCode: '',
  researchOnly: true,
  researchText: DEFAULT_RESEARCH_TEXT,
  incluirFirma: true,
  incluirSello: true,
  incluirLogo: true,
}

const PERSONA_FIELDS = [
  { key: 'nombre',       label: 'Nombre completo',    placeholder: 'Full name' },
  { key: 'organizacion', label: 'Organización',       placeholder: 'Organization' },
  { key: 'address1',     label: 'Dirección línea 1',  placeholder: 'Address line 1' },
  { key: 'address2',     label: 'Dirección línea 2',  placeholder: 'Address line 2' },
  { key: 'ciudad',       label: 'Ciudad',             placeholder: 'City', half: true },
  { key: 'cp',           label: 'Código postal',      placeholder: 'Postal code', half: true },
  { key: 'pais',         label: 'País',               placeholder: 'Country' },
  { key: 'telefono',     label: 'Teléfono',           placeholder: '+34 000 000 000', half: true },
  { key: 'vat',          label: 'VAT / Tax ID',       placeholder: 'VATID', half: true },
]

export default function FacturaProforma() {
  const [form, setForm] = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error, setError] = useState(null)
  const [showRepo, setShowRepo] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [shippers, setShippers] = useState([])
  const [hsIaLoading, setHsIaLoading] = useState(null)
  const [hsIaResult, setHsIaResult] = useState(null)
  const [hsIaError, setHsIaError] = useState(null)
  // logoData: { base64, width, height, previewUrl } | null
  const [logoData, setLogoData] = useState(null)
  // null=no shipper selected yet | 'loading' | 'ok' | 'error' | 'none'
  const [logoStatus, setLogoStatus] = useState(null)
  const logoFileRef = useRef(null)

  const { records, saveRecord, deleteRecord } = useFacturaProformaStore()

  // HS (6 dig, internacional) vs HTS (10 dig, EE.UU.)
  const esUSA = (s) => /united states/i.test(s || '')
  const codigoTipo = esUSA(form.paisOrigen) || esUSA(form.shipper.pais) ? 'HTS' : 'HS'

  // Load shippers.json
  useEffect(() => {
    fetch('/data/shippers.json')
      .then(r => r.json())
      .then(setShippers)
      .catch(() => {})
  }, [])

  // Detect if current shipper is CIC bioGUNE (flag from directory or org name fallback)
  const shipperEsCIC = form.shipper.es_cicbiogune === true ||
    form.shipper.organizacion === 'CIC bioGUNE'

  // Per-line totals
  function lineTotal(l) {
    const q = parseFloat(l.cantidad) || 0
    const p = parseFloat(l.precioUnitario) || 0
    return q * p
  }
  const totalQty   = form.lineas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
  const totalValue = form.lineas.reduce((s, l) => s + lineTotal(l), 0)
  const sym = form.moneda === 'USD' ? '$' : '€'

  function setField(path, value) {
    setForm(prev => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...prev, [path]: value }
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } }
    })
    setError(null)
  }

  function setLinea(i, field, value) {
    setForm(prev => ({
      ...prev,
      lineas: prev.lineas.map((l, idx) => idx === i ? { ...l, [field]: value } : l),
    }))
  }

  function addLinea() {
    setForm(prev => ({ ...prev, lineas: [...prev.lineas, { ...EMPTY_LINEA }] }))
  }

  function removeLinea(i) {
    setForm(prev => ({ ...prev, lineas: prev.lineas.filter((_, idx) => idx !== i) }))
  }

  function personaToForm(p) {
    return {
      ...EMPTY_PERSONA,
      nombre:        p.nombre_contacto   || '',
      organizacion:  p.organizacion      || '',
      address1:      p.direccion_linea1  || '',
      address2:      p.direccion_linea2  || '',
      ciudad:        p.ciudad            || '',
      cp:            p.codigo_postal     || '',
      pais:          p.pais              || '',
      telefono:      p.telefono          || '',
      fax:           p.fax               || '',
      email:         p.email             || '',
      vat:           p.vat_tax_id        || '',
      es_cicbiogune: p.es_cicbiogune     || false,
      logo:          p.logo              || '',
    }
  }

  function applyShipper(persona) {
    setForm(prev => ({ ...prev, shipper: personaToForm(persona) }))
    const logoFile = persona.logo
    if (logoFile) {
      setLogoStatus('loading')
      setLogoData(null)
      const url = `/assets/logos/${logoFile}`
      svgUrlToPng(url)
        .then(d => {
          setLogoData({ ...d, previewUrl: url })
          setLogoStatus('ok')
        })
        .catch(() => setLogoStatus('error'))
    } else {
      setLogoStatus('none')
      setLogoData(null)
    }
  }

  function applyConsignee(persona) {
    setForm(prev => ({ ...prev, consignee: personaToForm(persona) }))
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
      const d = await svgUrlToPng(dataUrl, 300, 120)
      setLogoData({ ...d, previewUrl: dataUrl })
      setLogoStatus('ok')
      setField('shipper.logo', '__manual__')
    } catch {
      setLogoStatus('error')
    }
    e.target.value = ''
  }

  async function handleHsIa(provider) {
    setHsIaLoading(provider)
    setHsIaResult(null)
    setHsIaError(null)
    try {
      const descripcion = form.lineas
        .filter(l => l.descripcion?.trim())
        .map(l => l.descripcion.trim())
        .join('; ')
      const res = await fetch('/api/ia/hs-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion, tipo: codigoTipo, provider }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      setHsIaResult(await res.json())
    } catch (err) {
      setHsIaError(err.message)
    } finally {
      setHsIaLoading(null)
    }
  }

  function handleSave() {
    if (!form.numero.trim()) return
    const meta = {
      shipperNombre:    form.shipper.organizacion || form.shipper.nombre,
      consigneeNombre:  form.consignee.organizacion || form.consignee.nombre,
      consigneePais:    form.consignee.pais,
      direccion:        shipperEsCIC ? 'DESDE CIC bioGUNE' : (
        (form.consignee.organizacion || '').includes('CIC bioGUNE') ? 'HACIA CIC bioGUNE' : ''
      ),
    }
    saveRecord(form.numero, { ...form, ...meta })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  function loadRecord(record) {
    setForm(prev => ({ ...DEFAULTS, ...record.form, lineas: record.form.lineas?.length ? record.form.lineas : [{ ...EMPTY_LINEA }] }))
    setLogoData(null)
    setLogoStatus(null)
    setShowRepo(false)
    setError(null)
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)
    try {
      const payload = {
        ...form,
        shipperEsCIC,
        logoBase64:  form.incluirLogo && logoData ? logoData.base64  : null,
        logoWidth:   logoData?.width,
        logoHeight:  logoData?.height,
      }
      const res = await fetch(`/api/aduanas/factura-proforma?format=${format}`, {
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
      a.href     = url
      const sn   = (form.shipper.organizacion || form.shipper.nombre || 'shipper').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
      const cn   = (form.consignee.organizacion || form.consignee.nombre || 'consignee').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
      const num  = form.numero.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)
      a.download = `Proforma_${num}_${sn}_${cn}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const isValid = form.numero.trim() &&
    (form.shipper.nombre || form.shipper.organizacion) &&
    (form.consignee.nombre || form.consignee.organizacion) &&
    form.lineas.some(l => l.descripcion?.trim())

  const busy = loadingFmt !== null

  const filteredRecords = records.filter(r => {
    if (!repoSearch) return true
    const q = repoSearch.toLowerCase()
    return r.id.toLowerCase().includes(q) ||
      r.form?.shipperNombre?.toLowerCase().includes(q) ||
      r.form?.consigneeNombre?.toLowerCase().includes(q) ||
      r.form?.consigneePais?.toLowerCase().includes(q) ||
      r.form?.direccion?.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        back="/aduanas"
        backLabel="Aduanas"
        title="Factura Proforma"
        subtitle="Genera facturas proforma para envíos internacionales de material biológico."
      />

      {/* ── Repositorio ──────────────────────────────────────────────────── */}
      <div className={styles.repoPanel}>
        <button type="button" className={styles.repoPanelToggle} onClick={() => setShowRepo(v => !v)}>
          {showRepo ? '▲' : '▼'} Repositorio de facturas
          {records.length > 0 && <span className={styles.repoBadge}>{records.length}</span>}
        </button>
        {showRepo && (
          <div className={styles.repoPanelBody}>
            {records.length === 0 ? (
              <p className={styles.repoEmpty}>Sin facturas guardadas aún.</p>
            ) : (
              <>
                <input
                  type="text"
                  className={styles.repoSearch}
                  placeholder="Buscar por número, remitente, destinatario, país…"
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
                            {r.form?.shipperNombre && ` · ${r.form.shipperNombre}`}
                            {r.form?.consigneeNombre && ` → ${r.form.consigneeNombre}`}
                          </span>
                          <span className={styles.repoItemSub}>
                            {r.form?.direccion && <span className={styles.repoDireccion}>{r.form.direccion}</span>}
                            {r.form?.consigneePais && ` · ${r.form.consigneePais}`}
                            {' · '}Guardado el {new Date(r.savedAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className={styles.repoItemActions}>
                          <button type="button" className={styles.repoLoadBtn} onClick={() => loadRecord(r)}>Cargar</button>
                          <button
                            type="button"
                            className={styles.repoDeleteBtn}
                            onClick={() => { if (window.confirm(`¿Eliminar factura «${r.id}»?`)) deleteRecord(r.id) }}
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

      {/* ── Formulario ───────────────────────────────────────────────────── */}
      <form onSubmit={e => e.preventDefault()} className={styles.form}>

        {/* Controles globales */}
        <div className={styles.topControls}>
          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label htmlFor="numero">Número de factura</label>
            <input
              id="numero"
              type="text"
              value={form.numero}
              onChange={e => setField('numero', e.target.value)}
              placeholder="2026-001"
              autoComplete="off"
            />
          </div>

          <div className={styles.toggleGroup}>
            <span className={styles.toggleLabel}>Moneda</span>
            <div className={styles.toggleRow}>
              {['EUR', 'USD'].map(m => (
                <label key={m} className={`${styles.toggleBtn} ${form.moneda === m ? styles.toggleBtnOn : ''}`}>
                  <input type="radio" name="moneda" value={m} checked={form.moneda === m} onChange={() => setField('moneda', m)} className={styles.srOnly} />
                  {m === 'EUR' ? '€ EUR' : '$ USD'}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.toggleGroup}>
            <span className={styles.toggleLabel}>Idioma del documento</span>
            <div className={styles.toggleRow}>
              {[{ v: 'en', l: '🇬🇧 English' }, { v: 'es', l: '🇪🇸 Español' }].map(({ v, l }) => (
                <label key={v} className={`${styles.toggleBtn} ${form.lang === v ? styles.toggleBtnOn : ''}`}>
                  <input type="radio" name="lang" value={v} checked={form.lang === v} onChange={() => setField('lang', v)} className={styles.srOnly} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* SHIPPER + CONSIGNEE */}
        <div className={styles.partiesRow}>
          <PersonaSection
            title="Shipper (Remitente)"
            prefix="shipper"
            values={form.shipper}
            onChange={(field, val) => setField(`shipper.${field}`, val)}
            shippers={shippers}
            onSelectShipper={applyShipper}
            logoStatus={logoStatus}
            logoData={logoData}
            onUploadLogo={() => logoFileRef.current?.click()}
          />
          <PersonaSection
            title="Consignee (Destinatario)"
            prefix="consignee"
            values={form.consignee}
            onChange={(field, val) => setField(`consignee.${field}`, val)}
            shippers={shippers}
            onSelectShipper={applyConsignee}
          />
        </div>

        {/* Hidden file input for logo upload */}
        <input
          ref={logoFileRef}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleLogoUpload}
        />

        {/* País de origen */}
        <div className="form-group" style={{ maxWidth: '280px' }}>
          <label htmlFor="paisOrigen">País de origen</label>
          <input
            id="paisOrigen"
            type="text"
            value={form.paisOrigen}
            onChange={e => setField('paisOrigen', e.target.value)}
            placeholder="Spain"
          />
        </div>

        {/* Líneas de producto */}
        <div className="form-group">
          <label>Líneas de producto</label>
          <div className={styles.lineasWrapper}>
            <table className={styles.lineasTable}>
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Descripción</th>
                  <th style={{ width: '9%'  }}>Cantidad</th>
                  <th style={{ width: '18%' }}>Precio unit.</th>
                  <th style={{ width: '18%' }}>Total</th>
                  <th style={{ width: '5%'  }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lineas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <textarea
                        value={l.descripcion}
                        onChange={e => setLinea(i, 'descripcion', e.target.value)}
                        placeholder="Descripción del producto / material"
                        rows={2}
                      />
                    </td>
                    <td>
                      <input type="number" min="0" value={l.cantidad} onChange={e => setLinea(i, 'cantidad', e.target.value)} placeholder="1" />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" value={l.precioUnitario} onChange={e => setLinea(i, 'precioUnitario', e.target.value)} placeholder="0.00" />
                    </td>
                    <td className={styles.lineaTotal}>
                      {sym} {lineTotal(l).toFixed(2)}
                    </td>
                    <td>
                      {form.lineas.length > 1 && (
                        <button type="button" className={styles.removeLineaBtn} onClick={() => removeLinea(i)} title="Eliminar línea">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalsRow}>
                  <td colSpan={2} className={styles.totalQtyCell}>
                    Total cantidad: <strong>{totalQty}</strong>
                  </td>
                  <td colSpan={2} className={styles.totalValCell}>
                    Total: <strong>{sym} {totalValue.toFixed(2)}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <button type="button" className={styles.addLineaBtn} onClick={addLinea}>+ Añadir línea</button>
          </div>
        </div>

        {/* Código HS / HTS global */}
        <div className={styles.hsBlock}>
          <div className="form-group">
            <label htmlFor="hsCode">
              Código {codigoTipo} del envío
              <span className={styles.hsTipoNote}>
                {codigoTipo === 'HTS'
                  ? 'HTS — 10 dígitos · Arancel de EE.UU.'
                  : 'HS — 6 dígitos · Sistema Armonizado internacional'}
              </span>
            </label>
            <input
              id="hsCode"
              type="text"
              value={form.hsCode}
              onChange={e => { setField('hsCode', e.target.value); setHsIaResult(null) }}
              placeholder={codigoTipo === 'HTS' ? 'p. ej. 3002.90.9090' : 'p. ej. 3002.90'}
              autoComplete="off"
              style={{ maxWidth: '220px' }}
            />
          </div>

          <div className={styles.hsIaRow}>
            <span className={styles.hsIaLabel}>Buscar con IA:</span>
            {[{ v: 'claude', l: 'Claude' }, { v: 'openai', l: 'GPT-4o' }, { v: 'gemini', l: 'Gemini' }].map(p => (
              <button
                key={p.v}
                type="button"
                className={styles.hsIaBtn}
                disabled={!form.lineas.some(l => l.descripcion?.trim()) || hsIaLoading !== null}
                onClick={() => handleHsIa(p.v)}
              >
                {hsIaLoading === p.v ? 'Consultando…' : `✦ ${p.l}`}
              </button>
            ))}
          </div>

          {hsIaError && <p className={styles.hsIaErr}>{hsIaError}</p>}

          {hsIaResult && (
            <div className={styles.hsIaResult}>
              <div className={styles.hsIaResultTop}>
                <span className={styles.hsIaCode}>{hsIaResult.codigo}</span>
                <span className={`${styles.hsIaCerteza} ${styles[`certeza${hsIaResult.certeza}`]}`}>
                  {hsIaResult.certeza === 'alta' ? '● Alta certeza'
                    : hsIaResult.certeza === 'media' ? '◑ Certeza media'
                    : '○ Certeza baja'}
                </span>
                <button
                  type="button"
                  className={styles.hsIaApply}
                  onClick={() => { setField('hsCode', hsIaResult.codigo); setHsIaResult(null) }}
                >
                  ↑ Aplicar
                </button>
                <button
                  type="button"
                  className={styles.hsIaDismiss}
                  onClick={() => setHsIaResult(null)}
                  title="Descartar"
                >×</button>
              </div>
              <p className={styles.hsIaJustificacion}>{hsIaResult.justificacion}</p>
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className={styles.togglesRow}>
          <label className={styles.checkToggle}>
            <input type="checkbox" checked={form.researchOnly} onChange={e => setField('researchOnly', e.target.checked)} />
            <span>For research purposes only</span>
          </label>

          {logoData && (
            <label className={styles.checkToggle}>
              <input type="checkbox" checked={form.incluirLogo} onChange={e => setField('incluirLogo', e.target.checked)} />
              <span>Incluir logo en el documento</span>
            </label>
          )}

          {shipperEsCIC && (
            <label className={styles.checkToggle}>
              <input type="checkbox" checked={form.incluirFirma} onChange={e => setField('incluirFirma', e.target.checked)} />
              <span>Incluir firma digital (Joaquín Castilla)</span>
            </label>
          )}

          {shipperEsCIC && (
            <label className={styles.checkToggle}>
              <input type="checkbox" checked={form.incluirSello} onChange={e => setField('incluirSello', e.target.checked)} />
              <span>Incluir sello CIC bioGUNE</span>
            </label>
          )}
        </div>

        {form.researchOnly && (
          <div className="form-group">
            <label htmlFor="researchText">Texto "For research purposes"</label>
            <textarea
              id="researchText"
              className={styles.researchTextarea}
              value={form.researchText}
              onChange={e => setField('researchText', e.target.value)}
              rows={3}
            />
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" disabled={!isValid || busy} onClick={() => handleDownload('docx')}>
            {loadingFmt === 'docx' ? 'Generando…' : '⬇ .docx'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={!isValid || busy} onClick={() => handleDownload('pdf')}>
            {loadingFmt === 'pdf' ? 'Generando…' : '⬇ PDF'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={!form.numero.trim()} onClick={handleSave}>
            Guardar factura
          </button>
          {savedMsg && <span className={styles.savedMsg}>✓ Guardado</span>}
          <span className={styles.meta}>Fecha: {new Date().toLocaleDateString('es-ES')} · incluida automáticamente</span>
        </div>
      </form>
    </div>
  )
}

// ── PersonaSection ────────────────────────────────────────────────────────────

function PersonaSection({ title, values, onChange, shippers, onSelectShipper, logoStatus, logoData, onUploadLogo }) {
  const isShipper = logoStatus !== undefined
  return (
    <div className={styles.personaSection}>
      <div className={styles.personaHeader}>
        <h3 className={styles.personaTitle}>{title}</h3>
        {shippers.length > 0 && (
          <select
            className={styles.shipperSelect}
            value=""
            onChange={e => {
              const s = shippers.find(s => String(s.id) === e.target.value)
              if (s) onSelectShipper(s)
            }}
          >
            <option value="">— Remitentes / destinatarios frecuentes —</option>
            {shippers.map(s => (
              <option key={s.id} value={s.id}>{s.nombre_display}</option>
            ))}
          </select>
        )}
      </div>

      {/* Logo zone — only for Shipper column */}
      {isShipper && logoStatus !== null && (
        <div className={styles.logoZone}>
          {logoStatus === 'loading' && (
            <span className={styles.logoLoading}>Cargando logo…</span>
          )}
          {logoStatus === 'ok' && logoData && (
            <div className={styles.logoPreview}>
              <img src={logoData.previewUrl} alt="logo" className={styles.logoPreviewImg} />
              <span className={styles.logoOk}>✓ Logo cargado</span>
              <button type="button" className={styles.logoChangeBtn} onClick={onUploadLogo} title="Cambiar logo">↑ Cambiar</button>
            </div>
          )}
          {(logoStatus === 'none' || logoStatus === 'error') && (
            <div className={styles.logoWarning}>
              <span>⚠ Sin logo para esta organización.</span>
              <button type="button" className={styles.logoUploadBtn} onClick={onUploadLogo}>
                ↑ Adjuntar logo
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.personaFields}>
        {PERSONA_FIELDS.map(f => (
          <div key={f.key} className={`form-group ${f.half ? styles.halfField : ''}`}>
            <label>{f.label}</label>
            <input
              type="text"
              value={values[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              autoComplete="off"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
