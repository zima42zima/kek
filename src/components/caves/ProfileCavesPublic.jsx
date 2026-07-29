import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { listProfileCaves, CavesNotInstalledError } from '../../lib/caves'
import { useCaves } from '../../context/CavesContext'
import CaveIcon, { CaveGlyph } from './CaveIcon'
import CaveAccessLabel from '../CaveAccessLabel'

function CavesListModal({ caves, myIds, frenName, onClose, onOpenCave }) {
  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><CaveIcon className="w-5 h-5" /> {frenName}&apos;s caves</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {caves.length === 0 ? (
        <p className="text-sm frens-muted text-center py-6">No caves shared on profile yet.</p>
      ) : (
        <ul className="space-y-2">
          {caves.map((c) => {
            const canOpen = myIds.has(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => canOpen && onOpenCave(c.id)}
                  disabled={!canOpen}
                  className={`w-full text-left border frens-border rounded-xl p-3 flex items-center gap-3 transition ${
                    canOpen ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]' : 'opacity-90 cursor-default'
                  }`}
                >
                  <CaveGlyph className="w-8 h-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="frens-title-sm truncate">{c.name}</p>
                    <p className="text-xs frens-muted inline-flex items-center gap-1 flex-wrap">
                      <CaveAccessLabel access={c.access} />
                      {c.isOwner ? ' · owner' : ''}
                    </p>
                  </div>
                  {canOpen ? (
                    <span className="text-xs frens-action shrink-0">open</span>
                  ) : (
                    <span className="text-[10px] frens-hint shrink-0">
                      {c.access === 'public' ? 'join to enter' : 'invite only'}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

/** Cave icon on another fren's profile — tap for their shared caves. */
export default function ProfileCavesPublic({ userId, frenName = 'this fren', onNavigate }) {
  const { myCaves } = useCaves()
  const [caves, setCaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listProfileCaves(userId)
      .then((rows) => { if (!cancelled) setCaves(rows) })
      .catch((err) => {
        if (!cancelled && !(err instanceof CavesNotInstalledError)) {
          console.error('Could not load profile caves:', err.message)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  const myIds = new Set(myCaves.map((c) => c.id))

  function openCave(id) {
    onNavigate?.('caves', { caveId: id })
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="frens-btn-outline w-11 h-11 rounded-full flex flex-col items-center justify-center gap-0.5 relative shrink-0"
        title={`${frenName}'s caves`}
        aria-label={`${frenName}'s caves`}
      >
        <CaveIcon className="w-5 h-5" />
        {!loading && caves.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
            {caves.length > 9 ? '9+' : caves.length}
          </span>
        )}
      </button>

      {open && (
        <CavesListModal
          caves={caves}
          myIds={myIds}
          frenName={frenName}
          onClose={() => setOpen(false)}
          onOpenCave={openCave}
        />
      )}
    </>
  )
}
