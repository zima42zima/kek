import { useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import CommentBody from '../CommentBody'
import PillComposer from '../PillComposer'
import EmojiReactions from '../EmojiReactions'
import ConfirmDialog from '../ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { appendGifUrlToText, prepareCommentText } from '../../lib/imageAttach'
import { insertAtCaret } from '../../lib/insertText'
import { relativeTime } from '../../lib/notifications'
import { applyCommentReactionToggle } from '../../lib/commentReactions'
import { normalizeEmojiReactions } from '../../lib/emojiReactions'
import { withLiveAuthorAvatar } from '../../lib/posts'
import ReportContentButton from '../ReportContentButton'

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
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const inputRef = useRef(null)
  const comments = echo.comments ?? []

  if (!echo.allowComments) {
    return (
      <p className="text-xs frens-muted text-center py-2">Comments are off for this echo.</p>
    )
  }

  const showComposer = canCompose && (!requireReviewed || reviewed)

  async function submit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy || !showComposer) return
    setBusy(true)
    try {
      const prepared = await prepareCommentText(text)
      await onAddComment?.(echo.id, {
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
    <div className="space-y-3">
      {comments.length === 0 && !showComposer ? (
        <p className="text-xs frens-muted">No comments yet.</p>
      ) : comments.length > 0 ? (
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
            const isOwn = Boolean(user?.id && uid && String(user.id) === String(uid))

            return (
              <li key={c.id} className="flex gap-2 group/comment">
                <ProfileAvatar profile={commentAuthor} className="w-7 h-7 shrink-0" logoClassName="w-4 h-auto" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FrenHandle className="text-xs">{commentName(c)}</FrenHandle>
                    <span className="text-[10px] frens-muted shrink-0">{commentTimestamp(c)}</span>
                    {isOwn && onRemoveComment ? (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(c.id)}
                        className="ml-auto shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[17px] leading-none text-black dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition"
                        aria-label="Delete comment"
                        title="Delete"
                      >
                        ×
                      </button>
                    ) : !isOwn && user?.id ? (
                      <ReportContentButton
                        kind="echo_comment"
                        refId={c.id}
                        reportedUserId={uid}
                        preview={commentText(c)}
                        subjectLabel="this comment"
                        className="ml-auto text-[10px] frens-action shrink-0"
                      />
                    ) : null}
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
      ) : null}

      {canCompose && requireReviewed && !reviewed ? (
        <p className="text-xs frens-muted text-center py-1">
          Listen or watch first to leave a comment.
        </p>
      ) : null}

      {showComposer && (
        <PillComposer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          placeholder="say something"
          busy={busy}
          disabled={!showComposer}
          inputRef={inputRef}
          submitDisabled={!draft.trim() || busy || !showComposer}
          onMediaPick={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
          onEmoji={(emoji) => setDraft((prev) => insertAtCaret(inputRef.current, prev, emoji))}
          onGif={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete comment?"
        message="This can’t be undone."
        confirmLabel="Delete"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId
          setPendingDeleteId(null)
          if (id) onRemoveComment?.(echo.id, id)
        }}
      />
    </div>
  )
}
