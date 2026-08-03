import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import { searchProfiles } from '../../lib/social'
import { sendFoldToUser } from '../../lib/foldsSocial'
import { useAuth } from '../../context/AuthContext'
import { formatFrenHandle } from '../../lib/frenName'

export default function SendFoldModal({ fold, onClose, onSent }) {
  const { user, profile } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return undefined
    }
    setSearching(true)
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((rows) => setResults(rows.filter((r) => r.userId !== user?.id)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(t)
  }, [query, user?.id])

  async function sendTo(person) {
    setBusyId(person.userId)
    setFeedback('')
    try {
      const result = await sendFoldToUser(
        { id: user?.id, frenName: profile?.frenName },
        person.userId,
        fold,
      )
      setFeedback(result.message)
      if (result.ok && !result.localOnly) {
        onSent?.(person)
        try {
          window.dispatchEvent(
            new CustomEvent('frens:fold-sent', {
              detail: { toUserId: person.userId, foldId: fold.id },
            }),
          )
          window.dispatchEvent(new CustomEvent('frens:notifications-refreshed'))
        } catch { /* ignore */ }
      } else if (result.ok && result.localOnly) {
        // Still call onSent but user sees warning in feedback
        onSent?.(person)
      }
    } catch (err) {
      setFeedback(err?.message || 'Could not send fold.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      title="Send fold"
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <p className="text-xs frens-muted -mt-2 mb-3 truncate">
        {fold?.title || 'Untitled'} · peer to peer
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a fren by @handle or name…"
        className="frens-input py-2 mb-2"
        autoFocus
      />
      {feedback ? (
        <p className={`text-xs mb-2 ${feedback.includes('sent') || feedback.includes('Sent') ? 'text-[#6BC06B]' : 'text-red-500 dark:text-red-400'}`}>
          {feedback}
        </p>
      ) : null}
      {searching ? (
        <p className="text-sm frens-muted py-6 text-center">Searching…</p>
      ) : !query.trim() ? (
        <p className="text-xs frens-muted text-center py-6">
          Search someone to send this fold to their P.S. inbox.
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm frens-muted py-6 text-center">No accounts match.</p>
      ) : (
        <ul className="max-h-[45vh] overflow-y-auto space-y-1">
          {results.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 px-1 py-2">
              <ProfileAvatar profile={p} className="w-9 h-9 shrink-0" logoClassName="w-5 h-auto" />
              <div className="min-w-0 flex-1">
                <FrenHandle>{p.frenName}</FrenHandle>
                {p.frenHandle ? (
                  <p className="text-[11px] frens-muted truncate">{formatFrenHandle(p.frenHandle)}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId === p.userId}
                onClick={() => sendTo(p)}
                className="shrink-0 text-xs rounded-full px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
              >
                {busyId === p.userId ? '…' : 'Send'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
