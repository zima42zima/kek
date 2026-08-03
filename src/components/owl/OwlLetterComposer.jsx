import { useCallback, useEffect, useRef, useState } from 'react'
import OwlLetterPreview from './OwlLetterPreview'
import OwlFontPicker from './OwlFontPicker'
import {
  OWL_OCCASION_EXAMPLES,
  createOwlLetterDraft,
  serializeOwlLetterBody,
} from '../../lib/owlLetterFormat'
import { preloadOwlFont } from '../../lib/owlLetterFonts'
import { printOwlLetter, canUseBrowserPrint } from '../../lib/owlPrint'
import { sanitizeImage } from '../../lib/media'

export default function OwlLetterComposer({
  fromName: initialFrom = '',
  toName: initialTo = '',
  anonymous = false,
  onLetterChange,
  showPrint = true,
}) {
  const [letter, setLetter] = useState(() => createOwlLetterDraft({ fromName: initialFrom, toName: initialTo }))
  const [showDetails, setShowDetails] = useState(false)
  const [imageError, setImageError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    preloadOwlFont(letter.font)
  }, [letter.font])

  useEffect(() => {
    setLetter((prev) => ({
      ...prev,
      fromName: initialFrom || prev.fromName,
      toName: initialTo || prev.toName,
      signature: prev.signature || initialFrom,
    }))
  }, [initialFrom, initialTo])

  useEffect(() => {
    onLetterChange?.(letter)
  }, [letter, onLetterChange])

  const update = useCallback((patch) => {
    setLetter((prev) => ({ ...prev, ...patch }))
  }, [])

  function applyOccasion(occasionId) {
    const ex = OWL_OCCASION_EXAMPLES[occasionId]
    if (!ex) return
    update({
      occasion: occasionId,
      greeting: ex.greeting,
      body: ex.body,
      closing: ex.closing,
    })
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')
    if (!file.type.startsWith('image/')) {
      setImageError('Choose a JPG or PNG.')
      return
    }
    try {
      const { dataUrl } = await sanitizeImage(file, { maxDimension: 1400 })
      update({ image: dataUrl })
    } catch (err) {
      setImageError(err.message || 'Could not add that image.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handlePrintPreview() {
    const previewLetter = anonymous
      ? { ...letter, fromName: 'A friend', signature: letter.signature ? 'Your fren' : '' }
      : letter
    await printOwlLetter({
      body: serializeOwlLetterBody(previewLetter),
      fromDisplay: previewLetter.fromName,
      anonymous,
    })
  }

  const previewLetter = anonymous
    ? { ...letter, fromName: 'A friend', signature: letter.signature ? 'Your fren' : letter.signature }
    : letter

  const fontPreviewText = [letter.greeting, letter.body].filter(Boolean).join(' ')

  return (
    <div className="owl-letter-ui space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
        <div className="space-y-3 owl-letter-controls">
          <OwlFontPicker
            value={letter.font}
            onChange={(font) => update({ font })}
            previewText={fontPreviewText}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="owl-field-label">From</label>
              <input
                type="text"
                className="owl-field py-2"
                value={letter.fromName}
                onChange={(e) => update({ fromName: e.target.value, signature: e.target.value || letter.signature })}
                disabled={anonymous}
                placeholder={anonymous ? 'Hidden' : 'You'}
              />
            </div>
            <div>
              <label className="owl-field-label">To</label>
              <input
                type="text"
                className="owl-field py-2"
                value={letter.toName}
                onChange={(e) => update({ toName: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="owl-field-label">Your letter</label>
            <textarea
              className="owl-field min-h-[160px] resize-y py-3"
              rows={8}
              placeholder="Write what you want to say…"
              value={letter.body}
              onChange={(e) => update({ body: e.target.value })}
              maxLength={3500}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
            <button type="button" onClick={() => fileRef.current?.click()} className="owl-btn-outline text-xs py-1.5 px-3">
              {letter.image ? 'Change photo' : 'Add photo (optional)'}
            </button>
            {letter.image && (
              <button type="button" onClick={() => update({ image: null })} className="text-xs underline text-black/60">
                Remove
              </button>
            )}
            <span className="text-[10px] text-black/45">For cards &amp; silly prints · scaled to A4</span>
          </div>
          {imageError && <p className="text-xs text-red-600">{imageError}</p>}

          <div className="flex flex-wrap gap-1.5">
            {[
              ['general', 'General'],
              ['birthday', 'Birthday'],
              ['thankyou', 'Thank you'],
              ['casual', 'Thinking of you'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyOccasion(id)}
                className={`text-[10px] px-2 py-1 border transition ${
                  letter.occasion === id
                    ? 'border-black bg-black text-white'
                    : 'border-black/25 hover:border-black/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-black/55 underline"
          >
            {showDetails ? 'Hide letter details' : 'Greeting, closing & signature'}
          </button>

          {showDetails && (
            <div className="space-y-2 pt-1 border-t border-black/10">
              <input
                type="text"
                className="owl-field py-2"
                placeholder="Greeting"
                value={letter.greeting}
                onChange={(e) => update({ greeting: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="owl-field py-2"
                  placeholder="Closing"
                  value={letter.closing}
                  onChange={(e) => update({ closing: e.target.value })}
                />
                <input
                  type="text"
                  className="owl-field py-2"
                  placeholder="Signature"
                  value={letter.signature}
                  onChange={(e) => update({ signature: e.target.value })}
                  disabled={anonymous}
                />
              </div>
            </div>
          )}

          {showPrint && canUseBrowserPrint() && (
            <button type="button" onClick={handlePrintPreview} className="owl-btn-outline w-full text-sm py-2">
              Preview print
            </button>
          )}
        </div>

        <div>
          <p className="owl-field-label mb-2">Preview</p>
          <div className="owl-letter-preview-wrap p-2 sm:p-3 flex justify-center overflow-auto max-h-[70vh]">
            <div className="origin-top scale-[0.82] sm:scale-90 w-full max-w-[650px]">
              <OwlLetterPreview letter={previewLetter} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
