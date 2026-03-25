import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Converts a DOCX buffer to PDF using LibreOffice headless.
 * Requires LibreOffice installed on the system (see nixpacks.toml).
 */
export function docxToPdf(docxBuffer) {
  const id = randomUUID()
  const inPath  = join(tmpdir(), `${id}.docx`)
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
