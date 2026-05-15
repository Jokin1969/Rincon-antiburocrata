import { useState, useRef } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './FacturaProforma.module.css'
import dec from './DeclaracionExenta.module.css'
import { useDeclaracionExentaStore } from '../../hooks/useAduanasStore'

const TODAY = new Date().toISOString().split('T')[0]

const DEFAULTS = {
  firmante:       'Joaquín Castilla',
  cargo:          'Investigador responsable del laboratorio de priones en el CIC bioGUNE',
  representacion: 'CIC bioGUNE',
  aduana:         'Vitoria-Gasteiz (Aeropuerto de Foronda)',
  naturaleza:     '',
  cantidad:       '',
  importador:     '',
  exportador:     '',
  awb:            '',
  paisOrigen:     '',
  lugar:          'Derio',
  fecha:          TODAY,
  incluirFirma:   true,
  incluirSello:   true,
  logoBase64:     null,
  logoHeight:     90,
}

export default function DeclaracionExenta() {
  const [form,          setForm]          = useState(DEFAULTS)
  const [loadingFmt,    setLoadingFmt]    = useState(null)
  const [error,         setError]         = useState(null)

  // AI naturaleza
  const [iaDesc,        setIaDesc]        = useState('')
  const [iaLoading,     setIaLoading]     = useState(false)
  const [iaSuggestion,  setIaSuggestion]  = useState(null)
  const [iaError,       setIaError]       = useState(null)

  // Repository
  const { records, saveRecord, deleteRecord } = useDeclaracionExentaStore()
  const [repoOpen,   setRepoOpen]   = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveOk,     setSaveOk]     = useState(false)
  const [repoId,     setRepoId]     = useState('')

  const logoInputRef = useRef(null)

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  // ── Logo upload ─────────────────────────────────────────────────────────────
  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setField('logoBase64', ev.target.result)
    reader.readAsDataURL(file)
  }

  // ── AI: sugerir código NC ───────────────────────────────────────────────────
  async function handleIaSuggest() {
    if (!iaDesc.trim()) return
    setIaLoading(true)
    setIaError(null)
    setIaSuggestion(null)
    try {
      const res  = await fetch('/api/aduanas/ia-naturaleza', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description: iaDesc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setIaSuggestion(data.naturaleza)
    } catch (e) {
      setIaError(e.message)
    } finally {
      setIaLoading(false)
    }
  }

  function acceptSuggestion() {
    if (iaSuggestion) {
      setField('naturaleza', iaSuggestion)
      setIaSuggestion(null)
      setIaDesc('')
    }
  }

  // ── Repository: save ────────────────────────────────────────────────────────
  async function handleSave() {
    const id = repoId.trim() || form.awb?.trim() || form.naturaleza?.trim().slice(0, 40) || TODAY
    setSaving(true)
    setSaveOk(false)
    setError(null)
    const ok = await saveRecord(id, {
      ...form,
      awb:        form.awb,
      aduana:     form.aduana,
      naturaleza: form.naturaleza,
      importador: form.importador,
      exportador: form.exportador,
    })
    setSaving(false)
    if (ok) {
      setSaveOk(true)
      setRepoId(id)
      setTimeout(() => setSaveOk(false), 3000)
    } else {
      setError('Error al guardar en el repositorio.')
    }
  }

  // ── Repository: preview ────────────────────────────────────────────────────
  const [previewLoading, setPreviewLoading] = useState(null)

  async function handlePreview(r) {
    setPreviewLoading(r.id)
    try {
      const res = await fetch('/api/aduanas/declaracion-exenta?format=pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(r.form),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError(`No se pudo generar la vista previa: ${err.message}`)
    } finally {
      setPreviewLoading(null)
    }
  }

  // ── Repository: load ────────────────────────────────────────────────────────
  function loadRecord(r) {
    setForm({ ...DEFAULTS, ...r.form, fecha: r.form.fecha || TODAY })
    setRepoId(r.id)
    setRepoOpen(false)
    setError(null)
    setSaveOk(false)
  }

  // ── Generate & download ─────────────────────────────────────────────────────
  async function handleDownload(format) {
    if (!form.firmante?.trim()) {
      setError('El campo "Firmante" es obligatorio.')
      return
    }
    setLoadingFmt(format)
    setError(null)
    try {
      const res = await fetch(`/api/aduanas/declaracion-exenta?format=${format}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      const safe = (form.firmante || 'declaracion').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)
      a.download = `DeclaracionExenta_${safe}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  // ── Filtered records ────────────────────────────────────────────────────────
  const filteredRecords = records.filter(r => {
    if (!repoSearch) return true
    const q = repoSearch.toLowerCase()
    return r.id.toLowerCase().includes(q) ||
      r.form?.aduana?.toLowerCase().includes(q) ||
      r.form?.naturaleza?.toLowerCase().includes(q) ||
      r.form?.importador?.toLowerCase().includes(q) ||
      r.form?.exportador?.toLowerCase().includes(q) ||
      r.form?.awb?.toLowerCase().includes(q) ||
      r.form?.paisOrigen?.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        back="/aduanas"
        backLabel="Aduanas"
        title="Declaración de mercancías exentas"
        subtitle="Declaración ante la aduana de que las mercancías importadas no están sujetas a control oficial en frontera (MAPA/DGSPABA). Remisión 02 362."
      />

      {/* ── Repositorio ───────────────────────────────────────────────────── */}
      <div className={styles.repoPanel}>
        <button
          type="button"
          className={styles.repoPanelToggle}
          onClick={() => setRepoOpen(o => !o)}
        >
          <span>📂 Repositorio</span>
          <span className={styles.repoBadge}>{records.length}</span>
          <span style={{ marginLeft: 'auto' }}>{repoOpen ? '▲' : '▼'}</span>
        </button>

        {repoOpen && (
          <div className={styles.repoPanelBody}>
            {records.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Aún no hay declaraciones guardadas.
              </p>
            ) : (
              <>
                <input
                  className={styles.repoSearch}
                  placeholder="Buscar por AWB, aduana, naturaleza, importador…"
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                />
                <ul className={styles.repoList}>
                  {filteredRecords.map(r => (
                    <li key={r.id} className={styles.repoItem}>
                      <div className={styles.repoItemMeta}>
                        <span className={styles.repoItemCode}>
                          {r.id}
                          {r.form?.aduana && ` · ${r.form.aduana}`}
                        </span>
                        <span className={styles.repoItemSub}>
                          {r.form?.naturaleza && <>{r.form.naturaleza.slice(0, 50)}{r.form.naturaleza.length > 50 ? '…' : ''} · </>}
                          {r.form?.awb && <>AWB: {r.form.awb} · </>}
                          Guardado el {new Date(r.savedAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <div className={styles.repoItemActions}>
                        <button
                          className={styles.repoLoadBtn}
                          style={{ minWidth: '4.5rem' }}
                          onClick={() => handlePreview(r)}
                          disabled={previewLoading === r.id}
                          title="Abrir PDF en nueva pestaña"
                        >
                          {previewLoading === r.id ? '…' : '👁 Ver'}
                        </button>
                        <button
                          className={styles.repoLoadBtn}
                          onClick={() => loadRecord(r)}
                        >
                          Cargar
                        </button>
                        <button
                          className={styles.repoDeleteBtn}
                          onClick={() => {
                            if (window.confirm(`¿Eliminar "${r.id}" del repositorio?`)) deleteRecord(r.id)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <form className={styles.form} onSubmit={e => e.preventDefault()}>

        {/* ── Cabecera del documento (logo MAPA) ───────────────────────── */}
        <fieldset>
          <legend>Cabecera del documento</legend>

          <div className={dec.logoUploadRow}>
            <div className={dec.logoPreview} onClick={() => logoInputRef.current?.click()}>
              {form.logoBase64
                ? <img src={form.logoBase64} alt="Logo MAPA" className={dec.logoImg} />
                : <span className={dec.logoPlaceholder}>📎 Haz clic para cargar el logo/cabecera del MAPA<br /><small>PNG o JPG — se colocará a todo lo ancho del documento</small></span>
              }
            </div>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg"
              style={{ display: 'none' }} onChange={handleLogoChange} />
            <div className={dec.logoControls}>
              {form.logoBase64 && (
                <button type="button" className="btn btn-ghost"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setField('logoBase64', null)}>
                  Usar cabecera de texto
                </button>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="logoHeight" style={{ fontSize: '0.8rem' }}>Altura de imagen (px)</label>
                <input id="logoHeight" type="number" value={form.logoHeight} min={40} max={200}
                  onChange={e => setField('logoHeight', Number(e.target.value))}
                  style={{ width: '80px' }} />
              </div>
            </div>
          </div>
          <p className={dec.logoHint}>
            Si no cargas imagen se generará la cabecera en formato texto. Imagen por defecto: coloca <code>header-mapa.png</code> en <code>public/logos/mapa/</code>.
          </p>
        </fieldset>

        {/* ── Declarante ────────────────────────────────────────────────── */}
        <fieldset>
          <legend>Declarante</legend>

          <div className={styles.fieldRow}>
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="firmante">Firmante (De:) *</label>
              <input id="firmante" type="text" value={form.firmante}
                onChange={e => setField('firmante', e.target.value)}
                placeholder="Nombre y apellidos del firmante"
                autoComplete="name" maxLength={120} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="cargo">Cargo</label>
              <input id="cargo" type="text" value={form.cargo}
                onChange={e => setField('cargo', e.target.value)}
                placeholder="Cargo del firmante"
                maxLength={160} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="representacion">Organización (en representación de)</label>
            <input id="representacion" type="text" value={form.representacion}
              onChange={e => setField('representacion', e.target.value)}
              placeholder="Empresa u organización que representa"
              maxLength={120} />
          </div>
        </fieldset>

        {/* ── Aduana y envío ────────────────────────────────────────────── */}
        <fieldset>
          <legend>Aduana y envío</legend>

          <div className="form-group">
            <label htmlFor="aduana">Administración de la ADUANA de (Para:)</label>
            <input id="aduana" type="text" value={form.aduana}
              onChange={e => setField('aduana', e.target.value)}
              placeholder="Ej: Vitoria-Gasteiz (Aeropuerto de Foronda)"
              maxLength={120} />
          </div>

          {/* Naturaleza con asistente IA */}
          <div className="form-group">
            <label htmlFor="naturaleza">Naturaleza (Código NC / Descripción)</label>
            <input id="naturaleza" type="text" value={form.naturaleza}
              onChange={e => setField('naturaleza', e.target.value)}
              placeholder="Ej: 3002.90.90 — Muestras biológicas para investigación"
              maxLength={300} />
          </div>

          {/* IA assistant for NC code */}
          <div className={dec.iaBox}>
            <div className={dec.iaBoxHeader}>
              <span>✨ Asistente IA — sugerir Código NC</span>
            </div>
            <div className={dec.iaBoxBody}>
              <textarea
                className={dec.iaTextarea}
                rows={3}
                value={iaDesc}
                onChange={e => setIaDesc(e.target.value)}
                placeholder="Describe brevemente qué se importa (ej: anticuerpos policlonales para investigación, reactivos de laboratorio, células freeze-dried...)."
              />
              <div className={dec.iaActions}>
                <button type="button" className="btn btn-ghost"
                  style={{ fontSize: '0.82rem' }}
                  onClick={handleIaSuggest}
                  disabled={iaLoading || !iaDesc.trim()}>
                  {iaLoading ? 'Consultando IA…' : '✨ Sugerir Código NC con IA'}
                </button>
              </div>
              {iaError && <div className="alert alert-error" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>{iaError}</div>}
              {iaSuggestion && (
                <div className={dec.iaSuggestion}>
                  <span className={dec.iaSuggestionLabel}>Sugerencia:</span>
                  <code className={dec.iaSuggestionCode}>{iaSuggestion}</code>
                  <button type="button" className="btn btn-primary"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                    onClick={acceptSuggestion}>
                    ✓ Usar esta sugerencia
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className="form-group">
              <label htmlFor="cantidad">Cantidad</label>
              <input id="cantidad" type="text" value={form.cantidad}
                onChange={e => setField('cantidad', e.target.value)}
                placeholder="Ej: 1 caja, 5 viales"
                maxLength={80} />
            </div>
            <div className="form-group">
              <label htmlFor="paisOrigen">País de origen</label>
              <input id="paisOrigen" type="text" value={form.paisOrigen}
                onChange={e => setField('paisOrigen', e.target.value)}
                placeholder="Ej: Estados Unidos"
                maxLength={80} />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className="form-group">
              <label htmlFor="importador">Importador</label>
              <input id="importador" type="text" value={form.importador}
                onChange={e => setField('importador', e.target.value)}
                placeholder="Nombre o razón social del importador"
                maxLength={120} />
            </div>
            <div className="form-group">
              <label htmlFor="exportador">Exportador</label>
              <input id="exportador" type="text" value={form.exportador}
                onChange={e => setField('exportador', e.target.value)}
                placeholder="Nombre o razón social del exportador"
                maxLength={120} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="awb">AWB / Conocimiento Aéreo</label>
            <input id="awb" type="text" value={form.awb}
              onChange={e => setField('awb', e.target.value)}
              placeholder="Número de air waybill o conocimiento de embarque"
              maxLength={80} />
          </div>
        </fieldset>

        {/* ── Lugar y fecha de firma ────────────────────────────────────── */}
        <fieldset>
          <legend>Firma</legend>

          <div className={styles.fieldRow}>
            <div className="form-group">
              <label htmlFor="lugar">Lugar de firma</label>
              <input id="lugar" type="text" value={form.lugar}
                onChange={e => setField('lugar', e.target.value)}
                placeholder="Ciudad donde se firma"
                maxLength={80} />
            </div>
            <div className="form-group">
              <label htmlFor="fecha">Fecha de firma</label>
              <input id="fecha" type="date" value={form.fecha}
                onChange={e => setField('fecha', e.target.value)} />
            </div>
          </div>

          <div className={styles.togglesRow}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={form.incluirFirma}
                onChange={e => setField('incluirFirma', e.target.checked)} />
              Incluir firma (Joaquín Castilla)
            </label>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={form.incluirSello}
                onChange={e => setField('incluirSello', e.target.checked)} />
              Incluir sello CIC bioGUNE
            </label>
          </div>
        </fieldset>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── Guardar en repositorio ────────────────────────────────────── */}
        <div className={dec.saveRow}>
          <input
            className={dec.saveInput}
            type="text"
            placeholder="Identificador para guardar (ej: AWB-12345, 2026-05-EEUU)"
            value={repoId}
            onChange={e => setRepoId(e.target.value)}
            maxLength={80}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
          {saveOk && <span className={dec.saveOk}>✓ Guardado</span>}
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary"
            onClick={() => handleDownload('docx')}
            disabled={!!loadingFmt}>
            {loadingFmt === 'docx' ? 'Generando…' : '⬇ Descargar .docx'}
          </button>
          <button type="button" className="btn btn-ghost"
            onClick={() => handleDownload('pdf')}
            disabled={!!loadingFmt}>
            {loadingFmt === 'pdf' ? 'Generando…' : '⬇ Descargar PDF'}
          </button>
        </div>
      </form>
    </div>
  )
}
