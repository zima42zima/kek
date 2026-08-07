import { ECHO_RANGE_PRESETS } from '../../lib/echoConstants'
import { OPTION_ACTIVE } from '../icons/UiIcons'

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
