import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import LetterStudioComposer from './LetterStudioComposer'
import { useAuth } from '../../context/AuthContext'
import {
  listFollowers,
  listFollowing,
  searchProfiles,
  SocialNotInstalledError,
} from '../../lib/social'
import {
  canSendOwlTo,
  getPublicOwlStatus,
  sendOwlLetter,
  OwlPostNotInstalledError,
} from '../../lib/owlPost'
import { owlLetterHasContent, serializeOwlLetterBody } from '../../lib/owlLetterFormat'

async function filterAcceptingLetterProfiles(profiles) {
  const rows = await Promise.all(
    profiles.map(async (p) => {
      try {
        const open = await getPublicOwlStatus(p.userId)
        return open ? p : null
      } catch {
        return null
      }
    }),
  )
  return rows.filter(Boolean)
}

export function PickRecipient({ onSelect, onCancel }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [openFrens, setOpenFrens] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [picking, setPicking] = useState(false)
  const [listError, setListError] = useState('')
  const [pickError, setPickError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    setListError('')
    Promise.all([listFollowing(user.id), listFollowers(user.id)])
      .then(async ([following, followers]) => {
        if (cancelled) return
        const map = new Map()
        ;[...following, ...followers].forEach((p) => {
          if (p.userId !== user.id) map.set(p.userId, p)
        })
        const accepting = await filterAcceptingLetterProfiles([...map.values()])
        if (!cancelled) setOpenFrens(accepting)
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
    setPickError('')
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((rows) => setResults(rows.filter((r) => r.userId !== user?.id)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, user?.id])

  const people = useMemo(
    () => (query.trim() ? results : openFrens),
    [query, results, openFrens],
  )

  async function handlePick(person) {
    setPicking(true)
    setPickError('')
    try {
      const ok = await canSendOwlTo(person.userId)
      if (!ok) {
        setPickError(`${person.frenName} is not accepting letters right now.`)
        return
      }
      onSelect?.(person)
    } catch (err) {
      setPickError(err instanceof OwlPostNotInstalledError
        ? 'Letters are not set up yet — run the letters SQL patch in Supabase.'
        : (err.message || 'Could not check letters.'))
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search username…"
        className="ps-field"
        autoFocus
      />

      {loading ? (
        <p className="text-xs frens-muted py-4 text-center">Loading…</p>
      ) : listError ? (
        <p className="text-xs text-red-500 dark:text-red-400 py-4 text-center">{listError}</p>
      ) : searching ? (
        <p className="text-xs frens-muted py-4 text-center">Searching…</p>
      ) : people.length === 0 ? (
        <p className="text-xs frens-muted py-4 text-center">
          {query.trim() ? 'No users found.' : 'No frens with letters open yet.'}
        </p>
      ) : (
        <ul className="border frens-border rounded-xl overflow-hidden divide-y divide-[var(--frens-outline)] max-h-[42vh] overflow-y-auto">
          {people.map((p) => (
            <li key={p.userId}>
              <button
                type="button"
                disabled={picking}
                onClick={() => handlePick(p)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-left transition disabled:opacity-50"
              >
                <ProfileAvatar profile={p} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
                <FrenHandle className="text-sm">{p.frenName}</FrenHandle>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickError && <p className="text-xs text-red-500 dark:text-red-400">{pickError}</p>}

      <div className="pt-1">
        <button type="button" onClick={onCancel} className="text-xs frens-muted hover:underline">
          Cancel
        </button>
      </div>
    </div>
  )
}

export function ComposeLetterForm({ recipient, onSent, onCancel }) {
  const { profile } = useAuth()
  const senderName = profile?.frenName?.trim() || 'You'
  const [letter, setLetter] = useState(null)
  const [anonymous, setAnonymous] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [checking, setChecking] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const onLetterChange = useCallback((next) => setLetter(next), [])

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
          ? 'Letters are not set up yet — run the letters SQL patch in Supabase.'
          : (err.message || 'Could not check letters.'))
      })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [recipient?.userId])

  async function handleSend(e) {
    e.preventDefault()
    if (!letter || !recipient) return
    if (!owlLetterHasContent(letter)) return
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

  if (checking) {
    return <p className="text-sm frens-muted py-6 text-center">Checking…</p>
  }

  if (!canSend) {
    return (
      <div className="space-y-3">
        <p className="text-sm frens-muted py-4 text-center">
          {error || `${recipient.frenName} is not accepting letters right now.`}
        </p>
        <button type="button" onClick={onCancel} className="text-xs frens-muted hover:underline">
          Cancel
        </button>
      </div>
    )
  }

  async function handlePreviewPrint() {
    if (!letter || !owlLetterHasContent(letter)) return
    setError('')
    try {
      const { printOwlLetter } = await import('../../lib/owlPrint')
      await printOwlLetter({
        body: serializeOwlLetterBody(letter),
        fromDisplay: senderName,
        anonymous,
      })
    } catch (err) {
      setError(err.message || 'Could not open print preview.')
    }
  }

  return (
    <form onSubmit={handleSend} className="letter-compose-shell">
      {/* Canvas only — actions stay outside so they never steal page height */}
      <div className="letter-compose-canvas letter-studio-ui">
        <LetterStudioComposer
          fromName={senderName}
          toName={recipient.frenName}
          anonymous={anonymous}
          onLetterChange={onLetterChange}
          showPrint={false}
        />
      </div>

      <div className="letter-compose-actions">
        <button
          type="button"
          onClick={handlePreviewPrint}
          disabled={!letter || !owlLetterHasContent(letter)}
          className="text-xs frens-muted hover:underline disabled:opacity-40"
        >
          Preview print
        </button>

        <label className="flex items-center gap-2 text-xs frens-muted justify-center">
          <input
            type="checkbox"
            className="ps-checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          <span>Send anonymously</span>
        </label>

        {error && <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>}

        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={onCancel} className="text-xs frens-muted hover:underline">
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || !letter || !owlLetterHasContent(letter)}
            className="rounded-full bg-black text-white dark:bg-white dark:text-black px-5 py-2 text-sm font-medium disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  )
}

/** @deprecated Use PickRecipient + ComposeLetterForm from LettersPanel. */
export default function ComposeLetter(props) {
  const [recipient, setRecipient] = useState(null)
  if (recipient) {
    return (
      <ComposeLetterForm
        recipient={recipient}
        onSent={props.onSent}
        onCancel={() => setRecipient(null)}
      />
    )
  }
  return (
    <PickRecipient
      onSelect={setRecipient}
      onCancel={props.onCancel}
    />
  )
}
