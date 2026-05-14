import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { TIPOS_JUSTIFICACION } from '../../data/contratoMenorConfig'
import { useContratoStore } from '../../hooks/useContratoStore'
import styles from './ContratoMenorPage.module.css'

const TODAY = new Date().toISOString().split('T')[0]
const EMPTY_PROVEEDOR = { nombre: '', cif: '', contacto: '', presupuesto: '' }
const EMPTY_PROVEEDORES = [{ ...EMPTY_PROVEEDOR }, { ...EMPTY_PROVEEDOR }, { ...EMPTY_PROVEEDOR }]

const DEFAULTS = {
  codigo: '',
  objeto: '',
  justificacionNecesidad: '',
  tipoJustificacion: '',
  centroCoste: '',
  proveedores: EMPTY_PROVEEDORES.map(p => ({ ...p })),
  justificacionEleccion: '',
  plazo: '',
  importe: '',
  fecha: TODAY,
}

export default function ContratoMenorPage() {
  const [form, setForm] = useState(DEFAULTS)
  const [loadingFmt, setLoadingFmt] = useState(null) // 'docx' | 'pdf' | null
  const [error, setError] = useState(null)
  const [showRepo, setShowRepo] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [certExclusividad, setCertExclusividad] = useState(false)
  const [certFile, setCertFile] = useState(null)
  // { name, type, data: base64 } — persisted across save/load
  const [certFileData, setCertFileData] = useState(null)
  const [iaFile, setIaFile] = useState(null)
  const [iaLoading, setIaLoading] = useState(null) // 'claude' | 'openai' | 'gemini' | null
  const [iaResult, setIaResult] = useState(null)
  const [iaError, setIaError] = useState(null)

  const { records, saveRecord, deleteRecord } = useContratoStore()

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: e.target.result.split(',')[1],
      })
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function openCertData(fileOrData) {
    let url
    if (fileOrData instanceof File) {
      url = URL.createObjectURL(fileOrData)
    } else {
      const bytes = atob(fileOrData.data)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      url = URL.createObjectURL(new Blob([arr], { type: fileOrData.type }))
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  async function handleIaGenerar(provider) {
    setIaLoading(provider)
    setIaResult(null)
    setIaError(null)
    try {
      const body = new FormData()
      body.append('provider', provider)
      if (iaFile) body.append('file', iaFile)
      const res = await fetch('/api/ia/contrato', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setIaResult(data)
    } catch (err) {
      setIaError(err.message)
    } finally {
      setIaLoading(null)
    }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  function handleProveedorChange(index, field, value) {
    setForm(prev => ({
      ...prev,
      proveedores: prev.proveedores.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }))
  }

  function addProveedor() {
    setForm(prev => ({
      ...prev,
      proveedores: [...prev.proveedores, { ...EMPTY_PROVEEDOR }],
    }))
  }

  function loadRecord(record) {
    setForm(prev => ({
      ...DEFAULTS,
      ...record.form,
      proveedores: record.form.proveedores?.length
        ? record.form.proveedores
        : EMPTY_PROVEEDORES.map(p => ({ ...p })),
      fecha: prev.fecha,
    }))
    setCertExclusividad(record.form?.justificacionEleccion === 'Se adjunta certificado de exclusividad')
    setCertFile(null)
    setCertFileData(record.form?.certFileData ?? null)
    setShowRepo(false)
    setError(null)
  }

  async function handleSave() {
    if (!form.codigo.trim()) return
    const { fecha, ...toSave } = form

    let certData = certFileData
    if (certFile) {
      try { certData = await readFileAsBase64(certFile) } catch { /* keep existing */ }
    }

    saveRecord(form.codigo, { ...toSave, certFileData: certData })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  async function handleDownload(format) {
    setLoadingFmt(format)
    setError(null)
    try {
      const res = await fetch(`/api/contrato-menor?format=${format}`, {
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
      const code = form.codigo.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      a.download = `Contrato_Menor_#${code}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFmt(null)
    }
  }

  const isValid =
    form.codigo.trim() &&
    form.objeto.trim() &&
    form.justificacionNecesidad.trim() &&
    form.tipoJustificacion

  const busy = loadingFmt !== null

  const filteredRecords = records.filter(r => {
    if (!repoSearch) return true
    const q = repoSearch.toLowerCase()
    return r.codigo.toLowerCase().includes(q) ||
      r.form?.proveedores?.some(p => p.nombre?.toLowerCase().includes(q))
  })

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Inicio"
        title="Contrato Menor"
        subtitle="Rellena los campos del formulario. Los datos fijos del centro y del responsable se insertan automáticamente en el documento."
      />

      {/* ── Repositorio de expedientes ───────────────────────────────────── */}
      <div className={styles.repoPanel}>
        <button
          type="button"
          className={styles.repoPanelToggle}
          onClick={() => setShowRepo(v => !v)}
        >
          {showRepo ? '▲' : '▼'} Repositorio de expedientes
          {records.length > 0 && <span className={styles.repoBadge}>{records.length}</span>}
        </button>
        {showRepo && (
          <div className={styles.repoPanelBody}>
            {records.length === 0 ? (
              <p className={styles.repoEmpty}>Sin expedientes guardados aún. Usa «Guardar expediente» tras rellenar el formulario.</p>
            ) : (
              <>
                <input
                  type="text"
                  className={styles.repoSearch}
                  placeholder="Buscar por código o proveedor…"
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                />
                {filteredRecords.length === 0 ? (
                  <p className={styles.repoEmpty}>Sin resultados para «{repoSearch}».</p>
                ) : (
                  <ul className={styles.repoList}>
                    {filteredRecords.map(r => (
                      <li key={r.codigo} className={styles.repoItem}>
                        <div className={styles.repoItemMeta}>
                          <span className={styles.repoItemCode}>
                            {r.codigo}
                            {(() => { const n = r.form?.proveedores?.find(p => p.nombre?.trim())?.nombre?.trim(); return n ? ` (${n})` : '' })()}
                            {r.form?.certFileData && <span className={styles.certBadge} title={r.form.certFileData.name}> 📎</span>}
                          </span>
                          <span className={styles.repoItemDate}>
                            Guardado el {new Date(r.savedAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className={styles.repoItemActions}>
                          <button
                            type="button"
                            className={styles.repoLoadBtn}
                            onClick={() => loadRecord(r)}
                          >
                            Cargar
                          </button>
                          <button
                            type="button"
                            className={styles.repoDeleteBtn}
                            onClick={() => { if (window.confirm(`¿Eliminar «${r.codigo}»?`)) deleteRecord(r.codigo) }}
                            title="Eliminar expediente"
                          >
                            ×
                          </button>
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
        <div className={styles.fields}>

          {/* Código + Fecha */}
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="codigo">Código</label>
              <input
                id="codigo"
                name="codigo"
                type="text"
                value={form.codigo}
                onChange={handleChange}
                placeholder="Ej. 2026-001"
                autoComplete="off"
                required
              />
              <span className={styles.hint}>Define el nombre del archivo: Contrato_Menor_#[código].docx</span>
            </div>
            <div className="form-group" style={{ maxWidth: '190px' }}>
              <label htmlFor="fecha">Fecha</label>
              <input
                id="fecha"
                name="fecha"
                type="date"
                value={form.fecha}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Objeto */}
          <div className="form-group">
            <label htmlFor="objeto">Objeto del contrato</label>
            <textarea
              id="objeto"
              name="objeto"
              value={form.objeto}
              onChange={handleChange}
              rows={3}
              placeholder="Descripción del objeto del contrato"
              required
            />
          </div>

          {/* Importe + Plazo + Centro de coste */}
          <div className={styles.row}>
            <div className="form-group" style={{ maxWidth: '180px' }}>
              <label htmlFor="importe">Importe (€, sin IVA)</label>
              <input
                id="importe"
                name="importe"
                type="number"
                min="0"
                step="0.01"
                value={form.importe}
                onChange={handleChange}
                placeholder="0,00"
              />
            </div>
            <div className="form-group" style={{ maxWidth: '220px' }}>
              <label htmlFor="plazo">Plazo de ejecución</label>
              <input
                id="plazo"
                name="plazo"
                type="text"
                value={form.plazo}
                onChange={handleChange}
                placeholder="Ej. 30 días"
                autoComplete="off"
              />
            </div>
            <div className="form-group" style={{ maxWidth: '240px' }}>
              <label htmlFor="centroCoste">Centro de coste</label>
              <input
                id="centroCoste"
                name="centroCoste"
                type="text"
                value={form.centroCoste}
                onChange={handleChange}
                placeholder="Ej. BFB-2024-001"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Justificación de necesidad */}
          <div className="form-group">
            <label htmlFor="justificacionNecesidad">Justificación de la necesidad</label>
            <textarea
              id="justificacionNecesidad"
              name="justificacionNecesidad"
              value={form.justificacionNecesidad}
              onChange={handleChange}
              rows={4}
              placeholder="Explica por qué es necesaria esta contratación"
              required
            />
          </div>

          {/* Tipo de justificación */}
          <div className="form-group">
            <label>Tipo de justificación</label>
            <div className={styles.radioGroup}>
              {TIPOS_JUSTIFICACION.map(({ value, label }) => (
                <label key={value} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="tipoJustificacion"
                    value={label}
                    checked={form.tipoJustificacion === label}
                    onChange={handleChange}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Proveedores */}
          <div className="form-group">
            <label>Proveedores consultados</label>
            <div className={styles.proveedoresWrapper}>
              <table className={styles.proveedoresTable}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>CIF</th>
                    <th>Contacto</th>
                    <th>Presupuesto</th>
                  </tr>
                </thead>
                <tbody>
                  {form.proveedores.map((prov, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          value={prov.nombre}
                          onChange={e => handleProveedorChange(i, 'nombre', e.target.value)}
                          placeholder="Nombre del proveedor"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={prov.cif}
                          onChange={e => handleProveedorChange(i, 'cif', e.target.value)}
                          placeholder="B12345678"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={prov.contacto}
                          onChange={e => handleProveedorChange(i, 'contacto', e.target.value)}
                          placeholder="email / teléfono"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={prov.presupuesto}
                          onChange={e => handleProveedorChange(i, 'presupuesto', e.target.value)}
                          placeholder="0,00 €"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className={styles.addRowBtn} onClick={addProveedor}>
                + Añadir fila
              </button>
            </div>
          </div>

          {/* Justificación de elección */}
          <div className="form-group">
            <label htmlFor="justificacionEleccion">Justificación de la elección del proveedor</label>
            <label className={styles.certToggle}>
              <input
                type="checkbox"
                checked={certExclusividad}
                onChange={e => {
                  const on = e.target.checked
                  setCertExclusividad(on)
                  setForm(prev => ({
                    ...prev,
                    justificacionEleccion: on ? 'Se adjunta certificado de exclusividad' : '',
                  }))
                  if (!on) setCertFile(null)
                }}
              />
              <span>Certificado de exclusividad</span>
            </label>
            {certExclusividad && (
              <div className={styles.certFileRow}>
                <label className={styles.certFileLabel}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className={styles.certFileInput}
                    onChange={e => {
                      setCertFile(e.target.files[0] || null)
                      setCertFileData(null)
                    }}
                  />
                  <span className={styles.certFileBtn}>
                    {certFile
                      ? `📎 ${certFile.name}`
                      : certFileData
                        ? `📎 ${certFileData.name}`
                        : '📎 Adjuntar certificado…'}
                  </span>
                </label>
                {(certFile || certFileData) && (
                  <button
                    type="button"
                    className={styles.certViewBtn}
                    onClick={() => openCertData(certFile ?? certFileData)}
                  >
                    Abrir
                  </button>
                )}
              </div>
            )}
            <textarea
              id="justificacionEleccion"
              name="justificacionEleccion"
              value={form.justificacionEleccion}
              onChange={certExclusividad ? undefined : handleChange}
              readOnly={certExclusividad}
              rows={3}
              placeholder="Motivo por el que se elige el proveedor seleccionado"
              className={certExclusividad ? styles.textareaLocked : ''}
            />
          </div>
        </div>

        {/* ── Asistente IA ─────────────────────────────────────────────────── */}
        <div className={styles.iaRow}>
          <span className={styles.iaRowLabel}>✦ Generar textos con IA</span>
          <div className={styles.iaRowControls}>
            <label className={styles.iaFileLabel}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt"
                className={styles.iaFileInput}
                onChange={e => { setIaFile(e.target.files[0] || null); setIaResult(null); setIaError(null) }}
              />
              <span className={styles.iaFileBtn}>
                {iaFile ? `📎 ${iaFile.name}` : '📎 Documento de referencia (opcional)'}
              </span>
            </label>
            {[
              { value: 'claude', label: 'Claude' },
              { value: 'openai', label: 'GPT-4o' },
              { value: 'gemini', label: 'Gemini' },
            ].map(p => (
              <button
                key={p.value}
                type="button"
                className={styles.iaBtn}
                onClick={() => handleIaGenerar(p.value)}
                disabled={iaLoading !== null}
              >
                {iaLoading === p.value ? 'Consultando…' : `✦ ${p.label}`}
              </button>
            ))}
          </div>

          {iaError && <p className={styles.iaError}>{iaError}</p>}

          {iaResult && (
            <div className={styles.iaResult}>
              <div className={styles.iaResultField}>
                <span className={styles.iaResultLabel}>Objeto del contrato</span>
                <p className={styles.iaResultText}>{iaResult.objeto}</p>
                <button
                  type="button"
                  className={styles.iaUseBtn}
                  onClick={() => setForm(prev => ({ ...prev, objeto: iaResult.objeto }))}
                >
                  ↑ Usar este texto
                </button>
              </div>
              <div className={styles.iaResultField}>
                <span className={styles.iaResultLabel}>Justificación de la necesidad</span>
                <p className={styles.iaResultText}>{iaResult.justificacionNecesidad}</p>
                <button
                  type="button"
                  className={styles.iaUseBtn}
                  onClick={() => setForm(prev => ({ ...prev, justificacionNecesidad: iaResult.justificacionNecesidad }))}
                >
                  ↑ Usar este texto
                </button>
              </div>
            </div>
          )}
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
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!form.codigo.trim()}
            onClick={handleSave}
          >
            Guardar expediente
          </button>
          {savedMsg && <span className={styles.savedMsg}>✓ Guardado</span>}
          <span className={styles.meta}>
            Logo · Datos del centro · Firma — incluidos automáticamente
          </span>
        </div>
      </form>
    </div>
  )
}
