import { Router }                                         from 'express'
import { existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync, unlinkSync, rmSync } from 'fs'
import { join, dirname }                                  from 'path'
import { fileURLToPath }                                  from 'url'
import { contentDispositionHeader }                       from '../../utils/contentDisposition.js'
import { PDFDocument, rgb, StandardFonts }                from 'pdf-lib'
import QRCode                                            from 'qrcode'
import nodemailer                                        from 'nodemailer'
import archiver                                          from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const DATA_DIR    = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data')
const EVENTOS_DIR = join(DATA_DIR, 'certificados', 'eventos')
const FIRMAS_DIR  = join(DATA_DIR, 'certificados', 'firmas')

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readEvento(id) {
  const path = join(EVENTOS_DIR, `evento_${id}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeEvento(evento) {
  ensureDir(EVENTOS_DIR)
  writeFileSync(
    join(EVENTOS_DIR, `evento_${evento.id}.json`),
    JSON.stringify(evento, null, 2),
    'utf-8'
  )
}

function eventoFirmasDir(eventoId) {
  return join(FIRMAS_DIR, eventoId)
}

function readFirma(id) {
  ensureDir(FIRMAS_DIR)
  for (const entry of readdirSync(FIRMAS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(FIRMAS_DIR, entry.name)
    const hit = readdirSync(dir).find(f => f.endsWith(`_${id}.json`))
    if (hit) return JSON.parse(readFileSync(join(dir, hit), 'utf-8'))
  }
  return null
}

function writeFirma(firma) {
  const dir = eventoFirmasDir(firma.eventoId)
  ensureDir(dir)
  writeFileSync(
    join(dir, `firma_${firma.eventoId}_${firma.id}.json`),
    JSON.stringify(firma, null, 2),
    'utf-8'
  )
}

function listFirmasDeEvento(eventoId) {
  const dir = eventoFirmasDir(eventoId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.startsWith('firma_') && f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')))
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function makeTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
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

function buildLegalText(evento) {
  return TEXTO_LEGAL
    .replace('[organizador]', evento.organizador || '')
    .replace('[nif]', evento.nif_organizador || '')
}

// Wrap text to fit width (in points)
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const w = font.widthOfTextAtSize(test, fontSize)
    if (w > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

async function generateBlankPdf(evento) {
  const pdfDoc  = await PDFDocument.create()
  const page    = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const margin  = 50
  const contentWidth = width - margin * 2

  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let y = height - margin

  // Logo
  if (evento.logo && evento.logo.startsWith('data:image/')) {
    try {
      const base64Data = evento.logo.replace(/^data:image\/[^;]+;base64,/, '')
      const imgBytes   = Buffer.from(base64Data, 'base64')
      let img
      if (evento.logo.includes('image/png')) {
        img = await pdfDoc.embedPng(imgBytes)
      } else {
        img = await pdfDoc.embedJpg(imgBytes)
      }
      const logoH  = 50
      const scale  = logoH / img.height
      const logoW  = img.width * scale
      page.drawImage(img, { x: margin, y: y - logoH, width: logoW, height: logoH })
      y -= logoH + 15
    } catch { /* ignore logo errors */ }
  }

  // Título
  const title = evento.nombre || 'Evento'
  const titleSize = 16
  const titleW = fontBold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: margin + (contentWidth - titleW) / 2,
    y,
    size: titleSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.4),
  })
  y -= 20

  // Fecha y lugar
  const fechaLugar = [
    evento.fecha ? `Fecha: ${evento.fecha}` : '',
    evento.lugar ? `Lugar: ${evento.lugar}` : '',
  ].filter(Boolean).join('    ')
  if (fechaLugar) {
    page.drawText(fechaLugar, { x: margin, y, size: 9, font: fontReg, color: rgb(0.4, 0.4, 0.4) })
    y -= 18
  }

  // Línea separadora
  page.drawLine({
    start: { x: margin, y },
    end:   { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 18

  // Texto legal
  const legalText = buildLegalText(evento)
  const legalLines = legalText.split('\n')
  for (const rawLine of legalLines) {
    if (rawLine === '') { y -= 6; continue }
    const isBold = rawLine === rawLine.toUpperCase() && rawLine.length > 3
    const font   = isBold ? fontBold : fontReg
    const size   = isBold ? 8 : 7.5
    const wrapped = wrapText(rawLine, font, size, contentWidth)
    for (const line of wrapped) {
      if (y < margin + 120) break
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.15, 0.15, 0.15) })
      y -= size + 3
    }
  }
  y -= 10

  // Checkboxes — dibujados como rectángulos (evita problemas de encoding Unicode)
  const checkboxLabels = [
    'AUTORIZO el tratamiento de mis imágenes para los fines indicados',
  ]
  for (const label of checkboxLabels) {
    const boxSize = 8
    page.drawRectangle({ x: margin, y: y - 1, width: boxSize, height: boxSize, borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 1 })
    page.drawText(label, { x: margin + boxSize + 5, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
  }
  y -= 10

  // "En localidad, a fecha"
  const lugar    = evento.localidad || evento.lugar || '_________________'
  const fechaEvt = evento.fecha || '_________________'
  page.drawText(`En ${lugar}, a ${fechaEvt}`, { x: margin, y, size: 9, font: fontReg, color: rgb(0.3, 0.3, 0.3) })
  y -= 30

  // Datos del firmante
  page.drawText('DATOS DEL FIRMANTE:', { x: margin, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  y -= 16
  page.drawText('Nombre y apellidos: _______________________________________', { x: margin, y, size: 9, font: fontReg, color: rgb(0.2, 0.2, 0.2) })
  y -= 14
  page.drawText('DNI / Pasaporte: _______________________________________', { x: margin, y, size: 9, font: fontReg, color: rgb(0.2, 0.2, 0.2) })
  y -= 30

  // Línea de firma y QR
  const signAreaY  = y
  const signLineX1 = margin
  const signLineX2 = width - margin - 120
  page.drawText('Firma:', { x: margin, y: signAreaY + 14, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  page.drawLine({
    start: { x: signLineX1, y: signAreaY },
    end:   { x: signLineX2, y: signAreaY },
    thickness: 0.75,
    color: rgb(0.3, 0.3, 0.3),
  })

  // QR
  const appUrl   = process.env.APP_URL || 'https://tu-app.railway.app'
  const qrUrl    = `${appUrl}/firma/${evento.id}`
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 2 })
  const qrBase64  = qrDataUrl.replace(/^data:image\/png;base64,/, '')
  const qrImg     = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'))
  const qrSize    = 80
  const qrX       = width - margin - qrSize
  const qrY       = signAreaY - qrSize + 10
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  const qrLabelW = fontReg.widthOfTextAtSize('Firma digital', 7)
  page.drawText('Firma digital', {
    x: qrX + (qrSize - qrLabelW) / 2,
    y: qrY - 10,
    size: 7,
    font: fontReg,
    color: rgb(0.5, 0.5, 0.5),
  })

  return pdfDoc.save()
}

async function generateSignedPdf(evento, firma) {
  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([595, 842])
  const { width, height } = page.getSize()
  const margin = 50
  const contentWidth = width - margin * 2

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let y = height - margin

  // Logo
  if (evento.logo && evento.logo.startsWith('data:image/')) {
    try {
      const base64Data = evento.logo.replace(/^data:image\/[^;]+;base64,/, '')
      const imgBytes   = Buffer.from(base64Data, 'base64')
      let img
      if (evento.logo.includes('image/png')) {
        img = await pdfDoc.embedPng(imgBytes)
      } else {
        img = await pdfDoc.embedJpg(imgBytes)
      }
      const logoH  = 50
      const scale  = logoH / img.height
      const logoW  = img.width * scale
      page.drawImage(img, { x: margin, y: y - logoH, width: logoW, height: logoH })
      y -= logoH + 15
    } catch { /* ignore */ }
  }

  // Título
  const title = evento.nombre || 'Evento'
  const titleSize = 16
  const titleW = fontBold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: margin + (contentWidth - titleW) / 2,
    y,
    size: titleSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.4),
  })
  y -= 20

  const fechaLugar = [
    evento.fecha ? `Fecha: ${evento.fecha}` : '',
    evento.lugar ? `Lugar: ${evento.lugar}` : '',
  ].filter(Boolean).join('    ')
  if (fechaLugar) {
    page.drawText(fechaLugar, { x: margin, y, size: 9, font: fontReg, color: rgb(0.4, 0.4, 0.4) })
    y -= 18
  }

  page.drawLine({
    start: { x: margin, y },
    end:   { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 18

  // Texto legal
  const legalText  = buildLegalText(evento)
  const legalLines = legalText.split('\n')
  for (const rawLine of legalLines) {
    if (rawLine === '') { y -= 6; continue }
    const isBold = rawLine === rawLine.toUpperCase() && rawLine.length > 3
    const font   = isBold ? fontBold : fontReg
    const size   = isBold ? 8 : 7.5
    const wrapped = wrapText(rawLine, font, size, contentWidth)
    for (const line of wrapped) {
      if (y < margin + 120) break
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.15, 0.15, 0.15) })
      y -= size + 3
    }
  }
  y -= 10

  // Checkboxes marcados — rectángulo + aspa dibujada
  const checkboxLabels = [
    'AUTORIZO el tratamiento de mis imágenes para los fines indicados',
  ]
  for (const label of checkboxLabels) {
    const boxSize = 8
    page.drawRectangle({ x: margin, y: y - 1, width: boxSize, height: boxSize, borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 1 })
    // Aspa interior (X) para indicar marcado
    page.drawLine({ start: { x: margin + 1, y: y - 1 + boxSize - 1 }, end: { x: margin + boxSize - 1, y: y }, thickness: 1, color: rgb(0.1, 0.35, 0.7) })
    page.drawLine({ start: { x: margin + 1, y: y }, end: { x: margin + boxSize - 1, y: y - 1 + boxSize - 1 }, thickness: 1, color: rgb(0.1, 0.35, 0.7) })
    page.drawText(label, { x: margin + boxSize + 5, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
  }
  y -= 10

  const lugar    = evento.localidad || evento.lugar || ''
  const fechaEvt = evento.fecha || ''
  page.drawText(`En ${lugar}, a ${fechaEvt}`, { x: margin, y, size: 9, font: fontReg, color: rgb(0.3, 0.3, 0.3) })
  y -= 25

  // Datos firmante (rellenados)
  page.drawText('DATOS DEL FIRMANTE:', { x: margin, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  y -= 16
  page.drawText(`Nombre y apellidos: ${firma.nombre_apellidos || ''}`, { x: margin, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) })
  y -= 14
  page.drawText(`DNI / Pasaporte: ${firma.dni || ''}`, { x: margin, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) })
  y -= 25

  // Sello "FIRMADO DIGITALMENTE"
  page.drawText('FIRMADO DIGITALMENTE', {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.8),
  })
  y -= 14
  const ts = firma.timestamp ? new Date(firma.timestamp).toLocaleString('es-ES') : ''
  page.drawText(`Timestamp: ${ts}`, { x: margin, y, size: 8, font: fontReg, color: rgb(0.3, 0.3, 0.7) })
  y -= 20

  // Firma como imagen
  if (firma.firma_base64) {
    try {
      const sigBase64 = firma.firma_base64.replace(/^data:image\/png;base64,/, '')
      const sigImg    = await pdfDoc.embedPng(Buffer.from(sigBase64, 'base64'))
      const sigH      = 60
      const sigW      = Math.min(sigImg.width * (sigH / sigImg.height), 200)
      page.drawImage(sigImg, { x: margin, y: y - sigH, width: sigW, height: sigH })
      y -= sigH + 5
    } catch { /* ignore */ }
  }

  page.drawLine({
    start: { x: margin, y },
    end:   { x: margin + 200, y },
    thickness: 0.75,
    color: rgb(0.3, 0.3, 0.3),
  })
  y -= 10
  page.drawText('Firma del interesado/a', { x: margin, y, size: 8, font: fontReg, color: rgb(0.5, 0.5, 0.5) })

  return pdfDoc.save()
}

// ── CRUD Eventos ──────────────────────────────────────────────────────────────

router.get('/eventos', (_req, res) => {
  try {
    ensureDir(EVENTOS_DIR)
    const files   = readdirSync(EVENTOS_DIR).filter(f => f.startsWith('evento_') && f.endsWith('.json'))
    const eventos = files.map(f => {
      const ev = JSON.parse(readFileSync(join(EVENTOS_DIR, f), 'utf-8'))
      const firmaSubdir = eventoFirmasDir(ev.id)
      const firmasCount = existsSync(firmaSubdir)
        ? readdirSync(firmaSubdir).filter(f => f.startsWith('firma_') && f.endsWith('.json')).length
        : 0
      return { ...ev, logo: undefined, firmasCount }
    })
    eventos.sort((a, b) => (b.creado || '').localeCompare(a.creado || ''))
    res.json(eventos)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/eventos', (req, res) => {
  try {
    const id  = makeId()
    const now = new Date().toISOString()
    const evento = {
      id,
      nombre:          req.body.nombre || '',
      fecha:           req.body.fecha || '',
      lugar:           req.body.lugar || '',
      localidad:       req.body.localidad || '',
      organizador:     req.body.organizador || 'Fundación Española de Enfermedades Priónicas',
      nif_organizador: req.body.nif_organizador || 'G67935684',
      logo:            req.body.logo || null,
      email_destino:   req.body.email_destino || 'castilla@joaquincastilla.com',
      participantes:   req.body.participantes || [],
      creado:          now,
      actualizado:     now,
    }
    writeEvento(evento)
    res.json(evento)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/eventos/:id', (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json(ev)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/eventos/:id', (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const updated = { ...ev, ...req.body, id: ev.id, creado: ev.creado, actualizado: new Date().toISOString() }
    writeEvento(updated)
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/eventos/:id', (req, res) => {
  try {
    const id   = req.params.id
    const path = join(EVENTOS_DIR, `evento_${id}.json`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Evento no encontrado' })
    unlinkSync(path)
    // Borrar subdir de firmas del evento
    const firmasSubdir = eventoFirmasDir(id)
    if (existsSync(firmasSubdir)) {
      try { rmSync(firmasSubdir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Participantes ─────────────────────────────────────────────────────────────

router.post('/eventos/:id/participantes', (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const participante = { id: makeId(), ...req.body }
    ev.participantes = [...(ev.participantes || []), participante]
    ev.actualizado   = new Date().toISOString()
    writeEvento(ev)
    res.json(participante)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/eventos/:id/participantes/:pid', (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    ev.participantes = (ev.participantes || []).filter(p => p.id !== req.params.pid)
    ev.actualizado   = new Date().toISOString()
    writeEvento(ev)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Firmas ────────────────────────────────────────────────────────────────────

router.get('/eventos/:id/firmas', (req, res) => {
  try {
    ensureDir(FIRMAS_DIR)
    const firmas = listFirmasDeEvento(req.params.id).map(f => ({ ...f, firma_base64: undefined }))
    res.json(firmas)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/eventos/:id/firmas/buscar-dni', (req, res) => {
  try {
    const { dni } = req.query
    if (!dni) return res.json({ firma: null })
    const norm  = s => (s || '').trim().toUpperCase().replace(/[\s\-.]/g, '')
    const firmas = listFirmasDeEvento(req.params.id)
    const found  = firmas.find(f => norm(f.dni) === norm(dni)) || null
    res.json({
      firma: found
        ? { id: found.id, nombre_apellidos: found.nombre_apellidos, timestamp: found.timestamp }
        : null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/firmas', async (req, res) => {
  try {
    const { eventoId, nombre_apellidos, dni, firma_base64, tipo, overwriteId } = req.body
    if (!eventoId) return res.status(400).json({ error: 'eventoId requerido' })

    const ev = readEvento(eventoId)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })

    // Si se pide sobreescribir una firma previa, eliminar PDF y JSON antiguos
    if (overwriteId) {
      const old = readFirma(overwriteId)
      if (old) {
        if (old.pdf_path && existsSync(old.pdf_path)) {
          try { unlinkSync(old.pdf_path) } catch { /* ignore */ }
        }
        const oldJson = join(eventoFirmasDir(old.eventoId), `firma_${old.eventoId}_${old.id}.json`)
        if (existsSync(oldJson)) {
          try { unlinkSync(oldJson) } catch { /* ignore */ }
        }
      }
    }

    const id        = makeId()
    const timestamp = new Date().toISOString()
    const firma     = { id, eventoId, nombre_apellidos, dni, firma_base64, timestamp, tipo: tipo || 'digital' }

    // Generar PDF firmado y guardar en subdir del evento
    const pdfBytes   = await generateSignedPdf(ev, firma)
    const eventoDir  = eventoFirmasDir(eventoId)
    ensureDir(eventoDir)
    const pdfPath    = join(eventoDir, `pdf_${id}.pdf`)
    writeFileSync(pdfPath, pdfBytes)
    firma.pdf_path  = pdfPath

    writeFirma(firma)

    // Enviar email
    if (ev.email_destino) {
      try {
        const transporter = makeTransporter()
        await transporter.sendMail({
          from:    process.env.SMTP_FROM || process.env.SMTP_USER,
          to:      ev.email_destino,
          subject: `Nueva autorización firmada – ${ev.nombre}`,
          text:    `${nombre_apellidos || 'Un participante'} (DNI: ${dni || 'N/D'}) ha firmado la autorización de imagen para el evento "${ev.nombre}".\n\nFecha: ${new Date(timestamp).toLocaleString('es-ES')}\nTipo: ${tipo || 'digital'}\n\nAdjunto encontrarás el PDF firmado.`,
          attachments: [
            { filename: `autorizacion_${nombre_apellidos || id}.pdf`, content: Buffer.from(pdfBytes), contentType: 'application/pdf' },
          ],
        })
      } catch (emailErr) {
        console.error('Error enviando email de firma:', emailErr.message)
      }
    }

    res.json({ id, pdfUrl: `/api/certificados/firmas/${id}/pdf` })
  } catch (e) {
    console.error('Error POST /firmas:', e)
    res.status(500).json({ error: e.message })
  }
})

router.get('/firmas/:id/pdf', (req, res) => {
  try {
    const firma = readFirma(req.params.id)
    if (!firma) return res.status(404).json({ error: 'Firma no encontrada' })
    if (!firma.pdf_path || !existsSync(firma.pdf_path)) {
      return res.status(404).json({ error: 'PDF no encontrado' })
    }
    const pdfBuf = readFileSync(firma.pdf_path)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `autorizacion_${firma.nombre_apellidos || firma.id}.pdf`))
    res.send(pdfBuf)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Export ────────────────────────────────────────────────────────────────────

router.get('/eventos/:id/exportar-pdf', async (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const pdfBytes = await generateBlankPdf(ev)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `formulario_${ev.nombre || ev.id}.pdf`))
    res.send(Buffer.from(pdfBytes))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/eventos/:id/enviar-email', async (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const to       = req.body.email || ev.email_destino
    if (!to)       return res.status(400).json({ error: 'Email requerido' })
    const pdfBytes = await generateBlankPdf(ev)
    const transporter = makeTransporter()
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `Formulario de autorización de imagen – ${ev.nombre}`,
      text:    `Adjunto encontrarás el formulario de autorización de imagen para el evento "${ev.nombre}".\n\nGenerado automáticamente desde Rincón Antiburocrata.`,
      attachments: [
        { filename: `formulario_${ev.nombre || ev.id}.pdf`, content: Buffer.from(pdfBytes), contentType: 'application/pdf' },
      ],
    })
    res.json({ ok: true, to })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/eventos/:id/qr', async (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const appUrl  = process.env.APP_URL || 'https://tu-app.railway.app'
    const qrUrl   = `${appUrl}/firma/${ev.id}`
    const dataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 2 })
    res.json({ dataUrl, url: qrUrl })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

async function generatePosterPdf(evento) {
  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([595, 842])
  const { width, height } = page.getSize()
  const margin = 50
  const cw     = width - margin * 2

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Barra superior de color
  page.drawRectangle({ x: 0, y: height - 10, width, height: 10, color: rgb(0.1, 0.2, 0.7) })

  let y = height - 30

  // Logo centrado
  if (evento.logo && evento.logo.startsWith('data:image/')) {
    try {
      const b64  = evento.logo.replace(/^data:image\/[^;]+;base64,/, '')
      const imgBytes = Buffer.from(b64, 'base64')
      const img  = evento.logo.includes('image/png')
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes)
      const logoH = 55
      const logoW = Math.min(img.width * (logoH / img.height), cw)
      page.drawImage(img, { x: margin + (cw - logoW) / 2, y: y - logoH, width: logoW, height: logoH })
      y -= logoH + 22
    } catch { /* ignore */ }
  }

  // Titular principal
  const lines1 = ['¡AUTORIZA TU IMAGEN', 'DIGITALMENTE!']
  const hSize  = 34
  for (const line of lines1) {
    const lw = fontBold.widthOfTextAtSize(line, hSize)
    page.drawText(line, { x: margin + (cw - lw) / 2, y, size: hSize, font: fontBold, color: rgb(0.1, 0.2, 0.7) })
    y -= hSize + 6
  }
  y -= 18

  // QR grande y centrado
  const appUrl    = process.env.APP_URL || 'https://tu-app.railway.app'
  const qrUrl     = `${appUrl}/firma/${evento.id}`
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 500, margin: 2 })
  const qrBase64  = qrDataUrl.replace(/^data:image\/png;base64,/, '')
  const qrImg     = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'))
  const qrSize    = 230
  page.drawImage(qrImg, { x: (width - qrSize) / 2, y: y - qrSize, width: qrSize, height: qrSize })
  y -= qrSize + 22

  // Subtítulo de llamada a la acción
  const subText = 'Escanea este código con la cámara de tu móvil'
  const subW    = fontBold.widthOfTextAtSize(subText, 12)
  page.drawText(subText, { x: margin + (cw - subW) / 2, y, size: 12, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  y -= 18

  // Pasos
  const steps = [
    '1.  Abre la cámara de tu móvil y apunta al código QR',
    '2.  Toca el enlace que aparece en pantalla',
    '3.  Rellena tu nombre y DNI',
    '4.  Firma con el dedo directamente en la pantalla',
    '5.  Pulsa «Enviar» — ¡listo en menos de un minuto!',
  ]
  const stepSize = 11
  y -= 6
  for (const step of steps) {
    const sw = fontReg.widthOfTextAtSize(step, stepSize)
    page.drawText(step, { x: margin + (cw - sw) / 2, y, size: stepSize, font: fontReg, color: rgb(0.25, 0.25, 0.25) })
    y -= stepSize + 6
  }
  y -= 10

  // Nota RGPD
  const nota = 'Tus datos se tratan conforme al RGPD. Recibirás una copia firmada por email.'
  const notaW = fontReg.widthOfTextAtSize(nota, 8)
  page.drawText(nota, { x: margin + (cw - notaW) / 2, y, size: 8, font: fontReg, color: rgb(0.55, 0.55, 0.55) })
  y -= 22

  // Línea separadora inferior
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 14

  // Info del evento
  const infoLines = [
    evento.nombre,
    [evento.fecha, evento.lugar].filter(Boolean).join('  ·  '),
  ].filter(Boolean)
  for (const line of infoLines) {
    const lw = fontBold.widthOfTextAtSize(line, 10)
    page.drawText(line, { x: margin + (cw - lw) / 2, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    y -= 14
  }

  // Barra inferior de color
  page.drawRectangle({ x: 0, y: 0, width, height: 10, color: rgb(0.1, 0.2, 0.7) })

  return pdfDoc.save()
}

router.get('/eventos/:id/cartel-pdf', async (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const pdfBytes = await generatePosterPdf(ev)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `cartel_${ev.nombre || ev.id}.pdf`))
    res.send(Buffer.from(pdfBytes))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/eventos/:id/firmas/zip', (req, res) => {
  try {
    const ev = readEvento(req.params.id)
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' })
    const firmas = listFirmasDeEvento(req.params.id)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', contentDispositionHeader('attachment', `firmas_${ev.nombre || ev.id}.zip`))
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.pipe(res)
    for (const firma of firmas) {
      if (firma.pdf_path && existsSync(firma.pdf_path)) {
        archive.file(firma.pdf_path, { name: `autorizacion_${firma.nombre_apellidos || firma.id}.pdf` })
      }
    }
    archive.finalize()
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
