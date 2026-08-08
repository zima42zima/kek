import { useCallback, useEffect, useState } from 'react'
import { FoldsSectionIcon } from './PsSectionIcons'
import {
  listPublishedFolds,
  hasPublishedFolds,
  foldSummary,
  foldInboxUnread,
} from '../../lib/foldsSocial'
import {
  FOLDS_HUB_BADGE_EVENT,
  foldsHubBadgeCount,
  markFoldsHubSeen,
} from '../../lib/profileHubBadges'
import FoldViewerModal from './FoldViewerModal'
import Modal from '../Modal'
import ProfileShareToggle from '../ProfileShareToggle'

/** Own-profile hub chip — published folds shelf (always available to you). */
export default function ProfileFolds({ userId }) {
  const [open, setOpen] = useState(false)
  const [folds, setFolds] = useState([])
  const [view, setView] = useState(null)
  const [unread, setUnread] = useState(0)
  const [badgeTick, setBadgeTick] = useState(0)

  const refreshPublished = useCallback(() => {
    if (!userId) return
    setFolds(listPublishedFolds(userId))
  }, [userId])

  const refreshUnread = useCallback(async () => {
    if (!userId) return
    try {
      setUnread(await foldInboxUnread(userId))
    } catch {
      setUnread(0)
    }
    setBadgeTick((t) => t + 1)
  }, [userId])

  useEffect(() => {
    refreshPublished()
    refreshUnread()
  }, [refreshPublished, refreshUnread])

  useEffect(() => {
    const onRefresh = () => { refreshUnread() }
    window.addEventListener(FOLDS_HUB_BADGE_EVENT, onRefresh)
    window.addEventListener('frens:notifications-refreshed', onRefresh)
    return () => {
      window.removeEventListener(FOLDS_HUB_BADGE_EVENT, onRefresh)
      window.removeEventListener('frens:notifications-refreshed', onRefresh)
    }
  }, [refreshUnread])

  useEffect(() => {
    if (!open) return
    refreshPublished()
  }, [open, refreshPublished])

  if (!userId) return null

  const badgeCount = foldsHubBadgeCount(userId, unread)
  void badgeTick

  function openModal() {
    markFoldsHubSeen(userId, unread)
    setBadgeTick((t) => t + 1)
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="profile-hub-chip"
        title="Your published folds"
        aria-label="Your published folds"
      >
        <FoldsSectionIcon className="w-[1.06rem] h-[1.06rem]" />
        {badgeCount ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[9px] frens-badge-count flex items-center justify-center">
            {badgeCount}
          </span>
        ) : null}
      </button>

      {open && (
        <Modal
          title="Published folds"
          onClose={() => setOpen(false)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <ProfileShareToggle
              showcaseKey="folds"
              label="Show folds on my profile"
              hint="You always open folds here. When on, other frens see this on your profile."
            />
            {folds.length === 0 ? (
              <p className="text-sm frens-muted text-center py-6">
                No published folds yet — publish from Folds in read me
              </p>
            ) : (
              <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                {folds.map((f) => {
                  const s = foldSummary(f)
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setView(f)}
                        className="w-full text-left border frens-border rounded-xl p-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
                      >
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-xs frens-muted">
                          {s.formatLabel}
                          {f.formatId === 'zine' ? ` · ${s.filled}/8` : s.filled > 1 ? ` · ${s.filled} pages` : ''}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {view && (
        <FoldViewerModal
          fold={view}
          onClose={() => setView(null)}
          subtitle="Your published fold as others will print it."
        />
      )}
    </>
  )
}

export { hasPublishedFolds }
