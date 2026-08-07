import { useEffect, useRef, useState, useMemo } from 'react'
import Modal from '../Modal'
import { ProfileAvatar } from '../FrogLogo'
import { BatAvatar } from './EchoIcon'
import EchoAuraButton, { EchoAuraCount } from './EchoAuraButton'
import EchoComments from './EchoComments'
import PostReactionButton from '../PostReactionButton'
import FrenHandle from '../FrenHandle'
import SpatialEchoViewer from './SpatialEchoViewer'
import { ECHO_LOOK_FILTERS, ECHO_VOICE_FILTERS } from '../../lib/echoConstants'
import { spatialTierLabel } from '../../lib/spatialEcho'
import { senseFilterLabel, normalizeSenseFilter, lidarFilterLabel } from '../../lib/senseFilters'
import { EchoMetaLine, EchoTypeIcon } from './EchoMeta'
import { HeadphonesIcon, LocationIcon, BookmarkIcon } from '../icons/UiIcons'
import useLiveAuthorProfile from '../../hooks/useLiveAuthorProfile'
import { withLiveAuthorAvatar } from '../../lib/posts'
import ReportContentButton from '../ReportContentButton'

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
  onRemoveComment,
  onToggleCommentReaction,
  onToggleCommentAura,
  onToggleComments,
  onToggleReaction,
  onReviewed,
  onDelete,
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
  const canReact = Boolean(onToggleReaction)

  const isAnon = Boolean(echo.anonymous) && !mine
  const liveAuthor = useLiveAuthorProfile(!mine && !isAnon ? echo.ownerId : null)

  const displayEcho = useMemo(() => {
    if (isAnon) {
      return {
        ...echo,
        authorName: 'a fren',
        avatarUrl: null,
        ownerId: null,
      }
    }
    if (mine && (profile?.id || profile?.userId)) {
      return withLiveAuthorAvatar(echo, {
        id: profile.id || profile.userId,
        avatarType: profile.avatarType,
        avatarUrl: profile.avatarUrl,
      })
    }
    if (liveAuthor) {
      return {
        ...withLiveAuthorAvatar(echo, liveAuthor),
        authorName: liveAuthor.frenName || echo.authorName,
      }
    }
    return echo
  }, [echo, mine, profile, liveAuthor, isAnon])

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

  useEffect(() => {
    if (!canRangeSwipe || spatialView || !onRangeEchoChange) return undefined

    function isTypingTarget(el) {
      if (!el) return false
      const tag = el.tagName?.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
    }

    function onKey(e) {
      if (isTypingTarget(e.target)) return
      if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault()
        onRangeEchoChange(rangeEchoes[rangeIndex - 1].id)
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault()
        onRangeEchoChange(rangeEchoes[rangeIndex + 1].id)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canRangeSwipe, spatialView, hasPrev, hasNext, rangeIndex, rangeEchoes, onRangeEchoChange])

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
      <Modal
        title={null}
        onClose={onClose}
        maxWidth="max-w-sm"
        blurBackdrop={false}
      >
        <div className="flex items-center gap-3 mb-4">
          {isAnon ? (
            <BatAvatar className="w-11 h-11" />
          ) : (
            <ProfileAvatar
              profile={displayEcho}
              className="w-11 h-11"
              logoClassName="w-7 h-auto"
            />
          )}
          <div className="min-w-0 flex-1">
            <FrenHandle>{displayEcho.authorName}</FrenHandle>
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
          {!mine && !isAnon && echo.ownerId && onOpenProfile && (
            <button
              type="button"
              onClick={() => onOpenProfile(echo.ownerId)}
              className="text-xs frens-action shrink-0"
            >
              profile
            </button>
          )}
        </div>

        {(() => {
          const title = (echo.title || '').trim()
          if (!title || /^[.…·•\s]+$/.test(title)) return null
          return (
            <p className="text-sm frens-body-text text-center mb-3 px-1 leading-snug">
              {title}
            </p>
          )
        })()}

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
          className={`relative rounded-xl bg-black/30 overflow-hidden mb-3 ${canRangeSwipe ? 'touch-pan-x' : ''}`}
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
                {rangeIndex + 1} of {rangeEchoes.length} · swipe
              </p>
            </>
          )}
          {echo.mediaUrl ? (
            echo.kind === 'image' ? (
              <img
                src={echo.mediaUrl}
                alt=""
                className="w-full object-contain max-h-[min(48vh,420px)] bg-black"
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

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
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
            <PostReactionButton
              reactions={echo.reactions ?? []}
              onReact={canReact ? (id) => onToggleReaction(echo.id, id) : undefined}
            />
          </div>
          {mine ? (
            <label className="flex items-center gap-2 text-xs frens-muted cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={Boolean(echo.allowComments)}
                onChange={(e) => onToggleComments?.(echo.id, e.target.checked)}
                className="rounded"
              />
              Allow comments
            </label>
          ) : (
            <div className="flex items-center gap-0.5 ml-auto shrink-0">
              <button
                type="button"
                onClick={() => (echo.saved ? onUnsave?.(echo.id) : onSave?.(echo.id))}
                disabled={!echo.saved && !reviewed}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition disabled:opacity-30 ${
                  echo.saved
                    ? 'text-black dark:text-white'
                    : 'frens-muted opacity-45 hover:opacity-100 hover:text-black dark:hover:text-white'
                }`}
                aria-label={echo.saved ? 'Remove from collection' : reviewed ? 'Save to my collection' : 'Watch first to save'}
                title={echo.saved ? 'Remove from collection' : reviewed ? 'Save to my collection' : 'Watch first to save'}
              >
                <BookmarkIcon className="w-4 h-4" filled={Boolean(echo.saved)} />
              </button>
              {echo.id ? (
                <ReportContentButton
                  kind="echo"
                  refId={echo.id}
                  reportedUserId={isAnon ? null : echo.ownerId}
                  preview={echo.title || echo.caption || displayEcho.authorName}
                  subjectLabel="this echo"
                  variant="flag"
                  className="w-8 h-8 opacity-45 hover:opacity-100"
                />
              ) : null}
            </div>
          )}
        </div>

        {!mine && (
          <EchoComments
            echo={echo}
            reviewed={reviewed}
            onAddComment={onAddComment}
            onRemoveComment={onRemoveComment}
            onToggleCommentReaction={onToggleCommentReaction}
            onToggleCommentAura={onToggleCommentAura}
          />
        )}

        {mine && echo.allowComments && (
          <EchoComments
            echo={echo}
            reviewed
            requireReviewed={false}
            canCompose={false}
            onRemoveComment={onRemoveComment}
            onToggleCommentReaction={onToggleCommentReaction}
            onToggleCommentAura={onToggleCommentAura}
          />
        )}

        {mine && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(echo.id)}
            className="frens-btn-outline w-full mt-4 py-2.5 text-sm"
          >
            Delete echo
          </button>
        ) : null}
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
