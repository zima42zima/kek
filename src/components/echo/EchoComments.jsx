import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import CommentBody from '../CommentBody'
import PillComposer from '../PillComposer'
import EmojiReactions from '../EmojiReactions'
import ConfirmDialog from '../ConfirmDialog'
import CaveReplyIcon from '../caves/CaveReplyIcon'
import AuraIcon, { AURA_COLORS, AURA_IDLE } from '../AuraIcon'
import { useAuth } from '../../context/AuthContext'
import { appendGifUrlToText, prepareCommentText } from '../../lib/imageAttach'
import { insertAtCaret } from '../../lib/insertText'
import { relativeTime } from '../../lib/notifications'
import { normalizeEmojiReactions } from '../../lib/emojiReactions'
import { withLiveAuthorAvatar } from '../../lib/posts'
import ReportContentButton from '../ReportContentButton'
import { MessageIcon, POST_ACTION_BTN, POST_ACTION_ICON, POST_ACTION_BADGE } from '../icons/UiIcons'
import PostActionTip from '../PostActionTip'

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

/** Compact aura control — same look as post aura on the action row. */
function CommentAuraButton({
  auraCount = 0,
  iGaveAura = false,
  canToggle = false,
  onToggle,
}) {
  const [colorIndex, setColorIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [flashColor, setFlashColor] = useState(null)
  const [displayGave, setDisplayGave] = useState(iGaveAura)
  const [displayCount, setDisplayCount] = useState(auraCount)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setDisplayGave(iGaveAura)
    setDisplayCount(auraCount)
  }, [iGaveAura, auraCount])

  const savedColor = AURA_COLORS[colorIndex % AURA_COLORS.length]
  const iconColor = animating && flashColor
    ? flashColor
    : displayGave
      ? savedColor
      : AURA_IDLE

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!canToggle || pending || !onToggle) return

    const prevGave = displayGave
    const prevCount = displayCount
    const next = (colorIndex + 1) % AURA_COLORS.length
    setColorIndex(next)
    setFlashColor(AURA_COLORS[next])
    setAnimating(true)
    setDisplayGave(!prevGave)
    setDisplayCount(Math.max(0, prevCount + (prevGave ? -1 : 1)))
    window.setTimeout(() => {
      setAnimating(false)
      setFlashColor(null)
    }, 380)

    setPending(true)
    try {
      await onToggle()
    } catch {
      setDisplayGave(prevGave)
      setDisplayCount(prevCount)
    } finally {
      setPending(false)
    }
  }

  if (!canToggle) {
    return (
      <PostActionTip label="aura">
        <span className={`relative ${POST_ACTION_BTN} frens-muted pointer-events-none`}>
          <AuraIcon color={displayCount > 0 ? AURA_COLORS[0] : AURA_IDLE} className={POST_ACTION_ICON} />
          {displayCount > 0 ? (
            <span className={POST_ACTION_BADGE}>{displayCount}</span>
          ) : null}
        </span>
      </PostActionTip>
    )
  }

  return (
    <PostActionTip label="aura">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={displayGave}
        aria-label={displayGave ? 'Remove aura' : 'Give aura'}
        className={`${POST_ACTION_BTN} ${
          displayGave ? 'ring-1 ring-black/15 dark:ring-white/25' : 'frens-muted'
        }`}
      >
        <AuraIcon color={iconColor} animate={animating} active={displayGave} className={POST_ACTION_ICON} />
        {displayCount > 0 ? (
          <span className={POST_ACTION_BADGE}>{displayCount}</span>
        ) : null}
      </button>
    </PostActionTip>
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
  onToggleCommentAura,
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
        auraCount: 0,
        iGaveAura: false,
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
            const persisted = Boolean(c.id && !String(c.id).startsWith('ec-'))
            const canReact = Boolean(user?.id && persisted)
            const canReply = Boolean(showComposer && c.id)
            const canAura = Boolean(user?.id && persisted && !isOwn && onToggleCommentAura)

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

                  {/* Same action language as posts / caves: aura · reply · reactions */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <CommentAuraButton
                      auraCount={c.auraCount ?? 0}
                      iGaveAura={Boolean(c.iGaveAura)}
                      canToggle={canAura}
                      onToggle={canAura ? () => onToggleCommentAura(echo.id, c.id) : undefined}
                    />
                    {canReply ? (
                      <PostActionTip label="reply">
                        <button
                          type="button"
                          onClick={() => startReply(c)}
                          aria-label={`Reply to ${commentName(c)}`}
                          className={`${POST_ACTION_BTN} frens-muted`}
                        >
                          <MessageIcon className={POST_ACTION_ICON} />
                        </button>
                      </PostActionTip>
                    ) : null}
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
              <CaveReplyIcon className="w-3.5 h-3.5 frens-muted shrink-0" />
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
