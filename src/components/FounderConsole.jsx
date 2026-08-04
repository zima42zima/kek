import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { ProfileAvatar } from './FrogLogo'
import FrenHandle from './FrenHandle'
import { formatFrenHandle } from '../lib/frenName'
import {
  listPlatformReports,
  resolvePlatformReport,
  suspendPlatformUser,
  unsuspendPlatformUser,
  setUserCofounder,
  reportKindLabel,
  ModerationNotInstalledError,
} from '../lib/platformModeration'
import { hideTopic } from '../lib/rabbitHole'
import { searchProfiles } from '../lib/social'
import StaffInvestigateModal from './StaffInvestigateModal'

function AccountHandleField({
  value,
  onChange,
  selected,
  onSelect,
  placeholder = '@handle',
  disabled = false,
}) {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const q = value.trim().replace(/^@+/, '')
    if (!q) {
      setResults([])
      setSearching(false)
      return undefined
    }
    setSearching(true)
    const t = setTimeout(() => {
      searchProfiles(q, { limit: 8 })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (rootRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function pick(person) {
    onSelect?.(person)
    onChange(person.frenHandle ? `@${person.frenHandle}` : person.frenName)
    setOpen(false)
    setResults([])
  }

  const showMenu = open && value.trim().length > 0

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onSelect?.(null)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="frens-input w-full text-sm"
        spellCheck={false}
        autoComplete="off"
      />
      {selected ? (
        <p className="text-[10px] frens-muted mt-1 truncate">
          Selected: {selected.frenName}
          {selected.frenHandle ? ` · ${formatFrenHandle(selected.frenHandle)}` : ''}
        </p>
      ) : null}
      {showMenu ? (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-xl border frens-border frens-surface shadow-lg py-1">
          {searching ? (
            <li className="px-3 py-2 text-xs frens-muted">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs frens-muted">No accounts match.</li>
          ) : (
            results.map((person) => (
              <li key={person.userId}>
                <button
                  type="button"
                  onClick={() => pick(person)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10 transition"
                >
                  <ProfileAvatar profile={person} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
                  <span className="min-w-0 flex-1">
                    <FrenHandle className="text-sm block truncate">{person.frenName}</FrenHandle>
                    {person.frenHandle ? (
                      <span className="text-[10px] frens-muted block truncate">
                        {formatFrenHandle(person.frenHandle)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

function ReportRow({
  report,
  busy,
  onDismiss,
  onSuspend,
  onHideTopic,
  onOpenRabbit,
  onInvestigate,
}) {
  const isRabbit = report.kind === 'rabbit_topic' || report.kind === 'rabbit_reply'

  return (
    <li className="border frens-border rounded-xl p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide frens-muted">
            {reportKindLabel(report.kind)}
          </p>
          <p className="text-sm font-medium mt-0.5 break-words">
            {report.preview || '—'}
          </p>
        </div>
        <span className="text-[10px] frens-muted shrink-0">
          {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ''}
        </span>
      </div>
      <p className="text-xs frens-muted">
        Reported by {report.reporterName}
        {report.reportedName ? ` · about ${report.reportedName}` : ''}
      </p>
      {report.reason ? (
        <p className="text-xs frens-body-text italic">&ldquo;{report.reason}&rdquo;</p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {report.reportedUserId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onInvestigate(report.reportedUserId)}
            className="frens-btn-outline px-2.5 py-1 text-[11px] disabled:opacity-50"
          >
            Investigate
          </button>
        ) : null}
        {isRabbit && report.kind === 'rabbit_topic' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenRabbit(report.refId)}
            className="frens-btn-outline px-2.5 py-1 text-[11px] disabled:opacity-50"
          >
            Open topic
          </button>
        ) : null}
        {isRabbit && report.kind === 'rabbit_topic' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onHideTopic(report.refId, report.id)}
            className="frens-btn-outline px-2.5 py-1 text-[11px] disabled:opacity-50"
          >
            Hide
          </button>
        ) : null}
        {report.reportedUserId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSuspend(report)}
            className="text-[11px] text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
          >
            Suspend user
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => onDismiss(report.id)}
          className="text-[11px] frens-muted hover:underline ml-auto disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </li>
  )
}

export default function FounderConsole({
  open,
  onClose,
  isFounder = false,
  onOpenRabbitTopic,
  onStatusChange,
}) {
  const [tab, setTab] = useState('open')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsSql, setNeedsSql] = useState(false)
  const [promoteHandle, setPromoteHandle] = useState('')
  const [modHandle, setModHandle] = useState('')
  const [promoteSelected, setPromoteSelected] = useState(null)
  const [modSelected, setModSelected] = useState(null)
  const [investigateUserId, setInvestigateUserId] = useState(null)

  async function resolveHandle(raw, selected = null) {
    if (selected?.userId) return selected
    const handle = raw.trim().replace(/^@/, '')
    if (!handle) return null
    const matches = await searchProfiles(handle, { limit: 8 })
    const exact = matches.find(
      (m) => m.frenHandle?.toLowerCase() === handle.toLowerCase(),
    )
    const byName = matches.find(
      (m) => m.frenName?.toLowerCase() === handle.toLowerCase(),
    )
    return exact || byName || matches[0] || null
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listPlatformReports(tab)
      setReports(rows)
      setNeedsSql(false)
    } catch (err) {
      if (err instanceof ModerationNotInstalledError) {
        setNeedsSql(true)
        setReports([])
      } else {
        setError(err.message || 'Could not load reports.')
      }
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    if (!open) return
    refresh()
  }, [open, refresh])

  async function dismiss(id) {
    setBusy(true)
    try {
      await resolvePlatformReport(id, 'dismissed')
      await refresh()
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'Could not dismiss.')
    } finally {
      setBusy(false)
    }
  }

  async function hideTopicAndResolve(topicId, reportId) {
    setBusy(true)
    try {
      await hideTopic(topicId, true)
      await resolvePlatformReport(reportId, 'actioned', 'Topic hidden')
      await refresh()
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'Could not hide topic.')
    } finally {
      setBusy(false)
    }
  }

  async function suspendFromReport(report) {
    if (!report.reportedUserId) return
    const reason = window.prompt(
      `Suspend ${report.reportedName || 'this user'}?\nOptional reason:`,
      '',
    )
    if (reason === null) return
    setBusy(true)
    try {
      await suspendPlatformUser(report.reportedUserId, reason)
      await refresh()
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'Could not suspend user.')
    } finally {
      setBusy(false)
    }
  }

  async function promoteCofounder(e) {
    e.preventDefault()
    if (!promoteHandle.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const target = await resolveHandle(promoteHandle, promoteSelected)
      if (!target?.userId) {
        setError('Handle not found — pick an account from the list.')
        return
      }
      await setUserCofounder(target.userId, true)
      setPromoteHandle('')
      setPromoteSelected(null)
    } catch (err) {
      setError(err.message || 'Could not add co-founder.')
    } finally {
      setBusy(false)
    }
  }

  async function removeCofounder(e) {
    e.preventDefault()
    if (!promoteHandle.trim() || busy) return
    if (!window.confirm('Remove co-founder access for this handle?')) return
    setBusy(true)
    setError('')
    try {
      const target = await resolveHandle(promoteHandle, promoteSelected)
      if (!target?.userId) {
        setError('Handle not found — pick an account from the list.')
        return
      }
      await setUserCofounder(target.userId, false)
      setPromoteHandle('')
      setPromoteSelected(null)
    } catch (err) {
      setError(err.message || 'Could not remove co-founder.')
    } finally {
      setBusy(false)
    }
  }

  async function suspendByHandle(e) {
    e.preventDefault()
    if (!modHandle.trim() || busy) return
    const reason = window.prompt('Optional reason for suspension:', '')
    if (reason === null) return
    setBusy(true)
    setError('')
    try {
      const target = await resolveHandle(modHandle, modSelected)
      if (!target?.userId) {
        setError('Handle not found — pick an account from the list.')
        return
      }
      await suspendPlatformUser(target.userId, reason)
      setModHandle('')
      setModSelected(null)
      await refresh()
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'Could not suspend user.')
    } finally {
      setBusy(false)
    }
  }

  async function unsuspendByHandle(e) {
    e.preventDefault()
    if (!modHandle.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const target = await resolveHandle(modHandle, modSelected)
      if (!target?.userId) {
        setError('Handle not found — pick an account from the list.')
        return
      }
      await unsuspendPlatformUser(target.userId)
      setModHandle('')
      setModSelected(null)
    } catch (err) {
      setError(err.message || 'Could not unsuspend user.')
    } finally {
      setBusy(false)
    }
  }

  async function investigateByHandle(e) {
    e.preventDefault()
    if (!modHandle.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const target = await resolveHandle(modHandle, modSelected)
      if (!target?.userId) {
        setError('Handle not found — pick an account from the list.')
        return
      }
      setInvestigateUserId(target.userId)
    } catch (err) {
      setError(err.message || 'Could not open account.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <>
    <Modal title="Founder console" onClose={onClose} maxWidth="max-w-lg">
      {needsSql ? (
        <p className="text-sm text-amber-700 dark:text-amber-300 border border-amber-400/50 rounded-xl p-3">
          Run <code className="text-[11px]">supabase-patch-platform-moderation.sql</code> in Supabase SQL Editor.
        </p>
      ) : (
        <div className="space-y-4 -mt-1">
          <div
            className="flex gap-0.5 p-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06]"
            role="tablist"
          >
            {['open', 'actioned', 'dismissed'].map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 py-1.5 text-[11px] font-medium rounded-full capitalize transition ${
                  tab === id
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'frens-muted hover:text-black dark:hover:text-white'
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          {error ? (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-sm frens-muted text-center py-8">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm frens-muted text-center py-8">
              {tab === 'open' ? 'No open reports.' : `No ${tab} reports.`}
            </p>
          ) : (
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {reports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  busy={busy}
                  onDismiss={dismiss}
                  onSuspend={suspendFromReport}
                  onHideTopic={hideTopicAndResolve}
                  onInvestigate={setInvestigateUserId}
                  onOpenRabbit={(topicId) => {
                    onOpenRabbitTopic?.(topicId)
                    onClose?.()
                  }}
                />
              ))}
            </ul>
          )}

          {isFounder ? (
            <form onSubmit={promoteCofounder} className="border-t frens-border pt-4 space-y-3">
              <p className="text-xs frens-label">Co-founders</p>
              <div className="flex gap-2 items-start">
                <AccountHandleField
                  value={promoteHandle}
                  onChange={setPromoteHandle}
                  selected={promoteSelected}
                  onSelect={setPromoteSelected}
                />
                <button
                  type="submit"
                  disabled={busy || !promoteHandle.trim()}
                  className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  disabled={busy || !promoteHandle.trim()}
                  onClick={removeCofounder}
                  className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </form>
          ) : null}

          <form onSubmit={investigateByHandle} className="border-t frens-border pt-4 space-y-2">
            <p className="text-xs frens-label">Investigate / moderate by handle</p>
            <div className="flex gap-2 items-start flex-wrap">
              <AccountHandleField
                value={modHandle}
                onChange={setModHandle}
                selected={modSelected}
                onSelect={setModSelected}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !modHandle.trim()}
                className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
              >
                Investigate
              </button>
              <button
                type="button"
                disabled={busy || !modHandle.trim()}
                onClick={suspendByHandle}
                className="text-sm px-3 py-2 shrink-0 text-red-500 dark:text-red-400 border border-red-400/40 rounded-full disabled:opacity-50"
              >
                Suspend
              </button>
              <button
                type="button"
                disabled={busy || !modHandle.trim()}
                onClick={unsuspendByHandle}
                className="frens-btn-outline px-3 py-2 text-sm shrink-0 disabled:opacity-50"
              >
                Unsuspend
              </button>
            </div>
          </form>
        </div>
      )}
    </Modal>

    {investigateUserId ? (
      <StaffInvestigateModal
        userId={investigateUserId}
        onClose={() => setInvestigateUserId(null)}
        onStatusChange={onStatusChange}
      />
    ) : null}
    </>
  )
}
