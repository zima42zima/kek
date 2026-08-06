import { useEffect, useState } from 'react'
import Modal from './Modal'
import { ProfileAvatar } from './FrogLogo'
import FrenHandle from './FrenHandle'
import { formatFrenHandle } from '../lib/frenName'
import {
  staffGetUserDossier,
  staffListUserPosts,
  staffListUserDmThreads,
  staffListDmMessages,
  staffListUserReports,
  suspendPlatformUser,
  unsuspendPlatformUser,
  reportKindLabel,
  ModerationNotInstalledError,
} from '../lib/platformModeration'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'posts', label: 'Posts' },
  { id: 'dms', label: 'Messages' },
  { id: 'reports', label: 'Reports' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return '—'
  }
}

export default function StaffInvestigateModal({
  userId,
  onClose,
  onStatusChange,
}) {
  const [tab, setTab] = useState('overview')
  const [dossier, setDossier] = useState(null)
  const [posts, setPosts] = useState([])
  const [threads, setThreads] = useState([])
  const [reports, setReports] = useState([])
  const [openConvo, setOpenConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsSql, setNeedsSql] = useState(false)

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    staffGetUserDossier(userId)
      .then((d) => {
        if (!cancelled) {
          setDossier(d)
          setNeedsSql(false)
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ModerationNotInstalledError) {
          setNeedsSql(true)
        } else {
          setError(err.message || 'Could not load account.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!userId || tab !== 'posts') return undefined
    let cancelled = false
    staffListUserPosts(userId)
      .then((rows) => { if (!cancelled) setPosts(rows) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load posts.') })
    return () => { cancelled = true }
  }, [userId, tab])

  useEffect(() => {
    if (!userId || tab !== 'dms') return undefined
    let cancelled = false
    setOpenConvo(null)
    setMessages([])
    staffListUserDmThreads(userId)
      .then((rows) => { if (!cancelled) setThreads(rows) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load messages.') })
    return () => { cancelled = true }
  }, [userId, tab])

  useEffect(() => {
    if (!userId || tab !== 'reports') return undefined
    let cancelled = false
    staffListUserReports(userId)
      .then((rows) => { if (!cancelled) setReports(rows) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load reports.') })
    return () => { cancelled = true }
  }, [userId, tab])

  async function openThread(thread) {
    setOpenConvo(thread)
    setBusy(true)
    setError('')
    try {
      const rows = await staffListDmMessages(thread.conversationId)
      setMessages(rows)
    } catch (err) {
      setError(err.message || 'Could not open thread.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSuspend() {
    if (!dossier) return
    const reason = window.prompt(`Suspend ${dossier.frenName}? Optional reason:`, '')
    if (reason === null) return
    setBusy(true)
    try {
      await suspendPlatformUser(dossier.userId, reason)
      const next = await staffGetUserDossier(dossier.userId)
      setDossier(next)
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'Could not suspend.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnsuspend() {
    if (!dossier) return
    setBusy(true)
    try {
      await unsuspendPlatformUser(dossier.userId)
      const next = await staffGetUserDossier(dossier.userId)
      setDossier(next)
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'Could not unsuspend.')
    } finally {
      setBusy(false)
    }
  }

  const title = dossier
    ? (
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="truncate">Investigate · {dossier.frenName}</span>
      </span>
      )
    : 'Investigate account'

  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-lg">
      {needsSql ? (
        <p className="text-sm text-amber-700 dark:text-amber-300 border border-amber-400/50 rounded-xl p-3">
          Run <code className="text-[11px]">supabase-patch-staff-investigate.sql</code> in Supabase SQL Editor.
        </p>
      ) : loading ? (
        <p className="text-sm frens-muted text-center py-8">Loading…</p>
      ) : !dossier ? (
        <p className="text-sm frens-muted text-center py-8">Account not found.</p>
      ) : (
        <div className="space-y-4 -mt-1">
          <p className="text-[11px] frens-muted">
            Staff-only view for report review. Treat messages as confidential — same access as the account holder for investigation.
          </p>

          <div className="flex items-center gap-3">
            <ProfileAvatar profile={dossier} className="w-12 h-12 shrink-0" logoClassName="w-7 h-auto" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <FrenHandle className="text-sm">{dossier.frenName}</FrenHandle>
                {dossier.frenHandle ? (
                  <span className="text-xs frens-muted">{formatFrenHandle(dossier.frenHandle)}</span>
                ) : null}
                {dossier.suspended ? (
                  <span className="text-[10px] frens-muted border frens-border rounded-full px-2 py-0.5">suspended</span>
                ) : null}
                {dossier.isFounder ? (
                  <span className="text-[10px] frens-muted border frens-border rounded-full px-2 py-0.5">founder</span>
                ) : null}
                {dossier.isCofounder && !dossier.isFounder ? (
                  <span className="text-[10px] frens-muted border frens-border rounded-full px-2 py-0.5">co-founder</span>
                ) : null}
              </div>
              <p className="text-[10px] frens-muted mt-0.5">
                Joined {fmtDate(dossier.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex gap-0.5 p-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06]" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 text-[11px] font-medium rounded-full transition ${
                  tab === t.id
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'frens-muted hover:text-black dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}

          {tab === 'overview' ? (
            <div className="space-y-3 text-sm">
              {dossier.oneHumanThing ? (
                <p className="frens-body-text italic">&ldquo;{dossier.oneHumanThing}&rdquo;</p>
              ) : null}
              {dossier.bio ? <p className="text-xs frens-muted whitespace-pre-wrap">{dossier.bio}</p> : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p><span className="frens-muted">Posts</span> · {dossier.postCount}</p>
                <p><span className="frens-muted">DMs</span> · {dossier.dmThreadCount}</p>
                <p><span className="frens-muted">Followers</span> · {dossier.followerCount}</p>
                <p><span className="frens-muted">Following</span> · {dossier.followingCount}</p>
                <p><span className="frens-muted">Open reports</span> · {dossier.openReportCount}</p>
                {dossier.suspended ? (
                  <p className="col-span-2 text-red-500">
                    Suspended {fmtDate(dossier.suspendedAt)}
                    {dossier.suspendedReason ? ` — ${dossier.suspendedReason}` : ''}
                  </p>
                ) : null}
              </div>
              {!dossier.isFounder && !dossier.isCofounder ? (
                <div className="flex gap-2 pt-1">
                  {dossier.suspended ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleUnsuspend}
                      className="frens-btn-outline px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSuspend}
                      className="frens-btn-outline px-3 py-2 text-sm rounded-full disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[11px] frens-muted">Staff accounts cannot be suspended here.</p>
              )}
            </div>
          ) : null}

          {tab === 'posts' ? (
            <ul className="space-y-2 max-h-[48vh] overflow-y-auto">
              {posts.length === 0 ? (
                <li className="text-sm frens-muted text-center py-6">No posts.</li>
              ) : (
                posts.map((p) => (
                  <li key={p.id} className="border frens-border rounded-xl p-3 text-sm space-y-1">
                    <p className="text-[10px] frens-muted">{fmtDate(p.createdAt)} · {p.audience}</p>
                    {p.body ? <p className="whitespace-pre-wrap break-words">{p.body}</p> : null}
                    {p.image ? <p className="text-[10px] frens-muted">[image attached]</p> : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {tab === 'dms' ? (
            openConvo ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => { setOpenConvo(null); setMessages([]) }}
                  className="text-xs frens-muted hover:underline"
                >
                  ← Threads
                </button>
                <p className="text-xs frens-muted">
                  With {openConvo.otherName}
                  {openConvo.otherHandle ? ` · ${formatFrenHandle(openConvo.otherHandle)}` : ''}
                </p>
                <ul className="space-y-2 max-h-[44vh] overflow-y-auto border frens-border rounded-xl p-2">
                  {busy && messages.length === 0 ? (
                    <li className="text-xs frens-muted py-4 text-center">Loading…</li>
                  ) : messages.length === 0 ? (
                    <li className="text-xs frens-muted py-4 text-center">No messages.</li>
                  ) : (
                    messages.map((m) => (
                      <li key={m.id} className="text-xs px-1 py-1.5 border-b frens-border last:border-0">
                        <p className="frens-muted mb-0.5">
                          {m.authorName} · {fmtDate(m.createdAt)}
                        </p>
                        {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                        {m.image || m.video || m.sticker ? (
                          <p className="frens-muted mt-0.5">
                            {[m.image && 'photo', m.video && 'video', m.sticker && 'sticker'].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : (
              <ul className="space-y-1 max-h-[48vh] overflow-y-auto">
                {threads.length === 0 ? (
                  <li className="text-sm frens-muted text-center py-6">No DM threads.</li>
                ) : (
                  threads.map((t) => (
                    <li key={t.conversationId}>
                      <button
                        type="button"
                        onClick={() => openThread(t)}
                        className="w-full text-left px-2 py-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                      >
                        <p className="text-sm truncate">{t.otherName}</p>
                        <p className="text-[10px] frens-muted truncate">
                          {t.messageCount} msgs · {t.lastBody || '—'} · {fmtDate(t.lastAt)}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )
          ) : null}

          {tab === 'reports' ? (
            <ul className="space-y-2 max-h-[48vh] overflow-y-auto">
              {reports.length === 0 ? (
                <li className="text-sm frens-muted text-center py-6">No reports about this account.</li>
              ) : (
                reports.map((r) => (
                  <li key={r.id} className="border frens-border rounded-xl p-3 text-sm space-y-1">
                    <p className="text-[10px] uppercase tracking-wide frens-muted">
                      {reportKindLabel(r.kind)} · {r.status}
                    </p>
                    <p className="break-words">{r.preview || '—'}</p>
                    <p className="text-[10px] frens-muted">
                      by {r.reporterName} · {fmtDate(r.createdAt)}
                    </p>
                    {r.reason ? <p className="text-xs italic">&ldquo;{r.reason}&rdquo;</p> : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
