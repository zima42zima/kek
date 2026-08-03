import { useEffect, useState } from 'react'
import Modal from './Modal'
import { ProfileAvatar } from './FrogLogo'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { listFollowers, listFollowing, SocialNotInstalledError } from '../lib/social'
import { MessageIcon } from './icons/UiIcons'
import FrenHandle from './FrenHandle'
import { formatFrenHandle } from '../lib/frenName'

export default function FollowListModal({ userId, initialTab = 'followers', onClose, onOpenUser, onMessage }) {
  const { user } = useAuth()
  const { setFollow } = usePosts()
  const [tab, setTab] = useState(initialTab)
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const fetcher = tab === 'followers' ? listFollowers : listFollowing
    fetcher(userId)
      .then((rows) => { if (!cancelled) setPeople(rows) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof SocialNotInstalledError
          ? 'Following needs the latest database update.'
          : (err.message || 'Could not load this list.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, tab])

  function toggleFollow(person) {
    const next = !person.iFollow
    setPeople((prev) => prev.map((p) => (p.userId === person.userId ? { ...p, iFollow: next } : p)))
    setFollow(person.userId, next)
  }

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
        tab === id ? 'border-frens bg-black/[0.04] dark:bg-white/[0.06]' : 'border-transparent frens-muted'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Modal title="frens" onClose={onClose}>
      <div className="flex mb-2 -mt-1">
        {tabBtn('followers', 'Followers')}
        {tabBtn('following', 'Following')}
      </div>

      {loading ? (
        <p className="text-sm frens-muted py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</p>
      ) : people.length === 0 ? (
        <p className="text-sm frens-muted py-8 text-center">
          {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <ul className="-mx-1 max-h-[60vh] overflow-y-auto divide-y divide-frens">
          {people.map((p) => {
            const isMe = user?.id === p.userId
            return (
              <li key={p.userId} className="flex items-center gap-3 px-1 py-3">
                <button
                  type="button"
                  onClick={() => onOpenUser?.(p.userId)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <ProfileAvatar profile={p} className="w-10 h-10 shrink-0" logoClassName="w-6 h-auto" />
                  <div className="min-w-0">
                    <FrenHandle>{p.frenName}</FrenHandle>
                    {p.frenHandle && (
                      <p className="text-[11px] frens-muted truncate">{formatFrenHandle(p.frenHandle)}</p>
                    )}
                    {p.bio && <p className="text-xs frens-muted truncate">{p.bio}</p>}
                  </div>
                </button>
                {!isMe && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onMessage && (
                      <button
                        type="button"
                        onClick={() => onMessage(p)}
                        className="frens-btn-outline w-9 h-9 rounded-full flex items-center justify-center"
                        aria-label={`Message ${p.frenName}`}
                        title="Message"
                      >
                        <MessageIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleFollow(p)}
                      className={`text-xs rounded-full px-3 py-1.5 transition ${
                        p.iFollow ? 'frens-btn-outline' : 'bg-black text-white dark:bg-white dark:text-black'
                      }`}
                    >
                      {p.iFollow ? 'Following' : 'Follow'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
