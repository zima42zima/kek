import EchoIcon from './EchoIcon'
import { HeadphonesIcon } from '../icons/UiIcons'

/** Preview URL for a collection entry — the frame the user actually saw (meme = full image). */
export function echoWatchedPreviewUrl(echo) {
  if (!echo) return null
  if (echo.collectionPreviewUrl) return echo.collectionPreviewUrl
  if (echo.kind === 'image') return echo.mediaUrl || null
  // video/audio preview rules TBD
  return null
}

export function echoPreviewSrc(echo, { ownerPreview = false, watchedPreview = false } = {}) {
  if (watchedPreview) {
    const watched = echoWatchedPreviewUrl(echo)
    if (watched) return watched
  }
  if (!ownerPreview && !echo.mine) return echo.coverUrl || null
  if (echo.kind === 'image' && echo.mediaUrl) return echo.mediaUrl
  if (echo.coverUrl) return echo.coverUrl
  if (echo.kind === 'image') return echo.mediaUrl
  return null
}

export default function EchoPreviewMedia({
  echo,
  ownerPreview = false,
  watchedPreview = false,
  className = '',
}) {
  const thumb = echoPreviewSrc(echo, { ownerPreview, watchedPreview })

  if (thumb) {
    return (
      <img
        src={thumb}
        alt=""
        className={`w-full h-full object-cover ${className}`}
      />
    )
  }

  if (echo.kind === 'audio') {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 text-frens-muted ${className}`}>
        <HeadphonesIcon className="w-8 h-8 opacity-60" />
      </div>
    )
  }

  if (echo.kind === 'video') {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 text-frens-muted ${className}`}>
        <EchoIcon className="w-9 h-6 opacity-60" />
      </div>
    )
  }

  return <EchoIcon className={`w-9 h-6 opacity-50 ${className}`} />
}
