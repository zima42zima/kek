import { useRef, useState } from 'react'
import { CameraIcon } from '../icons/UiIcons'
import { CaveGlyph } from './CaveIcon'
import { prepareImageAttachment, finalizeImageUrl } from '../../lib/imageAttach'

/** Square thumb for cave list / preview / header — cover photo when set, else cave mark. */
export function CaveCoverThumb({ coverUrl, className = 'w-12 h-12' }) {
  const url = typeof coverUrl === 'string' ? coverUrl.trim() : ''
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${className} rounded-xl object-cover shrink-0 border frens-border`}
      />
    )
  }
  return (
    <span
      className={`${className} rounded-xl frens-avatar-ring flex items-center justify-center shrink-0 text-xl`}
      aria-hidden
    >
      <CaveGlyph className="w-[55%] h-[55%] max-w-6 max-h-6" />
    </span>
  )
}

/** Wide banner for cave detail header when a cover is set. */
export function CaveCoverBanner({ coverUrl, className = '' }) {
  const url = typeof coverUrl === 'string' ? coverUrl.trim() : ''
  if (!url) return null
  return (
    <div className={`w-full aspect-[3/1] max-h-28 overflow-hidden ${className}`}>
      <img src={url} alt="" className="w-full h-full object-cover" />
    </div>
  )
}

/** Upload / remove cover — for cave settings or create flow. */
export default function CaveCoverEditor({
  coverUrl,
  editable = false,
  onSave,
  onRemove,
  compact = false,
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
      const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 1200 })
      const url = await finalizeImageUrl({ image: dataUrl, blob, prefix: 'cave-covers' })
      await onSave?.(url)
    } catch (err) {
      setLocalError(err.message || 'Could not upload cover.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={`relative w-full overflow-hidden border frens-border ${
          compact ? 'aspect-square max-w-[7rem] rounded-xl' : 'aspect-[3/1] max-h-32 rounded-xl'
        } ${coverUrl ? '' : 'bg-black/[0.02] dark:bg-white/[0.02]'}`}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-3">
            <CaveGlyph className="w-6 h-6 opacity-40" />
            <p className="text-[11px] frens-muted">No cover yet</p>
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
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="frens-btn-outline text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <CameraIcon className="w-3.5 h-3.5" />
            {uploading ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add cover'}
          </button>
          {coverUrl ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => onRemove?.()}
              className="text-xs frens-muted hover:text-black dark:hover:text-white transition disabled:opacity-40"
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      {localError ? (
        <p className="text-xs text-red-500 dark:text-red-400">{localError}</p>
      ) : null}
    </div>
  )
}
