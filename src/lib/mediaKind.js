/** Guess image vs video vs iframe embed from a URL. */
export function mediaKindFromUrl(url) {
  if (!url) return 'image'
  const lower = String(url).toLowerCase()
  if (lower.includes('youtube.com/embed') || lower.includes('player.vimeo.com')) return 'embed'
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(lower)) return 'video'
  if (lower.includes('/video/') || lower.includes('mime=video')) return 'video'
  return 'image'
}
