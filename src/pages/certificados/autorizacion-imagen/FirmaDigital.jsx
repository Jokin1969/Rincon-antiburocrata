import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import styles from './FirmaDigital.module.css'

const TEXTO_LEGAL = `AUTORIZACIÓN DE CAPTACIÓN Y USO DE IMAGEN

En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales (LOPDGDD):

RESPONSABLE DEL TRATAMIENTO: [organizador] · NIF: [nif] · documentacion@fundacionprionicas.org

FINALIDAD: Captación, registro y tratamiento de imágenes mediante fotografías y/o vídeos durante el evento, con la finalidad de potenciar la imagen corporativa y/o promocionar las actividades de la entidad, siendo publicadas en la página web y/o redes sociales.

LEGITIMACIÓN: Consentimiento expreso del/la interesado/a.

DESTINATARIOS: Los datos no serán cedidos a terceros salvo obligación legal.

DERECHOS: Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a: Avda. Lomas del Rey nº 70, 28701 San Sebastián de los Reyes (Madrid), o a documentacion@fundacionprionicas.org.

DELEGADO DE PROTECCIÓN DE DATOS: dpd.cliente@conversia.es · Tel. 902 877 192

Mediante la firma, otorga su consentimiento expreso para el tratamiento indicado.`

function buildLegal(evento) {
  return TEXTO_LEGAL
    .replace('[organizador]', evento?.organizador || '')
    .replace('[nif]', evento?.nif_organizador || '')
}

