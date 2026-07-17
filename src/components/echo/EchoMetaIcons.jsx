import { ECHO_PUBLIC_VISIBILITIES } from '../../lib/echoConstants'
import { formatRangeM } from '../../lib/echoRange'
import {
  echoKindText,
  EchoTypeIcon,
  EchoVisibilityIcon,
  echoVisibilityText,
} from './EchoMeta'

/** Icon-only meta strip — labels live in title tooltips. */
export default function EchoMetaIcons({
  kind,
  visibility,
  discoverRadiusM = null,
  onWorldClick = null,
  light = false,
  className = '',
}) {
  const showDiscover =
    discoverRadiusM != null && ECHO_PUBLIC_VISIBILITIES.has(visibility)
  const iconClass = light ? 'w-3.5 h-3.5 text-white/90' : 'w-3.5 h-3.5 frens-muted'
  const rangeClass = light
    ? 'text-[10px] text-white/90 tabular-nums font-medium'
    : 'text-[10px] frens-muted tabular-nums'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span title={echoKindText(kind, { short: true })} className="inline-flex">
        <EchoTypeIcon kind={kind} className={iconClass} />
      </span>
      {visibility === 'world' && onWorldClick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onWorldClick()
          }}
          title="Show on map"
          className="inline-flex frens-action"
        >
          <EchoVisibilityIcon visibility={visibility} className={iconClass} />
        </button>
      ) : (
        <span title={echoVisibilityText(visibility)} className="inline-flex">
          <EchoVisibilityIcon visibility={visibility} className={iconClass} />
        </span>
      )}
      {showDiscover ? (
        <span title={`Discover within ${formatRangeM(discoverRadiusM)}`} className={rangeClass}>
          {formatRangeM(discoverRadiusM)}
        </span>
      ) : null}
    </span>
  )
}
