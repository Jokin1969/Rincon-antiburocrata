/**
 * Builds a Content-Disposition header value that correctly handles non-ASCII
 * filenames (accents, ñ, etc.) using RFC 5987 encoding.
 *
 * Result: attachment; filename="ASCII_fallback.pdf"; filename*=UTF-8''encoded.pdf
 *
 * Modern browsers use filename* (RFC 5987) and ignore filename.
 * Older clients fall back to the ASCII-only filename.
 *
 * @param {'attachment'|'inline'} disposition
 * @param {string} filename  – original filename, may contain non-ASCII chars
 */
export function contentDispositionHeader(disposition, filename) {
  const ascii   = filename.replace(/[^\x20-\x7E]/g, '_')
  const encoded = encodeURIComponent(filename).replace(/'/g, '%27')
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
