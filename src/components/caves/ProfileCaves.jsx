import { useState } from 'react'
import { useCaves } from '../../context/CavesContext'
import { cavesVisibleOnProfile } from '../../lib/caves'
import Modal from '../Modal'
import CaveIcon, { CaveGlyph } from './CaveIcon'
import CaveAccessLabel from '../CaveAccessLabel'
import CavesManager from './CavesManager'

function CavesProfileModal({ caves, onClose, onOpenCave, onManage }) {
  const visible = cavesVisibleOnProfile(caves)

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><CaveIcon className="w-5 h-5" /> Your caves</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {visible.length === 0 ? (
        <p className="text-sm frens-muted text-center py-4">
          No caves shown on your profile yet.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {visible.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpenCave(c.id)}
                className="w-full text-left border frens-border rounded-xl p-3 flex items-center gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
              >
                <CaveGlyph className="w-8 h-8 shrink-0" />
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
      <p className="text-xs frens-muted mb-3">
        Public caves you share appear here for other frens. Invite-only caves stay off your profile.
      </p>
      <button type="button" onClick={onManage} className="frens-btn-outline w-full py-2.5 text-sm">
        Manage which caves show
      </button>
    </Modal>
  )
}

/** Cave icon on your profile — tap to see caves you share with others. */
export default function ProfileCaves({ onNavigate }) {
  const { myCaves } = useCaves()
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)

  const visible = cavesVisibleOnProfile(myCaves)

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
        className="frens-btn-outline w-11 h-11 rounded-full flex items-center justify-center relative shrink-0"
        title="Your caves"
        aria-label="Your caves"
      >
        <CaveIcon className="w-5 h-5" />
        {visible.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
            {visible.length > 9 ? '9+' : visible.length}
          </span>
        )}
      </button>

      {open && !manage && (
        <CavesProfileModal
          caves={myCaves}
          onClose={() => setOpen(false)}
          onOpenCave={openCave}
          onManage={() => setManage(true)}
        />
      )}

      {manage && (
        <Modal title="Manage profile caves" onClose={() => { setManage(false); setOpen(false) }} maxWidth="max-w-sm">
          <p className="text-xs frens-muted mb-3">
            Choose which public caves show on your profile. Invite-only caves are never listed there.
          </p>
          <CavesManager onOpenCave={openCave} />
        </Modal>
      )}
    </>
  )
}
