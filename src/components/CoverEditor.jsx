import { useRef, useState } from 'react'
import Modal from './Modal'
import ColorWheel from './ColorWheel'
import { sanitizeImage } from '../lib/media'
import { coverBackground, isColorCover } from '../lib/cover'

export default function CoverEditor({ current, busy, error, onApply, onRemove, onClose }) {
  const [tab, setTab] = useState(isColorCover(current) ? 'color' : 'photo')
  const [choice, setChoice] = useState(null) // data URL (photo) or hex (color)
  const [localError, setLocalError] = useState('')
  const fileRef = useRef(null)

  const preview = choice ?? current ?? null

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalError('')
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file.')
      return
    }
    try {
      const { dataUrl } = await sanitizeImage(file, { maxDimension: 1200 })
      setChoice(dataUrl)
    } catch (err) {
      setLocalError(err.message || 'Could not process that image.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Modal title="Cover" onClose={onClose} maxWidth="max-w-sm">
      {/* Live preview */}
      <div
        className="h-24 w-full rounded-xl mb-4 overflow-hidden"
        style={{ background: preview ? coverBackground(preview) : 'repeating-linear-gradient(45deg,#20281f,#20281f 6px,#161b15 6px,#161b15 12px)' }}
      >
        {preview && !isColorCover(preview) && (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('photo')}
          className={`text-xs px-3 py-1.5 rounded-full ${tab === 'photo' ? 'frens-btn-primary' : 'frens-btn-outline'}`}
        >
          Upload photo
        </button>
        <button
          type="button"
          onClick={() => setTab('color')}
          className={`text-xs px-3 py-1.5 rounded-full ${tab === 'color' ? 'frens-btn-primary' : 'frens-btn-outline'}`}
        >
          Pick a color
        </button>
      </div>

      {tab === 'photo' ? (
        <div className="text-center">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button type="button" onClick={() => fileRef.current?.click()} className="frens-btn-outline px-4 py-2 text-sm">
            Choose photo
          </button>
          <p className="text-xs frens-hint mt-2">Location &amp; timestamp data is stripped automatically.</p>
        </div>
      ) : (
        <ColorWheel value={isColorCover(choice) ? choice : ''} onChange={setChoice} />
      )}

      {(localError || error) && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-3 text-center">{localError || error}</p>
      )}

      <div className="mt-5 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!choice || busy}
            onClick={() => onApply(choice, { persist: false })}
            className="frens-btn-outline flex-1 py-2 text-sm disabled:opacity-40"
          >
            Use for now
          </button>
          <button
            type="button"
            disabled={!choice || busy}
            onClick={() => onApply(choice, { persist: true })}
            className="frens-btn-primary flex-1 py-2 text-sm disabled:opacity-40"
          >
            {busy ? 'Saving...' : 'Save to profile'}
          </button>
        </div>
        <p className="text-[11px] frens-hint text-center">
          &ldquo;Use for now&rdquo; is temporary; &ldquo;Save to profile&rdquo; keeps it permanently.
        </p>
        {current && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="w-full text-xs frens-muted underline pt-1 disabled:opacity-40"
          >
            Remove cover
          </button>
        )}
      </div>
    </Modal>
  )
}
