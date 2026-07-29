import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  createInviteCode,
  getInviteDailyQuota,
  listMyInvites,
  InvitesNotInstalledError,
} from '../lib/invites'
import {
  copyText,
  inviteJoinUrl,
  inviteMessage,
  shareInvite,
} from '../lib/inviteShare'
import { APP_NAME } from '../lib/brand'

function formatResetsIn(resetsAt) {
  if (!resetsAt) return null
  const ms = new Date(resetsAt).getTime() - Date.now()
  if (ms <= 0) return 'soon'
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  if (hours < 2) return 'in about an hour'
  return `in ~${hours}h`
}

export default function InviteGenerator({ compact = false, inModal = false }) {
  const { profile } = useAuth()
  const inviterName = profile?.frenName || 'A fren'
  const [invites, setInvites] = useState([])
  const [quota, setQuota] = useState({ remaining: 3, dailyLimit: 3, createdLast24h: 0, resetsAt: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [needsSql, setNeedsSql] = useState(false)
  const [latestCode, setLatestCode] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, q] = await Promise.all([listMyInvites(), getInviteDailyQuota()])
      setInvites(rows)
      setQuota(q)
      setNeedsSql(false)
    } catch (err) {
      if (err instanceof InvitesNotInstalledError) {
        setNeedsSql(true)
        setInvites([])
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate() {
    if (quota.remaining <= 0) return
    setBusy(true)
    setError('')
    try {
      const code = await createInviteCode()
      setLatestCode(code)
      await refresh()
    } catch (err) {
      if (err instanceof InvitesNotInstalledError) setNeedsSql(true)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyCode(code) {
    await copyText(code)
    setCopied(`code:${code}`)
    setTimeout(() => setCopied(''), 2000)
  }

  async function handleCopyMessage(code) {
    await copyText(inviteMessage(code, { inviterName }))
    setCopied(`msg:${code}`)
    setTimeout(() => setCopied(''), 2000)
  }

  async function handleCopyLink(code) {
    await copyText(inviteJoinUrl(code))
    setCopied(`link:${code}`)
    setTimeout(() => setCopied(''), 2000)
  }

  async function handleShare(code) {
    const result = await shareInvite(code, { inviterName })
    if (result === 'copied') {
      setCopied(`share:${code}`)
      setTimeout(() => setCopied(''), 2000)
    }
  }

  const unused = invites.filter((i) => !i.used_by)
  const used = invites.filter((i) => i.used_by)
  const atDailyLimit = quota.remaining <= 0
  const resetsLabel = formatResetsIn(quota.resetsAt)

  if (needsSql) {
    return (
      <div className={inModal ? '' : `border frens-border rounded-xl p-4 ${compact ? '' : 'mb-4'}`}>
        <p className="text-sm frens-body-text font-medium mb-1">Invite a fren</p>
        <p className="text-xs frens-muted">
          Run <code className="text-[11px]">supabase-patch-invite-daily-limit.sql</code> in Supabase SQL Editor.
        </p>
      </div>
    )
  }

  return (
    <div className={inModal ? '' : `border frens-border rounded-xl p-4 ${compact ? '' : 'mb-4'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm frens-body-text font-medium">Invite a fren</p>
          <p className="text-xs frens-muted mt-0.5">
            {quota.remaining} of {quota.dailyLimit} new codes left (rolling 24h). Share via text — {APP_NAME} never emails for you.
          </p>
          {atDailyLimit && resetsLabel && (
            <p className="text-xs frens-muted mt-1">
              Resets {resetsLabel}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || atDailyLimit}
          className="frens-btn-outline shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {busy ? '...' : '+ new code'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>}

      {latestCode && (
        <div className="rounded-lg border border-[#6BC06B]/40 bg-[#6BC06B]/5 dark:bg-[#6BC06B]/10 px-3 py-3 mb-3 text-left">
          <p className="text-xs frens-muted mb-1">New code — share privately</p>
          <p className="font-mono text-lg tracking-wider mb-2">{latestCode}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleCopyMessage(latestCode)} className="frens-btn-primary px-3 py-1.5 text-xs">
              {copied === `msg:${latestCode}` ? 'copied' : 'copy message'}
            </button>
            <button type="button" onClick={() => handleShare(latestCode)} className="frens-btn-outline px-3 py-1.5 text-xs">
              share
            </button>
            <button type="button" onClick={() => handleCopyLink(latestCode)} className="frens-btn-outline px-3 py-1.5 text-xs">
              copy link
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs frens-muted">loading invites...</p>
      ) : unused.length === 0 && used.length === 0 ? (
        <p className="text-xs frens-muted">No invites yet — create one above.</p>
      ) : (
        <ul className="space-y-2">
          {unused.map((inv) => (
            <li
              key={inv.code}
              className="rounded-lg border frens-border px-3 py-2 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm tracking-wider">{inv.code}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(inv.code)}
                  className="text-xs frens-btn-outline px-2 py-1"
                >
                  {copied === `code:${inv.code}` ? 'copied' : 'code'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyMessage(inv.code)}
                  className="text-xs frens-btn-outline px-2 py-1"
                >
                  {copied === `msg:${inv.code}` ? 'copied' : 'message'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyLink(inv.code)}
                  className="text-xs frens-btn-outline px-2 py-1"
                >
                  {copied === `link:${inv.code}` ? 'copied' : 'link'}
                </button>
                <button
                  type="button"
                  onClick={() => handleShare(inv.code)}
                  className="text-xs frens-btn-outline px-2 py-1"
                >
                  share
                </button>
              </div>
            </li>
          ))}
          {used.length > 0 && (
            <li className="text-[11px] frens-muted pt-1">
              {used.length} code{used.length !== 1 ? 's' : ''} already used
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
