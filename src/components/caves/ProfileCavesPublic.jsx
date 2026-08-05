import { useEffect, useState } from 'react'
import Modal from '../Modal'
import {
  listProfileCaves,
  searchPublicCaves,
  joinPublicCave,
  CavesNotInstalledError,
} from '../../lib/caves'
import { useCaves } from '../../context/CavesContext'
import CaveIcon from './CaveIcon'
import { CaveCoverThumb } from './CaveCover'
import CaveAccessLabel from '../CaveAccessLabel'

function CavesListModal({
  caves,
  myIds,
  frenName,
  joiningId,
  error,
  onClose,
  onOpenCave,
  onJoinCave,
}) {
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
            const canJoin = !canOpen && c.access === 'public'
            const busy = joiningId === c.id
            const clickable = (canOpen || canJoin) && !joiningId
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (canOpen) onOpenCave(c.id)
                    else if (canJoin) onJoinCave(c)
                  }}
                  disabled={!clickable}
                  className={`w-full text-left border frens-border rounded-xl p-3 flex items-center gap-3 transition ${
                    clickable
                      ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                      : 'opacity-90 cursor-default'
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
                  ) : canJoin ? (
                    <span className="text-xs frens-action shrink-0">
                      {busy ? 'joining…' : 'join to enter'}
                    </span>
                  ) : (
                    <span className="text-[10px] frens-hint shrink-0">invite only</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error ? (
        <p className="text-xs text-red-500 dark:text-red-400 mt-3 text-center">{error}</p>
      ) : null}
    </Modal>
  )
}

/** Cave icon on another fren's profile — tap for their shared caves. */
export default function ProfileCavesPublic({
  userId,
  frenName = 'this fren',
  onNavigate,
  onCloseProfile,
}) {
  const { myCaves, syncRemoteCaves } = useCaves()
  const [caves, setCaves] = useState([])
  const [open, setOpen] = useState(false)
  const [joiningId, setJoiningId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) {
      setCaves([])
      return undefined
    }
    let cancelled = false
    setCaves([])

    async function load() {
      try {
        let rows = await listProfileCaves(userId)
        // Fallback: owned public caves from discover list (covers lagging SQL patches).
        if (rows.length === 0) {
          const publicRows = await searchPublicCaves('').catch(() => [])
          rows = publicRows
            .filter((r) => String(r.ownerId) === String(userId))
            .map((r) => ({
              id: r.id,
              name: r.name,
              emoji: r.emoji,
              access: 'public',
              isOwner: true,
              coverUrl: r.coverUrl ?? null,
            }))
        }
        if (!cancelled) setCaves(rows)
      } catch (err) {
        if (!cancelled && !(err instanceof CavesNotInstalledError)) {
          console.error('Could not load profile caves:', err.message)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  const myIds = new Set(myCaves.map((c) => c.id))

  function openCave(id) {
    setOpen(false)
    onCloseProfile?.()
    onNavigate?.('caves', { caveId: id })
  }

  async function joinCave(cave) {
    if (!cave?.id || joiningId) return
    setJoiningId(cave.id)
    setError('')
    try {
      await joinPublicCave(cave.id)
      await syncRemoteCaves()
      openCave(cave.id)
    } catch (err) {
      if (err instanceof CavesNotInstalledError) {
        setError('Joining public caves needs a database update.')
      } else {
        setError(err.message || 'Could not join cave.')
      }
    } finally {
      setJoiningId(null)
    }
  }

  if (caves.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); setOpen(true) }}
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
          joiningId={joiningId}
          error={error}
          onClose={() => setOpen(false)}
          onOpenCave={openCave}
          onJoinCave={joinCave}
        />
      )}
    </>
  )
}
