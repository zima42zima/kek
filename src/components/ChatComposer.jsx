import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ProfileAvatar } from './FrogLogo'
import EmojiButton from './EmojiButton'
import GifPicker from './GifPicker'
import {
  CameraIcon,
  GifIcon,
  PaperclipIcon,
  PlayIcon,
  SmileyIcon,
} from './icons/UiIcons'

const MAX_PX = 120

/**
 * Post-style chat write bar: avatar · say something… · Send
 * No pill outline — same quiet row as the home “Add a post…” chrome.
 */
export default function ChatComposer({
  profile,
  value,
  onChange,
  onSubmit,
  placeholder = 'Say something…',
  sendLabel = 'Send',
  busy = false,
  attachBusy = false,
  error = '',
  inputRef: inputRefProp,
  onPhoto,
  onVideo,
  onEmoji,
  onGif,
  gifDirection = 'up',
  className = '',
}) {
  const [attachOpen, setAttachOpen] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const innerRef = useRef(null)
  const attachRef = useRef(null)
  const textareaRef = inputRefProp || innerRef

  const hasAttach = Boolean(onPhoto || onVideo || onEmoji || onGif)
  const sendDisabled = !String(value || '').trim() || busy || attachBusy

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_PX)}px`
  }, [value, textareaRef])

  useEffect(() => {
    if (!attachOpen) return undefined
    function onDoc(e) {
      if (attachRef.current && !attachRef.current.contains(e.target)) setAttachOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setAttachOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [attachOpen])

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (sendDisabled) return
    onSubmit?.(e)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      {error ? (
        <p className="text-xs text-red-500 dark:text-red-400 mb-2 px-1">{error}</p>
      ) : null}

      <div className="flex items-end gap-3 px-1 py-1">
        <ProfileAvatar
          profile={profile}
          className="w-11 h-11 shrink-0 self-center"
          logoClassName="w-6 h-auto"
        />

        <div className="flex-1 min-w-0 flex items-end gap-1.5">
          {hasAttach ? (
            <div ref={attachRef} className="relative shrink-0 self-center">
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                disabled={busy || attachBusy}
                aria-label="Attach"
                aria-expanded={attachOpen}
                className="frens-action w-8 h-8 flex items-center justify-center disabled:opacity-50"
              >
                {attachBusy ? (
                  <span className="text-xs">…</span>
                ) : (
                  <PaperclipIcon className="w-4 h-4" />
                )}
              </button>

              {attachOpen ? (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 mb-2 z-40 min-w-[10rem] frens-surface border frens-border rounded-xl shadow-lg py-1"
                >
                  {onPhoto ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAttachOpen(false)
                        onPhoto()
                      }}
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
                      onClick={() => {
                        setAttachOpen(false)
                        onVideo()
                      }}
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
                      onClick={() => {
                        setAttachOpen(false)
                        setShowGif(true)
                      }}
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
                  onPick={(url) => {
                    if (url) onGif(url)
                    setShowGif(false)
                  }}
                  onClose={() => setShowGif(false)}
                  direction={gifDirection}
                />
              ) : null}
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={busy}
            className="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 py-2.5 leading-snug max-h-[7.5rem]"
          />
        </div>

        <button
          type="submit"
          disabled={sendDisabled}
          className="frens-btn-primary px-4 py-1.5 text-xs rounded-full shrink-0 self-center disabled:opacity-40"
        >
          {busy ? '…' : sendLabel}
        </button>
      </div>
    </form>
  )
}
