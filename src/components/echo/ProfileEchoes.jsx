import { useEffect, useState } from 'react'
import Modal from '../Modal'
import EchoIcon from './EchoIcon'
import { listProfileEchoes } from '../../lib/echoStorage'
import { echoesInstalled, listUserProfileEchoes, attachMediaUrls } from '../../lib/echoes'
import { requestEchoFocus } from '../../lib/notificationNav'

import { AuraCount } from '../AuraButton'
import { EchoKindLabel } from './EchoMeta'
import ProfileShareToggle from '../ProfileShareToggle'

function EchoesProfileModal({ echoes, onClose, onOpenEcho }) {
  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><EchoIcon className="w-[1.06rem] h-[0.85rem]" /> Your aftersounds</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="space-y-3">
        <ProfileShareToggle
          showcaseKey="echoes"
          label="Show aftersounds on my profile"
          hint="You always open aftersounds here or on the map. When on, other frens see this icon on your profile."
        />
        {echoes.length === 0 ? (
          <p className="text-sm frens-muted text-center py-6">
            No public aftersounds yet. Leave a <strong>world</strong> aftersound on the map to list it here.
          </p>
        ) : (
          <ul className="space-y-2">
            {echoes.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenEcho(e.id)}
                  className="w-full text-left border frens-border rounded-xl p-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <EchoKindLabel kind={e.kind} short className="frens-title-sm" />
                    {(e.auraCount ?? 0) > 0 && (
                      <AuraCount count={e.auraCount ?? 0} />
                    )}
                  </div>
                  {e.label ? (
                    <p className="text-xs frens-body-text mt-1 truncate">{e.label}</p>
                  ) : null}
                  <p className="text-xs frens-muted mt-1">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : 'recent'}
                    {' '}· on the map
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] frens-hint text-center">
          Private memories stay off the public list. World aftersounds can appear when sharing is on.
        </p>
      </div>
    </Modal>
  )
}

/** Bat icon on your profile — tap to see public echoes you share. */
export default function ProfileEchoes({ userId, onNavigate, onOpenEcho }) {
  const [open, setOpen] = useState(false)
  const [echoes, setEchoes] = useState([])

  useEffect(() => {
    if (!userId || !open) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await echoesInstalled()
        if (ok) {
          const rows = await listUserProfileEchoes(userId, userId)
          const withUrls = await attachMediaUrls(rows)
          if (!cancelled) setEchoes(withUrls)
          return
        }
      } catch { /* fallback */ }
      if (!cancelled) setEchoes(listProfileEchoes(userId))
    })()
    return () => { cancelled = true }
  }, [userId, open])

  function openEcho(echoId) {
    requestEchoFocus(echoId)
    onOpenEcho?.(echoId)
    onNavigate?.('echoes')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="frens-btn-outline w-[2.34rem] h-[2.34rem] rounded-full flex items-center justify-center relative shrink-0 text-black dark:text-white"
        title="Your aftersounds"
        aria-label="Your aftersounds"
      >
        <EchoIcon className="w-[1.06rem] h-[0.85rem]" />
      </button>

      {open && (
        <EchoesProfileModal
          echoes={echoes}
          onClose={() => setOpen(false)}
          onOpenEcho={openEcho}
        />
      )}
    </>
  )
}
