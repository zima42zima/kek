import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import EchoPreviewMedia from './EchoPreviewMedia'
import EchoMetaIcons from './EchoMetaIcons'
import EchoAuraButton, { EchoAuraCount } from './EchoAuraButton'
import EchoOwnerMenu from './EchoOwnerMenu'
import { canBrowseGlobally } from '../../lib/echoPrivacy'

function GlobalBadge({ compact = false }) {
  return (
    <span
      className={`absolute ${compact ? 'top-1.5 left-1.5 w-5 h-5 text-[9px]' : 'top-2 left-2 w-6 h-6 text-[11px]'} rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center`}
      title="Browsable from anywhere"
    >
      🌍
    </span>
  )
}

function CardOverlay({ echo, global, auraSlot, onNavigateWorld }) {
  const worldNav = echo.visibility === 'world' && onNavigateWorld
    ? () => onNavigateWorld(echo)
    : null
  return (
    <>
      {global ? <GlobalBadge /> : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent pt-8 pb-2 px-2 flex items-end justify-between gap-2">
        <EchoMetaIcons
          kind={echo.kind}
          visibility={echo.visibility ?? 'world'}
          discoverRadiusM={echo.discoverRadiusM}
          onWorldClick={worldNav}
          light
        />
        <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {auraSlot}
        </div>
      </div>
    </>
  )
}

function MineCardFooter({ echo, showAuthor }) {
  const note = (echo.title || echo.label || '').trim()
  if (!note && !showAuthor) return null
  return (
    <div className="px-2.5 py-2 flex items-center gap-2 min-w-0 border-t frens-border">
      {showAuthor ? (
        <>
          <ProfileAvatar profile={echo} className="w-5 h-5 shrink-0" logoClassName="w-3 h-auto" />
          <FrenHandle className="text-[11px] truncate shrink-0 max-w-[5rem]">{echo.authorName}</FrenHandle>
          {note ? (
            <span className="text-[11px] frens-muted truncate min-w-0">{note}</span>
          ) : null}
        </>
      ) : (
        <p className="text-xs frens-body-text truncate">{note}</p>
      )}
    </div>
  )
}

function SavedCardFooter({ echo, savedAt }) {
  return (
    <div className="px-2.5 py-2 flex items-center gap-2 min-w-0 border-t frens-border">
      <ProfileAvatar profile={echo} className="w-5 h-5 shrink-0" logoClassName="w-3 h-auto" />
      <FrenHandle className="text-[11px] truncate min-w-0 flex-1">{echo.authorName || 'a fren'}</FrenHandle>
      {savedAt ? (
        <span className="text-[10px] frens-muted shrink-0 tabular-nums">
          saved · {new Date(savedAt).toLocaleDateString()}
        </span>
      ) : null}
    </div>
  )
}

export default function EchoMineCard({
  echo,
  layout = 'board',
  variant = 'mine',
  savedAt = null,
  auraMap,
  backendReady,
  onShowOnMap,
  onNavigateWorld,
  onView,
  onEdit,
  onDelete,
  onUnsave,
  onAuraChange,
}) {
  const isSaved = variant === 'saved'
  const global = canBrowseGlobally(echo)
  const showAuthor = !echo.mine && !isSaved

  const auraSlot = isSaved ? (
    <EchoAuraButton
      echoId={echo.id}
      auraCount={echo.auraCount ?? 0}
      iGaveAura={echo.iGaveAura ?? Boolean(auraMap?.[echo.id])}
      useRemote={backendReady}
      onAuraChange={onAuraChange}
      className="text-[10px] text-white/90 min-h-0 px-0.5 py-0 gap-1 hover:bg-white/10"
    />
  ) : (
    <EchoAuraCount count={echo.auraCount ?? 0} compact className="shrink-0" />
  )

  const menu = (
    <EchoOwnerMenu
      mine={!isSaved && echo.mine}
      saved={isSaved}
      onView={() => onView?.(echo)}
      onShowOnMap={onShowOnMap ? () => onShowOnMap?.(echo) : undefined}
      onEdit={() => onEdit?.(echo)}
      onDelete={() => onDelete?.(echo.id)}
      onUnsave={isSaved ? () => onUnsave?.(echo) : undefined}
    />
  )

  if (layout === 'list') {
    return (
      <article className="relative border frens-border rounded-xl overflow-hidden flex gap-0 bg-black/[0.02] dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={() => onView?.(echo)}
          className="relative shrink-0 w-[5.5rem] sm:w-[6rem] aspect-square bg-black/5 dark:bg-white/5 overflow-hidden border-r frens-border"
          aria-label={isSaved ? `Open ${echo.authorName || 'echo'}` : (echo.label ? `Open ${echo.label}` : 'Open echo')}
        >
          <EchoPreviewMedia echo={echo} ownerPreview={!isSaved && echo.mine} watchedPreview={isSaved} />
          {global ? <GlobalBadge compact /> : null}
        </button>

        <button
          type="button"
          onClick={() => onView?.(echo)}
          className="min-w-0 flex-1 p-2.5 text-left flex flex-col justify-center gap-1"
        >
          {isSaved ? (
            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
              <ProfileAvatar profile={echo} className="w-5 h-5 shrink-0" logoClassName="w-3 h-auto" />
              <FrenHandle className="text-xs truncate">{echo.authorName || 'a fren'}</FrenHandle>
            </div>
          ) : (echo.title || echo.label) ? (
            <p className="text-sm frens-body-text truncate">{(echo.title || echo.label).trim()}</p>
          ) : null}
          <EchoMetaIcons
            kind={echo.kind}
            visibility={echo.visibility ?? 'world'}
            discoverRadiusM={echo.discoverRadiusM}
            onWorldClick={
              echo.visibility === 'world' && onNavigateWorld
                ? () => onNavigateWorld(echo)
                : null
            }
          />
          {isSaved && savedAt ? (
            <p className="text-[10px] frens-muted">
              saved · {new Date(savedAt).toLocaleDateString()}
            </p>
          ) : null}
        </button>

        <div className="flex flex-col items-end justify-between p-2 shrink-0">
          {menu}
          {isSaved ? (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {auraSlot}
            </div>
          ) : (
            <EchoAuraCount count={echo.auraCount ?? 0} />
          )}
        </div>
      </article>
    )
  }

  return (
    <article className="relative border frens-border rounded-xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => onView?.(echo)}
        className="relative block w-full aspect-[4/3] bg-black/5 dark:bg-white/5 text-left"
        aria-label={isSaved ? `Open ${echo.authorName || 'echo'}` : (echo.label ? `Open ${echo.label}` : 'Open echo')}
      >
        <EchoPreviewMedia echo={echo} ownerPreview={!isSaved && echo.mine} watchedPreview={isSaved} />
        <CardOverlay echo={echo} global={global} auraSlot={auraSlot} onNavigateWorld={onNavigateWorld} />
      </button>

      <div className="absolute top-2 right-2 z-10 rounded-full bg-black/35 backdrop-blur-sm">
        {menu}
      </div>

      {isSaved ? (
        <SavedCardFooter echo={echo} savedAt={savedAt} />
      ) : (
        <MineCardFooter echo={echo} showAuthor={showAuthor} />
      )}
    </article>
  )
}
