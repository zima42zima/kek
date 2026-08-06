import { useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import CommentBody from '../CommentBody'
import PillComposer from '../PillComposer'
import EmojiReactions from '../EmojiReactions'
import ConfirmDialog from '../ConfirmDialog'
import CaveReplyIcon from '../caves/CaveReplyIcon'
import { useAuth } from '../../context/AuthContext'
import { appendGifUrlToText, prepareCommentText } from '../../lib/imageAttach'
import { insertAtCaret } from '../../lib/insertText'
import { relativeTime } from '../../lib/notifications'
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

function ReplyPreview({ preview, onJump = null }) {
  if (!preview) return null
  const snippet = preview.text ? String(preview.text).slice(0, 80) : ''
  const jumpId = preview.parentId ?? null
  const canJump = Boolean(jumpId && onJump)
  const className = `inline-flex items-center gap-1.5 max-w-full text-[11px] frens-muted mb-0.5 ${
    canJump ? 'hover:text-black/80 dark:hover:text-white/80 cursor-pointer' : ''
  }`
  const body = (
    <>
      <CaveReplyIcon className="w-3 h-3 opacity-70 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="font-medium text-black/70 dark:text-white/70">{preview.authorName || 'a fren'}</span>
        {snippet ? <span className="opacity-75"> · {snippet}</span> : null}
      </span>
    </>
  )
  if (!canJump) return <div className={className}>{body}</div>
  return (
    <button type="button" onClick={() => onJump(jumpId)} className={className} title="Jump to comment">
      {body}
    </button>
  )
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
  const [replyTo, setReplyTo] = useState(null)
  const inputRef = useRef(null)
  const comments = echo.comments ?? []

  if (!echo.allowComments) {
    return (
      <p className="text-xs frens-muted text-center py-2">Comments are off for this echo.</p>
    )
  }

  const showComposer = canCompose && (!requireReviewed || reviewed)

  function startReply(c) {
    if (!showComposer) return
    setReplyTo({
      id: c.id,
      authorName: commentName(c),
      text: commentText(c).slice(0, 120),
    })
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function jumpToComment(id) {
    const el = document.getElementById(`echo-comment-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function submit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy || !showComposer) return
    setBusy(true)
    try {
      const prepared = await prepareCommentText(text)
      const parentId = replyTo?.id ?? null
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
        parentId,
        replyPreview: parentId
          ? {
              authorName: replyTo.authorName || 'a fren',
              text: replyTo.text || '',
              parentId,
            }
          : null,
      })
      setDraft('')
      setReplyTo(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && !showComposer ? (
        <p className="text-xs frens-muted">No comments yet.</p>
      ) : comments.length > 0 ? (
        <ul className="space-y-3">
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
            const isOwn = Boolean(user?.id && uid && String(uid) === String(user.id))
            const canAct = Boolean(user?.id && c.id && !String(c.id).startsWith('ec-'))
            const canReact = canAct
            const canReply = Boolean(showComposer && c.id)

            return (
              <li key={c.id} id={`echo-comment-${c.id}`} className="flex gap-2 group/comment">
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
                  {c.replyPreview ? (
                    <ReplyPreview preview={c.replyPreview} onJump={jumpToComment} />
                  ) : null}
                  <CommentBody text={commentText(c)} />
                  <EmojiReactions
                    reactions={normalizeEmojiReactions(c.reactions)}
                    canReact={canReact}
                    onReact={
                      canReact && onToggleCommentReaction
                        ? (emoji) => onToggleCommentReaction(echo.id, c.id, emoji)
                        : null
                    }
                    onReply={canReply ? () => startReply(c) : null}
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
        <div className="space-y-2">
          {replyTo ? (
            <div className="flex items-center gap-2 rounded-xl border frens-border bg-black/[0.03] dark:bg-white/[0.04] px-2.5 py-1.5">
              <div className="min-w-0 flex-1 text-[11px] frens-muted truncate">
                Reply to <span className="font-medium text-black dark:text-white">{replyTo.authorName}</span>
                {replyTo.text ? <span className="opacity-75"> · {replyTo.text}</span> : null}
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="shrink-0 text-sm frens-muted hover:text-black dark:hover:text-white leading-none"
                aria-label="Cancel reply"
              >
                ×
              </button>
            </div>
          ) : null}
          <PillComposer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            placeholder={replyTo ? `Reply to ${replyTo.authorName}…` : 'say something'}
            busy={busy}
            disabled={!showComposer}
            inputRef={inputRef}
            submitDisabled={!draft.trim() || busy || !showComposer}
            onMediaPick={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
            onEmoji={(emoji) => setDraft((prev) => insertAtCaret(inputRef.current, prev, emoji))}
            onGif={(url) => setDraft((prev) => appendGifUrlToText(prev, url))}
          />
        </div>
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
