import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import {
  listFollowers,
  listFollowing,
  searchProfiles,
  SocialNotInstalledError,
} from '../../lib/social'
import { useCaves } from '../../context/CavesContext'

export default function AddMembersModal({ cave, currentUserId, onClose }) {
  const { inviteToCave } = useCaves()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [addingId, setAddingId] = useState(null)
  const [addFeedback, setAddFeedback] = useState('')

  const memberIds = useMemo(() => new Set(cave.members.map((m) => m.id)), [cave.members])
  const bannedIds = useMemo(() => new Set(cave.banned || []), [cave.banned])

  // Suggestions = people you follow or who follow you (deduped, minus yourself).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([listFollowing(currentUserId), listFollowers(currentUserId)])
      .then(([following, followers]) => {
        if (cancelled) return
        const map = new Map()
        ;[...following, ...followers].forEach((p) => {
          if (p.userId !== currentUserId) map.set(p.userId, p)
        })
        setSuggestions([...map.values()])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof SocialNotInstalledError
          ? 'Adding members needs the latest database update.'
          : (err.message || 'Could not load your frens.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentUserId])

  // Debounced search across all accounts.
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((rows) => setResults(rows.filter((r) => r.userId !== currentUserId)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, currentUserId])

  async function addMember(person) {
    if (person.userId === currentUserId) return

    setAddingId(person.userId)
    setAddFeedback('')
    const result = await inviteToCave(cave.id, person)
    setAddFeedback(result.message)
    setAddingId(null)
  }

  const list = query.trim() ? results : suggestions

  return (
    <Modal title={`Add members to ${cave.name}`} onClose={onClose} maxWidth="max-w-sm">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 search by @handle or name…"
        className="frens-input py-2 mb-2"
        autoFocus
      />

      {!query.trim() && (
        <p className="text-xs frens-hint mb-2">
          Frens you follow or who follow you — or search anyone above.
        </p>
      )}

      {addFeedback ? (
        <p className={`text-xs mb-2 ${addFeedback.includes('added') ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {addFeedback}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-500 dark:text-red-400 py-6 text-center">{error}</p>
      ) : loading ? (
        <p className="text-sm frens-muted py-6 text-center">Loading…</p>
      ) : searching ? (
        <p className="text-sm frens-muted py-6 text-center">Searching…</p>
      ) : list.length === 0 ? (
        <p className="text-sm frens-muted py-6 text-center">
          {query.trim() ? 'No accounts match that name.' : 'No frens to suggest yet — try searching.'}
        </p>
      ) : (
        <ul className="max-h-[50vh] overflow-y-auto divide-y divide-frens -mx-1">
          {list.map((p) => {
            const already = memberIds.has(p.userId)
            const banned = bannedIds.has(p.userId)
            return (
              <li key={p.userId} className="flex items-center gap-3 px-1 py-2.5">
                <ProfileAvatar profile={p} className="w-9 h-9 shrink-0" logoClassName="w-5 h-auto" />
                <div className="min-w-0 flex-1">
                  <FrenHandle>{p.frenName}</FrenHandle>
                  {p.frenHandle && (
                    <p className="text-[11px] frens-muted truncate">@{p.frenHandle}</p>
                  )}
                  {p.bio && <p className="text-xs frens-muted truncate">{p.bio}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => addMember(p)}
                  disabled={already || addingId === p.userId}
                  className={`shrink-0 text-xs rounded-full px-3 py-1.5 transition ${
                    already
                      ? 'frens-btn-outline opacity-60'
                      : 'bg-black text-white dark:bg-white dark:text-black disabled:opacity-50'
                  }`}
                >
                  {already ? 'In cave' : addingId === p.userId ? 'Adding…' : banned ? 'Unban + add' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
