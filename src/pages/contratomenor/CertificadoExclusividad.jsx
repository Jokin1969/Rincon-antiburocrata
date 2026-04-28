import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './CertificadoExclusividad.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const CERT_PDF_PATH = '/assets/modelos/certificado-exclusividad.pdf'

const DEFAULT_JUSTIFICACION =
  'GenScript Biotech es la única empresa que reúne la combinación de capacidades técnicas, ' +
  'certificaciones y autorizaciones regulatorias necesarias para suministrar el material requerido:\n\n' +
  '1. Tecnología propietaria de síntesis génica de alta fidelidad que permite abordar secuencias de ' +
  'difícil síntesis con las especificaciones técnicas del proyecto.\n\n' +
  '2. Autorización específica del Ministerio de Salud de Singapur para la exportación de secuencias ' +
  'con características reguladas (material de doble uso), junto con la capacidad de emitir la ' +
  'documentación de control de exportaciones exigida (End User Statement).\n\n' +
  '3. Certificaciones ISO 9001 y buenas prácticas de laboratorio (GLP) que garantizan la calidad ' +
  'y trazabilidad del material sintetizado.\n\n' +
  'Ningún otro proveedor consultado puede suministrar el material con las especificaciones técnicas ' +
  'y los requisitos regulatorios requeridos en el plazo necesario para el desarrollo del proyecto.'

const INSTITUTIONS = {
  cicbiogune: { label: 'CIC bioGUNE' },
  ciber:      { label: 'Pedido desde el CIBER' },
}

const DEFAULTS = {
  institution:   'cicbiogune',
  expediente:    '',
  descripcion:   '',
  importe:       '',
  justificacion: DEFAULT_JUSTIFICACION,
  date:          TODAY,
}

export default function CertificadoExclusividad() {
  const [form, setForm]             = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error, setError]           = useState(null)
  // 'checking' | 'found' | 'missing'
  const [pdfStatus, setPdfStatus]   = useState('checking')

  useEffect(() => {
    fetch(CERT_PDF_PATH, { method: 'HEAD' })
      .then(r => setPdfStatus(r.ok ? 'found' : 'missing'))
      .catch(() => setPdfStatus('missing'))
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)
    try {
      const res = await fetch(
        `/api/contrato-menor/certificado-exclusividad?format=${format}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      const code = (form.expediente || form.descripcion || 'cert')
        .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      a.download = `CertificadoExclusividad_${code}_${form.date}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const isValid = form.descripcion.trim() && form.date && form.justificacion.trim()
  const busy    = loadingFmt !== null

  return (
    <div>
      <PageHeader
        back="/contrato-menor"
        backLabel="Contrato menor"
        title="Certificado de exclusividad"
        subtitle="Acredita que GenScript es el único proveedor capaz de suministrar la síntesis génica requerida (Art. 168.a).2 LCSP)."
      />

      {/* ── Documento guardado en el repositorio ─────────────────────────── */}
      <section className={styles.storedSection}>
        <div className={styles.storedHeader}>
          <div>
            <h2 className={styles.storedTitle}>Certificado guardado</h2>
            <p className={styles.storedSubtitle}>
              Documento de referencia almacenado en el repositorio · se carga automáticamente
            </p>
          </div>
          {pdfStatus === 'found' && (
            <div className={styles.storedActions}>
              <a
                href={CERT_PDF_PATH}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Abrir en nueva pestaña
              </a>
              <a
                href={CERT_PDF_PATH}
                download="certificado-exclusividad.pdf"
                className="btn btn-ghost"
              >
                Descargar
              </a>
            </div>
          )}
        </div>

        {pdfStatus === 'checking' && (
          <div className={styles.pdfPlaceholder}>
            <p className={styles.pdfPlaceholderText} style={{ opacity: 0.5 }}>Cargando…</p>
          </div>
        )}

        {pdfStatus === 'missing' && (
          <div className={styles.pdfPlaceholder}>
            <span className={styles.pdfPlaceholderIcon}>📄</span>
            <p className={styles.pdfPlaceholderText}>
              No hay ningún certificado guardado todavía.
            </p>
            <p className={styles.pdfPlaceholderHint}>
              Genera el certificado con el formulario de abajo, descárgalo en PDF
              y guárdalo en el repositorio como{' '}
              <code>public/assets/modelos/certificado-exclusividad.pdf</code>.
              Aparecerá aquí automáticamente al cargar la página.
            </p>
          </div>
        )}

        {pdfStatus === 'found' && (
          <iframe
            className={styles.pdfViewer}
            src={CERT_PDF_PATH}
            title="Certificado de exclusividad"
          />
        )}
      </section>

      {/* ── Formulario para generar un nuevo certificado ─────────────────── */}
      <section className={styles.formSection}>
        <h2 className={styles.formTitle}>Generar certificado</h2>
        <p className={styles.formSubtitle}>
          Rellena los campos específicos del expediente. La justificación, firma y logo
          se insertan automáticamente.
        </p>

        <form onSubmit={e => e.preventDefault()} className={styles.form}>

          {/* Institución */}
          <div className={styles.instSelector}>
            {Object.entries(INSTITUTIONS).map(([key, { label }]) => (
              <button
                key={key}
                type="button"
                className={`${styles.instBtn} ${form.institution === key ? styles.instBtnActive : ''}`}
                onClick={() => setForm(prev => ({ ...prev, institution: key }))}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.fields}>

            <div className={styles.row}>
              <div className="form-group">
                <label htmlFor="expediente">N.º de expediente</label>
                <input
                  id="expediente"
                  name="expediente"
                  type="text"
                  value={form.expediente}
                  onChange={handleChange}
                  placeholder="Ej. EXP-2026-042"
                  autoComplete="off"
                />
                <span className={styles.hint}>Opcional — aparece en el cuerpo del certificado</span>
              </div>

              <div className="form-group" style={{ maxWidth: '200px' }}>
                <label htmlFor="date">Fecha</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="descripcion">Objeto del contrato</label>
              <input
                id="descripcion"
                name="descripcion"
                type="text"
                value={form.descripcion}
                onChange={handleChange}
                placeholder="Ej. síntesis génica personalizada de plásmidos de investigación"
                autoComplete="off"
                required
              />
              <span className={styles.hint}>
                Describe brevemente qué se va a contratar — aparece en el cuerpo del certificado
              </span>
            </div>

            <div className="form-group" style={{ maxWidth: '260px' }}>
              <label htmlFor="importe">Importe estimado</label>
              <input
                id="importe"
                name="importe"
                type="text"
                value={form.importe}
                onChange={handleChange}
                placeholder="Ej. 3.200,00 € (IVA no incluido)"
                autoComplete="off"
              />
              <span className={styles.hint}>Opcional</span>
            </div>

            <div className="form-group">
              <label htmlFor="justificacion">Justificación de la exclusividad</label>
              <textarea
                id="justificacion"
                name="justificacion"
                value={form.justificacion}
                onChange={handleChange}
                rows={10}
                required
              />
              <span className={styles.hint}>
                Texto prerellenado con la justificación estándar para GenScript. Modifica si es necesario.
              </span>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

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
              Logo · Firma · Texto legal LCSP — todo incluido
            </span>
          </div>

        </form>
      </section>
    </div>
  )
}
