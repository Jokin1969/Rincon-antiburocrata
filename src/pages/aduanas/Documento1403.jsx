import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/PageHeader'
import { useDocumento1403Store } from '../../hooks/useAduanasStore'
import { svgUrlToPng } from '../../utils/imageUtils'
import styles from './FacturaProforma.module.css'

const EMPTY_PERSONA = {
  nombre: '', organizacion: '', address1: '', address2: '',
  ciudad: '', cp: '', pais: '', telefono: '', fax: '', email: '', vat: '',
  es_cicbiogune: false,
  logo: '',
}

const DEFAULTS = {
  numero: '',
  lang: 'es',
  fecha: '',
  shipper: { ...EMPTY_PERSONA },
  firmante: '',
  cargo: '',
  cif: '',
  domicilio: '',
  producto: '',
  bultos: '',
  pesoNeto: '',
  taric: '',
  empresaOrigen: '',
  declaracionSumaria: '',
  contenedor: '',
  bol: '',
  factura: '',
  aduana: 'Irun',
  incluirFirma: true,
  incluirSello: true,
  incluirLogo: true,
}

const PERSONA_FIELDS = [
  { key: 'nombre',       label: 'Nombre completo',   placeholder: 'Full name' },
  { key: 'organizacion', label: 'Organización',      placeholder: 'Organization' },
  { key: 'address1',     label: 'Dirección línea 1', placeholder: 'Address line 1' },
  { key: 'address2',     label: 'Dirección línea 2', placeholder: 'Address line 2' },
  { key: 'ciudad',       label: 'Ciudad',            placeholder: 'City', half: true },
  { key: 'cp',           label: 'Código postal',     placeholder: 'Postal code', half: true },
  { key: 'pais',         label: 'País',              placeholder: 'Country' },
  { key: 'telefono',     label: 'Teléfono',          placeholder: '+34 000 000 000', half: true },
  { key: 'vat',          label: 'VAT / CIF',         placeholder: 'ESxxxxxxxxx', half: true },
]

