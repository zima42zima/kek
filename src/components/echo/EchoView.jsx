import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal'
import { ProfileAvatar } from '../FrogLogo'
import EchoAuraButton, { EchoAuraCount } from './EchoAuraButton'
import EchoComments from './EchoComments'
import FrenHandle from '../FrenHandle'
import SpatialEchoViewer from './SpatialEchoViewer'
import { ECHO_LOOK_FILTERS, ECHO_VOICE_FILTERS } from '../../lib/echoConstants'
import { spatialTierLabel } from '../../lib/spatialEcho'
import { senseFilterLabel, normalizeSenseFilter, lidarFilterLabel } from '../../lib/senseFilters'
import { EchoMetaLine, EchoTypeIcon } from './EchoMeta'
import { HeadphonesIcon, LocationIcon } from '../icons/UiIcons'

const SWIPE_THRESHOLD_PX = 48

function lookFilterCss(id) {
  return ECHO_LOOK_FILTERS.find((f) => f.id === id)?.css ?? 'none'
}

function voiceFilterRate(id) {
  return ECHO_VOICE_FILTERS.find((f) => f.id === id)?.rate ?? 1
}

export default function EchoView({
  echo,
  mine,
  profile,
  auraCount = 0,
  iGaveAura = false,
  spatialNearby = false,
  rangeEchoes = [],
  onRangeEchoChange,
  onToggleAura,
  onAuraChange,
  useRemoteAura = true,
  onSave,
  onUnsave,
  onNavigateToPlace,
  onClose,
  onOpenProfile,
  onAddComment,
  onToggleComments,
  onReviewed,
}) {
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const touchStartX = useRef(null)
  const [reviewed, setReviewed] = useState(false)
  const [spatialView, setSpatialView] = useState(false)

  const rangeIndex = rangeEchoes.findIndex((e) => e.id === echo.id)
  const canRangeSwipe = rangeEchoes.length > 1 && rangeIndex >= 0
  const hasPrev = canRangeSwipe && rangeIndex > 0
  const hasNext = canRangeSwipe && rangeIndex < rangeEchoes.length - 1

  const lookStyle = echo.kind === 'video' && echo.lookFilter
    ? { filter: lookFilterCss(echo.lookFilter) }
    : undefined
  const hideFace = echo.kind === 'video' && echo.lookFilter === 'hide-face'
  const voiceRate = echo.kind === 'audio' ? voiceFilterRate(echo.voiceFilter) : 1
  const hasSpatial = Boolean(echo.spatial)
  const canSpatialView = hasSpatial && (mine || spatialNearby)
  const senseName = (() => {
    const id = echo.senseFilter || normalizeSenseFilter(echo.lidarFilter)
    if (!id || id === 'clear') return ''
    return senseFilterLabel(id) || lidarFilterLabel(echo.lidarFilter)
  })()

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = voiceRate
  }, [voiceRate, echo.mediaUrl])

  useEffect(() => {
    setReviewed(false)
    setSpatialView(false)
  }, [echo.id])

  function markReviewed() {
    if (reviewed) return
    setReviewed(true)
    onReviewed?.(echo)
  }

  function navigateRange(delta) {
    if (!canRangeSwipe || !onRangeEchoChange) return
    const next = rangeEchoes[rangeIndex + delta]
    if (next) onRangeEchoChange(next.id)
  }

  function handleTouchStart(e) {
    if (!canRangeSwipe) return
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(e) {
    if (!canRangeSwipe || touchStartX.current == null) return
    const endX = e.changedTouches[0]?.clientX
    if (endX == null) return
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (delta <= -SWIPE_THRESHOLD_PX) navigateRange(1)
    else if (delta >= SWIPE_THRESHOLD_PX) navigateRange(-1)
  }

  return (
    <>
      <Modal title={mine ? 'Your echo' : 'A fren left an echo'} onClose={onClose} maxWidth="max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <ProfileAvatar profile={echo} className="w-11 h-11" logoClassName="w-7 h-auto" />
          <div className="min-w-0 flex-1">
            <FrenHandle>{echo.authorName}</FrenHandle>
            <p className="text-xs frens-muted">
              <EchoMetaLine
                kind={echo.kind}
                visibility={echo.visibility}
                spatial={hasSpatial ? spatialTierLabel(echo.spatial.tier) : null}
                sense={senseName || null}
                onWorldClick={
                  echo.visibility === 'world' && onNavigateToPlace
                    ? () => onNavigateToPlace(echo)
                    : null
                }
              />
            </p>
          </div>
          {!mine && echo.ownerId && onOpenProfile && (
            <button
              type="button"
              onClick={() => onOpenProfile(echo.ownerId)}
              className="text-xs frens-action shrink-0"
            >
              @{echo.authorName}
            </button>
          )}
        </div>

        {canSpatialView ? (
          <button
            type="button"
            onClick={() => setSpatialView(true)}
            className="w-full mb-3 rounded-xl border frens-border bg-black/5 dark:bg-white/5 px-4 py-3 text-left hover:bg-black/8 dark:hover:bg-white/8 transition"
          >
            <p className="text-sm font-medium inline-flex items-center gap-1.5">
              <LocationIcon className="w-4 h-4" />
              View in space
            </p>
            <p className="text-[11px] frens-muted mt-0.5">
              {mine
                ? 'See where you pinned this echo'
                : 'Open your camera to find the pinned spot'}
            </p>
          </button>
        ) : hasSpatial && !mine ? (
          <p className="text-[11px] frens-muted text-center mb-3 px-2">
            Get closer to this spot to unlock spatial view.
          </p>
        ) : null}

        <div
          className="relative rounded-xl bg-black/30 overflow-hidden mb-3 touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {canRangeSwipe && (
            <>
              <button
                type="button"
                onClick={() => navigateRange(-1)}
                disabled={!hasPrev}
                aria-label="Previous echo in range"
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/45 text-white text-lg leading-none disabled:opacity-25"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => navigateRange(1)}
                disabled={!hasNext}
                aria-label="Next echo in range"
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/45 text-white text-lg leading-none disabled:opacity-25"
              >
                ›
              </button>
              <p className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                {rangeIndex + 1} of {rangeEchoes.length} in range
              </p>
            </>
          )}
          {echo.mediaUrl ? (
            echo.kind === 'image' ? (
              <img
                src={echo.mediaUrl}
                alt=""
                className="w-full object-contain max-h-[60vh] bg-black"
                onLoad={markReviewed}
              />
            ) : echo.kind === 'video' ? (
              <>
                <video
                  ref={videoRef}
                  src={echo.mediaUrl}
                  controls
                  playsInline
                  className="w-full"
                  style={lookStyle}
                  onPlay={markReviewed}
                  onEnded={markReviewed}
                />
                {hideFace && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse 42% 38% at 50% 38%, rgba(0,0,0,0.72) 0%, transparent 72%)',
                    }}
                    aria-hidden
                  />
                )}
              </>
            ) : (
              <div className="p-4">
                {echo.coverUrl ? (
                  <img
                    src={echo.coverUrl}
                    alt=""
                    className="w-full aspect-square object-cover rounded-lg mb-3"
                  />
                ) : (
                  <div className="text-center mb-3 flex justify-center">
                    <HeadphonesIcon className="w-10 h-10 opacity-60" />
                  </div>
                )}
                <audio
                  ref={audioRef}
                  src={echo.mediaUrl}
                  controls
                  className="w-full"
                  onPlay={(e) => {
                    e.currentTarget.playbackRate = voiceRate
                    markReviewed()
                  }}
                  onEnded={markReviewed}
                />
              </div>
            )
          ) : (
            <div className="p-6 text-center flex flex-col items-center gap-2">
              <EchoTypeIcon kind={echo.kind} className="w-10 h-10 opacity-60" />
              <p className="text-xs frens-muted">Media will stream once the backend is connected.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          {mine ? (
            <EchoAuraCount count={auraCount} />
          ) : (
            <EchoAuraButton
              echoId={echo.id}
              auraCount={auraCount}
              iGaveAura={iGaveAura}
              useRemote={useRemoteAura}
              onAuraChange={onAuraChange ?? onToggleAura}
            />
          )}
          {mine && (
            <label className="flex items-center gap-2 text-xs frens-muted cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(echo.allowComments)}
                onChange={(e) => onToggleComments?.(echo.id, e.target.checked)}
                className="rounded"
              />
              Allow comments
            </label>
          )}
        </div>

        {!mine && (
          <EchoComments
            echo={echo}
            profile={profile}
            onAddComment={onAddComment}
            reviewed={reviewed}
          />
        )}

        {mine && echo.allowComments && (echo.comments?.length > 0) && (
          <div className="space-y-2 border-t frens-border pt-3 mt-3">
            <p className="text-xs frens-label">Comments on your echo</p>
            <ul className="space-y-2 max-h-36 overflow-y-auto">
              {(echo.comments ?? []).map((c) => (
                <li key={c.id} className="text-xs frens-body-text">
                  <FrenHandle inline>{c.authorName}</FrenHandle> — {c.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!mine && (
          <div className="flex gap-2 mt-4">
            {echo.saved ? (
              <button
                type="button"
                onClick={() => onUnsave?.(echo.id)}
                className="frens-btn-outline flex-1 py-2.5 text-sm"
              >
                Remove from collection
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSave(echo.id)}
                disabled={!reviewed}
                className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
              >
                {reviewed ? 'Save to my collection' : 'Watch first to save'}
              </button>
            )}
          </div>
        )}
      </Modal>

      {spatialView ? (
        <SpatialEchoViewer
          echo={echo}
          onPlay={markReviewed}
          onClose={() => setSpatialView(false)}
        />
      ) : null}
    </>
  )
}
