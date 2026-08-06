import { useEffect, useState } from 'react'
import CaveIcon from './CaveIcon'
import { CaveCoverThumb } from './CaveCover'
import { searchPublicCaves, CavesNotInstalledError } from '../../lib/caves'
import { useCaves } from '../../context/CavesContext'

export default function CavesList({
  caves,
  currentUserId,
  onOpenCave,
  onCreateClick,
  onJoinedPublic,
}) {
  const { joinPublicCaveAndOpen } = useCaves()
  const [tab, setTab] = useState('mine') // mine | discover
  const [query, setQuery] = useState('')
  const [publicCaves, setPublicCaves] = useState([])
  const [loadingPublic, setLoadingPublic] = useState(false)
  const [publicError, setPublicError] = useState('')
  const [joiningId, setJoiningId] = useState(null)

  const isEmpty = caves.length === 0

  useEffect(() => {
    if (tab !== 'discover') return undefined
    let cancelled = false
    setLoadingPublic(true)
    setPublicError('')
    const t = setTimeout(() => {
      searchPublicCaves(query)
        .then((rows) => {
          if (!cancelled) setPublicCaves(rows)
        })
        .catch((err) => {
          if (cancelled) return
          if (err instanceof CavesNotInstalledError) {
            setPublicError('Run supabase-patch-public-caves-search.sql to enable discover.')
          } else {
            setPublicError(err.message || 'Could not load public caves.')
          }
          setPublicCaves([])
        })
        .finally(() => {
          if (!cancelled) setLoadingPublic(false)
        })
    }, query.trim() ? 280 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [tab, query])

  async function handleJoin(cave) {
    if (!cave?.id || joiningId) return
    if (cave.iMember) {
      onOpenCave?.(cave.id)
      return
    }
    setJoiningId(cave.id)
    setPublicError('')
    try {
      await joinPublicCaveAndOpen(cave.id, {
        name: cave.name,
        emoji: cave.emoji,
        ownerId: cave.ownerId,
        coverUrl: cave.coverUrl,
      })
      await onJoinedPublic?.(cave.id)
      onOpenCave?.(cave.id)
    } catch (err) {
      if (err instanceof CavesNotInstalledError) {
        setPublicError('Run supabase-patch-public-cave-join-fix.sql to enable joining.')
      } else {
        setPublicError(err.message || 'Could not join cave.')
      }
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="frens-title-xl flex items-center gap-2">
          <CaveIcon className="w-5 h-5" /> Caves
        </h2>
        {tab === 'mine' && !isEmpty && (
          <button
            type="button"
            onClick={onCreateClick}
            className="frens-btn-outline px-3 py-1.5 text-xs shrink-0"
          >
            + New cave
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: 'mine', label: 'My caves' },
          { id: 'discover', label: 'Discover' },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-[11px] sm:text-xs rounded-full px-3 py-1 border transition ${
                active
                  ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                  : 'frens-border frens-muted hover:text-black dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'mine' ? (
        isEmpty ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="w-full border-2 border-dashed frens-border rounded-2xl p-10 flex flex-col items-center gap-3 transition group"
          >
            <span className="w-16 h-16 rounded-full frens-avatar-ring flex items-center justify-center text-3xl group-hover:scale-105 transition">
              +
            </span>
            <span className="text-base frens-title">Create your first cave</span>
            <span className="text-xs frens-muted">
              a private room for you and your frens
            </span>
          </button>
        ) : (
          <ul className="space-y-3">
            {caves.map((cave) => {
              const isOwner = cave.ownerId === currentUserId
              return (
                <li key={cave.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCave(cave.id)}
                    className="w-full text-left border frens-border rounded-xl p-4 flex items-center gap-3 hover:frens-surface transition"
                  >
                    <CaveCoverThumb coverUrl={cave.coverUrl} className="w-12 h-12" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="frens-title-sm truncate">{cave.name}</span>
                        {isOwner && (
                          <span className="text-[10px] frens-muted border frens-border rounded-full px-2 py-0.5">
                            owner
                          </span>
                        )}
                      </span>
                      <span className="block text-xs frens-muted">
                        {(cave.members?.length ?? 0)} {(cave.members?.length ?? 0) === 1 ? 'fren' : 'frens'}
                        {(cave.messages?.length ?? 0) > 0 && (
                          <> · {cave.messages.length} messages</>
                        )}
                      </span>
                    </span>
                    <span className="frens-muted text-lg shrink-0">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search public caves…"
            className="frens-input py-2 w-full"
            autoComplete="off"
          />

          {publicError ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 border frens-border rounded-lg px-3 py-2">
              {publicError}
            </p>
          ) : null}

          {loadingPublic ? (
            <p className="text-sm frens-muted py-6 text-center">Searching…</p>
          ) : publicCaves.length === 0 && !publicError ? (
            <p className="text-sm frens-muted py-8 text-center">
              {query.trim() ? 'No public caves match.' : 'No public caves yet.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {publicCaves.map((cave) => (
                <li key={cave.id}>
                  <div className="border frens-border rounded-xl p-4 flex items-center gap-3">
                    <CaveCoverThumb coverUrl={cave.coverUrl} className="w-12 h-12" />
                    <span className="min-w-0 flex-1">
                      <span className="frens-title-sm truncate block">{cave.name}</span>
                      <span className="block text-xs frens-muted">
                        {cave.memberCount} {cave.memberCount === 1 ? 'fren' : 'frens'}
                        {cave.iMember ? ' · joined' : ' · public'}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(joiningId)}
                      onClick={() => handleJoin(cave)}
                      className={`shrink-0 text-xs rounded-full px-3 py-1.5 transition ${
                        cave.iMember
                          ? 'frens-btn-outline'
                          : 'bg-black text-white dark:bg-white dark:text-black'
                      } disabled:opacity-50`}
                    >
                      {joiningId === cave.id
                        ? '…'
                        : cave.iMember
                          ? 'Open'
                          : 'Join'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
