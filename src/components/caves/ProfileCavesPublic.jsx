import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { listProfileCaves, CavesNotInstalledError } from '../../lib/caves'
import { useCaves } from '../../context/CavesContext'
import CaveIcon from './CaveIcon'
import { CaveCoverThumb } from './CaveCover'
import CaveAccessLabel from '../CaveAccessLabel'

function CavesListModal({ caves, myIds, frenName, onClose, onOpenCave }) {
  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><CaveIcon className="w-[1.06rem] h-[1.06rem]" /> {frenName}&apos;s caves</span>}
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
                  <CaveCoverThumb coverUrl={c.coverUrl} className="w-10 h-10" />
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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId) {
      setCaves([])
      return undefined
    }
    let cancelled = false
    setCaves([])
    listProfileCaves(userId)
      .then((rows) => {
        if (!cancelled) setCaves(rows)
      })
      .catch((err) => {
        if (!cancelled && !(err instanceof CavesNotInstalledError)) {
          console.error('Could not load profile caves:', err.message)
        }
      })
    return () => { cancelled = true }
  }, [userId])

  const myIds = new Set(myCaves.map((c) => c.id))

  function openCave(id) {
    onNavigate?.('caves', { caveId: id })
    setOpen(false)
  }

  if (caves.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="profile-hub-chip profile-hub-chip--stack"
        title={`${frenName}'s caves`}
        aria-label={`${frenName}'s caves`}
      >
        <CaveIcon className="w-[1.06rem] h-[1.06rem]" />
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
