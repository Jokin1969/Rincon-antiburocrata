import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './FacturaProforma.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const DEFAULTS = {
  firmante:       '',
  cargo:          '',
  representacion: '',
  aduana:         'Irun',
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
}

export default function DeclaracionExenta() {
  const [form,       setForm]       = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null)
  const [error,      setError]      = useState(null)

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

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

  return (
    <div>
      <PageHeader
        back="/aduanas"
        backLabel="Aduanas"
        title="Declaración de mercancías exentas"
        subtitle="Declaración del interesado de que las mercancías no están sujetas a control oficial en frontera (MAPA). Genera el documento listo para la aduana."
      />

      <form className={styles.form} onSubmit={e => e.preventDefault()}>

        {/* ── Declarante ────────────────────────────────────────────────── */}
        <fieldset>
          <legend>Declarante</legend>

          <div className={styles.fieldRow}>
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="firmante">Firmante (nombre completo) *</label>
              <input id="firmante" type="text" value={form.firmante}
                onChange={e => setField('firmante', e.target.value)}
                placeholder="Nombre y apellidos del firmante"
                autoComplete="name" maxLength={120} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="cargo">Cargo</label>
              <input id="cargo" type="text" value={form.cargo}
                onChange={e => setField('cargo', e.target.value)}
                placeholder="Ej: Responsable de importaciones"
                maxLength={80} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="representacion">Empresa / Organización representada</label>
            <input id="representacion" type="text" value={form.representacion}
              onChange={e => setField('representacion', e.target.value)}
              placeholder="Nombre de la empresa en cuya representación actúa"
              maxLength={120} />
            <span className={styles.hint}>Aparece como "en representación de …" en el documento.</span>
          </div>
        </fieldset>

        {/* ── Aduana y envío ────────────────────────────────────────────── */}
        <fieldset>
          <legend>Aduana y envío</legend>

          <div className="form-group">
            <label htmlFor="aduana">Aduana destinataria</label>
            <input id="aduana" type="text" value={form.aduana}
              onChange={e => setField('aduana', e.target.value)}
              placeholder="Ej: Irun, Barcelona, Madrid-Barajas"
              maxLength={80} />
          </div>

          <div className="form-group">
            <label htmlFor="naturaleza">Naturaleza (Código NC / Descripción)</label>
            <input id="naturaleza" type="text" value={form.naturaleza}
              onChange={e => setField('naturaleza', e.target.value)}
              placeholder="Ej: 3002.90.90 — Muestras biológicas para investigación"
              maxLength={200} />
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

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
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
