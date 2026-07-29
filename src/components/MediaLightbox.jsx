import { useEffect } from 'react'
import { mediaKindFromUrl } from '../lib/mediaKind'

export default function MediaLightbox({ src, kind, onClose }) {
  const resolvedKind = kind || mediaKindFromUrl(src)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged media"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 text-white text-xl leading-none hover:bg-black/70 transition"
      >
        ×
      </button>
      {resolvedKind === 'embed' ? (
        <iframe
          src={src}
          title="Embedded video"
          className="w-full max-w-4xl aspect-video max-h-[90vh] rounded-lg bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : resolvedKind === 'video' ? (
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="max-w-full max-h-[90vh] rounded-lg"
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt=""
          className="max-w-full max-h-[90vh] object-contain rounded-lg select-none"
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}

export function ExpandablePostMedia({ src, className = '' }) {
  if (!src) return null

  const kind = mediaKindFromUrl(src)
  const isVideo = kind === 'video'

  return (
    <div
      className={`block w-full rounded-xl overflow-hidden cursor-zoom-in ${className}`}
    >
      {isVideo ? (
        <video
          src={src}
          className="w-full max-h-64 object-cover pointer-events-none"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={src}
          alt=""
          className="w-full max-h-64 object-cover"
          loading="lazy"
        />
      )}
    </div>
  )
}
