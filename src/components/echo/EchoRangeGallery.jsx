import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import EchoIcon from './EchoIcon'
import { EchoKindLabel } from './EchoMeta'
import { distanceBucket, echoDistanceM } from '../../lib/echoRange'

function previewSrc(echo) {
  if (echo.kind === 'image' && echo.mediaUrl) return echo.mediaUrl
  if (echo.coverUrl) return echo.coverUrl
  return null
}

export default function EchoRangeGallery({ echoes, userPos, onOpenEcho, className = '' }) {
  if (!echoes.length) return null

  return (
    <section className={`space-y-2 ${className}`} aria-label="Echoes in range">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs frens-muted">
          {echoes.length} meme{echoes.length === 1 ? '' : 's'} in range — swipe left/right when open
        </p>
        <span className="text-[10px] frens-hint">approximate · no exact spots</span>
      </div>
      <div className="frens-echo-range-gallery -mx-1 px-1">
        {echoes.map((echo) => {
          const thumb = previewSrc(echo)
          const dist = echoDistanceM(echo, userPos)
          return (
            <button
              key={echo.id}
              type="button"
              onClick={() => onOpenEcho(echo.id)}
              className="frens-echo-range-card shrink-0 w-[9.5rem] text-left border frens-border rounded-xl overflow-hidden hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
            >
              <div className="relative aspect-[4/3] bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                {thumb ? (
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <EchoIcon className="w-8 h-6 opacity-70" />
                )}
                <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                  {distanceBucket(dist)}
                </span>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ProfileAvatar profile={echo} className="w-6 h-6 shrink-0" logoClassName="w-4 h-auto" />
                  <FrenHandle className="text-[11px] truncate">{echo.authorName}</FrenHandle>
                </div>
                <EchoKindLabel kind={echo.kind} short className="text-[10px] frens-muted" />
                {echo.label ? (
                  <p className="text-[10px] frens-body-text truncate">{echo.label}</p>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
