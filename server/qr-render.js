import QRCode from 'qrcode'
import sharp from 'sharp'
import PDFDocument from 'pdfkit'

export const STYLES = [
  { id: 'classic',      label: 'Clásico',    module: 'square',  eyeR: 0,   eyeInnerR: 0,   gradient: false },
  { id: 'rounded',      label: 'Redondeado', module: 'rounded', eyeR: 1.8, eyeInnerR: 0.8, gradient: false },
  { id: 'dots',         label: 'Puntos',     module: 'dot',     eyeR: 3.5, eyeInnerR: 1.5, gradient: false },
  { id: 'mosaic',       label: 'Mosaico',    module: 'rounded', eyeR: 2.4, eyeInnerR: 1.2, gradient: false },
  { id: 'diamond',      label: 'Diamante',   module: 'diamond', eyeR: 0,   eyeInnerR: 0,   gradient: false },
  { id: 'gradientDots', label: 'Degradado',  module: 'dot',     eyeR: 3.5, eyeInnerR: 1.5, gradient: true  },
]

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function isHex(s) { return /^#[0-9a-fA-F]{6}$/.test(s) }

function rr(x, y, w, h, r) {
  const rv = Math.min(r ?? 0, w / 2, h / 2)
  if (!rv) return `M${x} ${y}h${w}v${h}h${-w}Z`
  return `M${x+rv} ${y}h${w-2*rv}a${rv} ${rv} 0 0 1 ${rv} ${rv}` +
         `v${h-2*rv}a${rv} ${rv} 0 0 1 ${-rv} ${rv}` +
         `h${-(w-2*rv)}a${rv} ${rv} 0 0 1 ${-rv} ${-rv}` +
         `v${-(h-2*rv)}a${rv} ${rv} 0 0 1 ${rv} ${-rv}Z`
}

export function normalizeUrl(raw) {
  if (!raw) return null
  let s = String(raw).trim()
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (!['http:', 'https:'].includes(u.protocol)) return null
    const host = u.hostname
    if (!/^[a-z0-9.-]+$/i.test(host)) return null
    const isIp    = /^\d+\.\d+\.\d+\.\d+$/.test(host)
    const isLocal = host === 'localhost'
    const hasTld  = /\.[a-z]{2,}$/i.test(host)
    if (!isIp && !isLocal && !hasTld) return null
    return u.toString()
  } catch { return null }
}

export function sanitizeConfig(input) {
  const url = normalizeUrl(input?.url)
  if (!url) { const e = new Error('URL inválida'); e.status = 400; throw e }
  const preset  = STYLES.find(s => s.id === input?.style) ?? STYLES[0]
  const hasLogo = typeof input?.logo === 'string' && input.logo.startsWith('data:image/')
  let ecc = ['L','M','Q','H'].includes(input?.ecc) ? input.ecc : 'M'
  if (hasLogo && (ecc === 'L' || ecc === 'M')) ecc = 'H'
  return {
    url,
    style:     preset.id,
    fg:        isHex(input?.fg)   ? input.fg   : '#111111',
    bg:        input?.transparent ? 'transparent' : (isHex(input?.bg) ? input.bg : '#ffffff'),
    gradient:  input?.gradient ?? preset.gradient,
    grad2:     isHex(input?.grad2) ? input.grad2 : '#1B6CB0',
    ecc,
    logo:      hasLogo ? input.logo : null,
    logoScale: Math.min(34, Math.max(12, Number(input?.logoScale) || 22)),
    logoShape: input?.logoShape === 'square' ? 'square' : 'circle',
    logoInner: Math.min(250, Math.max(50, Number(input?.logoInner) || 90)),
    frame:     Boolean(input?.frame),
    frameText: String(input?.frameText ?? 'Escáneame').slice(0, 28),
  }
}

