/**
 * CSS mask-image url() — must be quoted.
 * Vite inlines SVGs as data: URLs in production; unquoted url(data:...)
 * parses as mask: none and shows a solid square.
 */
export function maskImageStyle(src) {
  const url = `url("${src}")`
  return {
    maskImage: url,
    WebkitMaskImage: url,
  }
}

/** For Leaflet / innerHTML mask snippets. */
export function maskUrl(src) {
  return `url("${src}")`
}
