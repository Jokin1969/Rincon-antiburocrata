import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import styles from './AutorizacionImagenForm.module.css'

function normalizeLogoForHeader(src, maxW = 280, maxH = 90) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

const DEFAULTS = {
  nombre:          '',
  fecha:           '',
  lugar:           '',
  localidad:       '',
  organizador:     'Fundación Española de Enfermedades Priónicas',
  nif_organizador: 'G67935684',
  email_destino:   'castilla@joaquincastilla.com',
  logo:            null,
  participantes:   [],
}

const TEXTO_LEGAL = `AUTORIZACIÓN DE CAPTACIÓN Y USO DE IMAGEN

En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales (LOPDGDD):

RESPONSABLE DEL TRATAMIENTO: [organizador] · NIF: [nif] · documentacion@fundacionprionicas.org

FINALIDAD: Captación, registro y tratamiento de imágenes mediante fotografías y/o vídeos durante el evento, con la finalidad de potenciar la imagen corporativa y/o promocionar las actividades de la entidad, siendo publicadas en la página web y/o redes sociales.

LEGITIMACIÓN: Consentimiento expreso del/la interesado/a.

DESTINATARIOS: Los datos no serán cedidos a terceros salvo obligación legal.

DERECHOS: Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a: Avda. Lomas del Rey nº 70, 28701 San Sebastián de los Reyes (Madrid), o a documentacion@fundacionprionicas.org.

DELEGADO DE PROTECCIÓN DE DATOS: dpd.cliente@conversia.es · Tel. 902 877 192

Mediante la firma, otorga su consentimiento expreso para el tratamiento indicado.`

function buildLegalPreview(form) {
  return TEXTO_LEGAL
    .replace('[organizador]', form.organizador || '')
    .replace('[nif]', form.nif_organizador || '')
}

