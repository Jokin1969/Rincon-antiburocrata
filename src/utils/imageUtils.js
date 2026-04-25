export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export const MIME_EXT = {
  'image/png':  'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif':  'gif',
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function getImageInfo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // SVG or non-bitmap: dimensions unknown
      resolve({ width: null, height: null })
    }
    img.src = url
  })
}

export function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = e => reject(e.target.error)
    reader.readAsArrayBuffer(file)
  })
}

function drawToCanvas(imgEl, targetW, targetH, mono, background) {
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (background === 'white') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
  }
  ctx.drawImage(imgEl, 0, 0, targetW, targetH)
  if (mono) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = gray
    }
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

export async function downloadLogo(logo, opts = {}) {
  const {
    format = 'png',
    width = null,
    height = null,
    mono = false,
    background = 'transparent',
  } = opts

  const blob = new Blob([logo.data], { type: logo.mimeType })

  // SVG passthrough (no canvas processing needed unless resize/mono requested)
  if (logo.mimeType === 'image/svg+xml' && format === 'svg' && !mono && !width && !height) {
    triggerDownload(blob, `${slug(logo.name)}.svg`)
    return
  }

  const url = URL.createObjectURL(blob)
  const img = await loadImage(url)
  URL.revokeObjectURL(url)

  const origW = img.naturalWidth || logo.width || 256
  const origH = img.naturalHeight || logo.height || 256

  let targetW = origW
  let targetH = origH
  if (width && height) {
    targetW = width
    targetH = height
  } else if (width) {
    targetW = width
    targetH = Math.round((width / origW) * origH)
  } else if (height) {
    targetH = height
    targetW = Math.round((height / origH) * origW)
  }

  const canvas = drawToCanvas(img, targetW, targetH, mono, background)
  const mimeOut = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const quality = format === 'jpg' ? 0.92 : undefined
  canvas.toBlob(outBlob => {
    triggerDownload(outBlob, `${slug(logo.name)}_v${logo.version}.${format}`)
  }, mimeOut, quality)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w.-]/g, '')
}
