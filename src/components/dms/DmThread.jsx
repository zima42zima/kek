import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import { prepareImageAttachment, finalizeImageUrl, finalizeGifUrl } from '../../lib/imageAttach'
import { sanitizeVideo } from '../../lib/media'
import { uploadMedia, StorageNotInstalledError } from '../../lib/storage'
import { insertAtCaret } from '../../lib/insertText'
import ChatComposer from '../ChatComposer'
import EmojiReactions from '../EmojiReactions'
import { PhoneIcon, VideoCallIcon } from '../icons/UiIcons'
import { useDmCalls } from '../../context/DmCallsContext'
import { useDms } from '../../context/DmsContext'
import { useAuth } from '../../context/AuthContext'
import RichText from '../RichText'
import FrenHandle from '../FrenHandle'
import { SharedImage, SharedVideo, textBubbleClass } from '../SharedMedia'

const MAX_VIDEO_MB = 25

function DmMessageMenu({ onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!onDelete) return null

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="frens-action w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none frens-muted hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Message options"
        aria-expanded={open}
      >
        ···
      </button>
      {open ? (
        <div className="absolute bottom-full right-0 mb-1 frens-surface border frens-border rounded-lg shadow-lg py-1 min-w-[8rem] z-20">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              if (window.confirm('Delete this message?')) onDelete()
            }}
            className="block w-full text-left text-xs px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 text-red-600 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

function DmBubble({ message, avatarProfile, mine, canReact, onReact, onDelete }) {
  const hasText = Boolean(message.text?.trim())
  const hasMedia = Boolean(message.image || message.video)

  return (
    <div className={`flex gap-2 min-w-0 ${mine ? 'flex-row-reverse' : ''}`}>
      <ProfileAvatar profile={avatarProfile || message} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
      <div className={`min-w-0 max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <span className="text-[10px] frens-muted mb-1 tracking-wide">
          {message.authorName} · {message.ts}
        </span>
        <div className={`flex items-end gap-1.5 max-w-full ${mine ? 'flex-row-reverse' : ''}`}>
          <div className="min-w-0">
            {message.sticker ? (
              <span className="text-4xl leading-none">{message.sticker}</span>
            ) : (
              <>
                {hasMedia && (
                  <div className={`max-w-full min-w-0 ${hasText ? 'mb-1' : ''}`}>
                    {message.video && <SharedVideo src={message.video} />}
                    {message.image && !message.video && <SharedImage src={message.image} />}
                  </div>
                )}
                {hasText ? (
                  <div className={textBubbleClass(mine)}>
                    <RichText text={message.text} className="min-w-0 max-w-full [overflow-wrap:anywhere] break-words" />
                  </div>
                ) : null}
              </>
            )}
          </div>
          <EmojiReactions
            reactions={message.reactions || []}
            mine={mine}
            canReact={canReact}
            onReact={onReact}
            controlsOnly
            extra={mine ? <DmMessageMenu onDelete={onDelete} /> : null}
          />
        </div>
        <EmojiReactions
          reactions={message.reactions || []}
          mine={mine}
          canReact={canReact}
          onReact={onReact}
          chipsOnly
        />
      </div>
    </div>
  )
}

export default function DmThread({ thread, messages, currentUserId, onSend, onBack }) {
  const { startCall, inCall } = useDmCalls()
  const { reactToDmMessage, deleteDmMessage } = useDms()
  const { profile } = useAuth()
  const [draft, setDraft] = useState('')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [callError, setCallError] = useState('')
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const bottomRef = useRef(null)
  const prevMessageCount = useRef(0)
  const textareaRef = useRef(null)

  const other = {
    frenName: thread.otherName,
    avatarType: thread.otherAvatarType,
    avatarUrl: thread.otherAvatarUrl,
  }

  function avatarForMessage(m) {
    const mine = m.senderId === currentUserId
    if (mine && profile) {
      return {
        ...m,
        avatarType: profile.avatarType || 'frog',
        avatarUrl: profile.avatarUrl ?? null,
      }
    }
    if (!mine && thread.otherUserId && String(m.senderId) === String(thread.otherUserId)) {
      return {
        ...m,
        avatarType: thread.otherAvatarType || 'frog',
        avatarUrl: thread.otherAvatarUrl ?? null,
      }
    }
    return m
  }

  function addEmoji(emoji) {
    setDraft((prev) => insertAtCaret(textareaRef.current, prev, emoji))
  }

  async function sendGif(url) {
    if (!url) return
    const image = await finalizeGifUrl(url, { prefix: 'dms' })
    onSend?.({ image })
  }

  useEffect(() => {
    if (messages.length >= prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend?.({ text })
    setDraft('')
  }

  async function handleImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaError('')
    if (!file.type.startsWith('image/')) {
      setMediaError('Please choose an image file.')
      return
    }
    setMediaBusy(true)
    try {
      const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 1200 })
      const image = await finalizeImageUrl({ image: dataUrl, blob, prefix: 'dms' })
      onSend?.({ image })
    } catch (err) {
      setMediaError(err.message || 'Could not process that image.')
    } finally {
      setMediaBusy(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  async function handleVideo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaError('')
    if (!file.type.startsWith('video/')) {
      setMediaError('Please choose a video file.')
      return
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setMediaError(`Video must be under ${MAX_VIDEO_MB}MB.`)
      return
    }
    setMediaBusy(true)
    try {
      const { blob, dataUrl } = await sanitizeVideo(file)
      let video = dataUrl
      try {
        video = await uploadMedia(blob, { prefix: 'dms' })
      } catch (err) {
        if (!(err instanceof StorageNotInstalledError)) {
          console.error('DM video upload failed, embedding inline:', err.message)
        }
      }
      onSend?.({ video })
    } catch (err) {
      setMediaError(err.message || 'Could not process that video.')
    } finally {
      setMediaBusy(false)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  async function placeCall(type) {
    setCallError('')
    const result = await startCall({
      conversationId: thread.id,
      peerId: thread.otherUserId,
      peerName: thread.otherName,
      peerAvatarType: thread.otherAvatarType,
      peerAvatarUrl: thread.otherAvatarUrl,
      type,
    })
    if (!result?.ok) setCallError(result?.message || 'Could not start call.')
  }

  return (
    // Fill shell between app header and bottom nav; composer docks above icon bar.
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      <div className="shrink-0 z-20 frens-surface px-3 pt-2 pb-2 flex items-center gap-2 border-b frens-border">
        <button type="button" onClick={onBack} className="frens-muted text-lg px-1" aria-label="Back">
          ‹
        </button>
        <ProfileAvatar profile={other} className="w-9 h-9 shrink-0" logoClassName="w-5 h-auto" />
        <div className="min-w-0 flex-1">
          <FrenHandle>{thread.otherName}</FrenHandle>
          <p className="text-[10px] frens-muted tracking-wide uppercase">direct</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => placeCall('audio')}
            disabled={inCall}
            className="frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
            aria-label="Audio call"
            title="Audio call"
          >
            <PhoneIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => placeCall('video')}
            disabled={inCall}
            className="frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
            aria-label="Video call"
            title="Video call"
          >
            <VideoCallIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {callError ? (
        <p className="shrink-0 text-xs text-red-500 dark:text-red-400 px-3 py-1">{callError}</p>
      ) : null}

      <div
        data-frens-panel-scroll
        className="flex-1 min-h-0 overflow-y-auto overscroll-none frens-scroll frens-panel-scroll-bleed"
      >
        <div className="px-3 py-3 space-y-3.5 frens-content-max">
          {messages.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <p className="text-sm frens-body-text mb-1 font-light">Say hi to {thread.otherName}</p>
              <p className="text-xs frens-muted">Just between you two. No third hand.</p>
            </div>
          ) : (
            messages.map((m) => (
              <DmBubble
                key={m.id}
                message={m}
                avatarProfile={avatarForMessage(m)}
                mine={m.senderId === currentUserId}
                canReact={m.id != null && !String(m.id).startsWith('tmp-')}
                onReact={(emoji) => reactToDmMessage(thread.id, m.id, emoji)}
                onDelete={
                  m.senderId === currentUserId
                    ? () => deleteDmMessage(thread.id, m.id)
                    : null
                }
              />
            ))
          )}
          <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
        </div>
      </div>

      <div className="shrink-0 z-20 frens-surface px-3 pt-1.5 pb-2">
        <input ref={imageInputRef} type="file" accept="image/*,image/gif,.gif" className="hidden" onChange={handleImage} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideo} />
        <ChatComposer
          profile={profile}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
          placeholder="Say something…"
          sendLabel="Send"
          busy={mediaBusy}
          attachBusy={mediaBusy}
          error={mediaError}
          inputRef={textareaRef}
          onPhoto={() => imageInputRef.current?.click()}
          onVideo={() => videoInputRef.current?.click()}
          onEmoji={addEmoji}
          onGif={sendGif}
        />
      </div>
    </div>
  )
}
