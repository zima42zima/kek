import { useRef } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import EchoIcon from './EchoIcon'
import { EchoKindLabel } from './EchoMeta'
import { EchoAuraCount } from './EchoAuraButton'
import { echoPreviewSrc } from './EchoPreviewMedia'
import { GlobeIcon, LocationIcon } from '../icons/UiIcons'
import { distanceBucket, echoDistanceM } from '../../lib/echoRange'
import { canBrowseGlobally } from '../../lib/echoPrivacy'

function galleryPreviewSrc(echo) {
  const canShowMedia = echo.mine || echo.inRange || canBrowseGlobally(echo)
  if (canShowMedia && echo.kind === 'image' && echo.mediaUrl) return echo.mediaUrl
  if (echo.coverUrl) return echo.coverUrl
  return echoPreviewSrc(echo)
}

function locationLine(echo) {
  const place = echo.placeLabel?.trim()
  const city = echo.cityLabel?.trim()
  if (place && city && place !== city) return `${place} · ${city}`
  return place || city || null
}

export default function EchoRangeGallery({
  echoes,
  userPos,
  anchor,
  title,
  hint = 'approximate · no exact spots',
  onOpenEcho,
  className = '',
}) {
  const scrollRef = useRef(null)
  const dragRef = useRef({ moved: false, startX: 0, startY: 0 })

  if (!echoes.length) return null

  const heading = title || `${echoes.length} aftersound${echoes.length === 1 ? '' : 's'} here`

  function onScrollPointerDown(e) {
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    }
  }

  function onScrollPointerMove(e) {
    const d = dragRef.current
    if (Math.abs(e.clientX - d.startX) > 6 || Math.abs(e.clientY - d.startY) > 6) {
      d.moved = true
    }
  }

  function onCardActivate(id) {
    if (dragRef.current.moved) return
    onOpenEcho(id)
  }

  return (
    <section className={`space-y-2 min-w-0 ${className}`} aria-label={heading}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-xs frens-muted min-w-0">
          {heading}
          {' '}
          — swipe left/right
        </p>
        <span className="text-[10px] frens-hint shrink-0">{hint}</span>
      </div>
      <div
        ref={scrollRef}
        className="frens-echo-range-gallery -mx-1 px-1"
        onPointerDown={onScrollPointerDown}
        onPointerMove={onScrollPointerMove}
      >
        {echoes.map((echo) => {
          const thumb = galleryPreviewSrc(echo)
          const dist = userPos ? echoDistanceM(echo, userPos) : null
          const global = canBrowseGlobally(echo)
          const where = locationLine(echo)
          const inRange = echo.inRange === true

          return (
            <div
              key={echo.id}
              role="button"
              tabIndex={0}
              onClick={() => onCardActivate(echo.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCardActivate(echo.id)
                }
              }}
              className="frens-echo-range-card shrink-0 w-[11rem] text-left border frens-border rounded-xl overflow-hidden hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition cursor-pointer select-none"
            >
              <div className="relative aspect-[4/3] bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden pointer-events-none">
                {thumb ? (
                  <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
                ) : (
                  <EchoIcon className="w-8 h-6 opacity-70" />
                )}
                {global ? (
                  <span
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/90 dark:bg-black/80 flex items-center justify-center"
                    title="Browsable from anywhere"
                  >
                    <GlobeIcon className="w-3 h-3" />
                  </span>
                ) : null}
                {dist != null && Number.isFinite(dist) ? (
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                    {inRange ? 'in range' : distanceBucket(dist)}
                  </span>
                ) : anchor ? (
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                    in area
                  </span>
                ) : null}
              </div>
              <div className="p-2 space-y-1 pointer-events-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ProfileAvatar profile={echo} className="w-6 h-6 shrink-0" logoClassName="w-4 h-auto" />
                  <FrenHandle className="text-[11px] truncate">{echo.authorName}</FrenHandle>
                </div>
                <EchoKindLabel kind={echo.kind} short className="text-[10px] frens-muted" />
                {where ? (
                  <p className="text-[10px] frens-muted truncate inline-flex items-center gap-0.5 min-w-0">
                    <LocationIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{where}</span>
                  </p>
                ) : null}
                {echo.label ? (
                  <p className="text-[10px] frens-body-text line-clamp-2 leading-snug">{echo.label}</p>
                ) : null}
                {(echo.auraCount ?? 0) > 0 ? (
                  <EchoAuraCount count={echo.auraCount} className="text-[10px]" />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
