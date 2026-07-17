import { useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'

export default function EchoComments({
  echo,
  profile,
  onAddComment,
  reviewed,
}) {
  const [text, setText] = useState('')
  const comments = echo.comments ?? []

  if (!echo.allowComments) {
    return (
      <p className="text-xs frens-muted text-center py-2">Comments are off for this echo.</p>
    )
  }

  if (!reviewed) {
    return (
      <p className="text-xs frens-muted text-center py-2">
        Listen or watch the echo first, then you can comment.
      </p>
    )
  }

  function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    onAddComment?.(echo.id, {
      id: `ec-${Date.now()}`,
      authorId: profile?.userId,
      authorName: profile?.frenName || 'you',
      avatarType: profile?.avatarType || 'frog',
      avatarUrl: profile?.avatarUrl || null,
      body,
      createdAt: Date.now(),
    })
    setText('')
  }

  return (
    <div className="space-y-2 border-t frens-border pt-3">
      <p className="text-xs frens-label">Comments</p>
      {comments.length === 0 ? (
        <p className="text-xs frens-muted">No comments yet — be the first.</p>
      ) : (
        <ul className="space-y-2 max-h-36 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <ProfileAvatar profile={c} className="w-7 h-7 shrink-0" logoClassName="w-4 h-auto" />
              <div className="min-w-0">
                <FrenHandle className="text-xs">{c.authorName}</FrenHandle>
                <p className="text-xs frens-body-text break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a note…"
          className="frens-input flex-1 py-2 text-xs"
          maxLength={280}
        />
        <button type="submit" disabled={!text.trim()} className="frens-btn-primary px-3 py-2 text-xs disabled:opacity-40">
          Post
        </button>
      </form>
    </div>
  )
}
