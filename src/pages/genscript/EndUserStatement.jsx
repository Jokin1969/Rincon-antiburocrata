import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './EndUserStatement.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const DEFAULT_END_USE =
  'Plasmid is used for protein engineering & antibody engineering via protein expression ' +
  'research on gene of interest consists of engineered, non-pathogenic variants of the bank vole ' +
  'prion protein (PrP/PRNP), intended for protein expression research to support anti-prion ' +
  'therapeutic development. These DNA constructs enable the controlled expression and evaluation ' +
  'of dominant-negative and conversion-resistant PrP designs, focusing on the characterization of ' +
  'protein localization and functional readouts. The material is used strictly for research purposes ' +
  'to study protein interactions and inhibition mechanisms; it is not intended to generate any ' +
  'infectious agent, is not derived from infectious material, and poses no pathogenic risk.'

const DEFAULTS = {
  projectCode: '',
  model: '',
  quantity: '',
  endUse: DEFAULT_END_USE,
  date: TODAY,
  productDescription: 'Purified Plasmid DNA Samples',
  strategicCode: '1C353',
  hsCode: '29349910',
}

export default function EndUserStatement() {
  const [form, setForm] = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null) // 'docx' | 'pdf' | null
  const [error, setError] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)

    try {
      const res = await fetch(`/api/genscript/end-user-statement?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const code = form.projectCode.trim() || form.model.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      a.download = `EndUserStatement_${code}_${form.date}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const isValid = form.projectCode.trim() && form.model.trim() && form.quantity.trim() && form.endUse.trim() && form.date
  const busy = loadingFmt !== null

  return (
    <div>
      <PageHeader
        back="/genscript"
        backLabel="GenScript"
        title="End User Statement"
        subtitle="Rellena los campos que cambian por pedido. El resto del documento (datos CIC bioGUNE, GenScript, textos legales y firma de Jokin) se inserta automáticamente."
      />

      <form onSubmit={e => e.preventDefault()} className={styles.form}>

        {/* ── Variable fields ─────────────────────────────────────── */}
        <div className={styles.fields}>

          <div className="form-group" style={{ maxWidth: '260px' }}>
            <label htmlFor="projectCode">Código de proyecto</label>
            <input
              id="projectCode"
              name="projectCode"
              type="text"
              value={form.projectCode}
              onChange={handleChange}
              placeholder="Ej. PRJ-2026-042"
              autoComplete="off"
              required
            />
            <span className={styles.hint}>
              Solo para el nombre del archivo — no aparece en el documento
            </span>
          </div>

          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="model">Model / Constructos</label>
              <input
                id="model"
                name="model"
                type="text"
                value={form.model}
                onChange={handleChange}
                placeholder="Ej. SC0002, SC0004"
                autoComplete="off"
                required
              />
              <span className={styles.hint}>
                Nombres o códigos de los constructos del pedido, separados por comas
              </span>
            </div>

            <div className="form-group" style={{ maxWidth: '220px' }}>
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="text"
                value={form.quantity}
                onChange={handleChange}
                placeholder="Ej. 23 vials"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label htmlFor="date">Date</label>
            <input
              id="date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="endUse">End-use description</label>
            <textarea
              id="endUse"
              name="endUse"
              value={form.endUse}
              onChange={handleChange}
              rows={8}
              required
            />
            <span className={styles.hint}>
              Descripción científica del uso final. Por defecto incluye el texto estándar del grupo.
            </span>
          </div>
        </div>

        {/* ── Advanced (fixed defaults) ────────────────────────────── */}
        <div className={styles.advanced}>
          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? '▲' : '▼'} Campos avanzados (Product details)
          </button>

          {showAdvanced && (
            <div className={styles.advancedFields}>
              <div className={styles.row}>
                <div className="form-group">
                  <label htmlFor="productDescription">Product Description</label>
                  <input
                    id="productDescription"
                    name="productDescription"
                    type="text"
                    value={form.productDescription}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group" style={{ maxWidth: '180px' }}>
                  <label htmlFor="strategicCode">Strategic Goods Code</label>
                  <input
                    id="strategicCode"
                    name="strategicCode"
                    type="text"
                    value={form.strategicCode}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group" style={{ maxWidth: '160px' }}>
                  <label htmlFor="hsCode">HS Code</label>
                  <input
                    id="hsCode"
                    name="hsCode"
                    type="text"
                    value={form.hsCode}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isValid || busy}
            onClick={() => handleDownload('docx')}
          >
            {loadingFmt === 'docx' ? 'Generando…' : '⬇ .docx'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!isValid || busy}
            onClick={() => handleDownload('pdf')}
          >
            {loadingFmt === 'pdf' ? 'Generando…' : '⬇ PDF'}
          </button>
          <span className={styles.meta}>
            Logo · Firma · Texto legal · Datos GenScript — todo incluido
          </span>
        </div>

      </form>
    </div>
  )
}
