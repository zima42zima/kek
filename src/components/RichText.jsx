import { ThoughtMark } from './FrogLogo'
import {
  splitTextWithUrls,
  collectEmbeds,
  linkLabel,
  normalizeUrl,
  getLinkEmbed,
  embedMatchKey,
} from '../lib/urls'
import { mediaKindFromUrl } from '../lib/mediaKind'
import { SharedImage, SharedVideo } from './SharedMedia'
import LinkPreviewCard from './LinkPreviewCard'
import {
  VideoFrame,
  EmbedExpandButton,
  VideoTimelineCard,
  YouTubeInlineCard,
} from './YouTubeEmbed'

const INLINE_LINK =
  'text-[#6BC06B] dark:text-[#e0703a] underline break-all'
const TIMELINE_LINK =
  'text-[10px] frens-muted hover:text-[#6BC06B] dark:hover:text-[#e0703a] underline break-all'
const TIMELINE_CAPTION =
  'text-[10px] frens-muted hover:text-[#6BC06B] dark:hover:text-[#e0703a] underline truncate block mt-1'

function SmallSourceLink({ url, className = TIMELINE_CAPTION }) {
  const href = normalizeUrl(url) || url
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} title={href}>
      {linkLabel(href)}
    </a>
  )
}

function LinkEmbed({ embed, variant = 'inline', onExpandMedia, showAddToPlaylist = false }) {
  const isTimeline = variant === 'timeline'

  if (embed.type === 'youtube' || embed.type === 'vimeo') {
    if (isTimeline) {
      return (
        <VideoTimelineCard
          embed={embed}
          onExpandMedia={onExpandMedia}
          showAddToPlaylist={showAddToPlaylist}
        />
      )
    }
    if (embed.type === 'youtube') return <YouTubeInlineCard embed={embed} />
  }

  if (embed.type === 'vimeo' && !isTimeline) {
    const vimeoSrc = `https://player.vimeo.com/video/${embed.id}`
    return (
      <figure className="my-2">
        <VideoFrame
          overlay={isTimeline && onExpandMedia ? (
            <EmbedExpandButton onExpand={() => onExpandMedia(vimeoSrc, 'embed')} />
          ) : null}
        >
          <iframe
            src={vimeoSrc}
            title="Vimeo video"
            className="w-full h-full"
            loading="lazy"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </VideoFrame>
        {isTimeline ? <SmallSourceLink url={embed.url} /> : null}
      </figure>
    )
  }

  if (embed.type === 'pageImage') {
    return (
      <LinkPreviewCard
        pageUrl={embed.pageUrl}
        maxHeight={isTimeline ? 'max-h-96' : 'max-h-80'}
      />
    )
  }

  if (embed.type === 'video') {
    return (
      <figure className="my-2">
        <div className="rounded-xl overflow-hidden">
          <SharedVideo
            src={embed.url}
            className={isTimeline ? 'max-h-96' : 'max-h-80'}
          />
        </div>
        {isTimeline ? <SmallSourceLink url={embed.sourceUrl || embed.url} /> : null}
      </figure>
    )
  }

  if (embed.type === 'image') {
    const sourceHref = embed.sourceUrl || embed.url
    const kind = mediaKindFromUrl(embed.url)
    const visual = kind === 'video' ? (
      <SharedVideo
        src={embed.url}
        className={`${isTimeline ? 'max-h-96' : ''}`}
      />
    ) : (
      <SharedImage
        src={embed.url}
        className={`${isTimeline ? 'max-h-96' : ''} ${onExpandMedia ? 'cursor-zoom-in' : ''}`}
      />
    )
    return (
      <figure className="my-2">
        {onExpandMedia && kind !== 'video' ? (
          <button
            type="button"
            onClick={() => onExpandMedia(embed.url, kind)}
            className="block w-full rounded-xl overflow-hidden text-left focus:outline-none"
            aria-label="View full size"
          >
            {visual}
          </button>
        ) : (
          <div className="block rounded-xl overflow-hidden">{visual}</div>
        )}
        {isTimeline ? <SmallSourceLink url={sourceHref} /> : null}
      </figure>
    )
  }

  return null
}

function segmentHidesForEmbed(seg, embedKeys) {
  if (seg.type !== 'url') return false
  const href = seg.href || normalizeUrl(seg.value) || seg.value
  const embed = getLinkEmbed(href)
  if (embed) return embedKeys.has(embedMatchKey(embed))
  return false
}

function renderInlineSegments(segments, { variant, embedKeys }) {
  const isTimeline = variant === 'timeline'
  const linkClass = isTimeline ? TIMELINE_LINK : INLINE_LINK

  const nodes = segments.map((seg, i) => {
    if (seg.type === 'url') {
      const href = seg.href || normalizeUrl(seg.value) || seg.value
      if (segmentHidesForEmbed(seg, embedKeys)) return null
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer" className={linkClass}>
          {linkLabel(href)}
        </a>
      )
    }
    if (isTimeline && !seg.value.trim()) return null
    return <span key={i}>{seg.value}</span>
  }).filter(Boolean)

  if (nodes.length === 0) return null

  return (
    <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {nodes}
    </span>
  )
}

/**
 * Renders user text with clickable links and rich embeds (YouTube, Vimeo, images).
 *
 * variant="timeline" — thumbnail/video cards with a small source link underneath (feed posts).
 * variant="inline"   — default; links inline with embeds below (DMs, caves, comments).
 */
export default function RichText({
  text,
  className = '',
  embeds = true,
  variant = 'inline',
  thoughtMark = false,
  onExpandMedia,
  showAddToPlaylist = false,
}) {
  if (!text) return null

  const segments = splitTextWithUrls(text)
  const richEmbeds = embeds ? collectEmbeds(text) : []
  const embedKeys = new Set(richEmbeds.map((e) => embedMatchKey(e)))
  const inline = renderInlineSegments(segments, { variant, embedKeys })

  return (
    <div className={className}>
      {inline ? (
        thoughtMark ? (
          <div className="flex items-baseline gap-1.5 min-w-0">
            <ThoughtMark />
            <div className="min-w-0 flex-1">{inline}</div>
          </div>
        ) : (
          inline
        )
      ) : null}
      {richEmbeds.map((embed, i) => (
        <LinkEmbed
          key={`${embed.type}-${embed.id || embed.url}-${i}`}
          embed={embed}
          variant={variant}
          onExpandMedia={onExpandMedia}
          showAddToPlaylist={showAddToPlaylist}
        />
      ))}
    </div>
  )
}

/** @deprecated Use RichText — kept for imports that only need inline links. */
export function linkifyText(text) {
  if (!text) return null
  const segments = splitTextWithUrls(text)
  return segments.map((seg, i) =>
    seg.type === 'url' ? (
      <a
        key={i}
        href={seg.href || normalizeUrl(seg.value) || seg.value}
        target="_blank"
        rel="noreferrer"
        className={INLINE_LINK}
      >
        {linkLabel(seg.href || seg.value)}
      </a>
    ) : (
      <span key={i}>{seg.value}</span>
    ),
  )
}
