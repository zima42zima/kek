import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { ProfileAvatar } from './FrogLogo'
import FrenHandle from './FrenHandle'
import { useAuth } from '../context/AuthContext'
import { searchProfiles } from '../lib/social'
import { formatFrenHandle } from '../lib/frenName'
import { SearchIcon } from './icons/UiIcons'

/**
 * Global people search — handles / display names only.
 * Opens profile on select (caller handles navigation).
 */
export default function PeopleSearch({ open, onClose, onSelectUser }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setError(null)
      return
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const q = query.trim()
    if (!q) {
      setResults([])
      setError(null)
      setSearching(false)
      return undefined
    }
    setSearching(true)
    setError(null)
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((rows) => {
          setResults(rows.filter((r) => r.userId !== user?.id))
          setError(null)
        })
        .catch((err) => {
          console.error('People search failed:', err)
          setResults([])
          setError(err?.message || 'Search failed')
        })
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(t)
  }, [query, user?.id, open])

  if (!open) return null

  return (
    <Modal title="Search people" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 frens-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Handle or name…"
            className="frens-input py-2.5 pl-9 w-full"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {!query.trim() ? (
          <p className="text-xs frens-muted text-center py-6">
            Find frens by @handle or display name.
          </p>
        ) : searching ? (
          <p className="text-sm frens-muted py-4 text-center">Searching…</p>
        ) : error ? (
          <p className="text-sm text-center py-4 text-red-500/90 dark:text-red-400/90">
            {error}
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm frens-muted py-4 text-center">No accounts match.</p>
        ) : (
          <ul className="space-y-1 max-h-[50vh] overflow-y-auto -mx-1">
            {results.map((p) => (
              <li key={p.userId}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectUser?.(p.userId)
                    onClose?.()
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition"
                >
                  <ProfileAvatar profile={p} className="w-10 h-10 shrink-0" logoClassName="w-5 h-auto" />
                  <span className="min-w-0 flex-1">
                    <FrenHandle className="block">{p.frenName}</FrenHandle>
                    {p.frenHandle ? (
                      <span className="block text-[11px] frens-muted truncate">
                        {formatFrenHandle(p.frenHandle)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
