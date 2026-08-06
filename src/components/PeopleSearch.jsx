import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { ProfileAvatar } from './FrogLogo'
import FrenHandle from './FrenHandle'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { searchAll } from '../lib/search'
import { formatFrenHandle } from '../lib/frenName'
import { SearchIcon, LocationIcon } from './icons/UiIcons'
import EchoIcon from './echo/EchoIcon'

function previewText(text, max = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/**
 * Absolute Search — people, public posts (words), public echoes (taglines / places).
 * Modal title stays “Search”.
 */
export default function PeopleSearch({
  open,
  onClose,
  onSelectUser,
  onSelectPost,
  onSelectEcho,
  onSelectPlace,
  /** Optional near/map echoes so tagline search hits local pins too. */
  localEchoes = [],
}) {
  const { user } = useAuth()
  const { posts: feedPosts = [] } = usePosts()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState([])
  const [posts, setPosts] = useState([])
  const [echoes, setEchoes] = useState([])
  const [places, setPlaces] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const feedRef = useRef(feedPosts)
  const echoesRef = useRef(localEchoes)
  feedRef.current = feedPosts
  echoesRef.current = localEchoes

  useEffect(() => {
    if (!open) {
      setQuery('')
      setPeople([])
      setPosts([])
      setEchoes([])
      setPlaces([])
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
      setPeople([])
      setPosts([])
      setEchoes([])
      setPlaces([])
      setError(null)
      setSearching(false)
      return undefined
    }
    setSearching(true)
    setError(null)
    const t = setTimeout(() => {
      searchAll(q, {
        userId: user?.id,
        feedPosts: feedRef.current,
        localEchoes: echoesRef.current,
      })
        .then((res) => {
          setPeople(res.people || [])
          setPosts(res.posts || [])
          setEchoes(res.echoes || [])
          setPlaces(res.places || [])
          setError(null)
        })
        .catch((err) => {
          console.error('Search failed:', err)
          setPeople([])
          setPosts([])
          setEchoes([])
          setPlaces([])
          setError(err?.message || 'Search failed')
        })
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(t)
  }, [query, user?.id, open])

  if (!open) return null

  const hasAny = people.length > 0 || posts.length > 0 || echoes.length > 0 || places.length > 0
  const empty = query.trim() && !searching && !error && !hasAny

  function pick(fn) {
    return (...args) => {
      fn?.(...args)
      onClose?.()
    }
  }

  return (
    <Modal title="Search" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 frens-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Frens, posts, echoes, places…"
            className="frens-input py-2.5 pl-9 w-full"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {!query.trim() ? (
          <p className="text-xs frens-muted text-center py-6">
            Find frens by @handle, words from public posts, and echo taglines or places.
          </p>
        ) : searching ? (
          <p className="text-sm frens-muted py-4 text-center">Searching…</p>
        ) : error ? (
          <p className="text-sm text-center py-4 text-red-500/90 dark:text-red-400/90">
            {error}
          </p>
        ) : empty ? (
          <p className="text-sm frens-muted py-4 text-center">Nothing matches.</p>
        ) : (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto -mx-1 px-0.5">
            {people.length > 0 && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wide frens-muted px-2 mb-1">People</h3>
                <ul className="space-y-0.5">
                  {people.map((p) => (
                    <li key={p.userId}>
                      <button
                        type="button"
                        onClick={pick(() => onSelectUser?.(p.userId))}
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
              </section>
            )}

            {posts.length > 0 && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wide frens-muted px-2 mb-1">Posts</h3>
                <ul className="space-y-0.5">
                  {posts.map((post) => (
                    <li key={post.id}>
                      <button
                        type="button"
                        onClick={pick(() => onSelectPost?.(post))}
                        className="w-full flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition"
                      >
                        <ProfileAvatar
                          profile={post}
                          className="w-9 h-9 shrink-0 mt-0.5"
                          logoClassName="w-4 h-auto"
                        />
                        <span className="min-w-0 flex-1">
                          <FrenHandle className="block text-sm">{post.frenName}</FrenHandle>
                          <span className="block text-xs frens-body-text mt-0.5 line-clamp-2">
                            {previewText(post.text) || (post.image ? 'Photo post' : 'Post')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {echoes.length > 0 && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wide frens-muted px-2 mb-1">Echoes</h3>
                <ul className="space-y-0.5">
                  {echoes.map((echo) => (
                    <li key={echo.id}>
                      <button
                        type="button"
                        onClick={pick(() => onSelectEcho?.(echo))}
                        className="w-full flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition"
                      >
                        <span className="w-9 h-9 rounded-full frens-btn-outline flex items-center justify-center shrink-0 mt-0.5">
                          <EchoIcon className="w-4 h-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm frens-body-text truncate">
                            {echo.label?.trim() || echo.placeLabel || echo.kind || 'Echo'}
                          </span>
                          <span className="block text-[11px] frens-muted truncate mt-0.5">
                            {[echo.authorName, echo.placeLabel || echo.cityLabel].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {places.length > 0 && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wide frens-muted px-2 mb-1">Places</h3>
                <ul className="space-y-0.5">
                  {places.map((place) => {
                    const key = place.placeKey || `${place.lat}-${place.lon}`
                    const label = place.placeLabel || place.cityLabel || 'Place'
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={pick(() => onSelectPlace?.(place))}
                          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition"
                        >
                          <span className="w-9 h-9 rounded-full frens-btn-outline flex items-center justify-center shrink-0">
                            <LocationIcon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm truncate">{label}</span>
                            <span className="block text-[11px] frens-muted truncate">
                              {[place.cityLabel && place.cityLabel !== label ? place.cityLabel : null,
                                place.echoCount != null ? `${place.echoCount} echo${place.echoCount === 1 ? '' : 's'}` : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
