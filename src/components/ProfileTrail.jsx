import { useEffect, useMemo, useState } from 'react'
import { listMyLogFeed } from '../lib/trailLog'
import PostCard from './PostCard'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'replies', label: 'Replies' },
  { id: 'aura', label: 'Aura' },
]

/**
 * Profile → _log — outbound only: replies + aura/reactions.
 * No quotes / reposts (not part of MISAO).
 */
export default function ProfileTrail({ userId, onOpenProfile }) {
  const [filter, setFilter] = useState('all')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    listMyLogFeed(userId)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load _log')
          setEntries([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  const visible = useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'replies') return entries.filter((e) => e.kinds.has('replies'))
    if (filter === 'aura') return entries.filter((e) => e.kinds.has('aura'))
    return entries
  }, [entries, filter])

  return (
    <div className="space-y-0 min-w-0">
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 px-1">
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-[11px] sm:text-xs rounded-full px-2.5 sm:px-3 py-1 border transition shrink-0 ${
                active
                  ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                  : 'frens-border frens-muted hover:text-black dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-xs frens-muted py-6 text-center">Loading…</p>
      ) : error ? (
        <p className="text-xs text-red-500 dark:text-red-400 py-4 text-center px-2 break-words">{error}</p>
      ) : visible.length === 0 ? (
        <p className="text-xs frens-muted py-8 text-center">—</p>
      ) : (
        <div className="space-y-0 min-w-0">
          {visible.map((entry) => (
            <div key={entry.post.id} className="min-w-0">
              {filter === 'replies' && entry.replyText ? (
                <p className="text-[11px] frens-muted px-4 pt-2 pb-0 truncate">
                  your reply · {entry.replyText}
                </p>
              ) : null}
              <PostCard
                post={entry.post}
                onOpenProfile={onOpenProfile}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
