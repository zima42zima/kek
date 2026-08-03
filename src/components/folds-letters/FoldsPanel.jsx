import { useEffect, useState } from 'react'
import Modal from '../Modal'
import FoldComposer from './FoldComposer'
import SendFoldModal from './SendFoldModal'
import FoldViewerModal from './FoldViewerModal'
import { useAuth } from '../../context/AuthContext'
import {
  FOLD_FORMATS,
  emptyFoldDraft,
  foldFormatById,
  foldHasContent,
  countFilled,
  loadFoldDrafts,
  saveFoldDrafts,
} from '../../lib/foldFormats'
import {
  publishFold,
  unpublishFold,
  isFoldPublished,
  listPublishedFolds,
  listFoldInbox,
  markFoldInboxRead,
  foldInboxUnread,
} from '../../lib/foldsSocial'
import { markFoldsHubSeen } from '../../lib/profileHubBadges'

function FormatCard({ format, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(format.id)}
      className="letter-choice group text-left"
    >
      <span className="letter-choice__head">
        <span className="letter-choice__copy">
          <span className="letter-choice__title">{format.label}</span>
          <span className="letter-choice__hint">{format.hint}</span>
        </span>
      </span>
    </button>
  )
}

export default function FoldsPanel({ onBack, onExit }) {
  const { user, profile } = useAuth()
  const userId = user?.id
  const [drafts, setDrafts] = useState([])
  const [published, setPublished] = useState([])
  const [inbox, setInbox] = useState([])
  const [tab, setTab] = useState('yours') // yours | published | inbox
  /** null | 'pick' | 'compose' */
  const [phase, setPhase] = useState(null)
  const [draft, setDraft] = useState(null)
  const [sendFold, setSendFold] = useState(null)
  const [viewFold, setViewFold] = useState(null)
  const [actionMsg, setActionMsg] = useState('')
  /** When set, composer is editing an existing draft (not a brand-new pick). */
  const [editingDraftId, setEditingDraftId] = useState(null)

  async function refresh() {
    try {
      const list = await loadFoldDrafts()
      setDrafts(list)
    } catch {
      setDrafts([])
    }
    if (userId) {
      setPublished(listPublishedFolds(userId))
      try {
        const rows = await listFoldInbox(userId)
        setInbox(rows)
      } catch {
        setInbox([])
      }
    }
  }

  useEffect(() => {
    refresh()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    foldInboxUnread(userId)
      .then((n) => markFoldsHubSeen(userId, n))
      .catch(() => {})
  }, [userId])

  function startNew() {
    setPhase('pick')
    setDraft(null)
    setEditingDraftId(null)
    setActionMsg('')
  }

  function pickFormat(formatId) {
    setDraft(emptyFoldDraft(formatId))
    setEditingDraftId(null)
    setPhase('compose')
  }

  function leaveComposer() {
    setPhase(editingDraftId ? null : 'pick')
    if (editingDraftId) setDraft(null)
    else setDraft(null)
    setEditingDraftId(null)
    setActionMsg('')
  }

  async function handleSave() {
    if (!draft || !foldHasContent(draft)) {
      setActionMsg('Add at least one panel image before saving.')
      return
    }
    setActionMsg('Saving…')
    const format = foldFormatById(draft.formatId)
    const entry = {
      ...draft,
      id: draft.id || `fold-${Date.now()}`,
      title: (draft.title || '').trim() || `Untitled ${format?.label || 'fold'}`,
      updatedAt: new Date().toISOString(),
    }
    try {
      const existing = await loadFoldDrafts()
      const next = [entry, ...existing.filter((d) => d.id !== entry.id)]
      const result = await saveFoldDrafts(next)
      if (!result?.ok) {
        setActionMsg(result?.error || 'Could not save draft.')
        return
      }
      setDrafts(next)
      setPhase(null)
      setDraft(null)
      setEditingDraftId(null)
      setTab('yours')
      setActionMsg(editingDraftId ? 'Changes saved.' : 'Draft saved.')
      await refresh()
    } catch (err) {
      setActionMsg(err?.message || 'Could not save draft.')
    }
  }

  function openDraft(entry) {
    setDraft({ ...entry })
    setEditingDraftId(entry.id)
    setPhase('compose')
    setActionMsg('')
  }

  async function deleteDraft(id) {
    const existing = await loadFoldDrafts()
    const next = existing.filter((d) => d.id !== id)
    const result = await saveFoldDrafts(next)
    if (!result?.ok) {
      setActionMsg(result?.error || 'Could not delete draft.')
      return
    }
    setDrafts(next)
    if (userId && isFoldPublished(userId, id)) {
      unpublishFold(userId, id)
    }
    await refresh()
  }

  function handlePublish(entry) {
    if (!userId) {
      setActionMsg('Sign in to publish.')
      return
    }
    const r = publishFold(userId, entry, { ownerName: profile?.frenName })
    setActionMsg(r.message)
    refresh()
  }

  function handleUnpublish(foldId) {
    if (!userId) return
    const r = unpublishFold(userId, foldId)
    setActionMsg(r.message)
    refresh()
  }

  const composing = phase === 'compose' || phase === 'pick'
  const format = draft ? foldFormatById(draft.formatId) : null
  const unread = inbox.filter((e) => !e.read).length

  return (
    <Modal
      title={(
        <span className="inline-flex items-center gap-2">
          {(onBack || phase) && (
            <button
              type="button"
              onClick={() => {
                if (phase === 'compose') {
                  leaveComposer()
                  return
                }
                if (phase === 'pick') {
                  setPhase(null)
                  return
                }
                onBack?.()
              }}
              className="text-xs frens-muted hover:underline mr-1"
            >
              ←
            </button>
          )}
          FOLDS
          {format ? (
            <span className="text-[10px] frens-muted font-normal tracking-wide">
              · {format.label}
            </span>
          ) : null}
        </span>
      )}
      onClose={onExit}
      maxWidth={composing ? 'max-w-2xl' : 'max-w-lg'}
    >
      {phase === 'pick' ? (
        <div className="space-y-4 letter-studio-ui">
          <p className="text-xs frens-muted -mt-2">
            Peer publishing for paper — everything fits A4. Pick a form, drop JPG or PDF.
          </p>
          <div className="grid gap-3">
            {FOLD_FORMATS.map((f) => (
              <FormatCard key={f.id} format={f} onPick={pickFormat} />
            ))}
          </div>
        </div>
      ) : phase === 'compose' && draft ? (
        <div className="space-y-4">
          {editingDraftId ? (
            <p className="text-[10px] frens-muted text-center uppercase tracking-wide -mt-1">
              Editing draft · change name or content, then save
            </p>
          ) : null}
          <FoldComposer draft={draft} onChange={setDraft} />
          {actionMsg ? (
            <p
              className={`text-xs text-center ${
                /could not|full|before saving|error/i.test(actionMsg)
                  ? 'text-red-500 dark:text-red-400'
                  : 'frens-muted'
              }`}
            >
              {actionMsg}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!foldHasContent(draft)}
            onClick={() => {
              if (!foldHasContent(draft)) return
              setViewFold({
                ...draft,
                title: (draft.title || '').trim() || 'Untitled fold',
              })
            }}
            className="w-full rounded-full px-4 py-2.5 text-sm tracking-wide border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent disabled:opacity-50"
          >
            Preview · then print
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={leaveComposer}
              className="flex-1 min-w-[5rem] rounded-full px-4 py-3 text-sm border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent"
            >
              {editingDraftId ? 'Done' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={!foldHasContent(draft)}
              className="flex-1 min-w-[5rem] rounded-full px-4 py-3 text-sm border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent disabled:opacity-50"
            >
              {editingDraftId ? 'Save changes' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!foldHasContent(draft)) return
                const formatMeta = foldFormatById(draft.formatId)
                const entry = {
                  ...draft,
                  id: draft.id || `fold-${Date.now()}`,
                  title: (draft.title || '').trim() || `Untitled ${formatMeta?.label || 'fold'}`,
                  updatedAt: new Date().toISOString(),
                }
                const existing = await loadFoldDrafts()
                const next = [entry, ...existing.filter((d) => d.id !== entry.id)]
                const result = await saveFoldDrafts(next)
                if (!result?.ok) {
                  setActionMsg(result?.error || 'Could not save draft before publish.')
                  return
                }
                setDrafts(next)
                handlePublish(entry)
                setDraft(entry)
                setEditingDraftId(entry.id)
              }}
              disabled={!foldHasContent(draft)}
              className="flex-[1.2] min-w-[6rem] rounded-full px-4 py-3 text-sm font-medium bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
            >
              Publish
            </button>
          </div>
          <button
            type="button"
            disabled={!foldHasContent(draft)}
            onClick={() => {
              if (!foldHasContent(draft)) return
              setSendFold({
                ...draft,
                title: (draft.title || '').trim() || 'Untitled fold',
              })
            }}
            className="w-full rounded-full px-4 py-2.5 text-xs tracking-wide border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent disabled:opacity-50"
          >
            Send to a fren
          </button>
          <p className="text-[10px] frens-muted text-center">
            {editingDraftId
              ? 'Save changes to keep your edits. Preview to print a test sheet.'
              : 'Preview like letters — print a test sheet, then publish or send.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 letter-studio-ui">
          <p className="text-xs frens-muted -mt-1 text-center leading-relaxed">
            Zines, stories, prints & posters for A4 — send peer to peer or publish on your profile.
          </p>

          {/* Primary action — always first under title */}
          <button
            type="button"
            onClick={startNew}
            className="w-full letter-btn-primary py-3.5 text-sm font-semibold tracking-wide"
          >
            + New fold
          </button>

          {/* Sections: Inbox → Published → Drafts */}
          <div
            className="flex gap-0.5 p-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06]"
            role="tablist"
            aria-label="Folds sections"
          >
            {[
              {
                id: 'inbox',
                label: 'Inbox',
                badge: unread > 0 ? (unread > 9 ? '9+' : String(unread)) : null,
              },
              { id: 'published', label: 'Published', badge: null },
              {
                id: 'yours',
                label: 'Drafts',
                badge: drafts.length > 0 ? String(drafts.length > 9 ? '9+' : drafts.length) : null,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id)
                  setActionMsg('')
                  refresh()
                }}
                className={`flex-1 py-2 text-[11px] font-medium rounded-full transition inline-flex items-center justify-center gap-1 ${
                  tab === t.id
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                    : 'frens-muted hover:text-black dark:hover:text-white'
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span
                    className={`min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[9px] leading-none inline-flex items-center justify-center tabular-nums ${
                      tab === t.id
                        ? 'bg-white/20 dark:bg-black/15'
                        : 'bg-black/10 dark:bg-white/15'
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {actionMsg ? (
            <p className="text-xs frens-muted text-center -mt-1">{actionMsg}</p>
          ) : null}

          {/* Section body */}
          <div className="min-h-[12rem]">
            {tab === 'inbox' ? (
              inbox.length === 0 ? (
                <p className="text-sm frens-muted text-center py-10">
                  No folds from frens yet.
                </p>
              ) : (
                <ul className="space-y-2 max-h-[48vh] overflow-y-auto">
                  {inbox.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          setViewFold(e.fold)
                          if (userId) await markFoldInboxRead(userId, e.id)
                          refresh()
                        }}
                        className={`w-full text-left border frens-border rounded-2xl px-3.5 py-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                          !e.read ? 'border-black/30 dark:border-white/30' : ''
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium truncate min-w-0">
                            {e.fold?.title || 'Fold'}
                          </p>
                          {!e.read ? (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-black dark:bg-white" aria-label="Unread" />
                          ) : null}
                        </div>
                        <p className="text-xs frens-muted mt-0.5">
                          from {e.fromName}
                          {e.sentAt ? ` · ${new Date(e.sentAt).toLocaleDateString()}` : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === 'published' ? (
              published.length === 0 ? (
                <p className="text-sm frens-muted text-center py-10">
                  Nothing on your profile yet.
                  <br />
                  <span className="text-[11px]">Publish a draft to show it here.</span>
                </p>
              ) : (
                <ul className="space-y-2 max-h-[48vh] overflow-y-auto">
                  {published.map((f) => (
                    <li
                      key={f.id}
                      className="border frens-border rounded-2xl px-3.5 py-3 flex items-center gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => setViewFold(f)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-medium truncate">{f.title}</p>
                        <p className="text-xs frens-muted mt-0.5">
                          {foldFormatById(f.formatId)?.label}
                          {f.publishedAt
                            ? ` · ${new Date(f.publishedAt).toLocaleDateString()}`
                            : ''}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnpublish(f.id)}
                        className="text-[11px] frens-muted hover:underline shrink-0"
                      >
                        Unpublish
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === 'yours' ? (
              drafts.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm frens-muted">No drafts yet.</p>
                  <button
                    type="button"
                    onClick={startNew}
                    className="text-xs font-medium underline underline-offset-2 text-black dark:text-white"
                  >
                    + Start a new fold
                  </button>
                </div>
              ) : (
                <ul className="space-y-2 max-h-[48vh] overflow-y-auto">
                  {drafts.map((d) => {
                    const f = foldFormatById(d.formatId)
                    const n = countFilled(d)
                    const live = userId && isFoldPublished(userId, d.id)
                    return (
                      <li
                        key={d.id}
                        className="border frens-border rounded-2xl px-3.5 py-3 space-y-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => openDraft(d)}
                          className="w-full text-left min-w-0"
                        >
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          <p className="text-xs frens-muted mt-0.5">
                            {f?.label || d.formatId}
                            {d.formatId === 'zine' ? ` · ${n}/8` : n > 1 ? ` · ${n} pages` : ''}
                            {live ? ' · on profile' : ' · draft'}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <button
                            type="button"
                            onClick={() => openDraft(d)}
                            className="text-[11px] font-medium text-black dark:text-white hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewFold(d)}
                            className="text-[11px] frens-muted hover:underline"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => (live ? handleUnpublish(d.id) : handlePublish(d))}
                            className="text-[11px] frens-muted hover:underline"
                          >
                            {live ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendFold(d)}
                            className="text-[11px] frens-muted hover:underline"
                          >
                            Send
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDraft(d.id)}
                            className="text-[11px] frens-muted hover:underline ml-auto"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )
            ) : null}
          </div>
        </div>
      )}

      {sendFold && (
        <SendFoldModal
          fold={sendFold}
          onClose={() => setSendFold(null)}
          onSent={() => {
            setActionMsg('Fold sent.')
            setSendFold(null)
          }}
        />
      )}

      {viewFold && (
        <FoldViewerModal
          fold={viewFold}
          onClose={() => setViewFold(null)}
          subtitle={
            viewFold.formatId === 'zine'
              ? 'One A4 landscape sheet — print to test alignment, then fold.'
              : 'As printed on A4 — same preview your fren will see.'
          }
        />
      )}
    </Modal>
  )
}
