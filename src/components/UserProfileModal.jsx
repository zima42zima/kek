import { useEffect, useState } from 'react'
import Modal from './Modal'
import PostCard from './PostCard'
import { ProfileAvatar } from './FrogLogo'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { useDms } from '../context/DmsContext'
import { getProfileCard, SocialNotInstalledError } from '../lib/social'
import ProfileCavesPublic from './caves/ProfileCavesPublic'
import ProfileEchoesPublic from './echo/ProfileEchoesPublic'
import { MessageIcon } from './icons/UiIcons'
import RichText from './RichText'
import FrenHandle from './FrenHandle'
import { formatFrenHandle } from '../lib/frenName'
import { CosmosProfileLink } from './ProfileGallery'
import ProfilePlaylistsPublic from './playlists/ProfilePlaylistsPublic'
import ProfileGathererPublic from './gatherer/ProfileGathererPublic'
import SendLetterModal from './folds-letters/SendLetterModal'
import ProfileOwlPost from './owl/ProfileOwlPost'

export default function UserProfileModal({ userId, onClose, onOpenList, onNavigate, onOpenProfile, onOpenEcho, onOpenPlaylists, onOpenGatherer }) {
  const { user } = useAuth()
  const { setFollow, postsByUser, loadPostsForUser } = usePosts()
  const { openConversationWithUser } = useDms()
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [showSendLetter, setShowSendLetter] = useState(false)

  const isMe = user?.id && userId && user.id === userId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getProfileCard(userId)
      .then((c) => {
        if (cancelled) return
        if (!c) { setError('This fren could not be found.'); return }
        setCard(c)
        setFollowing(c.iFollow)
        setFollowers(c.followers)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof SocialNotInstalledError
          ? 'Following needs the latest database update.'
          : (err.message || 'Could not load this profile.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    loadPostsForUser(userId)
  }, [userId, loadPostsForUser])

  function toggleFollow() {
    const next = !following
    setFollowing(next)
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)))
    setFollow(userId, next)
  }

  async function handleMessage() {
    if (!card) return
    await openConversationWithUser(userId, {
      userId,
      frenName: card.frenName,
      avatarType: card.avatarType,
      avatarUrl: card.avatarUrl,
    })
    onNavigate?.('messages')
    onClose?.()
  }

  const theirPosts = postsByUser(userId)

  return (
    <>
    <Modal title="Profile" onClose={onClose}>
      {loading ? (
        <p className="text-sm frens-muted py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</p>
      ) : card ? (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-2">
            <ProfileAvatar profile={card} className="w-20 h-20" logoClassName="w-12 h-auto" />
            {!isMe && (
              <div className="flex items-center gap-2 shrink-0">
                <ProfileOwlPost
                  open={Boolean(card.owlPostOpen)}
                  onClick={() => {
                    if (card.owlPostOpen) setShowSendLetter(true)
                  }}
                />
                <button
                  type="button"
                  onClick={handleMessage}
                  className="frens-btn-outline w-10 h-10 rounded-full flex items-center justify-center"
                  aria-label={`Message ${card.frenName}`}
                  title="Message"
                >
                  <MessageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleFollow}
                  className={`text-sm rounded-full px-4 py-1.5 transition ${
                    following ? 'frens-btn-outline' : 'bg-black text-white dark:bg-white dark:text-black'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FrenHandle size="lg">{card.frenName}</FrenHandle>
              {card.frenHandle && (
                <span className="text-sm frens-muted">{formatFrenHandle(card.frenHandle)}</span>
              )}
              {card.isFounder && (
                <span className="text-[10px] text-[#6BC06B] dark:text-white border frens-border rounded-full px-2 py-0.5">
                  first fren
                </span>
              )}
            </div>
            {card.oneHumanThing && (
              <p className="text-sm frens-body-text italic mt-1">&ldquo;{card.oneHumanThing}&rdquo;</p>
            )}
            {card.bio && (
              <RichText text={card.bio} className="text-sm frens-body-text mt-1" />
            )}

            <CosmosProfileLink url={card.cosmosUrl} />

            <div className="flex gap-4 mt-2 text-sm">
              <button type="button" onClick={() => onOpenList?.(userId, 'following')} className="hover:underline">
                <span className="frens-stat">{card.following}</span> <span className="frens-muted">Following</span>
              </button>
              <button type="button" onClick={() => onOpenList?.(userId, 'followers')} className="hover:underline">
                <span className="frens-stat">{followers}</span> <span className="frens-muted">Followers</span>
              </button>
            </div>

            {!isMe && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs frens-muted mr-1">Connect</span>
                <ProfileCavesPublic userId={userId} frenName={card.frenName} onNavigate={onNavigate} />
                <ProfileEchoesPublic
                  userId={userId}
                  frenName={card.frenName}
                  onNavigate={onNavigate}
                  onOpenEcho={onOpenEcho}
                  onCloseProfile={onClose}
                />
                <ProfilePlaylistsPublic
                  userId={userId}
                  frenName={card.frenName}
                  onOpenPlaylists={onOpenPlaylists}
                  onCloseProfile={onClose}
                />
                <ProfileGathererPublic
                  userId={userId}
                  frenName={card.frenName}
                  onOpenGatherer={onOpenGatherer}
                  onNavigate={onNavigate}
                  onCloseProfile={onClose}
                />
              </div>
            )}
          </div>

          <div className="border-t frens-border pt-3 space-y-3">
            {theirPosts.length === 0 ? (
              <p className="text-sm frens-muted text-center py-4">No posts to show here yet.</p>
            ) : (
              theirPosts.map((p) => (
                <PostCard key={p.id} post={p} authorProfile={card} onOpenProfile={onOpenProfile} />
              ))
            )}
          </div>
        </div>
      ) : null}
    </Modal>
      {showSendLetter && card && (
        <SendLetterModal
          recipient={{ id: userId, frenName: card.frenName }}
          onClose={() => setShowSendLetter(false)}
        />
      )}
    </>
  )
}
