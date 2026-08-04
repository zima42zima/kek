import { MEME_CAPTION_MAX } from '../../lib/memeText'
import { OPTION_ACTIVE, OPTION_IDLE, TextIcon } from '../icons/UiIcons'

/**
 * Mini meme caption editor — outline (Impact) or white box.
 * Preview is CSS overlay; pixels are baked on publish.
 */
export default function EchoMemeCaptionPanel({
  open,
  onToggle,
  text = '',
  style = 'outline',
  onChange,
  hideToggle = false,
}) {
  return (
    <div className="space-y-2">
      {!hideToggle ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={open}
            aria-label={open ? 'Hide meme text' : 'Add meme text'}
            title="Add text"
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition touch-manipulation ${
              open ? OPTION_ACTIVE : OPTION_IDLE
            }`}
          >
            <TextIcon className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="rounded-xl border frens-border p-3 space-y-2.5 bg-black/[0.02] dark:bg-white/[0.03]">
          <p className="text-[11px] frens-muted">Optional text on the meme</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange?.({ text, style: 'outline' })}
              className={`rounded-lg border px-2.5 py-2 text-left transition touch-manipulation ${
                style === 'outline' ? OPTION_ACTIVE : OPTION_IDLE
              }`}
            >
              <span
                className="block text-[11px] font-bold uppercase tracking-wide"
                style={{
                  color: '#fff',
                  textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                  fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
                }}
              >
                Outline
              </span>
              <span className="text-[10px] frens-muted">Classic meme</span>
            </button>
            <button
              type="button"
              onClick={() => onChange?.({ text, style: 'box' })}
              className={`rounded-lg border px-2.5 py-2 text-left transition touch-manipulation ${
                style === 'box' ? OPTION_ACTIVE : OPTION_IDLE
              }`}
            >
              <span className="block text-[11px] bg-white text-black px-1.5 py-0.5 rounded-sm font-medium">
                White box
              </span>
              <span className="text-[10px] frens-muted">Caption bar</span>
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => onChange?.({ text: e.target.value.slice(0, MEME_CAPTION_MAX), style })}
            rows={style === 'outline' ? 3 : 2}
            maxLength={MEME_CAPTION_MAX}
            placeholder={style === 'outline' ? 'TOP LINE\n\nbottom line' : 'Caption in the white box…'}
            className="frens-input w-full text-sm min-h-[4.5rem] resize-y"
          />
          <p className="text-[10px] frens-muted">
            {style === 'outline'
              ? 'Blank line splits top / bottom. GIFs become a still when text is added.'
              : 'Shows as a white bar across the top.'}
            {' '}
            {text.length}/{MEME_CAPTION_MAX}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Live CSS preview of caption over an image URL */
export function MemeCaptionPreview({ src, text, style = 'outline', className = '' }) {
  const trimmed = String(text || '').trim()
  if (!src) return null

  const parts = trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  const top = style === 'outline' && parts.length >= 2 ? parts[0] : null
  const bottom = style === 'outline'
    ? (parts.length >= 2 ? parts.slice(1).join(' ') : parts[0] || '')
    : ''

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={src} alt="" className="w-full h-full object-cover" />
      {style === 'box' && trimmed ? (
        <div className="absolute inset-x-0 top-0 bg-white text-black text-left px-2.5 py-2 text-[11px] sm:text-xs leading-snug font-sans">
          {trimmed}
        </div>
      ) : null}
      {style === 'outline' && top ? (
        <p
          className="absolute inset-x-2 top-2 text-center text-[11px] sm:text-sm font-bold uppercase leading-tight pointer-events-none"
          style={{
            color: '#fff',
            fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
            textShadow: '0 0 3px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
          }}
        >
          {top}
        </p>
      ) : null}
      {style === 'outline' && bottom ? (
        <p
          className="absolute inset-x-2 bottom-2 text-center text-[11px] sm:text-sm font-bold uppercase leading-tight pointer-events-none"
          style={{
            color: '#fff',
            fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
            textShadow: '0 0 3px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
          }}
        >
          {bottom}
        </p>
      ) : null}
    </div>
  )
}
