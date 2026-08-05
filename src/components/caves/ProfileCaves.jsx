import { useEffect, useState } from 'react'
import { useCaves } from '../../context/CavesContext'
import { cavesVisibleOnProfile } from '../../lib/caves'
import Modal from '../Modal'
import CaveIcon from './CaveIcon'
import { CaveCoverThumb } from './CaveCover'
import CaveAccessLabel from '../CaveAccessLabel'
import CavesManager from './CavesManager'
import ProfileShareToggle from '../ProfileShareToggle'

function CavesProfileModal({ caves, ownerId, onClose, onOpenCave, onManage, onShowcaseEnabled }) {
  const visible = cavesVisibleOnProfile(caves, ownerId)

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><CaveIcon className="w-[1.06rem] h-[1.06rem]" /> Your caves</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="space-y-3">
        <ProfileShareToggle
          showcaseKey="caves"
          label="Show caves on my profile"
          hint="Per-cave: mark a public cave you own as Shown on profile — other frens then see your cave icon."
          onChange={(enabled) => { if (enabled) onShowcaseEnabled?.() }}
        />
        {visible.length === 0 ? (
          <p className="text-sm frens-muted text-center py-4">
            No caves listed yet — join or create one, then manage visibility below.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenCave(c.id)}
                  className="w-full text-left border frens-border rounded-xl p-3 flex items-center gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
                >
                  <CaveCoverThumb coverUrl={c.coverUrl} className="w-10 h-10" />
                  <div className="min-w-0 flex-1">
                    <p className="frens-title-sm truncate">{c.name}</p>
                    <CaveAccessLabel access={c.access} />
                  </div>
                  <span className="text-xs frens-action shrink-0">open</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onManage} className="frens-btn-outline w-full py-2.5 text-sm">
          Manage which caves show
        </button>
      </div>
    </Modal>
  )
}

/** Cave icon on your profile — tap to see caves you share with others. */
export default function ProfileCaves({ onNavigate }) {
  const { myCaves, meId, pushProfileCavesToServer } = useCaves()
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)

  const visible = cavesVisibleOnProfile(myCaves, meId)

  useEffect(() => {
    if (!open) return
    pushProfileCavesToServer()
  }, [open, pushProfileCavesToServer])

  function openCave(id) {
    onNavigate?.('caves', { caveId: id })
    setOpen(false)
    setManage(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="profile-hub-chip"
        title="Your caves"
        aria-label="Your caves"
      >
        <CaveIcon className="w-[1.06rem] h-[1.06rem]" />
      </button>

      {open && !manage && (
        <CavesProfileModal
          caves={myCaves}
          ownerId={meId}
          onClose={() => setOpen(false)}
          onOpenCave={openCave}
          onManage={() => setManage(true)}
          onShowcaseEnabled={pushProfileCavesToServer}
        />
      )}

      {manage && (
        <Modal title="Manage profile caves" onClose={() => { setManage(false); setOpen(false) }} maxWidth="max-w-sm">
          <p className="text-xs frens-muted mb-3">
            Choose which of your public caves show on your profile. Joined caves and invite-only caves are never listed there.
          </p>
          <CavesManager onOpenCave={openCave} />
        </Modal>
      )}
    </>
  )
}
