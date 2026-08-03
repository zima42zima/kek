import { useRef, useState } from 'react'
import { prepareImageAttachment } from '../../lib/imageAttach'
import { CameraIcon, ImageIcon } from '../icons/UiIcons'

const ACCEPT = 'image/*,image/gif,.gif,.heic,.heif,.webp,.png,.jpg,.jpeg'

function isHeicFile(file) {
  const type = file?.type || ''
  const name = file?.name || ''
  return type === 'image/heic'
    || type === 'image/heif'
    || /\.heic$/i.test(name)
    || /\.heif$/i.test(name)
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
        throw new Error('HEIC photos are not supported here yet — try a JPEG, PNG, or GIF.')
      }
      const { blob, dataUrl, isGif } = await prepareImageAttachment(file, { maxDimension: 1600 })
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
          <button type="button" onClick={() => fileRef.current?.click()} className="frens-btn-outline flex-1 py-2 text-sm">
            Replace
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
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
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
        >
          <CameraIcon className="w-4 h-4" />
          {busy ? 'Processing…' : 'Take photo'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="frens-btn-outline flex-1 py-2.5 text-sm disabled:opacity-40"
        >
          Choose meme
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
