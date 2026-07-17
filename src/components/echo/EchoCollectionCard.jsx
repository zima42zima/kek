import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import EchoPreviewMedia from './EchoPreviewMedia'
import EchoAuraButton, { EchoAuraCount } from './EchoAuraButton'
import EchoOwnerMenu from './EchoOwnerMenu'
import { EchoMetaLine } from './EchoMeta'

function logActionLabel(kind) {
  if (kind === 'video') return 'watched'
  if (kind === 'image') return 'viewed'
  return 'listened'
}

export default function EchoCollectionCard({
  echo,
  variant = 'collection',
  heardAt = null,
  ownerPreview = false,
  auraMap,
  backendReady,
  onShowOnMap,
  onView,
  onEdit,
  onDelete,
  onAuraChange,
}) {
  const isLog = variant === 'log'
  const badge = isLog ? null : (echo.mine ? 'mine' : 'saved')
  const footerHint = isLog && heardAt
    ? `${logActionLabel(echo.kind)} · ${new Date(heardAt).toLocaleDateString()}`
    : 'Tap to show on map'

  function handlePrimary() {
    if (isLog) onView?.(echo)
    else onShowOnMap?.(echo)
  }

  return (
    <article
      className="relative z-0 border frens-border rounded-xl flex gap-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
    >
      <button
        type="button"
        onClick={handlePrimary}
        className="shrink-0 w-[5.5rem] sm:w-[6.5rem] aspect-square rounded-l-xl bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden border-r frens-border"
        aria-label={isLog ? `Open ${echo.label || 'echo'}` : `Show ${echo.label || 'echo'} on map`}
      >
        <EchoPreviewMedia echo={echo} ownerPreview={ownerPreview} />
      </button>

      <button
        type="button"
        onClick={handlePrimary}
        className="min-w-0 flex-1 p-3 text-left"
      >
        <div className="flex items-center gap-2 mb-1">
          <ProfileAvatar profile={echo} className="w-7 h-7 shrink-0" logoClassName="w-4 h-auto" />
          <FrenHandle className="text-sm truncate">{echo.authorName}</FrenHandle>
          {badge ? (
            <span className="text-[10px] frens-muted border frens-border rounded-full px-2 py-0.5 shrink-0">
              {badge}
            </span>
          ) : null}
        </div>

        {echo.label ? (
          <p className="text-sm frens-body-text truncate mb-0.5">{echo.label}</p>
        ) : null}

        <div className="text-[11px] frens-hint mt-0.5">
          <EchoMetaLine
            kind={echo.kind}
            visibility={echo.visibility ?? 'world'}
            spatial={echo.spatial ? 'spatial' : null}
            discoverRadiusM={echo.discoverRadiusM}
          />
        </div>

        <p className="text-[10px] frens-muted mt-1.5">{footerHint}</p>
      </button>

      <div className="flex flex-col items-end justify-between p-2 shrink-0">
        {variant === 'collection' ? (
          <EchoOwnerMenu
            mine={echo.mine}
            onView={() => onView?.(echo)}
            onEdit={() => onEdit?.(echo)}
            onDelete={() => onDelete?.(echo.id)}
          />
        ) : (
          <span className="w-8 h-8" aria-hidden />
        )}
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {echo.mine ? (
            <EchoAuraCount count={echo.auraCount ?? 0} />
          ) : (
            <EchoAuraButton
              echoId={echo.id}
              auraCount={echo.auraCount ?? 0}
              iGaveAura={echo.iGaveAura ?? Boolean(auraMap?.[echo.id])}
              useRemote={backendReady}
              onAuraChange={onAuraChange}
            />
          )}
        </div>
      </div>
    </article>
  )
}
