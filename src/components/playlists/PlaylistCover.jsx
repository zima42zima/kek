import { useRef, useState } from 'react'
import { CameraIcon } from '../icons/UiIcons'
import PlaylistIcon from './PlaylistIcon'
import { prepareImageAttachment, finalizeImageUrl } from '../../lib/imageAttach'

/** Read-only cover banner for playback view. */
export function PlaylistCoverBanner({ coverUrl, className = '' }) {
  if (!coverUrl) return null
  return (
    <div className={`w-full aspect-[3/1] max-h-32 rounded-xl overflow-hidden border frens-border ${className}`}>
      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
    </div>
  )
}

/** Minimal optional cover — rounded frame, no heavy chrome. */
export function PlaylistCoverThumb({ coverUrl, name, className = 'w-10 h-10' }) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt=""
        className={`${className} rounded-xl object-cover shrink-0 border frens-border`}
      />
    )
  }
  return (
    <span
      className={`${className} rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 border frens-border`}
      aria-hidden
    >
      <PlaylistIcon className="w-5 h-5 opacity-70" />
    </span>
  )
}

export default function PlaylistCoverEditor({
  coverUrl,
  name,
  editable,
  busy,
  onSave,
  onRemove,
}) {
  const fileRef = useRef(null)
  const [localError, setLocalError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !editable) return
    setLocalError('')
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file.')
      return
    }
    setUploading(true)
    try {
      const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 900 })
      const url = await finalizeImageUrl({ image: dataUrl, blob, prefix: 'playlist-covers' })
      await onSave?.(url)
    } catch (err) {
      setLocalError(err.message || 'Could not upload cover.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isBusy = busy || uploading

  if (!editable && !coverUrl) return null

  return (
    <div className="space-y-2">
      <div
        className={`relative w-full aspect-[3/1] max-h-32 rounded-xl overflow-hidden border frens-border ${
          coverUrl ? '' : 'bg-black/[0.02] dark:bg-white/[0.02]'
        }`}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-4">
            <PlaylistIcon className="w-6 h-6 opacity-40" />
            <p className="text-[11px] frens-muted">No cover yet — optional</p>
          </div>
        )}
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileRef.current?.click()}
            className="frens-btn-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <CameraIcon className="w-3.5 h-3.5" />
            {coverUrl ? 'Change cover' : 'Upload cover'}
          </button>
          {coverUrl ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRemove?.()}
              className="text-xs frens-muted hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      {(localError) ? (
        <p className="text-xs text-red-500 dark:text-red-400">{localError}</p>
      ) : null}
    </div>
  )
}
