import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar } from './FrogLogo'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import CommentBody from './CommentBody'
import FrenHandle from './FrenHandle'
import PillComposer from './PillComposer'
import { appendGifUrlToText, prepareCommentText } from '../lib/imageAttach'
import { insertAtCaret } from '../lib/insertText'
import { POST_ACTION_BTN, POST_ACTION_ICON, POST_ACTION_BADGE } from './icons/UiIcons'
import PostActionTip from './PostActionTip'
import EmojiReactions from './EmojiReactions'
import ConfirmDialog from './ConfirmDialog'
import ReportContentButton from './ReportContentButton'
import { normalizeEmojiReactions } from '../lib/emojiReactions'
import { withLiveAuthorAvatar } from '../lib/posts'

export function CommentIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  )
}

export default function PostComments({
  postId,
  count = 0,
  alwaysOpen = false,
  onOpen,
  focusInput = false,
  inline = false,
  hideHeader = false,
}) {
  const { user, profile } = useAuth()
  const { loadComments, addComment, removeComment, toggleCommentReaction, getComments } = usePosts()
  const [open, setOpen] = useState(alwaysOpen)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const inputRef = useRef(null)

  const comments = getComments(postId)
  const expanded = alwaysOpen || open

  useEffect(() => {
    if (alwaysOpen) setOpen(true)
  }, [alwaysOpen])

  useEffect(() => {
    if (expanded) loadComments(postId)
  }, [expanded, postId, loadComments])

  useEffect(() => {
    if (focusInput && expanded) inputRef.current?.focus()
  }, [focusInput, expanded])

  function handleToggle() {
    if (onOpen) {
      onOpen()
      return
    }
    setOpen((v) => !v)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const prepared = await prepareCommentText(text)
      await addComment(postId, {
        text: prepared,
        frenName: profile?.frenName || 'you',
        avatarType: profile?.avatarType || 'frog',
        avatarUrl: profile?.avatarUrl || null,
      })
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={inline ? 'shrink-0' : 'mt-2'}>
      {!alwaysOpen ? (
        <PostActionTip label="leave a thought">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-label={count > 0 ? `${count} comments` : 'Comment'}
            className={`${POST_ACTION_BTN} ${inline ? '' : 'gap-1.5 text-xs w-auto px-1 -mx-1 rounded-lg'} frens-action shrink-0`}
          >
            <CommentIcon className={POST_ACTION_ICON} />
            {inline ? (
              count > 0 ? (
                <span className={POST_ACTION_BADGE}>
                  {count}
                </span>
              ) : null
            ) : (
              <> Comment{count > 0 ? ` ${count}` : ''}</>
            )}
          </button>
        </PostActionTip>
      ) : hideHeader ? null : (
        <p className="text-xs frens-muted mb-2 flex items-center gap-1.5">
          <CommentIcon />
          {count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : 'Comments'}
        </p>
      )}

      {expanded && (
        <div className={`${
          inline ? 'w-full basis-full mt-3' : alwaysOpen ? '' : 'mt-3 border-t frens-border pt-3'
        } space-y-3`}
        >
          {comments.length === 0 ? (
            <p className="text-xs frens-muted">say something...</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const commentAuthor = withLiveAuthorAvatar(
                  c,
                  user?.id && c.userId && String(c.userId) === String(user.id)
                    ? { id: user.id, ...profile }
                    : null,
                )
                return (
                <li key={c.id} className="flex gap-2">
                  <ProfileAvatar profile={commentAuthor} className="w-7 h-7 shrink-0" logoClassName="w-4 h-auto" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <FrenHandle className="text-xs">{c.frenName}</FrenHandle>
                      <span className="text-[10px] frens-muted shrink-0">{c.timestamp}</span>
                      {user?.id === c.userId ? (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(c.id)}
                          className="text-[10px] frens-action ml-auto shrink-0"
                        >
                          Delete
                        </button>
                      ) : user?.id ? (
                        <ReportContentButton
                          kind="post_comment"
                          refId={c.id}
                          reportedUserId={c.userId}
                          preview={c.text}
                          subjectLabel="this comment"
                          className="text-[10px] frens-action ml-auto shrink-0"
                        />
                      ) : null}
                    </div>
                    <CommentBody text={c.text} />
                    <EmojiReactions
                      reactions={normalizeEmojiReactions(c.reactions)}
                      canReact={Boolean(user && user.id !== c.userId)}
                      onReact={(emoji) => toggleCommentReaction(c.id, emoji)}
                    />
                  </div>
                </li>
                )
              })}
            </ul>
          )}

          <PillComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            placeholder="leave a comment..."
            busy={busy}
            inputRef={inputRef}
            submitDisabled={!draft.trim() || busy}
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
          if (id) removeComment(postId, id)
        }}
      />
    </div>
  )
}
