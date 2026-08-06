import { useEffect, useState } from 'react'
import { FoldsSectionIcon } from './PsSectionIcons'
import {
  listPublishedFolds,
  isSubscribedToFolds,
  subscribeToFolds,
  unsubscribeFromFolds,
  foldSummary,
} from '../../lib/foldsSocial'
import FoldViewerModal from './FoldViewerModal'
import Modal from '../Modal'
import ReportContentButton from '../ReportContentButton'
import { useAuth } from '../../context/AuthContext'

/**
 * Other fren's profile — open their published folds + subscribe.
 */
export default function ProfileFoldsPublic({
  userId,
  frenName = 'fren',
  onCloseProfile,
}) {
  const { user } = useAuth()
  const viewerId = user?.id
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [folds, setFolds] = useState([])
  const [view, setView] = useState(null)
  const [subscribed, setSubscribed] = useState(false)
  const [subMsg, setSubMsg] = useState('')

  function refresh() {
    if (!userId) return
    const list = listPublishedFolds(userId)
    setCount(list.length)
    setFolds(list)
    if (viewerId) setSubscribed(isSubscribedToFolds(viewerId, userId))
  }

  useEffect(() => {
    refresh()
  }, [userId, viewerId])

  if (!userId || count === 0) return null

  function toggleSub() {
    if (!viewerId) {
      setSubMsg('Sign in to subscribe.')
      return
    }
    if (subscribed) {
      const r = unsubscribeFromFolds(viewerId, userId)
      setSubscribed(false)
      setSubMsg(r.message)
    } else {
      const r = subscribeToFolds(viewerId, userId, { creatorName: frenName })
      setSubscribed(Boolean(r.ok))
      setSubMsg(r.message)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          refresh()
        }}
        className="profile-hub-chip"
        title={`${frenName}'s folds`}
        aria-label={`${frenName}'s folds`}
      >
        <FoldsSectionIcon className="w-[1.06rem] h-[1.06rem]" />
      </button>

      {open && (
        <Modal
          title={`${frenName}'s folds`}
          onClose={() => setOpen(false)}
          maxWidth="max-w-md"
        >
          <p className="text-xs frens-muted -mt-2 mb-3">
            Peer paper on their shelf — zines, prints, stories.
          </p>

          {viewerId && viewerId !== userId ? (
            <div className="mb-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={toggleSub}
                className={`w-full py-2.5 rounded-xl text-sm transition ${
                  subscribed
                    ? 'frens-btn-outline'
                    : 'bg-black text-white dark:bg-white dark:text-black'
                }`}
              >
                {subscribed ? 'Subscribed to folds' : 'Subscribe to folds'}
              </button>
              {subMsg ? (
                <p className="text-[11px] frens-muted text-center">{subMsg}</p>
              ) : (
                <p className="text-[10px] frens-muted text-center">
                  Get a quiet nod when they publish a new fold.
                </p>
              )}
            </div>
          ) : null}

          <ul className="space-y-2 max-h-[45vh] overflow-y-auto">
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
        </Modal>
      )}

      {view && (
        <FoldViewerModal
          fold={view}
          onClose={() => setView(null)}
          subtitle={
            view.formatId === 'zine'
              ? 'Print this one page, then fold into a zine.'
              : 'Print preview — A4, print or save as PDF.'
          }
          footer={
            viewerId && viewerId !== userId ? (
              <div className="pt-3 border-t frens-border flex justify-center">
                <ReportContentButton
                  kind="fold"
                  refId={view.id}
                  reportedUserId={userId}
                  preview={foldSummary(view).title}
                  subjectLabel="this fold"
                  className="text-[11px] frens-muted hover:underline"
                />
              </div>
            ) : null
          }
        />
      )}
    </>
  )
}
