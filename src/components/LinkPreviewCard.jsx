import { useEffect, useState } from 'react'
import { linkLabel, normalizeUrl } from '../lib/urls'
import { resolvePagePreviewMedia } from '../lib/linkPreview'
import { SharedImage, SharedVideo } from './SharedMedia'

const CAPTION =
  'text-[10px] frens-muted hover:text-[#6BC06B] dark:hover:text-[#e0703a] underline truncate block mt-1'

function SourceLink({ url }) {
  const href = normalizeUrl(url) || url
  return (
    <a href={href} target="_blank" rel="noreferrer" className={CAPTION} title={href}>
      {linkLabel(href)}
    </a>
  )
}

/** Async preview for Cosmos / Pinterest page links — video, GIF, or image inline. */
export default function LinkPreviewCard({
  pageUrl,
  maxHeight = 'max-h-96',
}) {
  const [media, setMedia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setMedia(null)

    resolvePagePreviewMedia(pageUrl)
      .then((result) => {
        if (cancelled) return
        if (result?.url) setMedia(result)
        else setFailed(true)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [pageUrl])

  if (loading) {
    return (
      <figure className="my-2">
        <div
          className="w-full rounded-xl bg-black/5 dark:bg-white/10 animate-pulse"
          style={{ aspectRatio: '4 / 3', maxHeight: '24rem' }}
        />
        <SourceLink url={pageUrl} />
      </figure>
    )
  }

  if (failed || !media?.url) {
    return (
      <figure className="my-2">
        <a
          href={pageUrl}
          target="_blank"
          rel="noreferrer"
          className="block border frens-border rounded-xl px-4 py-6 text-center text-sm frens-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
        >
          {linkLabel(pageUrl)} — open link
        </a>
      </figure>
    )
  }

  const preview = media.kind === 'video' ? (
    <SharedVideo src={media.url} className={maxHeight} />
  ) : (
    <SharedImage src={media.url} className={maxHeight} />
  )

  return (
    <figure className="my-2">
      <div className="block rounded-xl overflow-hidden">
        {preview}
      </div>
      <SourceLink url={pageUrl} />
    </figure>
  )
}
