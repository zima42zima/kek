import { ECHO_RANGE_PRESETS } from '../../lib/echoConstants'
import { formatRangeM } from '../../lib/echoRange'
import { OPTION_ACTIVE } from '../icons/UiIcons'

export default function EchoSearchRadiusSelect({ value, onChange, cityLabel, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs frens-muted">
          Search {cityLabel ? `near ${cityLabel}` : 'your area'}
        </p>
        <span className="text-[10px] frens-hint shrink-0">{formatRangeM(value)}</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {ECHO_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.meters)}
            title={preset.hint}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              value === preset.meters ? OPTION_ACTIVE : 'frens-border frens-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function EchoDiscoverRadiusPicker({ value, onChange, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-sm frens-body-text text-center">How close must someone be?</p>
      <p className="text-xs frens-muted text-center -mt-1">
        Frens discover your echo when they walk within this range. Exact pin stays hidden.
      </p>
      <div className="grid gap-2">
        {ECHO_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.meters)}
            className={`text-left rounded-xl border p-3 transition ${
              value === preset.meters ? OPTION_ACTIVE : 'frens-border hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
            }`}
          >
            <span className="font-medium text-sm">{preset.label}</span>
            <p className="text-xs frens-muted mt-0.5">{preset.hint}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
