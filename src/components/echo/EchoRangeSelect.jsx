import { ECHO_PROXIMITY_PRESETS } from '../../lib/echoConstants'
import { OPTION_ACTIVE } from '../icons/UiIcons'

function presetForMeters(meters) {
  return (
    ECHO_PROXIMITY_PRESETS.find((p) => p.meters === meters)
    || ECHO_PROXIMITY_PRESETS.find((p) => p.id === 'area')
    || ECHO_PROXIMITY_PRESETS[0]
  )
}

/** Compact Exact · Area · City proximity chips for publish / edit. */
export function EchoDiscoverRadiusPicker({ value, onChange, className = '' }) {
  const activeId = presetForMeters(value)?.id

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs frens-muted text-center">Proximity</p>
      <div className="flex gap-1.5 justify-center flex-wrap">
        {ECHO_PROXIMITY_PRESETS.map((preset) => {
          const active = activeId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.meters, preset)}
              className={`min-w-[4.25rem] px-3.5 py-2 rounded-full border text-sm font-medium transition ${
                active
                  ? OPTION_ACTIVE
                  : 'frens-border frens-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