export function buildSvg(cfg) {
  const qr   = QRCode.create(cfg.url, { errorCorrectionLevel: cfg.ecc })
  const N    = qr.modules.size
  const data = qr.modules.data

  const margin = 4
  const pad    = cfg.frame ? 2.5 : 0
  const labelH = cfg.frame ? 6   : 0
  const W      = N + 2 * margin + 2 * pad
  const H      = W + labelH
  const off    = margin + pad

  const uid    = Math.random().toString(36).slice(2, 8)
  const preset = STYLES.find(s => s.id === cfg.style) ?? STYLES[0]
  const bgFill = cfg.bg === 'transparent' ? null : cfg.bg
  const fill   = cfg.gradient ? `url(#qrGrad-${uid})` : cfg.fg

  function isDetector(r, c) {
    if (r < 7 && c < 7) return true
    if (r < 7 && c >= N - 7) return true
    if (r >= N - 7 && c < 7) return true
    return false
  }

  let pathD = ''
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!data[r * N + c] || isDetector(r, c)) continue
      const x = off + c, y = off + r
      if (preset.module === 'square') {
        pathD += `M${x} ${y}h1v1h-1Z`
      } else if (preset.module === 'rounded') {
        pathD += rr(x, y, 1, 1, 0.34)
      } else if (preset.module === 'dot') {
        const rv = 0.46, cx = x + 0.5, cy = y + 0.5
        pathD += `M${cx-rv} ${cy}a${rv} ${rv} 0 1 0 ${2*rv} 0a${rv} ${rv} 0 1 0 ${-2*rv} 0Z`
      } else if (preset.module === 'diamond') {
        pathD += `M${x+.5} ${y}L${x+1} ${y+.5}L${x+.5} ${y+1}L${x} ${y+.5}Z`
      }
    }
  }

  function drawEye(ex, ey) {
    const eR  = preset.eyeR
    const eiR = preset.eyeInnerR
    const outerHoleR = Math.max(0, eR - 1)
    const outerPath  = rr(ex, ey, 7, 7, eR) + rr(ex+1, ey+1, 5, 5, outerHoleR)
    const innerPath  = rr(ex+2, ey+2, 3, 3, eiR)
    return `<path d="${outerPath}" fill="${cfg.fg}" fill-rule="evenodd"/>` +
           `<path d="${innerPath}" fill="${cfg.fg}"/>`
  }

  const eyesSvg = [
    drawEye(off,         off),
    drawEye(off + N - 7, off),
    drawEye(off,         off + N - 7),
  ].join('')

  const gradDef = cfg.gradient
    ? `<linearGradient id="qrGrad-${uid}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${cfg.fg}"/>` +
      `<stop offset="100%" stop-color="${cfg.grad2}"/>` +
      `</linearGradient>`
    : ''

  let logoDef = '', logoSvg = ''
  if (cfg.logo) {
    const backR = (cfg.logoScale / 100) * N / 2 + 0.6
    const imgR  = backR * (cfg.logoInner / 100)
    const cx    = off + N / 2, cy = off + N / 2
    if (cfg.logoShape === 'circle') {
      logoDef = `<clipPath id="logoClip-${uid}"><circle cx="${cx}" cy="${cy}" r="${imgR}"/></clipPath>`
      logoSvg = `<circle cx="${cx}" cy="${cy}" r="${backR}" fill="white"/>` +
                `<image href="${cfg.logo}" x="${cx-imgR}" y="${cy-imgR}" width="${2*imgR}" height="${2*imgR}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip-${uid})"/>`
    } else {
      const rx = Math.min(0.5, backR * 0.15)
      logoDef = `<clipPath id="logoClip-${uid}"><rect x="${cx-imgR}" y="${cy-imgR}" width="${2*imgR}" height="${2*imgR}" rx="${rx}"/></clipPath>`
      logoSvg = `<rect x="${cx-backR}" y="${cy-backR}" width="${2*backR}" height="${2*backR}" rx="${rx}" fill="white"/>` +
                `<image href="${cfg.logo}" x="${cx-imgR}" y="${cy-imgR}" width="${2*imgR}" height="${2*imgR}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip-${uid})"/>`
    }
  }

  const defs = [gradDef, logoDef].filter(Boolean).join('')

  let frameBorder = '', frameLabel = ''
  if (cfg.frame) {
    frameBorder = `<rect x=".3" y=".3" width="${W-.6}" height="${H-.6}" rx="1" fill="none" stroke="${cfg.fg}" stroke-width=".5"/>`
    frameLabel  = `<rect x=".3" y="${H-labelH}" width="${W-.6}" height="${labelH-.3}" fill="${cfg.fg}"/>` +
                  `<text x="${W/2}" y="${H-labelH/2}" font-family="DejaVu Sans,Verdana,sans-serif" font-size="2.8" fill="white" text-anchor="middle" dominant-baseline="middle">${esc(cfg.frameText)}</text>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">\n` +
    (defs ? `<defs>${defs}</defs>\n` : '') +
    (bgFill ? `<rect width="${W}" height="${H}" fill="${bgFill}"/>\n` : '') +
    frameBorder +
    `<path d="${pathD}" fill="${fill}"/>\n` +
    eyesSvg + '\n' +
    logoSvg + '\n' +
    frameLabel +
    '</svg>'

  return { svg, modules: N, ecc: cfg.ecc }
}