export default function Documento1403() {
  const [form, setForm] = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error, setError] = useState(null)
  const [showRepo, setShowRepo] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [shippers, setShippers] = useState([])
  const [logoData, setLogoData] = useState(null)
  const [logoStatus, setLogoStatus] = useState(null)
  const logoFileRef = useRef(null)

  const { records, saveRecord, deleteRecord } = useDocumento1403Store()

  useEffect(() => {
    fetch('/data/shippers.json')
      .then(r => r.json())
      .then(setShippers)
      .catch(() => {})
  }, [])

  const shipperEsCIC = form.shipper.es_cicbiogune === true ||
    form.shipper.organizacion === 'CIC bioGUNE'

  function setField(path, value) {
    setForm(prev => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...prev, [path]: value }
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } }
    })
    setError(null)
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
    const next = personaToForm(persona)
    setForm(prev => ({
      ...prev,
      shipper: next,
      firmante: prev.firmante?.trim() ? prev.firmante : next.nombre,
      cif:      prev.cif?.trim()      ? prev.cif      : next.vat,
    }))
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

  async function handleSave() {
    if (!form.numero.trim()) return
    const meta = {
      shipperNombre: form.shipper.organizacion || form.shipper.nombre,
      proveedor:     form.empresaOrigen,
      producto:      form.producto,
      direccion:     shipperEsCIC ? 'DESDE CIC bioGUNE' : '',
    }
    const ok = await saveRecord(form.numero, { ...form, ...meta })
    if (ok) {
      setError(null)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } else {
      setError('No se pudo guardar la declaración. Revisa la consola y vuelve a intentarlo.')
    }
  }

  function loadRecord(record) {
    setForm({ ...DEFAULTS, ...record.form })
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
      const res = await fetch(`/api/aduanas/documento-1403?format=${format}`, {
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
      const sn   = (form.shipper.organizacion || form.shipper.nombre || 'emisor').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
      const pr   = (form.empresaOrigen || 'origen').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
      const num  = form.numero.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)
      a.download = num
        ? `Doc1403_${num}_${sn}_${pr}.${format}`
        : `Doc1403_${sn}_${pr}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const isValid =
    (form.shipper.nombre || form.shipper.organizacion) &&
    form.firmante.trim() &&
    form.producto.trim() &&
    form.empresaOrigen.trim()

  const busy = loadingFmt !== null

  const filteredRecords = records.filter(r => {
    if (!repoSearch) return true
    const q = repoSearch.toLowerCase()
    return r.id.toLowerCase().includes(q) ||
      r.form?.shipperNombre?.toLowerCase().includes(q) ||
      r.form?.proveedor?.toLowerCase().includes(q) ||
      r.form?.producto?.toLowerCase().includes(q) ||
      r.form?.direccion?.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        back="/aduanas"
        backLabel="Aduanas"
        title="Documento 1403"
        subtitle="Declaración del importador de productos NO sometidos a control farmacéutico (Orden SPI/2136/2011)."
      />

      {/* ── Repositorio ──────────────────────────────────────────────────── */}
      <div className={styles.repoPanel}>
        <button type="button" className={styles.repoPanelToggle} onClick={() => setShowRepo(v => !v)}>
          {showRepo ? '▲' : '▼'} Repositorio de declaraciones
          {records.length > 0 && <span className={styles.repoBadge}>{records.length}</span>}
        </button>
        {showRepo && (
          <div className={styles.repoPanelBody}>
            {records.length === 0 ? (
              <p className={styles.repoEmpty}>Sin declaraciones guardadas aún.</p>
            ) : (
              <>
                <input
                  type="text"
                  className={styles.repoSearch}
                  placeholder="Buscar por número, emisor, proveedor, producto…"
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
                            {r.form?.proveedor && ` ← ${r.form.proveedor}`}
                          </span>
                          <span className={styles.repoItemSub}>
                            {r.form?.producto && <>{r.form.producto} · </>}
                            {r.form?.direccion && <span className={styles.repoDireccion}>{r.form.direccion}</span>}
                            {' · '}Guardado el {new Date(r.savedAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className={styles.repoItemActions}>
                          <button type="button" className={styles.repoLoadBtn} onClick={() => loadRecord(r)}>Cargar</button>
                          <button
                            type="button"
                            className={styles.repoDeleteBtn}
                            onClick={() => { if (window.confirm(`¿Eliminar declaración «${r.id}»?`)) deleteRecord(r.id) }}
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

        <div className={styles.topControls}>
          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label htmlFor="numero">Número (interno)</label>
            <input
              id="numero"
              type="text"
              value={form.numero}
              onChange={e => setField('numero', e.target.value)}
              placeholder="1403-2026-001"
              autoComplete="off"
            />
          </div>

          <div className="form-group" style={{ maxWidth: '260px' }}>
            <label htmlFor="fecha">Fecha (vacío = hoy)</label>
            <input
              id="fecha"
              type="text"
              value={form.fecha}
              onChange={e => setField('fecha', e.target.value)}
              placeholder="27 de julio de 2026"
              autoComplete="off"
            />
          </div>

          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label htmlFor="aduana">Aduana de</label>
            <input
              id="aduana"
              type="text"
              value={form.aduana}
              onChange={e => setField('aduana', e.target.value)}
              placeholder="Irun"
              autoComplete="off"
            />
          </div>

          <div className={styles.toggleGroup}>
            <span className={styles.toggleLabel}>Idioma del documento</span>
            <div className={styles.toggleRow}>
              {[{ v: 'es', l: '🇪🇸 Español' }, { v: 'en', l: '🇬🇧 English' }].map(({ v, l }) => (
                <label key={v} className={`${styles.toggleBtn} ${form.lang === v ? styles.toggleBtnOn : ''}`}>
                  <input type="radio" name="lang" value={v} checked={form.lang === v} onChange={() => setField('lang', v)} className={styles.srOnly} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Empresa emisora */}
        <div className={styles.partiesRow} style={{ gridTemplateColumns: '1fr' }}>
          <PersonaSection
            title="Empresa emisora (membrete + firmante)"
            values={form.shipper}
            onChange={(field, val) => setField(`shipper.${field}`, val)}
            shippers={shippers}
            onSelectShipper={applyShipper}
            logoStatus={logoStatus}
            logoData={logoData}
            onUploadLogo={() => logoFileRef.current?.click()}
          />
        </div>

        <input
          ref={logoFileRef}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleLogoUpload}
        />

        {/* Datos del firmante */}
        <div className={styles.topControls}>
          <div className="form-group" style={{ flex: '1 1 320px', maxWidth: '420px' }}>
            <label htmlFor="firmante">D/Dª (firmante)</label>
            <input
              id="firmante"
              type="text"
              value={form.firmante}
              onChange={e => setField('firmante', e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="off"
            />
          </div>

          <div className="form-group" style={{ flex: '1 1 260px', maxWidth: '360px' }}>
            <label htmlFor="cargo">En calidad de…</label>
            <input
              id="cargo"
              type="text"
              value={form.cargo}
              onChange={e => setField('cargo', e.target.value)}
              placeholder="p. ej. Responsable de Compras"
              autoComplete="off"
            />
          </div>

          <div className="form-group" style={{ flex: '1 1 180px', maxWidth: '220px' }}>
            <label htmlFor="cif">CIF de la empresa</label>
            <input
              id="cif"
              type="text"
              value={form.cif}
              onChange={e => setField('cif', e.target.value)}
              placeholder="Autocompleta desde el VAT"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="domicilio">Domicilio (vacío = construido desde la empresa emisora)</label>
          <input
            id="domicilio"
            type="text"
            value={form.domicilio}
            onChange={e => setField('domicilio', e.target.value)}
            placeholder="Calle, número, ciudad, CP, país"
            autoComplete="off"
          />
        </div>

        {/* Datos del producto y envío */}
        <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <legend style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', padding: '0 0.4rem' }}>
            Datos del producto y del envío
          </legend>

          <div className="form-group">
            <label htmlFor="producto">Producto denominado</label>
            <input
              id="producto"
              type="text"
              value={form.producto}
              onChange={e => setField('producto', e.target.value)}
              placeholder="Nombre / descripción del producto importado"
              autoComplete="off"
            />
          </div>

          <div className={styles.topControls}>
            <div className="form-group" style={{ flex: '1 1 120px', maxWidth: '160px' }}>
              <label htmlFor="bultos">Nº de bultos</label>
              <input id="bultos" type="text" value={form.bultos} onChange={e => setField('bultos', e.target.value)} placeholder="1" autoComplete="off" />
            </div>

            <div className="form-group" style={{ flex: '1 1 160px', maxWidth: '200px' }}>
              <label htmlFor="pesoNeto">Peso neto (Kg)</label>
              <input id="pesoNeto" type="text" value={form.pesoNeto} onChange={e => setField('pesoNeto', e.target.value)} placeholder="0,50" autoComplete="off" />
            </div>

            <div className="form-group" style={{ flex: '1 1 220px', maxWidth: '280px' }}>
              <label htmlFor="taric">Partida TARIC</label>
              <input id="taric" type="text" value={form.taric} onChange={e => setField('taric', e.target.value)} placeholder="p. ej. 3002.90.9090" autoComplete="off" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="empresaOrigen">Empresa de origen (proveedor)</label>
            <input
              id="empresaOrigen"
              type="text"
              value={form.empresaOrigen}
              onChange={e => setField('empresaOrigen', e.target.value)}
              placeholder="Nombre del proveedor del que proceden los productos"
              autoComplete="off"
            />
          </div>

          <div className={styles.topControls}>
            <div className="form-group" style={{ flex: '1 1 260px', maxWidth: '340px' }}>
              <label htmlFor="declaracionSumaria">Declaración sumaria / nº conocimiento aéreo</label>
              <input id="declaracionSumaria" type="text" value={form.declaracionSumaria} onChange={e => setField('declaracionSumaria', e.target.value)} placeholder="" autoComplete="off" />
            </div>

            <div className="form-group" style={{ flex: '1 1 200px', maxWidth: '260px' }}>
              <label htmlFor="contenedor">Contenedor</label>
              <input id="contenedor" type="text" value={form.contenedor} onChange={e => setField('contenedor', e.target.value)} placeholder="" autoComplete="off" />
            </div>
          </div>

          <div className={styles.topControls}>
            <div className="form-group" style={{ flex: '1 1 260px', maxWidth: '340px' }}>
              <label htmlFor="bol">Bill of Lading / Air bill / CMR nº</label>
              <input id="bol" type="text" value={form.bol} onChange={e => setField('bol', e.target.value)} placeholder="" autoComplete="off" />
            </div>

            <div className="form-group" style={{ flex: '1 1 200px', maxWidth: '260px' }}>
              <label htmlFor="factura">Nº de factura</label>
              <input id="factura" type="text" value={form.factura} onChange={e => setField('factura', e.target.value)} placeholder="" autoComplete="off" />
            </div>
          </div>
        </fieldset>

        {/* Toggles */}
        <div className={styles.togglesRow}>
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

          <label className={styles.checkToggle}>
            <input type="checkbox" checked={form.incluirSello} onChange={e => setField('incluirSello', e.target.checked)} />
            <span>Incluir sello</span>
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
          <button type="button" className="btn btn-ghost" disabled={!form.numero.trim()} onClick={handleSave}>
            Guardar declaración
          </button>
          {savedMsg && <span className={styles.savedMsg}>✓ Guardado</span>}
          <span className={styles.meta}>Fecha por defecto: {new Date().toLocaleDateString('es-ES')}</span>
        </div>
      </form>
    </div>
  )
}

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
            <option value="">— Cargar desde directorio —</option>
            {shippers.map(s => (
              <option key={s.id} value={s.id}>{s.nombre_display}</option>
            ))}
          </select>
        )}
      </div>

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
