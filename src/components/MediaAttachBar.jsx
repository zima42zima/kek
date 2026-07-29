import { useRef, useState } from 'react'
import EmojiButton from './EmojiButton'
import GifPicker from './GifPicker'
import { prepareImageAttachment } from '../lib/imageAttach'
import { SmileyIcon, CameraIcon, GifIcon } from './icons/UiIcons'

const MEDIA_ACCEPT = 'image/*,image/gif,.gif'

/**
 * Shared attach controls: photo/GIF file, emoji, GIPHY search.
 * Used anywhere frens can post (feed, comments, rabbit hole, etc.).
 */
export default function MediaAttachBar({
  onEmoji,
  onGif,
  onPhoto,
  onMediaPick,
  photoBusy = false,
  showPhoto = true,
  showEmoji = true,
  showGif = true,
  gifDirection = 'down',
  gifAlign = 'left',
  className = '',
}) {
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const gifAnchorRef = useRef(null)
  const fileRef = useRef(null)

  const canPickMedia = Boolean(onMediaPick || onPhoto)
  const showPhotoButton = showPhoto && canPickMedia
  const busy = photoBusy || mediaBusy

  function pickGif(url) {
    if (url) onGif?.(url)
    setShowGifPicker(false)
  }

  function handlePhotoClick() {
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

  return (
    <div className={className}>
      <div className={`flex items-center gap-1 ${mediaError ? 'mb-1' : ''}`}>
        {showPhotoButton && (
          <>
            <button
              type="button"
              onClick={handlePhotoClick}
              disabled={busy}
              aria-label="Add photo or GIF from library"
              title="Photo / GIF file"
              className="frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
            >
              {busy ? <span className="text-sm">…</span> : <CameraIcon className="w-4 h-4" />}
            </button>
            {onMediaPick && (
              <input
                ref={fileRef}
                type="file"
                accept={MEDIA_ACCEPT}
                className="hidden"
                onChange={handleFileSelect}
              />
            )}
          </>
        )}
        {showEmoji && onEmoji && (
          <EmojiButton
            onPick={onEmoji}
            label={<SmileyIcon className="w-4 h-4" />}
            className="frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
          />
        )}
        {showGif && onGif && (
          <div className="relative" ref={gifAnchorRef}>
            <button
              type="button"
              data-gif-trigger
              onClick={(e) => {
                e.stopPropagation()
                setShowGifPicker((v) => !v)
              }}
              aria-label="Search GIPHY"
              aria-expanded={showGifPicker}
              title="Search GIPHY"
              className="frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            >
              <GifIcon className="w-5 h-4" />
            </button>
            {showGifPicker && (
              <GifPicker
                anchorRef={gifAnchorRef}
                onPick={pickGif}
                onClose={() => setShowGifPicker(false)}
                direction={gifDirection}
                align={gifAlign}
              />
            )}
          </div>
        )}
      </div>
      {mediaError ? (
        <p className="text-[10px] text-red-500 dark:text-red-400">{mediaError}</p>
      ) : null}
    </div>
  )
}