async function toRaster(svgBuf, format, width = 1024, bgColor = '#ffffff') {
  const base = sharp(svgBuf, { density: 384 }).resize({ width })
  if (format === 'png')  return base.png({ compressionLevel: 9 }).toBuffer()
  if (format === 'jpeg') return base.flatten({ background: bgColor }).jpeg({ quality: 92 }).toBuffer()
  if (format === 'webp') return base.webp({ quality: 92 }).toBuffer()
  throw new Error('Unknown format')
}

async function toPdf(svgBuf, name, url) {
  const pngBuf = await sharp(svgBuf, { density: 384 }).resize({ width: 1200 }).png().toBuffer()
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 56 })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const pw = doc.page.width - 112
    if (name) {
      doc.fontSize(20).font('Helvetica-Bold').text(name, { align: 'center' })
      doc.moveDown(0.5)
    }
    const sz = Math.min(360, pw)
    doc.image(pngBuf, (doc.page.width - sz) / 2, doc.y, { width: sz, height: sz })
    doc.moveDown(1)
    doc.fontSize(11).font('Helvetica').fillColor('#0000EE').text(url, { align: 'center', link: url, underline: true })
    doc.moveDown(2)
    doc.fontSize(8).fillColor('#888888').text('Generado con Rincón del Anti-Burócrata', { align: 'center' })
    doc.end()
  })
}

export async function exportConfig(config, format, meta = {}) {
  const cfg     = sanitizeConfig(config)
  const { svg } = buildSvg(cfg)
  const svgBuf  = Buffer.from(svg)
  if (format === 'svg')  return { buffer: svgBuf, mime: 'image/svg+xml', ext: 'svg' }
  if (format === 'pdf')  return { buffer: await toPdf(svgBuf, meta.name ?? '', cfg.url), mime: 'application/pdf', ext: 'pdf' }
  const buf  = await toRaster(svgBuf, format, meta.width ?? 1024, cfg.bg === 'transparent' ? '#ffffff' : cfg.bg)
  const ext  = format === 'jpeg' ? 'jpg' : format
  const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
  return { buffer: buf, mime, ext }
}

export function stylePreviews() {
  const sample = { url: 'https://example.com', ecc: 'M', logo: null, frame: false,
                   transparent: false, logoScale: 22, logoShape: 'circle', logoInner: 90, frameText: 'Escáneame' }
  return STYLES.map(s => {
    const cfg = sanitizeConfig({ ...sample, style: s.id, fg: '#111111', bg: '#ffffff', gradient: s.gradient, grad2: '#1B6CB0' })
    const { svg } = buildSvg(cfg)
    return { id: s.id, label: s.label, gradient: s.gradient, svg }
  })
}