export default function AutorizacionImagenForm() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const isNew     = !id

  const [form, setForm]                   = useState(DEFAULTS)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [loading, setLoading]             = useState(!isNew)
  const [error, setError]                 = useState(null)

  // Participantes
  const [newPartic, setNewPartic]         = useState({ nombre_apellidos: '', dni: '', email: '' })
  const [addingPartic, setAddingPartic]   = useState(false)
  const [savingPartic, setSavingPartic]   = useState(false)
  const [enviandoPartic, setEnviandoPartic]   = useState(null)  // participante obj
  const [emailParticInput, setEmailParticInput] = useState('')
  const [loadingEmailPartic, setLoadingEmailPartic] = useState(false)
  const [emailParticMsg, setEmailParticMsg]     = useState(null)

  // Firmas
  const [firmas, setFirmas]               = useState([])
  const [loadingFirmas, setLoadingFirmas] = useState(false)

  // PDF / Email
  const [genPdf, setGenPdf]               = useState(false)
  const [sendingEmail, setSendingEmail]   = useState(false)
  const [emailInput, setEmailInput]       = useState('')
  const [emailMsg, setEmailMsg]           = useState(null)
  const [qrDataUrl, setQrDataUrl]         = useState(null)

  const logoFileRef = useRef(null)

  // Shared logos picker
  const [sharedLogos, setSharedLogos]     = useState([])
  const [loadingLogos, setLoadingLogos]   = useState(true)
  const [pickingLogo, setPickingLogo]     = useState(false)

  useEffect(() => {
    fetch('/api/store/logos/shared')
      .then(r => r.ok ? r.json() : [])
      .then(list => { setSharedLogos(list); setLoadingLogos(false) })
      .catch(() => setLoadingLogos(false))
  }, [])

  async function handlePickLogo(logo) {
    try {
      const dataUrl = await normalizeLogoForHeader(logo.imageUrl)
      setField('logo', dataUrl)
      setPickingLogo(false)
    } catch {
      // fall back to direct URL if canvas fails
      setField('logo', logo.imageUrl)
      setPickingLogo(false)
    }
  }

  // Load evento
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`/api/certificados/eventos/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setForm(data)
        setLoading(false)
        loadFirmas(data.id)
        loadQr(data.id)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  async function loadFirmas(eventoId) {
    const eid = eventoId || id
    if (!eid) return
    setLoadingFirmas(true)
    try {
      const res  = await fetch(`/api/certificados/eventos/${eid}/firmas`)
      const data = await res.json()
      setFirmas(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
    setLoadingFirmas(false)
  }

  async function loadQr(eventoId) {
    const eid = eventoId || id
    if (!eid) return
    try {
      const res  = await fetch(`/api/certificados/eventos/${eid}/qr`)
      const data = await res.json()
      if (data.dataUrl) setQrDataUrl(data.dataUrl)
    } catch { /* ignore */ }
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre del evento es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      const method = isNew ? 'POST' : 'PUT'
      const url    = isNew ? '/api/certificados/eventos' : `/api/certificados/eventos/${id}`
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data   = await res.json()
      if (data.error) throw new Error(data.error)
      if (isNew) {
        navigate(`/autorizaciones/autorizacion-imagen/${data.id}`, { replace: true })
      } else {
        setForm(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        loadQr(data.id)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = ev => resolve(ev.target.result)
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }

  async function handleLogoFile(file) {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    setField('logo', dataUrl)
  }

  function handleLogoPaste(e) {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (!item) return
    handleLogoFile(item.getAsFile())
  }

  function handleLogoDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleLogoFile(file)
  }

  async function handleAddParticipante() {
    if (!newPartic.nombre_apellidos.trim()) return
    setSavingPartic(true)
    try {
      if (id) {
        const res  = await fetch(`/api/certificados/eventos/${id}/participantes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify(newPartic),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setForm(prev => ({ ...prev, participantes: [...(prev.participantes || []), data] }))
      } else {
        const p = { id: Date.now().toString(36), ...newPartic }
        setForm(prev => ({ ...prev, participantes: [...(prev.participantes || []), p] }))
      }
      setNewPartic({ nombre_apellidos: '', dni: '', email: '' })
      setAddingPartic(false)
    } catch (e) {
      alert('Error al añadir participante: ' + e.message)
    } finally {
      setSavingPartic(false)
    }
  }

  async function handleDeleteParticipante(pid) {
    if (!window.confirm('¿Eliminar este participante?')) return
    if (id) {
      try {
        await fetch(`/api/certificados/eventos/${id}/participantes/${pid}`, { method: 'DELETE' })
      } catch { /* ignore */ }
    }
    setForm(prev => ({ ...prev, participantes: (prev.participantes || []).filter(p => p.id !== pid) }))
  }

  function abrirEnvioPartic(p) {
    setEnviandoPartic(p)
    setEmailParticInput(p.email || '')
    setEmailParticMsg(null)
  }

  async function handleEnviarEnlaceParticipante() {
    if (!emailParticInput.trim()) { setEmailParticMsg('❌ Introduce un email.'); return }
    setLoadingEmailPartic(true)
    setEmailParticMsg(null)
    try {
      const res  = await fetch(`/api/certificados/eventos/${id}/participantes/${enviandoPartic.id}/enviar-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailParticInput.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmailParticMsg(`✅ Enlace enviado a ${data.to}`)
      // Actualizar email en el participante local si se acaba de guardar
      setForm(prev => ({
        ...prev,
        participantes: (prev.participantes || []).map(p =>
          p.id === enviandoPartic.id ? { ...p, email: emailParticInput.trim() } : p
        ),
      }))
    } catch (e) {
      setEmailParticMsg(`❌ Error: ${e.message}`)
    } finally {
      setLoadingEmailPartic(false)
    }
  }

  async function handleGenerarPdf() {
    if (!id) { alert('Guarda el evento primero.'); return }
    setGenPdf(true)
    try {
      const res  = await fetch(`/api/certificados/eventos/${id}/exportar-pdf`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error generando PDF')
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `formulario_${form.nombre || id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error al generar PDF: ' + e.message)
    } finally {
      setGenPdf(false)
    }
  }

  async function handleEnviarEmail() {
    if (!id) { alert('Guarda el evento primero.'); return }
    setSendingEmail(true)
    setEmailMsg(null)
    try {
      const res  = await fetch(`/api/certificados/eventos/${id}/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email: emailInput || undefined }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmailMsg(`✅ Email enviado a ${data.to}`)
    } catch (e) {
      setEmailMsg(`❌ Error: ${e.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleDescargarCartel() {
    if (!id) { alert('Guarda el evento primero.'); return }
    try {
      const res  = await fetch(`/api/certificados/eventos/${id}/cartel-pdf`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error generando cartel')
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `cartel_${form.nombre || id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error al generar el cartel: ' + e.message)
    }
  }

  async function handleExportZip() {
    if (!id) return
    try {
      const res  = await fetch(`/api/certificados/eventos/${id}/firmas/zip`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `firmas_${form.nombre || id}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error al exportar ZIP: ' + e.message)
    }
  }

  if (loading) return <div className={styles.loading}>Cargando evento…</div>

  return (
    <div>
      <PageHeader
        back="/autorizaciones/autorizacion-imagen"
        backLabel="Eventos"
        title={isNew ? 'Nuevo evento' : (form.nombre || 'Editar evento')}
        subtitle="Autorización de captación y uso de imagen."
      />

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Sección 1: Datos del evento */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Datos del evento</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nombre del evento *</label>
            <input
              className={styles.input}
              value={form.nombre}
              onChange={e => setField('nombre', e.target.value)}
              placeholder="Ej: Jornada Priónicas 2026"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Fecha</label>
            <input
              className={styles.input}
              type="date"
              value={form.fecha}
              onChange={e => setField('fecha', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Lugar (recinto / hotel)</label>
            <input
              className={styles.input}
              value={form.lugar}
              onChange={e => setField('lugar', e.target.value)}
              placeholder="Ej: Hotel Meliá"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Localidad (ciudad)</label>
            <input
              className={styles.input}
              value={form.localidad}
              onChange={e => setField('localidad', e.target.value)}
              placeholder="Ej: Madrid"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Organizador</label>
            <input
              className={styles.input}
              value={form.organizador}
              onChange={e => setField('organizador', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>NIF organizador</label>
            <input
              className={styles.input}
              value={form.nif_organizador}
              onChange={e => setField('nif_organizador', e.target.value)}
            />
          </div>
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Email destino (receptor de firmas)</label>
            <input
              className={styles.input}
              type="email"
              value={form.email_destino}
              onChange={e => setField('email_destino', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.saveRow}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear evento' : 'Guardar cambios'}
          </button>
          {saved && <span className={styles.savedMsg}>✅ Guardado</span>}
        </div>
      </section>

      {/* Sección 2: Logo */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Logo del evento</h2>

        {form.logo ? (
          <div className={styles.logoPreview}>
            <img src={form.logo} alt="Logo del evento" className={styles.logoImg} />
            <button className="btn btn-sm btn-danger" onClick={() => setField('logo', null)}>
              Quitar logo
            </button>
          </div>
        ) : (
          <button className={styles.logoPickBtn} onClick={() => setPickingLogo(p => !p)}>
            {loadingLogos ? 'Cargando logos…' : `Seleccionar logo compartido (${sharedLogos.length})`}
          </button>
        )}

        {pickingLogo && (
          <div className={styles.logoPicker}>
            {sharedLogos.length === 0 ? (
              <p className={styles.logoPickerEmpty}>
                No hay logos compartidos. Ve a la app de <strong>Logos</strong> y activa el botón "↗ Compartir" en los que quieras usar aquí.
              </p>
            ) : (
              <div className={styles.logoPickerGrid}>
                {sharedLogos.map(l => (
                  <button key={l.id} className={styles.logoPickerCard} onClick={() => handlePickLogo(l)}>
                    <img src={l.imageUrl} alt={l.name} className={styles.logoPickerImg} />
                    <span className={styles.logoPickerName}>{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sección 3: Participantes */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Participantes (para firma pre-cargada)</h2>
        <p className={styles.hint}>
          Añade participantes conocidos (ponentes, invitados) para que puedan firmar con su enlace personalizado.
          El QR genérico permite que cualquier asistente firme sin estar en esta lista.
        </p>

        {(form.participantes || []).length > 0 && (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre y apellidos</th>
                    <th>DNI / ID</th>
                    <th>Email</th>
                    <th>Enlace</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(form.participantes || []).map(p => (
                    <tr key={p.id}>
                      <td>{p.nombre_apellidos}</td>
                      <td>{p.dni || '—'}</td>
                      <td>{p.email || '—'}</td>
                      <td>
                        {id && (
                          <a
                            href={`/firma/${id}/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.link}
                          >
                            Ver enlace
                          </a>
                        )}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {id && (
                            <button
                              className="btn btn-sm"
                              onClick={() => abrirEnvioPartic(p)}
                              title="Enviar enlace de firma por email"
                            >
                              ✉ Enviar
                            </button>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteParticipante(p.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Panel de envío de enlace */}
            {enviandoPartic && (
              <div className={styles.emailParticPanel}>
                <p className={styles.emailParticTitle}>
                  Enviar enlace personal de firma a <strong>{enviandoPartic.nombre_apellidos}</strong>:
                </p>
                <div className={styles.emailRow}>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="Email del participante"
                    value={emailParticInput}
                    onChange={e => setEmailParticInput(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleEnviarEnlaceParticipante}
                    disabled={loadingEmailPartic}
                  >
                    {loadingEmailPartic ? 'Enviando…' : '✉ Enviar'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => { setEnviandoPartic(null); setEmailParticMsg(null) }}
                  >
                    Cancelar
                  </button>
                </div>
                {emailParticMsg && <p className={styles.emailMsg}>{emailParticMsg}</p>}
              </div>
            )}
          </>
        )}

        {addingPartic ? (
          <div className={styles.inlineForm}>
            <input
              className={styles.input}
              placeholder="Nombre y apellidos *"
              value={newPartic.nombre_apellidos}
              onChange={e => setNewPartic(prev => ({ ...prev, nombre_apellidos: e.target.value }))}
            />
            <input
              className={styles.input}
              placeholder="DNI / Pasaporte"
              value={newPartic.dni}
              onChange={e => setNewPartic(prev => ({ ...prev, dni: e.target.value }))}
            />
            <input
              className={styles.input}
              type="email"
              placeholder="Email (para enviarle el enlace)"
              value={newPartic.email}
              onChange={e => setNewPartic(prev => ({ ...prev, email: e.target.value }))}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddParticipante} disabled={savingPartic}>
              {savingPartic ? '…' : 'Añadir'}
            </button>
            <button className="btn btn-sm" onClick={() => { setAddingPartic(false); setNewPartic({ nombre_apellidos: '', dni: '', email: '' }) }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button className="btn btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => setAddingPartic(true)}>
            + Añadir participante
          </button>
        )}
      </section>

      {/* Sección 4: Formulario imprimible */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Formulario imprimible</h2>

        <div className={styles.legalPreview}>
          <pre className={styles.legalText}>{buildLegalPreview(form)}</pre>
          <div className={styles.checkboxes}>
            <p>☐ AUTORIZO el tratamiento de mis imágenes para los fines indicados</p>
          </div>
        </div>

        {qrDataUrl && (
          <div className={styles.qrSection}>
            <p className={styles.label}>Código QR para firma digital:</p>
            <img src={qrDataUrl} alt="QR firma digital" className={styles.qrImg} />
            <p className={styles.hint}>Escanea este QR para acceder a la página de firma digital.</p>
          </div>
        )}

        <div className={styles.pdfActions}>
          <button className="btn btn-primary" onClick={handleGenerarPdf} disabled={genPdf || !id}>
            {genPdf ? 'Generando…' : '📄 Generar PDF en blanco'}
          </button>
          <button className="btn" onClick={handleDescargarCartel} disabled={!id}>
            📢 Descargar cartel QR
          </button>
          <div className={styles.emailRow}>
            <input
              className={styles.input}
              type="email"
              placeholder={`Email (por defecto: ${form.email_destino || 'destino'})`}
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
            />
            <button className="btn" onClick={handleEnviarEmail} disabled={sendingEmail || !id}>
              {sendingEmail ? 'Enviando…' : '✉ Enviar PDF por email'}
            </button>
          </div>
          {emailMsg && <p className={styles.emailMsg}>{emailMsg}</p>}
          {!id && <p className={styles.hint}>Guarda el evento para poder generar el PDF y el QR.</p>}
        </div>
      </section>

      {/* Sección 5: Firmas recibidas */}
      {id && (
        <section className={styles.section}>
          <div className={styles.firmasHeader}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, padding: 0, border: 'none' }}>
              5. Firmas recibidas
            </h2>
            <span className={styles.badge}>{firmas.length}</span>
            <button className="btn btn-sm" onClick={() => loadFirmas()} disabled={loadingFirmas}>
              {loadingFirmas ? '…' : '↺ Actualizar'}
            </button>
          </div>

          {firmas.length === 0 ? (
            <p className={styles.hint} style={{ marginTop: '1rem' }}>
              Aún no se han recibido firmas para este evento.
            </p>
          ) : (
            <>
              <div className={styles.tableWrapper} style={{ marginTop: '1rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>DNI</th>
                      <th>Fecha y hora</th>
                      <th>Tipo</th>
                      <th>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firmas.map(f => (
                      <tr key={f.id}>
                        <td>{f.nombre_apellidos}</td>
                        <td>{f.dni || '—'}</td>
                        <td>{f.timestamp ? new Date(f.timestamp).toLocaleString('es-ES') : '—'}</td>
                        <td>
                          <span className={`${styles.tipoBadge} ${f.tipo === 'qr' ? styles.tipoQr : styles.tipoDigital}`}>
                            {f.tipo || 'digital'}
                          </span>
                        </td>
                        <td>
                          <a
                            href={`/api/certificados/firmas/${f.id}/pdf`}
                            download
                            className={styles.link}
                          >
                            ⬇ PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.zipRow}>
                <button className="btn" onClick={handleExportZip}>
                  📦 Exportar todas (ZIP)
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
