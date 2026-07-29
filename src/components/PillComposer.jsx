import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import EmojiButton from './EmojiButton'
import GifPicker from './GifPicker'
import { prepareImageAttachment } from '../lib/imageAttach'
import {
  CameraIcon,
  GifIcon,
  PaperclipIcon,
  PlayIcon,
  SendIcon,
  SmileyIcon,
} from './icons/UiIcons'

const DEFAULT_MAX_PX = 128
const MEDIA_ACCEPT = 'image/*,image/gif,.gif'

function resizePillInput(el, setTall, maxPx) {
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, maxPx)
  el.style.height = `${next}px`
  setTall?.(next > 44)
}

export default function PillComposer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Leave a message',
  disabled = false,
  busy = false,
  inputRef: inputRefProp,
  maxHeightPx = DEFAULT_MAX_PX,
  error = '',
  className = '',
  formClassName = '',
  footer = null,
  asForm = true,
  submitDisabled = null,
  attachBusy = false,
  onPhoto,
  onMediaPick,
  onVideo,
  onEmoji,
  onGif,
  gifDirection = 'down',
  showSubmit = true,
}) {
  const [attachOpen, setAttachOpen] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [tallInput, setTallInput] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [mediaBusy, setMediaBusy] = useState(false)
  const innerRef = useRef(null)
  const attachRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = inputRefProp || innerRef

  const hasAttach = Boolean(onPhoto || onMediaPick || onVideo || onEmoji || onGif)
  const attachDisabled = disabled || busy || attachBusy || mediaBusy
  const sendDisabled = submitDisabled ?? (!value.trim() || disabled || busy || attachBusy || mediaBusy)

  useLayoutEffect(() => {
    resizePillInput(textareaRef.current, setTallInput, maxHeightPx)
  }, [value, maxHeightPx, textareaRef])

  useEffect(() => {
    if (!attachOpen) return undefined
    function onDocClick(e) {
      if (attachRef.current && !attachRef.current.contains(e.target)) setAttachOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setAttachOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [attachOpen])

  function handleSubmit(e) {
    e.preventDefault()
    if (sendDisabled) return
    onSubmit?.(e)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && showSubmit) {
      e.preventDefault()
      if (!sendDisabled) onSubmit?.(e)
    }
  }

  function openPhotoPicker() {
    setAttachOpen(false)
    if (onPhoto) {
      onPhoto()
      return
    }
    fileRef.current?.click()
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file || !onMediaPick) return
    setMediaError('')
    setMediaBusy(true)
    try {
      const { dataUrl } = await prepareImageAttachment(file, { maxDimension: 1600 })
      onMediaPick(dataUrl)
    } catch (err) {
      setMediaError(err.message || 'Could not use that file.')
    } finally {
      setMediaBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function openVideoPicker() {
    setAttachOpen(false)
    onVideo?.()
  }

  function openGifPicker() {
    setAttachOpen(false)
    setShowGif(true)
  }

  function pickGif(url) {
    if (url) onGif?.(url)
    setShowGif(false)
  }

  const row = (
    <>
      {(error || mediaError) ? (
        <p className="text-xs text-red-500 dark:text-red-400 mb-2 px-1">{error || mediaError}</p>
      ) : null}

      <div className={`flex items-end gap-2 ${formClassName}`}>
        {onMediaPick && !onPhoto ? (
          <input ref={fileRef} type="file" accept={MEDIA_ACCEPT} className="hidden" onChange={handleFileSelect} />
        ) : null}

        {hasAttach ? (
          <div ref={attachRef} className="relative shrink-0 self-end mb-1">
            <button
              type="button"
              onClick={() => setAttachOpen((v) => !v)}
              disabled={attachDisabled}
              aria-label="Attach"
              aria-expanded={attachOpen}
              aria-haspopup="menu"
              className="frens-action w-7 h-7 flex items-center justify-center disabled:opacity-50"
            >
              {attachDisabled && (busy || attachBusy || mediaBusy) ? (
                <span className="text-xs">…</span>
              ) : (
                <PaperclipIcon className="w-[18px] h-[18px]" />
              )}
            </button>

            {attachOpen ? (
              <div
                role="menu"
                className="absolute bottom-full left-0 mb-2 z-40 min-w-[10rem] frens-surface border frens-border rounded-xl shadow-lg py-1"
              >
                {(onPhoto || onMediaPick) ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openPhotoPicker}
                    className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <CameraIcon className="w-4 h-4 shrink-0" />
                    Photo
                  </button>
                ) : null}
                {onVideo ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openVideoPicker}
                    className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <PlayIcon className="w-4 h-4 shrink-0" />
                    Video
                  </button>
                ) : null}
                {onEmoji ? (
                  <EmojiButton
                    onPick={(emoji) => {
                      onEmoji(emoji)
                      setAttachOpen(false)
                    }}
                    direction="up"
                    align="left"
                    label={(
                      <span className="flex items-center gap-2 text-xs">
                        <SmileyIcon className="w-4 h-4 shrink-0" />
                        Emoji
                      </span>
                    )}
                    className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-none"
                  />
                ) : null}
                {onGif ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openGifPicker}
                    className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <GifIcon className="w-4 h-4 shrink-0" />
                    GIF
                  </button>
                ) : null}
              </div>
            ) : null}

            {showGif && onGif ? (
              <GifPicker
                anchorRef={attachRef}
                onPick={pickGif}
                onClose={() => setShowGif(false)}
                direction={gifDirection}
              />
            ) : null}
          </div>
        ) : null}

        <div className={`flex-1 min-w-0 border frens-border px-4 py-2 transition-[border-radius] ${tallInput ? 'rounded-2xl' : 'rounded-full'}`}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              resizePillInput(e.target, setTallInput, maxHeightPx)
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-transparent placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none text-sm leading-snug max-h-32 overflow-y-auto py-0.5"
          />
        </div>

        {showSubmit ? (
          <button
            type="submit"
            disabled={sendDisabled}
            aria-label="Send"
            className="frens-action shrink-0 self-end mb-1 w-7 h-7 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-[18px] h-[18px]" />
          </button>
        ) : null}
      </div>

      {footer}
    </>
  )

  if (!asForm) {
    return <div className={className}>{row}</div>
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {row}
    </form>
  )
}
