import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import { useAuth } from '../../context/AuthContext'
import RichText from '../RichText'
import FrenHandle from '../FrenHandle'
import PillComposer from '../PillComposer'
import { appendGifUrlToText, prepareCommentText } from '../../lib/imageAttach'
import { insertAtCaret } from '../../lib/insertText'
import {
  addPlaylistComment,
  deletePlaylistComment,
  listPlaylistComments,
  PlaylistsNotInstalledError,
} from '../../lib/playlists'

function CommentIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  )
}

export default function PlaylistComments({ playlistId }) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState([])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [needsSql, setNeedsSql] = useState(false)
  const inputRef = useRef(null)

  function load() {
    if (!playlistId) return
    setLoading(true)
    listPlaylistComments(playlistId)
      .then(setComments)
      .catch((err) => {
        if (err instanceof PlaylistsNotInstalledError) setNeedsSql(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId, open])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy || !user) return
    setBusy(true)
    try {
      const prepared = await prepareCommentText(text, { prefix: 'playlists' })
      await addPlaylistComment(playlistId, prepared, profile)
      setDraft('')
      load()
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    await deletePlaylistComment(id)
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  if (needsSql) return null

  return (
    <div className="mt-6 pt-4 border-t frens-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="frens-action text-xs flex items-center gap-1.5"
        aria-expanded={open}
      >
        <CommentIcon />
        Comment{comments.length > 0 ? ` ${comments.length}` : ''}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-xs frens-muted">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs frens-muted">say something...</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <ProfileAvatar profile={c} className="w-7 h-7 shrink-0" logoClassName="w-4 h-auto" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <FrenHandle className="text-xs">{c.frenName}</FrenHandle>
                      <span className="text-[10px] frens-muted shrink-0">{c.timestamp}</span>
                      {user?.id === c.userId && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="text-[10px] frens-action ml-auto shrink-0"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <RichText text={c.text} className="text-sm frens-body-text" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {user ? (
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
          ) : null}
        </div>
      )}
    </div>
  )
}
