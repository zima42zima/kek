import { useEffect } from 'react'
import { ProfileAvatar } from './FrogLogo'
import { audienceLabel, usePosts } from '../context/PostsContext'
import AudienceIcon from './AudienceIcon'
import PostComments, { CommentIcon } from './PostComments'
import RichText from './RichText'
import AuraButton, { AuraCount } from './AuraButton'
import ShowToFrensButton from './ShowToFrensButton'
import PostShareButton from './PostShareButton'
import PostReactionButton from './PostReactionButton'
import PostMedia from './PostMedia'
import MediaLightbox from './MediaLightbox'
import PinnedLabel from './PinnedLabel'
import PostTimestamp from './PostTimestamp'
import FrenHandle from './FrenHandle'
import PostOwnerMenu from './PostOwnerMenu'
import ReportContentButton from './ReportContentButton'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { POST_ACTION_BTN, POST_ACTION_ICON, POST_ACTION_BADGE, POST_ACTION_ROW } from './icons/UiIcons'
import PostActionTip from './PostActionTip'
import { isTextOnlyThoughtPost } from '../lib/urls'
import { withLiveAuthorAvatar } from '../lib/posts'

export default function PostDetailModal({ post, authorProfile, onClose, onOpenProfile }) {
  const { setFollow, removePost, pinPost, unpinPost, getPostAura, getPostReactions, togglePostReaction } = usePosts()
  const { user, profile } = useAuth()
  const [expandedEmbed, setExpandedEmbed] = useState(null)

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
  const showThoughtMark = isTextOnlyThoughtPost(post)
  const following = post.iFollowAuthor ?? false
  const canOpenProfile = post.userId && onOpenProfile

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="frens-surface border frens-border rounded-none w-full max-w-[35.2rem] max-h-[92vh] sm:max-h-[88vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Post"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b frens-border frens-surface">
          <span className="text-sm frens-muted">Post</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="frens-muted text-xl leading-none w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            {showAvatar ? (
              canOpenProfile ? (
                <button type="button" onClick={() => onOpenProfile(post.userId)} className="shrink-0 self-start rounded-full">
                  <ProfileAvatar profile={displayPost} className="w-11 h-11 shrink-0" logoClassName="w-6 h-auto" />
                </button>
              ) : (
                <ProfileAvatar profile={displayPost} className="w-10 h-10 shrink-0" logoClassName="w-5 h-auto" />
              )
            ) : (
              <div className="w-10 h-10 shrink-0 rounded-full frens-avatar-ring flex items-center justify-center text-base">
                {post.avatar}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {shownByFren ? (
                <p className="text-[11px] frens-muted mb-1.5">
                  {post.shownByName} thought your frens might like this
                </p>
              ) : null}

              <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
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
                </div>
                <div className="ml-auto flex items-center gap-1 shrink-0">
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
                      onDelete={() => { removePost(post.id); onClose?.() }}
                    />
                  ) : user?.id ? (
                    <ReportContentButton
                      kind="post"
                      refId={post.id}
                      reportedUserId={post.userId}
                      preview={post.text || post.image || post.frenName}
                      subjectLabel="this post"
                      className="text-[10px] frens-muted hover:underline px-1"
                    />
                  ) : null}
                </div>
              </div>

              {post.text && (
                <div className={post.image ? 'mb-2.5' : 'mb-0.5'}>
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

              {post.image && <PostMedia src={post.image} size="detail" />}

              {post.audience === 'other' && post.tags?.length > 0 && (
                <p className="text-xs frens-muted mt-2">
                  tagged: {post.tags.map((t) => `@${t}`).join(' ')}
                </p>
              )}

              <div className={`${POST_ACTION_ROW} mb-3`}>
                {canAura ? (
                  <AuraButton postId={post.id} auraCount={auraCount} iGaveAura={iGaveAura} />
                ) : (
                  <AuraCount count={auraCount} />
                )}
                <PostActionTip label="leave a thought">
                  <span
                    className={`${POST_ACTION_BTN} frens-muted pointer-events-none`}
                    aria-label="Comments"
                  >
                    <CommentIcon className={POST_ACTION_ICON} />
                    {(post.commentCount ?? 0) > 0 ? (
                      <span className={POST_ACTION_BADGE}>
                        {post.commentCount}
                      </span>
                    ) : null}
                  </span>
                </PostActionTip>
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

              <PostComments postId={post.id} count={post.commentCount ?? 0} alwaysOpen focusInput hideHeader />
            </div>
          </div>
        </div>
      </div>

      {expandedEmbed && (
        <MediaLightbox
          src={expandedEmbed.src}
          kind={expandedEmbed.kind}
          onClose={() => setExpandedEmbed(null)}
        />
      )}
    </div>
  )
}
