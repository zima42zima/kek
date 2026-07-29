import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import { prepareImageAttachment, finalizeImageUrl, finalizeGifUrl } from '../../lib/imageAttach'
import { sanitizeVideo } from '../../lib/media'
import { uploadMedia, StorageNotInstalledError } from '../../lib/storage'
import { insertAtCaret } from '../../lib/insertText'
import PillComposer from '../PillComposer'
import EmojiReactions from '../EmojiReactions'
import { PhoneIcon, VideoCallIcon } from '../icons/UiIcons'
import { useDmCalls } from '../../context/DmCallsContext'
import { useDms } from '../../context/DmsContext'
import RichText from '../RichText'
import FrenHandle from '../FrenHandle'
import { SharedImage, SharedVideo, textBubbleClass } from '../SharedMedia'

const MAX_VIDEO_MB = 25

function DmBubble({ message, mine, canReact, onReact }) {
  const hasText = Boolean(message.text?.trim())
  const hasMedia = Boolean(message.image || message.video)

  return (
    <div className={`flex gap-2 min-w-0 ${mine ? 'flex-row-reverse' : ''}`}>
      <ProfileAvatar profile={message} className="w-8 h-8 shrink-0" logoClassName="w-5 h-auto" />
      <div className={`min-w-0 max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <span className="text-[11px] frens-muted mb-0.5">
          {message.authorName} · {message.ts}
        </span>
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
        <EmojiReactions
          reactions={message.reactions || []}
          mine={mine}
          canReact={canReact}
          onReact={onReact}
        />
      </div>
    </div>
  )
}

export default function DmThread({ thread, messages, currentUserId, onSend, onBack }) {
  const { startCall, inCall } = useDmCalls()
  const { reactToDmMessage } = useDms()
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

  function addEmoji(emoji) {
    setDraft((prev) => insertAtCaret(textareaRef.current, prev, emoji))
  }

  async function sendGif(url) {
    if (!url) return
    const image = await finalizeGifUrl(url, { prefix: 'dms' })
    onSend?.({ image })
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
    <div className="flex flex-col min-h-[calc(100dvh-8rem)] -m-4">
      <div className="sticky top-0 z-20 frens-surface shrink-0 border-b frens-border px-3 py-2 flex items-center gap-2">
        <button type="button" onClick={onBack} className="frens-muted text-lg px-1" aria-label="Back">
          ‹
        </button>
        <ProfileAvatar profile={other} className="w-9 h-9 shrink-0" logoClassName="w-5 h-auto" />
        <div className="min-w-0 flex-1">
          <FrenHandle>{thread.otherName}</FrenHandle>
          <p className="text-xs frens-muted">direct message</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
        <p className="shrink-0 text-xs text-red-500 dark:text-red-400 px-3 py-1 border-b frens-border">{callError}</p>
      ) : null}

      <div className="mt-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <p className="text-sm frens-body-text mb-1">Say hi to {thread.otherName}</p>
            <p className="text-xs frens-muted">This conversation is just between you two.</p>
          </div>
        ) : (
          messages.map((m) => (
            <DmBubble
              key={m.id}
              message={m}
              mine={m.senderId === currentUserId}
              canReact={m.id != null && !String(m.id).startsWith('tmp-')}
              onReact={(emoji) => reactToDmMessage(thread.id, m.id, emoji)}
            />
          ))
        )}
        <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
      </div>

      <div className="sticky bottom-0 z-20 frens-surface shrink-0 px-3 py-2.5">
        <input ref={imageInputRef} type="file" accept="image/*,image/gif,.gif" className="hidden" onChange={handleImage} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideo} />
        <PillComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
          placeholder="Leave a message"
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
