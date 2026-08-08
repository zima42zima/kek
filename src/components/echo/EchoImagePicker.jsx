import { useRef, useState } from 'react'
import { prepareImageAttachment } from '../../lib/imageAttach'
import { CameraIcon, ImageIcon, TextIcon, OPTION_ACTIVE, OPTION_IDLE } from '../icons/UiIcons'
import EchoMemeCaptionPanel, { MemeCaptionPreview } from './EchoMemeCaptionPanel'

const ACCEPT = 'image/*,image/gif,.gif,.heic,.heif,.webp,.png,.jpg,.jpeg'

/** Visually hidden but not display:none — iOS Safari ignores .click() on display:none file inputs. */
const FILE_INPUT_CLASS =
  'absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed'

function isHeicFile(file) {
  const type = file?.type || ''
  const name = file?.name || ''
  return type === 'image/heic'
    || type === 'image/heif'
    || /\.heic$/i.test(name)
    || /\.heif$/i.test(name)
}

function looksLikeImage(file) {
  if (!file) return false
  if (file.type?.startsWith('image/')) return true
  return /\.(gif|jpe?g|png|webp|heic|heif|bmp|tiff?)$/i.test(file.name || '')
}

export default function EchoImagePicker({
  value = null,
  onChange,
  compact = false,
  title = 'Drop a meme',
  hint = 'Pick a meme, GIF, or photo — EXIF stripped for privacy',
  captionEnabled = false,
  captionOpen = false,
  onCaptionOpenChange,
  caption = { text: '', style: 'outline' },
  onCaptionChange,
}) {
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      if (isHeicFile(file)) {
        throw new Error('iPhone HEIC isn’t supported yet — in Photos, share as JPEG, or pick a PNG/GIF.')
      }
      if (!looksLikeImage(file)) {
        throw new Error('Please choose an image file (JPEG, PNG, GIF, or WebP).')
      }
      let input = file
      if (!file.type?.startsWith('image/')) {
        const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'png' ? 'image/png'
            : ext === 'gif' ? 'image/gif'
              : ext === 'webp' ? 'image/webp'
                : 'image/jpeg'
        input = new File([file], file.name || `photo.${ext || 'jpg'}`, { type: mime })
      }
      const { blob, dataUrl, isGif } = await prepareImageAttachment(input, { maxDimension: 1600 })
      onChange?.({ blob, url: dataUrl, isGif: Boolean(isGif) })
    } catch (err) {
      setError(err.message || 'Could not use that image.')
      onChange?.(null)
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setError('')
    onChange?.(null)
    onCaptionChange?.({ text: '', style: caption?.style || 'outline' })
    onCaptionOpenChange?.(false)
  }

  if (value?.url) {
    const showCaption = Boolean(captionEnabled)
    const capText = caption?.text || ''
    const capStyle = caption?.style || 'outline'
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl border frens-border overflow-hidden">
          <MemeCaptionPreview
            src={value.url}
            text={showCaption ? capText : ''}
            style={capStyle}
            className={`bg-black/5 ${compact ? 'aspect-[4/3] max-h-[28vh]' : 'aspect-[4/3] max-h-[32vh]'}`}
          />
          {showCaption ? (
            <button
              type="button"
              onClick={() => onCaptionOpenChange?.(!captionOpen)}
              aria-pressed={captionOpen}
              aria-label={captionOpen ? 'Hide meme text' : 'Add meme text'}
              title="Add text"
              className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full border frens-surface shadow-sm flex items-center justify-center transition touch-manipulation ${
                captionOpen ? OPTION_ACTIVE : 'border-white/40 bg-black/55 text-white'
              }`}
            >
              <TextIcon className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {showCaption && captionOpen ? (
          <EchoMemeCaptionPanel
            open
            hideToggle
            onToggle={() => onCaptionOpenChange?.(false)}
            text={capText}
            style={capStyle}
            onChange={onCaptionChange}
          />
        ) : null}

        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button type="button" onClick={clear} className="frens-btn-outline px-4 py-2 text-sm rounded-full">
            Remove
          </button>
          <label className="frens-btn-outline px-4 py-2 text-sm rounded-full text-center relative overflow-hidden cursor-pointer">
            Replace
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className={FILE_INPUT_CLASS}
              disabled={busy}
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border frens-border px-5 flex flex-col items-center justify-center text-center ${compact ? 'py-4' : 'py-5'}`}>
        <ImageIcon className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} opacity-70`} />
        <p className="mt-2.5 text-sm font-medium">{title}</p>
        {hint ? <p className="mt-1 text-[11px] frens-muted max-w-[220px]">{hint}</p> : null}
        {busy ? <p className="mt-1 text-[11px] frens-muted">Preparing…</p> : null}
      </div>

      {error ? <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p> : null}

      <div className="flex items-center justify-center gap-2.5 flex-wrap">
        <label
          className={`frens-btn-primary px-4 py-2 text-sm rounded-full inline-flex items-center justify-center gap-1.5 relative overflow-hidden cursor-pointer touch-manipulation ${
            busy ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          <CameraIcon className="w-4 h-4 shrink-0" />
          <span>{busy ? '…' : 'Take photo'}</span>
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            capture="environment"
            className={FILE_INPUT_CLASS}
            disabled={busy}
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        <label
          className={`frens-btn-outline px-4 py-2 text-sm rounded-full inline-flex items-center justify-center gap-1.5 relative overflow-hidden cursor-pointer touch-manipulation ${
            busy ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          <ImageIcon className="w-4 h-4 shrink-0" />
          <span>{busy ? '…' : 'Upload'}</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className={FILE_INPUT_CLASS}
            disabled={busy}
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}
