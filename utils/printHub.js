/**
 * submitToPrintHub — envía un PDF al hub de impresión físico.
 *
 * El hub es un servicio externo (jokin-tools). Recibe el PDF por
 * multipart/form-data, lo encola y un agente local lo imprime.
 *
 * La clave PRINT_HUB_KEY viaja solo en el backend; nunca se expone al cliente.
 *
 * @param {Buffer} pdfBuffer - Contenido del PDF
 * @param {string} filename  - Nombre de fichero a mostrar en el panel del hub
 * @returns {Promise<{ok:boolean, id:number, status:string, printer:string}>}
 * @throws {Error} con err.status = código HTTP del hub (503 si faltan env vars)
 */
export async function submitToPrintHub(pdfBuffer, filename) {
  const hubUrl = process.env.PRINT_HUB_URL
  const hubKey = process.env.PRINT_HUB_KEY

  if (!hubUrl || !hubKey) {
    const err = new Error('Hub de impresión no configurado (PRINT_HUB_URL / PRINT_HUB_KEY)')
    err.status = 503
    throw err
  }

  const form = new FormData()
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename)
  form.append('filename', filename)
  form.append('source', 'anti-burocrata')

  const res = await fetch(`${hubUrl}/imprimir/api/submit`, {
    method:  'POST',
    headers: { 'X-Api-Key': hubKey },
    body:    form,
    signal:  AbortSignal.timeout(30_000),
  })

  let data = {}
  try { data = await res.json() } catch { /* hub devolvió respuesta no-JSON */ }

  if (!res.ok) {
    const err = new Error(data.error || data.message || `Hub error ${res.status}`)
    err.status = res.status
    throw err
  }

  return data
}
