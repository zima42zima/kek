import { useEffect, useState } from 'react'
import { linkLabel, normalizeUrl, youtubeThumbnail } from '../lib/urls'
import { AddToPlaylistButton } from './playlists/AddToPlaylistModal'
import { PlayIcon } from './icons/UiIcons'

const TIMELINE_CAPTION =
  'text-[10px] frens-muted hover:text-[#6BC06B] dark:hover:text-[#e0703a] underline truncate block mt-1'

function vimeoThumbnail(id) {
  return `https://vumbnail.com/${id}.jpg`
}

function videoEmbedSrc(embed, autoplay = false) {
  if (embed.type === 'youtube') {
    return `https://www.youtube.com/embed/${embed.id}${autoplay ? '?autoplay=1' : ''}`
  }
  if (embed.type === 'vimeo') {
    return `https://player.vimeo.com/video/${embed.id}${autoplay ? '?autoplay=1' : ''}`
  }
  return null
}

function videoThumbnail(embed) {
  if (embed.type === 'youtube') return youtubeThumbnail(embed.id)
  if (embed.type === 'vimeo') return vimeoThumbnail(embed.id)
  return null
}

export function VideoFrame({ children, overlay }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black video-embed-frame">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div className="absolute inset-0">{children}</div>
        {overlay}
      </div>
    </div>
  )
}

export function EmbedExpandButton({ onExpand, label = 'Fullscreen' }) {
  if (!onExpand) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onExpand()
      }}
      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 text-white text-sm hover:bg-black/80 transition flex items-center justify-center"
      aria-label={label}
      title={label}
    >
      ⛶
    </button>
  )
}

function SmallSourceLink({ url, className = TIMELINE_CAPTION }) {
  const href = normalizeUrl(url) || url
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} title={href}>
      {linkLabel(href)}
    </a>
  )
}

/** Thumbnail → inline play for YouTube or Vimeo — same frame as feed video links. */
export function VideoTimelineCard({
  embed,
  onExpandMedia,
  caption,
  showAddToPlaylist = false,
  forcePlaying = null,
  onPlayRequest,
  onEnded,
  externalPlayback = false,
}) {
  const [localPlaying, setLocalPlaying] = useState(false)
  const controlled = forcePlaying !== null && forcePlaying !== undefined
  const playing = controlled ? forcePlaying : localPlaying
  const embedSrc = videoEmbedSrc(embed, true)
  const thumb = videoThumbnail(embed)
  const label = caption || (embed.type === 'vimeo' ? 'Vimeo video' : 'YouTube video')

  useEffect(() => {
    if (!playing || !onEnded || externalPlayback) return undefined

    function onMessage(event) {
      const origins = ['https://www.youtube.com', 'https://player.vimeo.com']
      if (!origins.includes(event.origin)) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (event.origin.includes('youtube')) {
          const ended = data?.info === 0
            || (data?.event === 'onStateChange' && data?.info === 0)
            || (data?.event === 'infoDelivery' && data?.info?.playerState === 0)
          if (ended) onEnded()
        }
        if (event.origin.includes('vimeo') && data?.event === 'finish') onEnded()
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [playing, onEnded, externalPlayback])

  if (!embedSrc || !thumb) return null

  const ytSrc = embed.type === 'youtube'
    ? `${embedSrc}${embedSrc.includes('?') ? '&' : '?'}enablejsapi=1`
    : embedSrc.replace('autoplay=1', 'api=1&autoplay=1')

  function handleThumbnailClick() {
    if (onPlayRequest) {
      onPlayRequest()
      return
    }
    if (controlled) return
    setLocalPlaying(true)
  }

  if (playing && externalPlayback) {
    return (
      <figure className="my-2">
        <button
          type="button"
          onClick={() => onPlayRequest?.()}
          className="relative w-full block rounded-xl overflow-hidden ring-2 ring-[#6BC06B]/70 dark:ring-white/40 text-left focus:outline-none"
          aria-label={caption ? `Now playing ${caption}` : `Now playing ${label}`}
        >
          <img
            src={thumb}
            alt=""
            className="w-full object-cover"
            style={{ aspectRatio: '16 / 9' }}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="w-10 h-10 rounded-full bg-black/80 dark:bg-white/90 text-white dark:text-black flex items-center justify-center text-sm tracking-tight">
              ⏸
            </span>
          </span>
          <span className="absolute bottom-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/70 text-white">
            Now playing
          </span>
        </button>
        {caption ? (
          <p className="text-xs font-medium frens-body-text mt-1 truncate">{caption}</p>
        ) : null}
        <SmallSourceLink url={embed.url} />
      </figure>
    )
  }

  if (playing) {
    return (
      <figure className="my-2">
        <VideoFrame
          overlay={(
            <>
              <EmbedExpandButton
                onExpand={onExpandMedia ? () => onExpandMedia(ytSrc, 'embed') : null}
              />
              {showAddToPlaylist ? <AddToPlaylistButton embed={embed} /> : null}
            </>
          )}
        >
          <iframe
            src={ytSrc}
            title={label}
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </VideoFrame>
        {caption ? (
          <p className="text-xs font-medium frens-body-text mt-1 truncate">{caption}</p>
        ) : null}
        <SmallSourceLink url={embed.url} />
      </figure>
    )
  }

  return (
    <figure className="my-2">
      <button
        type="button"
        onClick={handleThumbnailClick}
        className="relative w-full block rounded-xl overflow-hidden bg-black text-left focus:outline-none touch-pan-y"
        aria-label={caption ? `Play ${caption}` : `Play ${label}`}
      >
        <img
          src={thumb}
          alt=""
          className="w-full object-cover"
          style={{ aspectRatio: '16 / 9' }}
          loading="lazy"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/40 transition">
          <span className="w-14 h-14 rounded-full bg-black/75 text-white flex items-center justify-center text-xl pl-1 shadow-lg">
            ▶
          </span>
        </span>
        {showAddToPlaylist ? <AddToPlaylistButton embed={embed} /> : null}
      </button>
      {caption ? (
        <p className="text-xs font-medium frens-body-text mt-1 truncate">{caption}</p>
      ) : null}
      <SmallSourceLink url={embed.url} />
    </figure>
  )
}

/** @deprecated Use VideoTimelineCard */
export function YouTubeTimelineCard(props) {
  return <VideoTimelineCard {...props} />
}

export function YouTubeInlineCard({ embed }) {
  return (
    <figure className="my-2">
      <VideoFrame>
        <iframe
          src={`https://www.youtube.com/embed/${embed.id}`}
          title="YouTube video"
          className="w-full h-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </VideoFrame>
    </figure>
  )
}
