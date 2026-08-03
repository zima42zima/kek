import { useState } from 'react'
import MediaLightbox from './MediaLightbox'
import { SharedImage } from './SharedMedia'
import { mediaKindFromUrl } from '../lib/mediaKind'

/** Post attachment with tap-to-enlarge lightbox. */
export default function PostMedia({ src, size = 'feed' }) {
  const [open, setOpen] = useState(false)

  if (!src) return null

  const previewClass = size === 'detail' ? 'mb-0 max-h-[50vh]' : 'mb-0 max-h-64'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-left rounded-xl mb-3 focus:outline-none cursor-zoom-in"
        aria-label="View full size"
      >
        <SharedImage src={src} className={previewClass} />
      </button>
      {open && (
        <MediaLightbox
          src={src}
          kind={mediaKindFromUrl(src)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
