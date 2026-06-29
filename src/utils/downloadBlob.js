/**
 * downloadBlob — descarga un Blob como archivo en todos los contextos.
 *
 * Problema en iOS modo standalone (PWA abierta desde el icono):
 *   - `<a download>` es ignorado por iOS Safari.
 *   - `a.click()` sobre un blob URL REEMPLAZA la página actual, rompiendo la PWA.
 *
 * Estrategia:
 *   1. Si estamos en modo standalone iOS e Web Share API con ficheros está disponible
 *      (iOS 15+): usamos navigator.share({ files }). El usuario recibe la hoja de
 *      compartir nativa y puede guardar en Fotos, Archivos, etc.
 *   2. Si Web Share no está disponible en standalone: abrimos el blob URL en la
 *      ventana actual. iOS Safari muestra el visor inline (el usuario puede pulsarlo
 *      prolongadamente para guardarlo o enviarlo).
 *   3. En cualquier otro contexto (escritorio, Android Chrome, Safari normal):
 *      descarga estándar con <a download>.
 *
 * @param {Blob}   blob     - Datos del fichero
 * @param {string} filename - Nombre de fichero sugerido (con extensión)
 */
export async function downloadBlob(blob, filename) {
  const isStandalone =
    window.navigator.standalone === true ||           // iOS standalone check
    window.matchMedia('(display-mode: standalone)').matches

  if (isStandalone) {
    // ── Estrategia 1: Web Share API con ficheros (iOS 15+) ────────────────
    if (typeof navigator.canShare === 'function') {
      const file = new File([blob], filename, { type: blob.type })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename })
          return
        } catch (err) {
          if (err.name === 'AbortError') return  // usuario canceló
          // Si falla por otra razón, caemos a estrategia 2
        }
      }
    }

    // ── Estrategia 2: abrir el blob en la ventana actual ─────────────────
    // iOS mostrará el visor inline; el usuario puede pulsar prolongado → Guardar.
    const url = URL.createObjectURL(blob)
    window.location.href = url
    // Revocamos con retardo amplio para que el navegador lea el blob
    setTimeout(() => URL.revokeObjectURL(url), 120_000)
    return
  }

  // ── Estrategia 3: descarga estándar (escritorio / Android / Safari normal) ──
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
