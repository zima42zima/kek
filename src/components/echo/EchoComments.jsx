import { useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import CommentBody from '../CommentBody'
import PillComposer from '../PillComposer'
import EmojiReactions from '../EmojiReactions'
import { useAuth } from '../../context/AuthContext'
import { appendGifUrlToText, prepareCommentText } from '../../lib/imageAttach'
import { insertAtCaret } from '../../lib/insertText'
import { relativeTime } from '../../lib/notifications'
import { applyCommentReactionToggle } from '../../lib/commentReactions'
import { normalizeEmojiReactions } from '../../lib/emojiReactions'
import { withLiveAuthorAvatar } from '../../lib/posts'

function commentText(c) {
  return c.text ?? c.body ?? ''
}

function commentUserId(c) {
  return c.authorId ?? c.userId ?? null
}

function commentName(c) {
  return c.authorName ?? c.frenName ?? 'a fren'
}

function commentTimestamp(c) {
  if (c.timestamp) return c.timestamp
  if (c.createdAt) return relativeTime(new Date(c.createdAt).toISOString())
  return ''
}

export default function EchoComments({
  echo,
  reviewed,
  canCompose = true,
  requireReviewed = true,
  onAddComment,
  onRemoveComment,
  onToggleCommentReaction,
}) {
  const { user, profile } = useAuth()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const comments = echo.comments ?? []

  if (!echo.allowComments) {
    return (
      <p className="text-xs frens-muted text-center py-2">Comments are off for this echo.</p>
    )
  }

  if (requireReviewed && !reviewed) {
    return (
      <p className="text-xs frens-muted text-center py-2">
        Listen or watch the echo first, then you can comment.
      </p>
    )
  }

  async function submit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy || !canCompose) return
    setBusy(true)
    try {
      const prepared = await prepareCommentText(text)
      onAddComment?.(echo.id, {
        id: `ec-${Date.now()}`,
        authorId: user?.id ?? profile?.userId,
        authorName: profile?.frenName || 'you',
        avatarType: profile?.avatarType || 'frog',
        avatarUrl: profile?.avatarUrl || null,
        text: prepared,
        createdAt: Date.now(),
        timestamp: relativeTime(new Date().toISOString()),
        reactions: [],
      })
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 border-t frens-border pt-3">
      <p className="text-xs frens-label">
        {canCompose ? 'Comments' : 'Comments on your echo'}
      </p>

      {comments.length === 0 ? (
        <p className="text-xs frens-muted">
          {canCompose ? 'say something...' : 'No comments yet.'}
        </p>
      ) : (
        <ul className="space-y-3 max-h-48 overflow-y-auto">
          {comments.map((c) => {
            const uid = commentUserId(c)
            const commentAuthor = withLiveAuthorAvatar(
              {
                ...c,
                frenName: commentName(c),
                userId: uid,
              },
              user?.id && uid && String(uid) === String(user.id)
                ? { id: user.id, ...profile }
                : null,
            )
            const canReact = Boolean(user?.id && uid && String(user.id) !== String(uid))

            return (
              <li key={c.id} className="flex gap-2">
                <ProfileAvatar profile={commentAuthor} className="w-7 h-7 shrink-0" logoClassName="w-4 h-auto" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <FrenHandle className="text-xs">{commentName(c)}</FrenHandle>
                    <span className="text-[10px] frens-muted shrink-0">{commentTimestamp(c)}</span>
                    {user?.id && uid && String(user.id) === String(uid) && onRemoveComment && (
                      <button
                        type="button"
                        onClick={() => onRemoveComment(echo.id, c.id)}
                        className="text-[10px] frens-action ml-auto shrink-0"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <CommentBody text={commentText(c)} />
                  <EmojiReactions
                    reactions={normalizeEmojiReactions(c.reactions)}
                    canReact={canReact}
                    onReact={
                      canReact && onToggleCommentReaction
                        ? (emoji) => onToggleCommentReaction(echo.id, c.id, emoji)
                        : null
                    }
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canCompose && (
        <PillComposer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          placeholder="leave a comment..."
          busy={busy}
          disabled={!canCompose}
          inputRef={inputRef}
          submitDisabled={!draft.trim() || busy || !canCompose}
          onMediaPick={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
          onEmoji={(emoji) => setDraft((prev) => insertAtCaret(inputRef.current, prev, emoji))}
          onGif={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
        />
      )}
    </div>
  )
}
