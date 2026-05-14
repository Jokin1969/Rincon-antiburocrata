import { PDFDocument } from 'pdf-lib'
import { execSync }    from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir }      from 'os'
import { join }        from 'path'
import { randomUUID }  from 'crypto'

async function docxBufToPdfBuf(docxBuffer) {
  const id     = randomUUID()
  const inPath = join(tmpdir(), `${id}.docx`)
  const outPath = join(tmpdir(), `${id}.pdf`)
  try {
    writeFileSync(inPath, docxBuffer)
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tmpdir()}" "${inPath}"`,
      { timeout: 60_000, stdio: 'pipe' }
    )
    return readFileSync(outPath)
  } finally {
    try { unlinkSync(inPath)  } catch { /* ignore */ }
    try { unlinkSync(outPath) } catch { /* ignore */ }
  }
}

async function imageBufToPdfBuf(buffer, mime) {
  const doc = await PDFDocument.create()
  let image
  if (mime === 'image/png') {
    image = await doc.embedPng(buffer)
  } else {
    image = await doc.embedJpg(buffer)
  }
  const { width, height } = image.scale(1)
  const page = doc.addPage([width, height])
  page.drawImage(image, { x: 0, y: 0, width, height })
  return Buffer.from(await doc.save())
}

/**
 * Merges multiple PDF buffers into one.
 */
export async function mergePdfs(pdfBuffers) {
  const merged = await PDFDocument.create()
  for (const buf of pdfBuffers) {
    try {
      const src   = await PDFDocument.load(buf, { ignoreEncryption: true })
      const pages = await merged.copyPages(src, src.getPageIndices())
      for (const page of pages) merged.addPage(page)
    } catch (err) {
      console.error('mergePdfs: error cargando PDF parcial, se omite:', err.message)
    }
  }
  return Buffer.from(await merged.save())
}

/**
 * Converts an attachment buffer to a PDF buffer based on its MIME type.
 */
export async function attachmentToPdf(buffer, mime) {
  if (mime === 'application/pdf') return buffer
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword') {
    return docxBufToPdfBuf(buffer)
  }
  if (mime.startsWith('image/')) {
    return imageBufToPdfBuf(buffer, mime)
  }
  throw new Error(`Tipo de archivo no soportado para adjuntar: ${mime}`)
}