export default function FirmaDigital() {
  const { eventoId, participanteId } = useParams()

  const [evento, setEvento]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  // Steps: 1=identificacion, 'duplicado'=ya firmado antes, 2=firma, 3=exito
  const [paso, setPaso]                   = useState(1)
  const [dniInput, setDniInput]           = useState('')
  const [nombreInput, setNombreInput]     = useState('')
  const [participante, setParticipante]   = useState(null)
  const [idError, setIdError]             = useState(null)
  const [checkingDni, setCheckingDni]     = useState(false)
  const [firmaPrevia, setFirmaPrevia]     = useState(null) // {id, nombre_apellidos, timestamp}
  const [overwriteId, setOverwriteId]     = useState(null)

  const [legalExpanded, setLegalExpanded] = useState(false)
  const [autorizo, setAutorizo]           = useState(false)
  const [firmando, setFirmando]           = useState(false)
  const [firmaError, setFirmaError]       = useState(null)
  const [pdfUrl, setPdfUrl]               = useState(null)

  const canvasRef   = useRef(null)
  const drawingRef  = useRef(false)
  const hasDrawnRef = useRef(false)

  useEffect(() => {
    fetch(`/api/certificados/eventos/${eventoId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setEvento(data)
        setLoading(false)
        if (participanteId) {
          const p = (data.participantes || []).find(x => x.id === participanteId)
          if (p) setParticipante(p)
        }
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [eventoId, participanteId])

  // Canvas setup when step 2 is active
  useEffect(() => {
    if (paso !== 2) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'

    function getPos(e) {
      const rect   = canvas.getBoundingClientRect()
      const scaleX = canvas.width  / rect.width
      const scaleY = canvas.height / rect.height
      const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0)
      const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0)
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top)  * scaleY,
      }
    }

    function startDraw(e) {
      e.preventDefault()
      drawingRef.current = true
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    function draw(e) {
      if (!drawingRef.current) return
      e.preventDefault()
      const pos = getPos(e)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      hasDrawnRef.current = true
    }

    function stopDraw(e) {
      if (e) e.preventDefault()
      drawingRef.current = false
    }

    canvas.addEventListener('pointerdown', startDraw, { passive: false })
    canvas.addEventListener('pointermove', draw,      { passive: false })
    canvas.addEventListener('pointerup',   stopDraw,  { passive: false })
    canvas.addEventListener('pointerleave',stopDraw,  { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', startDraw)
      canvas.removeEventListener('pointermove', draw)
      canvas.removeEventListener('pointerup',   stopDraw)
      canvas.removeEventListener('pointerleave',stopDraw)
    }
  }, [paso])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
  }

  async function handleVerificarIdentidad() {
    setIdError(null)
    if (participanteId) {
      if (!participante) { setIdError('Participante no encontrado en este evento.'); return }
      if (!dniInput.trim()) { setIdError('Introduce tu DNI o identificación.'); return }
      const norm = s => (s || '').trim().toUpperCase().replace(/[\s\-.]/g, '')
      if (norm(dniInput) !== norm(participante.dni || '')) {
        setIdError('El DNI introducido no coincide con el registrado.')
        return
      }
    } else {
      if (!nombreInput.trim()) { setIdError('Introduce tu nombre y apellidos.'); return }
      if (!dniInput.trim()) { setIdError('Introduce tu DNI o identificación.'); return }
    }

    // Comprobar si ya existe una firma con este DNI
    setCheckingDni(true)
    try {
      const res  = await fetch(`/api/certificados/eventos/${eventoId}/firmas/buscar-dni?dni=${encodeURIComponent(dniInput.trim())}`)
      const data = await res.json()
      if (data.firma) {
        setFirmaPrevia(data.firma)
        setPaso('duplicado')
        return
      }
    } catch { /* Si falla la comprobación, continuamos normalmente */ }
    finally {
      setCheckingDni(false)
    }
    setPaso(2)
  }

  async function handleConfirmar() {
    if (!hasDrawnRef.current) { setFirmaError('Por favor, firma en el recuadro antes de continuar.'); return }
    if (!autorizo) { setFirmaError('Debes marcar la casilla de autorización de imágenes.'); return }

    const canvas      = canvasRef.current
    const firma_base64 = canvas ? canvas.toDataURL('image/png') : null
    const nombre      = participante?.nombre_apellidos || nombreInput
    const dni         = participante?.dni || dniInput

    setFirmando(true)
    setFirmaError(null)
    try {
      const res  = await fetch('/api/certificados/firmas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          eventoId,
          nombre_apellidos: nombre,
          dni,
          firma_base64,
          tipo: participanteId ? 'digital' : 'qr',
          ...(overwriteId ? { overwriteId } : {}),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPdfUrl(data.pdfUrl)
      setPaso(3)
    } catch (e) {
      setFirmaError(e.message)
    } finally {
      setFirmando(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.loadingText}>Cargando…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.step}>
            <p className={styles.errorText}>❌ {error}</p>
            <p className={styles.subtext}>Comprueba que el enlace es correcto.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          {evento?.logo && (
            <img src={evento.logo} alt="Logo" className={styles.logo} />
          )}
          <h1 className={styles.eventName}>{evento?.nombre}</h1>
          {evento?.fecha && (
            <p className={styles.eventMeta}>
              {evento.fecha}{evento?.lugar ? ` · ${evento.lugar}` : ''}
            </p>
          )}
        </div>

        {/* Paso 1: Identificación */}
        {paso === 1 && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>
              {participanteId ? 'Verificación de identidad' : 'Tus datos'}
            </h2>
            <p className={styles.stepDesc}>
              {participanteId
                ? 'Introduce tu DNI para confirmar tu identidad antes de firmar.'
                : 'Introduce tus datos para firmar la autorización de imagen.'}
            </p>

            {!participanteId && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nombre y apellidos *</label>
                <input
                  className={styles.fieldInput}
                  value={nombreInput}
                  onChange={e => setNombreInput(e.target.value)}
                  placeholder="Nombre y apellidos"
                  autoComplete="name"
                />
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>DNI / Pasaporte *</label>
              <input
                className={styles.fieldInput}
                value={dniInput}
                onChange={e => setDniInput(e.target.value)}
                placeholder="Ej: 12345678A"
                autoComplete="off"
              />
            </div>

            {idError && <p className={styles.errorText}>{idError}</p>}

            <button className={styles.btnPrimary} onClick={handleVerificarIdentidad} disabled={checkingDni}>
              {checkingDni ? 'Comprobando…' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* Paso duplicado: ya ha firmado antes */}
        {paso === 'duplicado' && firmaPrevia && (
          <div className={styles.step}>
            <div className={styles.dupIcon}>⚠️</div>
            <h2 className={styles.stepTitle}>Ya has firmado este evento</h2>
            <p className={styles.stepDesc}>
              Encontramos una autorización registrada para el DNI introducido
              {firmaPrevia.nombre_apellidos ? ` (${firmaPrevia.nombre_apellidos})` : ''}, firmada el{' '}
              <strong>
                {firmaPrevia.timestamp
                  ? new Date(firmaPrevia.timestamp).toLocaleString('es-ES')
                  : '—'}
              </strong>.
            </p>
            <p className={styles.stepDesc}>
              ¿Qué deseas hacer?
            </p>
            <button
              className={styles.btnPrimary}
              onClick={() => { setPaso(3) }}
            >
              ✅ Mi firma ya está registrada, gracias
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => {
                setOverwriteId(firmaPrevia.id)
                hasDrawnRef.current = false
                setPaso(2)
              }}
            >
              ✏️ Volver a firmar (reemplazará la anterior)
            </button>
          </div>
        )}

        {/* Paso 2: Firma */}
        {paso === 2 && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>Autorización de imagen</h2>
            <p className={styles.firmante}>
              Firmante: <strong>{participante?.nombre_apellidos || nombreInput}</strong>
            </p>

            <div className={styles.legalBlock}>
              <button
                className={styles.legalToggle}
                onClick={() => setLegalExpanded(prev => !prev)}
              >
                {legalExpanded ? '▲ Ocultar texto legal' : '▼ Ver texto legal completo'}
              </button>
              {legalExpanded && (
                <pre className={styles.legalText}>{buildLegal(evento)}</pre>
              )}
            </div>

            <div className={styles.canvasWrapper}>
              <p className={styles.canvasLabel}>Firme aquí con el dedo o ratón:</p>
              <canvas
                ref={canvasRef}
                className={styles.canvas}
                width={540}
                height={160}
              />
              <button className={styles.btnClear} type="button" onClick={clearCanvas}>
                🗑 Borrar firma
              </button>
            </div>

            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={autorizo}
                  onChange={e => setAutorizo(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>AUTORIZO el tratamiento de mis imágenes para los fines indicados</span>
              </label>
            </div>

            <p className={styles.lugar}>
              En {evento?.localidad || evento?.lugar || '___'}, a {evento?.fecha || '___'}
            </p>

            {firmaError && <p className={styles.errorText}>{firmaError}</p>}

            <button
              className={styles.btnConfirm}
              onClick={handleConfirmar}
              disabled={firmando}
            >
              {firmando ? 'Procesando…' : '✅ Confirmar y enviar autorización'}
            </button>
          </div>
        )}

        {/* Paso 3: Éxito */}
        {paso === 3 && (
          <div className={styles.step}>
            <div className={styles.successIcon}>✅</div>
            <h2 className={styles.successTitle}>Autorización registrada</h2>
            <p className={styles.successDesc}>
              {pdfUrl
                ? 'Tu autorización ha sido enviada al organizador del evento.'
                : 'Tu autorización ya constaba registrada. No es necesario volver a firmar.'}
            </p>
            {pdfUrl && (
              <a href={pdfUrl} download className={styles.btnPrimary}>
                ⬇ Descargar mi copia
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
