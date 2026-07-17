import EchoIcon from './EchoIcon'
import { HeadphonesIcon } from '../icons/UiIcons'

export function echoPreviewSrc(echo, { ownerPreview = false } = {}) {
  if (!ownerPreview && !echo.mine) return echo.coverUrl || null
  if (echo.kind === 'image' && echo.mediaUrl) return echo.mediaUrl
  if (echo.coverUrl) return echo.coverUrl
  if (echo.kind === 'image') return echo.mediaUrl
  return null
}

export default function EchoPreviewMedia({ echo, ownerPreview = false, className = '' }) {
  const thumb = echoPreviewSrc(echo, { ownerPreview })

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
