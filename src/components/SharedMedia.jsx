/** Clean, borderless rendering for photos, GIFs, and videos shared in the app. */
const MEDIA_BASE = 'block max-w-full w-full rounded-xl border-0 outline-none'

function imageObjectFit(src) {
  const lower = String(src || '').toLowerCase()
  if (lower.includes('.gif') || lower.includes('giphy.com') || lower.includes('tenor.com')) {
    return 'object-contain'
  }
  return 'object-cover'
}

export function SharedImage({ src, alt = '', className = '' }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${MEDIA_BASE} max-h-80 ${imageObjectFit(src)} ${className}`}
    />
  )
}

export function SharedVideo({ src, className = '', autoPlay = false, loop = false, muted = false }) {
  if (!src) return null
  return (
    <video
      src={src}
      controls
      playsInline
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      referrerPolicy="no-referrer"
      className={`${MEDIA_BASE} max-h-80 ${className}`}
    />
  )
}

/** Chat/DM text bubbles — same transparent outline for both sides. */
export function textBubbleClass(_mine) {
  return 'rounded-2xl px-3 py-2 text-sm font-light max-w-full min-w-0 break-words [overflow-wrap:anywhere] border frens-border bg-transparent'
}
