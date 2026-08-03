import { useState, useEffect } from 'react'
import { ProfileAvatar } from './FrogLogo'
import { audienceLabel, usePosts } from '../context/PostsContext'
import { useAuth } from '../context/AuthContext'
import AudienceIcon from './AudienceIcon'
import PostComments from './PostComments'
import RichText from './RichText'
import AuraButton, { AuraCount } from './AuraButton'
import ShowToFrensButton from './ShowToFrensButton'
import PostShareButton from './PostShareButton'
import PostReactionButton from './PostReactionButton'
import { POST_ACTION_ROW } from './icons/UiIcons'
import PostMedia from './PostMedia'
import MediaLightbox from './MediaLightbox'
import PinnedLabel from './PinnedLabel'
import PostTimestamp from './PostTimestamp'
import FrenHandle from './FrenHandle'
import PostOwnerMenu from './PostOwnerMenu'
import PostDetailModal from './PostDetailModal'
import PostMorseRule from './PostMorseRule'
import { isTextOnlyThoughtPost } from '../lib/urls'
import { withLiveAuthorAvatar } from '../lib/posts'

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('a, button, input, textarea, [data-no-post-open]'))
}

export default function PostCard({ post, authorProfile, onOpenProfile, highlight = false, openComments = false }) {
  const { setFollow, removePost, pinPost, unpinPost, getPostAura, getPostReactions, togglePostReaction } = usePosts()
  const { user, profile } = useAuth()
  const [expandedEmbed, setExpandedEmbed] = useState(null)
  const [detailOpen, setDetailOpen] = useState(openComments)

  const liveProfile = authorProfile
    ?? (user?.id && post?.userId && String(post.userId) === String(user.id) ? { id: user.id, ...profile } : null)
  const displayPost = withLiveAuthorAvatar(post, liveProfile)

  const canDelete = Boolean(post.userId && user?.id && post.userId === user.id)
  const showAvatar =
    (displayPost.avatarType === 'frog') ||
    (displayPost.avatarType === 'photo' && displayPost.avatarUrl)

  const { auraCount, iGaveAura } = getPostAura(post)
  const canAura = Boolean(user?.id)
  const canReact = Boolean(user?.id)
  const canShowToFrens =
    Boolean(user?.id && post.userId && post.userId !== user.id) &&
    ['everyone', 'frens'].includes(post.audience)
  const shownByFren = post.feedSource === 'shown' && post.shownByName
  const canFollow = post.userId && user?.id && post.userId !== user.id
  const following = post.iFollowAuthor ?? false
  const canOpenProfile = post.userId && onOpenProfile
  const showThoughtMark = isTextOnlyThoughtPost(post)
  const avatarClass = 'w-11 h-11 shrink-0 self-start'
  const avatarLogoClass = 'w-6 h-auto'

  useEffect(() => {
    if (openComments || highlight) setDetailOpen(true)
  }, [openComments, highlight])

  function openDetail() {
    setDetailOpen(true)
  }

  function handleContentClick(e) {
    if (isInteractiveTarget(e.target)) return
    openDetail()
  }

  function handleContentKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    if (isInteractiveTarget(e.target)) return
    e.preventDefault()
    openDetail()
  }

  return (
    <article
      id={`post-${post.id}`}
      className={`transition-shadow ${highlight ? 'ring-2 ring-[#6BC06B] ring-inset shadow-md' : ''}`}
    >
      <PostMorseRule />
      <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        {showAvatar ? (
          canOpenProfile ? (
            <button type="button" onClick={() => onOpenProfile(post.userId)} className="shrink-0 self-start rounded-full">
              <ProfileAvatar profile={displayPost} className={avatarClass} logoClassName={avatarLogoClass} />
            </button>
          ) : (
            <ProfileAvatar profile={displayPost} className={avatarClass} logoClassName={avatarLogoClass} />
          )
        ) : (
          <div className={`${avatarClass} rounded-full frens-avatar-ring flex items-center justify-center text-lg`}>
            {post.avatar}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {shownByFren ? (
            <p className="text-[11px] frens-muted mb-2">
              {post.shownByName} thought your frens might like this
            </p>
          ) : null}
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            {canOpenProfile ? (
              <FrenHandle onClick={() => onOpenProfile(post.userId)}>
                {post.frenName}
              </FrenHandle>
            ) : (
              <FrenHandle>{post.frenName}</FrenHandle>
            )}
            {post.isPinned ? <PinnedLabel /> : null}
            <PostTimestamp timestamp={post.timestamp} createdAt={post.createdAt} />
            {canFollow && !following && (
              <button
                type="button"
                onClick={() => setFollow(post.userId, true)}
                className="shrink-0 text-[11px] rounded-full px-2.5 py-0.5 transition bg-black text-white dark:bg-white dark:text-black"
              >
                Follow
              </button>
            )}
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {post.audience && post.audience !== 'everyone' && (
                <span
                  className="border frens-border rounded-full p-1 inline-flex items-center justify-center"
                  title={audienceLabel(post.audience)}
                  aria-label={audienceLabel(post.audience)}
                >
                  <AudienceIcon id={post.audience} className="w-3 h-3" />
                </span>
              )}
              {canDelete ? (
                <PostOwnerMenu
                  isPinned={Boolean(post.isPinned)}
                  onPin={() => pinPost(post.id)}
                  onUnpin={unpinPost}
                  onDelete={() => removePost(post.id)}
                />
              ) : null}
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
            className="rounded-lg -mx-1 px-1 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition"
            aria-label="Open post"
          >
            {post.text && (
              <div className="relative z-0 mb-3">
                <RichText
                  text={post.text}
                  className="frens-post-text"
                  variant="timeline"
                  thoughtMark={showThoughtMark}
                  showAddToPlaylist
                  onExpandMedia={(src, kind) => setExpandedEmbed({ src, kind })}
                />
              </div>
            )}

            {post.image && (
              <div data-no-post-open>
                <PostMedia src={post.image} />
              </div>
            )}

            {post.audience === 'other' && post.tags?.length > 0 && (
              <p className="text-xs frens-muted mb-2">
                tagged: {post.tags.map((t) => `@${t}`).join(' ')}
              </p>
            )}
          </div>

          <div className={`${POST_ACTION_ROW} items-center`}>
            {canAura ? (
              <AuraButton postId={post.id} auraCount={auraCount} iGaveAura={iGaveAura} />
            ) : (
              <AuraCount count={auraCount} />
            )}
            <PostComments
              postId={post.id}
              count={post.commentCount ?? 0}
              onOpen={openDetail}
              inline
            />
            <PostReactionButton
              reactions={getPostReactions(post)}
              onReact={canReact ? (id) => togglePostReaction(post.id, id) : undefined}
            />
            <div className="ml-auto flex items-center gap-4 shrink-0">
              {canShowToFrens ? (
                <ShowToFrensButton postId={post.id} iShowToFrens={post.iShowToFrens} />
              ) : null}
              <PostShareButton post={post} />
            </div>
          </div>
        </div>
      </div>
      </div>
      <PostMorseRule />
      {expandedEmbed && (
        <MediaLightbox
          src={expandedEmbed.src}
          kind={expandedEmbed.kind}
          onClose={() => setExpandedEmbed(null)}
        />
      )}
      {detailOpen && (
        <PostDetailModal
          post={displayPost}
          authorProfile={liveProfile}
          onClose={() => setDetailOpen(false)}
          onOpenProfile={onOpenProfile}
        />
      )}
    </article>
  )
}
