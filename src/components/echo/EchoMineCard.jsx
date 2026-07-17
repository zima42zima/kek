import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import EchoPreviewMedia from './EchoPreviewMedia'
import EchoMetaIcons from './EchoMetaIcons'
import { EchoAuraCount } from './EchoAuraButton'
import EchoOwnerMenu from './EchoOwnerMenu'
import { canBrowseGlobally } from '../../lib/echoPrivacy'

function MineCardOverlay({ echo, global }) {
  return (
    <>
      {global ? (
        <span
          className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-[11px]"
          title="Browsable from anywhere"
        >
          🌍
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent pt-8 pb-2 px-2 flex items-end justify-between gap-2">
        <EchoMetaIcons
          kind={echo.kind}
          visibility={echo.visibility ?? 'world'}
          discoverRadiusM={echo.discoverRadiusM}
          light
        />
        <EchoAuraCount count={echo.auraCount ?? 0} compact className="shrink-0" />
      </div>
    </>
  )
}

function MineCardFooter({ echo, showAuthor }) {
  if (!echo.label && !showAuthor) return null
  return (
    <div className="px-2.5 py-2 flex items-center gap-2 min-w-0 border-t frens-border">
      {showAuthor ? (
        <>
          <ProfileAvatar profile={echo} className="w-5 h-5 shrink-0" logoClassName="w-3 h-auto" />
          <FrenHandle className="text-[11px] truncate shrink-0 max-w-[5rem]">{echo.authorName}</FrenHandle>
          {echo.label ? (
            <span className="text-[11px] frens-muted truncate min-w-0">{echo.label}</span>
          ) : null}
        </>
      ) : (
        <p className="text-xs frens-body-text truncate">{echo.label}</p>
      )}
    </div>
  )
}

export default function EchoMineCard({
  echo,
  layout = 'board',
  onShowOnMap,
  onView,
  onEdit,
  onDelete,
}) {
  const global = canBrowseGlobally(echo)
  const showAuthor = !echo.mine

  if (layout === 'list') {
    return (
      <article className="relative border frens-border rounded-xl overflow-hidden flex gap-0 bg-black/[0.02] dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={() => onShowOnMap?.(echo)}
          className="relative shrink-0 w-[5.5rem] sm:w-[6rem] aspect-square bg-black/5 dark:bg-white/5 overflow-hidden border-r frens-border"
          aria-label={echo.label ? `Show ${echo.label} on map` : 'Show echo on map'}
        >
          <EchoPreviewMedia echo={echo} ownerPreview={echo.mine} />
          {global ? (
            <span
              className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-[9px]"
              title="Browsable from anywhere"
            >
              🌍
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => onShowOnMap?.(echo)}
          className="min-w-0 flex-1 p-2.5 text-left flex flex-col justify-center gap-1"
        >
          {echo.label ? (
            <p className="text-sm frens-body-text truncate">{echo.label}</p>
          ) : null}
          <EchoMetaIcons
            kind={echo.kind}
            visibility={echo.visibility ?? 'world'}
            discoverRadiusM={echo.discoverRadiusM}
          />
        </button>

        <div className="flex flex-col items-end justify-between p-2 shrink-0">
          <EchoOwnerMenu
            mine={echo.mine}
            onView={() => onView?.(echo)}
            onEdit={() => onEdit?.(echo)}
            onDelete={() => onDelete?.(echo.id)}
          />
          <EchoAuraCount count={echo.auraCount ?? 0} />
        </div>
      </article>
    )
  }

  return (
    <article className="relative border frens-border rounded-xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => onShowOnMap?.(echo)}
        className="relative block w-full aspect-[4/3] bg-black/5 dark:bg-white/5 text-left"
        aria-label={echo.label ? `Show ${echo.label} on map` : 'Show echo on map'}
      >
        <EchoPreviewMedia echo={echo} ownerPreview={echo.mine} />
        <MineCardOverlay echo={echo} global={global} />
      </button>

      <div className="absolute top-2 right-2 z-10 rounded-full bg-black/35 backdrop-blur-sm">
        <EchoOwnerMenu
          mine={echo.mine}
          onView={() => onView?.(echo)}
          onEdit={() => onEdit?.(echo)}
          onDelete={() => onDelete?.(echo.id)}
        />
      </div>

      <MineCardFooter echo={echo} showAuthor={showAuthor} />
    </article>
  )
}
