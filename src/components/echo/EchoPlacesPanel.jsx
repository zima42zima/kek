import EchoIcon from './EchoIcon'
import { GlobeIcon, LocationIcon } from '../icons/UiIcons'
import { formatRangeM } from '../../lib/echoRange'
import { canBrowseGlobally } from '../../lib/echoPrivacy'
import { groupEchoesByPlace } from '../../lib/echoCluster'

function PlaceEchoChip({ echo, onOpen, remote = false }) {
  const global = canBrowseGlobally(echo)
  return (
    <button
      type="button"
      onClick={() => onOpen?.(echo.id)}
      className="shrink-0 w-28 rounded-xl border frens-border overflow-hidden text-left hover:ring-1 hover:ring-[#6BC06B]/40 transition"
    >
      <div className="aspect-square bg-black/5 dark:bg-white/5 relative flex items-center justify-center">
        {echo.mediaUrl ? (
          echo.kind === 'video' ? (
            <video src={echo.mediaUrl} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={echo.mediaUrl || echo.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          )
        ) : (
          <EchoIcon className="w-8 h-6 opacity-40" />
        )}
        {global ? (
          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 dark:bg-black/80 flex items-center justify-center" title="Browsable from anywhere">
            <GlobeIcon className="w-3 h-3" />
          </span>
        ) : null}
      </div>
      <div className="p-2">
        <p className="text-[10px] font-medium truncate">
          {echo.anonymous && !echo.mine ? 'a fren' : (echo.authorName || 'a fren')}
        </p>
        <p className="text-[10px] frens-muted truncate">
          {remote ? 'tap to view' : echo.distanceM != null ? formatRangeM(echo.distanceM) : 'nearby'}
        </p>
      </div>
    </button>
  )
}

export default function EchoPlacesPanel({
  cityLabel,
  placeGroups,
  onOpenEcho,
  explorePlaces = [],
}) {
  if (!placeGroups?.length && !explorePlaces?.length) return null

  return (
    <div className="space-y-4">
      {placeGroups?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <LocationIcon className="w-4 h-4 frens-muted" />
            <h3 className="text-sm font-medium">Around you{cityLabel ? ` · ${cityLabel}` : ''}</h3>
          </div>
          <div className="space-y-3">
            {placeGroups.map((group) => (
              <div key={group.placeLabel}>
                <p className="text-xs frens-muted mb-1.5">{group.placeLabel}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {group.echoes.map((echo) => (
                    <PlaceEchoChip key={echo.id} echo={echo} onOpen={onOpenEcho} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {explorePlaces?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <GlobeIcon className="w-4 h-4 frens-muted" />
            <h3 className="text-sm font-medium">Places on the map</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {explorePlaces.map((p) => (
              <button
                key={p.placeKey}
                type="button"
                onClick={() => onOpenEcho?.(null, { lat: p.lat, lon: p.lon, label: p.placeLabel })}
                className="text-xs rounded-full border frens-border px-3 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5"
              >
                <EchoIcon className="w-3.5 h-2.5" />
                {p.placeLabel || p.cityLabel}
                <span className="frens-muted">{p.echoCount}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export { groupEchoesByPlace }
