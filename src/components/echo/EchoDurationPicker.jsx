import { DURATIONS } from '../../lib/echoConstants'
import { OPTION_ACTIVE, OPTION_IDLE } from '../icons/UiIcons'

export default function EchoDurationPicker({ value, onChange, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-sm frens-body-text text-center">How long should it linger?</p>
      <p className="text-xs frens-muted text-center -mt-1">
        Fades from the map after — your archive keeps a copy.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onChange(d.id)}
            className={`text-left rounded-xl border p-3 transition ${
              value === d.id ? OPTION_ACTIVE : OPTION_IDLE
            }`}
          >
            <span className="font-medium text-sm">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function durationToExpiresAt(durationId) {
  const row = DURATIONS.find((d) => d.id === durationId)
  if (!row?.ms) return null
  return new Date(Date.now() + row.ms).toISOString()
}
