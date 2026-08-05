import { useCaves } from '../../context/CavesContext'
import { CaveGlyph } from './CaveIcon'
import CaveAccessLabel from '../CaveAccessLabel'

// Shared management list for a user's caves: open, show/hide on profile, and
// (owners only) flip public vs invite-only. Reused on the profile and in Edit
// profile so cave setup lives in both places.
export default function CavesManager({ onOpenCave }) {
  const { myCaves, meId, setCaveHidden, setCaveAccess } = useCaves()

  if (myCaves.length === 0) {
    return <p className="text-sm frens-muted">You haven&apos;t created or joined any caves yet.</p>
  }

  return (
    <ul className="space-y-2">
      {myCaves.map((c) => {
        const shown = !c.hiddenOnProfile
        const isOwner = String(c.ownerId) === String(meId)
        const isPublic = c.access === 'public'
        return (
          <li key={c.id} className="border frens-border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenCave?.(c.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
                title={`Open ${c.name}`}
              >
                <CaveGlyph className="w-5 h-5 shrink-0" />
                <span className="min-w-0">
                  <span className="text-sm truncate block">{c.name}</span>
                  <span className="text-[11px] frens-hint">{isOwner ? 'you own this' : 'joined'}</span>
                </span>
              </button>
              <CaveAccessLabel access={c.access} />
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {isOwner && isPublic ? (
                <button
                  type="button"
                  onClick={() => setCaveHidden(c.id, shown)}
                  aria-pressed={shown}
                  className={`text-xs px-3 py-1 rounded-full ${shown ? 'frens-btn-primary' : 'frens-btn-outline'}`}
                  title={shown ? 'Shown on profile — tap to hide' : 'Hidden — tap to show'}
                >
                  {shown ? 'Shown on profile' : 'Hidden'}
                </button>
              ) : !isOwner ? (
                <span className="text-[11px] frens-hint">joined · only owners can list on profile</span>
              ) : (
                <span className="text-[11px] frens-hint">invite-only · not on profile</span>
              )}
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setCaveAccess(c.id, isPublic ? 'invite' : 'public')}
                  className="text-xs px-3 py-1 rounded-full frens-btn-outline"
                  title="Choose who can join"
                >
                  {isPublic ? 'Make invite-only' : 'Make public to join'}
                </button>
              ) : (
                <span className="text-[11px] frens-hint">owner controls access</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
