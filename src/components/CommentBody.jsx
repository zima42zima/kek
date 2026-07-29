import { collectEmbeds, embedMatchKey, getLinkEmbed, splitTextWithUrls } from '../lib/urls'
import RichText from './RichText'
import { SharedImage } from './SharedMedia'

function stripEmbeddedUrls(text) {
  const embeds = collectEmbeds(text)
  const embedKeys = new Set(embeds.map((e) => embedMatchKey(e)))
  const parts = []

  for (const seg of splitTextWithUrls(text)) {
    if (seg.type === 'url') {
      const href = seg.href || seg.value
      const embed = getLinkEmbed(href)
      if (embed && embedKeys.has(embedMatchKey(embed))) continue
    }
    parts.push(seg.value)
  }

  return parts.join('').trim()
}

/** Comment text + inline GIF/image embeds (no lightbox, no external links on media). */
export default function CommentBody({ text, className = '' }) {
  if (!text?.trim()) return null

  const embeds = collectEmbeds(text).filter((e) => e.type === 'image')
  const caption = stripEmbeddedUrls(text)

  return (
    <div className={className}>
      {caption ? (
        <RichText text={caption} embeds={false} className="text-sm frens-body-text mb-1" />
      ) : null}
      {embeds.map((embed, i) => (
        <SharedImage
          key={`${embed.url}-${i}`}
          src={embed.url}
          className="max-h-48 mt-1"
        />
      ))}
    </div>
  )
}
