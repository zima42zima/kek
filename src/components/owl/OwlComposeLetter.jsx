import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import OwlLetterComposer from './OwlLetterComposer'
import { useAuth } from '../../context/AuthContext'
import {
  listFollowers,
  listFollowing,
  searchProfiles,
  SocialNotInstalledError,
} from '../../lib/social'
import {
  canSendOwlTo,
  sendOwlLetter,
  OwlPostNotInstalledError,
} from '../../lib/owlPost'
import { owlLetterHasContent, serializeOwlLetterBody } from '../../lib/owlLetterFormat'

export default function OwlComposeLetter({ onSent, onCancel }) {
  const { user, profile } = useAuth()
  const senderName = profile?.frenName?.trim() || 'You'
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [listError, setListError] = useState('')
  const [recipient, setRecipient] = useState(null)
  const [letter, setLetter] = useState(null)
  const [anonymous, setAnonymous] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const onLetterChange = useCallback((next) => setLetter(next), [])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    setListError('')
    Promise.all([listFollowing(user.id), listFollowers(user.id)])
      .then(([following, followers]) => {
        if (cancelled) return
        const map = new Map()
        ;[...following, ...followers].forEach((p) => {
          if (p.userId !== user.id) map.set(p.userId, p)
        })
        setSuggestions([...map.values()])
      })
      .catch((err) => {
        if (cancelled) return
        setListError(err instanceof SocialNotInstalledError
          ? 'Following needs the latest database update.'
          : (err.message || 'Could not load your frens.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((rows) => setResults(rows.filter((r) => r.userId !== user?.id)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, user?.id])

  useEffect(() => {
    if (!recipient?.userId) {
      setCanSend(false)
      return
    }
    let cancelled = false
    setChecking(true)
    setError('')
    canSendOwlTo(recipient.userId)
      .then((ok) => { if (!cancelled) setCanSend(ok) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof OwlPostNotInstalledError
          ? 'Owl Post is not set up yet.'
          : (err.message || 'Could not check owl post.'))
      })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [recipient?.userId])

  const people = useMemo(() => {
    const list = query.trim() ? results : suggestions
    return list
  }, [query, results, suggestions])

  async function handleSend(e) {
    e.preventDefault()
    if (!letter || !recipient) return
    const trimmed = owlLetterHasContent(letter)
    if (!trimmed) return
    setSending(true)
    setError('')
    try {
      await sendOwlLetter({
        toUserId: recipient.userId,
        body: serializeOwlLetterBody(letter),
        anonymous,
        frenName: senderName,
      })
      onSent?.()
    } catch (err) {
      setError(err.message || 'Could not send letter.')
    } finally {
      setSending(false)
    }
  }

  if (recipient) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => { setRecipient(null); setError(''); setLetter(null) }}
          className="text-xs frens-muted hover:underline"
        >
          ← Choose a different fren
        </button>

        {checking ? (
          <p className="text-sm frens-muted py-6 text-center">Checking owl post…</p>
        ) : !canSend ? (
          <p className="text-sm frens-muted py-6 text-center">
            {error || `${recipient.frenName}'s owl post is not accepting letters right now.`}
          </p>
        ) : (
          <form onSubmit={handleSend} className="space-y-4 owl-letter-ui">
            <p className="text-sm font-medium">Letter for {recipient.frenName}</p>
            <OwlLetterComposer
              fromName={senderName}
              toName={recipient.frenName}
              anonymous={anonymous}
              onLetterChange={onLetterChange}
            />

            <label className="flex items-start gap-2 text-sm px-1">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              <span>
                <span className="block">Send anonymously</span>
                <span className="block text-xs frens-muted mt-0.5">
                  Your name stays hidden in notifications, inbox, and on the printed letter.
                </span>
              </span>
            </label>

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 owl-btn-outline py-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !letter || !owlLetterHasContent(letter)}
                className="flex-[2] owl-btn-primary py-3 disabled:opacity-50"
              >
                {sending ? 'Sending owl…' : 'Send sealed letter'}
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs frens-muted">
        Pick a fren with an open owl post, then write your sealed letter.
      </p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search frens…"
        className="w-full border frens-border rounded-xl px-3 py-2 text-sm bg-transparent"
        autoFocus
      />

      {loading ? (
        <p className="text-sm frens-muted py-6 text-center">Loading your frens…</p>
      ) : listError ? (
        <p className="text-sm text-red-500 dark:text-red-400 py-6 text-center">{listError}</p>
      ) : searching ? (
        <p className="text-sm frens-muted py-6 text-center">Searching…</p>
      ) : people.length === 0 ? (
        <p className="text-sm frens-muted py-6 text-center">
          {query.trim() ? 'No frens found.' : 'Follow some frens to send them letters.'}
        </p>
      ) : (
        <ul className="space-y-1 max-h-[45vh] overflow-y-auto -mx-1">
          {people.map((p) => (
            <li key={p.userId}>
              <button
                type="button"
                onClick={() => setRecipient(p)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition"
              >
                <ProfileAvatar profile={p} className="w-10 h-10 shrink-0" logoClassName="w-6 h-auto" />
                <div className="min-w-0">
                  <FrenHandle>{p.frenName}</FrenHandle>
                  {p.bio ? <p className="text-xs frens-muted truncate">{p.bio}</p> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onCancel} className="w-full owl-btn-outline py-2.5 text-sm">
        Cancel
      </button>
    </div>
  )
}
