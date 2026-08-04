import { useRef, useState } from 'react'
import { prepareImageAttachment } from '../../lib/imageAttach'
import { CameraIcon, ImageIcon } from '../icons/UiIcons'

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
      // iOS sometimes omits MIME type — give prepareImageAttachment a typed File.
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
  }

  if (value?.url) {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <div className={`relative rounded-xl overflow-hidden border frens-border bg-black/5 ${compact ? 'aspect-[4/3]' : 'aspect-[4/5] max-h-[48vh]'}`}>
          <img src={value.url} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={clear} className="frens-btn-outline flex-1 py-2 text-sm">
            Remove
          </button>
          <label className="frens-btn-outline flex-1 py-2 text-sm text-center relative overflow-hidden cursor-pointer">
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
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className={`rounded-xl border frens-border flex flex-col items-center justify-center text-center px-4 ${compact ? 'py-6' : 'aspect-[4/5] max-h-[48vh] py-10'}`}>
        <ImageIcon className="w-10 h-10 mb-2 opacity-70" />
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs frens-muted mt-1 max-w-[240px]">{hint}</p>
      </div>

      {error ? <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p> : null}

      <div className="flex gap-2">
        <label
          className={`frens-btn-primary flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-1.5 relative overflow-hidden cursor-pointer ${
            busy ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          <CameraIcon className="w-4 h-4" />
          {busy ? 'Processing…' : 'Take photo'}
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
          className={`frens-btn-outline flex-1 py-2.5 text-sm text-center relative overflow-hidden cursor-pointer ${
            busy ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {busy ? 'Processing…' : 'Choose meme'}
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
