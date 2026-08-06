import { useEffect, useState } from 'react'
import Modal from '../Modal'
import EchoIcon from './EchoIcon'
import { listProfileEchoes } from '../../lib/echoStorage'
import { echoesInstalled, listUserProfileEchoes, attachMediaUrls } from '../../lib/echoes'
import { requestEchoFocus } from '../../lib/notificationNav'

import { AuraCount } from '../AuraButton'
import { EchoKindLabel } from './EchoMeta'
import EchoPreviewMedia from './EchoPreviewMedia'

function EchoesListModal({ echoes, frenName, onClose, onFindOnMap }) {
  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><EchoIcon className="w-[1.06rem] h-[0.85rem]" /> {frenName}&apos;s echoes</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {echoes.length === 0 ? (
        <p className="text-sm frens-muted text-center py-6">
          No public echoes on profile yet — check the map when you&apos;re nearby.
        </p>
      ) : (
        <ul className="space-y-2">
          {echoes.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onFindOnMap(e.id)}
                className="w-full text-left border frens-border rounded-xl overflow-hidden flex gap-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
              >
                <div className="relative shrink-0 w-[4.25rem] aspect-square bg-black/5 dark:bg-white/5 overflow-hidden border-r frens-border">
                  <EchoPreviewMedia echo={e} watchedPreview />
                </div>
                <div className="min-w-0 flex-1 p-2.5 flex flex-col justify-center gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <EchoKindLabel kind={e.kind} short className="frens-title-sm" />
                    {(e.auraCount ?? 0) > 0 && (
                      <AuraCount count={e.auraCount ?? 0} />
                    )}
                  </div>
                  {e.label ? (
                    <p className="text-xs frens-body-text truncate">{e.label}</p>
                  ) : null}
                  <p className="text-xs frens-muted">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : 'recent'}
                    {' '}· find on map when you&apos;re close
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] frens-hint text-center mt-4">
        Echoes stay on the map until deleted — walk within ~80m to listen.
      </p>
    </Modal>
  )
}

/** Bat icon on another fren's profile — tap for their public echoes. */
export default function ProfileEchoesPublic({ userId, frenName = 'this fren', onNavigate, onOpenEcho, onCloseProfile }) {
  const [open, setOpen] = useState(false)
  const [echoes, setEchoes] = useState([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await echoesInstalled()
        if (ok) {
          const rows = await listUserProfileEchoes(userId, userId)
          if (!cancelled) setEchoes(rows)
          return
        }
      } catch { /* fallback */ }
      if (!cancelled) setEchoes(listProfileEchoes(userId))
    })()
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!open || echoes.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await echoesInstalled()
        if (ok) {
          const rows = await listUserProfileEchoes(userId, userId)
          const withUrls = await attachMediaUrls(rows)
          if (!cancelled) setEchoes(withUrls)
        }
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [open, userId, echoes.length])

  function findOnMap(echoId) {
    requestEchoFocus(echoId)
    onOpenEcho?.(echoId)
    onNavigate?.('echoes')
    setOpen(false)
    onCloseProfile?.()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="profile-hub-chip profile-hub-chip--stack"
        title={`${frenName}'s echoes`}
        aria-label={`${frenName}'s echoes`}
      >
        <EchoIcon className="profile-hub-icon--echo" />
      </button>

      {open && (
        <EchoesListModal
          echoes={echoes}
          frenName={frenName}
          onClose={() => setOpen(false)}
          onFindOnMap={findOnMap}
        />
      )}
    </>
  )
}
