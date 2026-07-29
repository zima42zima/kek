import { formatLetterDate } from '../../lib/owlLetterFormat'
import { APP_NAME } from '../../lib/brand'
import { normalizeOwlFontId, owlFontFamilyStyle, owlFontPresentation } from '../../lib/owlLetterFonts'
import OwlPostStamp from './OwlPostStamp'

export default function OwlLetterPreview({ letter, className = '' }) {
  const fontId = normalizeOwlFontId(letter.font)
  const bodyText = letter.body || 'Your message will appear here…'
  const { className: treatClass, style: treatStyle } = owlFontPresentation(fontId)

  return (
    <div
      className={`owl-letter-paper ${treatClass} w-full mx-auto p-6 sm:p-10 text-black ${className}`}
      style={{ minHeight: 420, ...owlFontFamilyStyle(fontId), ...treatStyle }}
      data-owl-font={fontId}
    >
      <OwlPostStamp className="absolute top-4 right-4 sm:top-6 sm:right-6" />

      <div className="flex items-start justify-between mb-5 pr-14">
        <div>
          <div className="owl-letter-header text-lg sm:text-xl font-medium tracking-[0.2em] text-black uppercase">
            Owl Post
          </div>
          <div className="text-[9px] tracking-[0.25em] text-black/60 mt-0.5 uppercase">From {APP_NAME}</div>
        </div>
        <div className="text-right text-[11px] sm:text-xs text-black/70 shrink-0">
          {formatLetterDate(letter.date)}
        </div>
      </div>

      <div className="mb-5 space-y-0.5 text-xs sm:text-sm border-y border-black py-2.5">
        <div><span className="font-medium uppercase text-[9px] tracking-wider">From</span> {letter.fromName || 'Your name'}</div>
        <div><span className="font-medium uppercase text-[9px] tracking-wider">To</span> {letter.toName || 'Their name'}</div>
      </div>

      {letter.greeting ? (
        <div className="mb-3 text-base sm:text-lg font-medium">{letter.greeting}</div>
      ) : null}

      {letter.image ? (
        <div className="mb-4 flex justify-center">
          <img
            src={letter.image}
            alt=""
            className="owl-letter-image max-h-[220px] sm:max-h-[280px] w-auto max-w-full object-contain border border-black/20"
          />
        </div>
      ) : null}

      <div className="text-sm sm:text-[15px] leading-relaxed mb-6 min-h-[100px] whitespace-pre-wrap">
        {bodyText}
      </div>

      <div className="mt-auto">
        {letter.closing ? <div className="mb-1 text-sm sm:text-base">{letter.closing}</div> : null}
        {letter.signature ? (
          <div className="font-medium text-base sm:text-lg">{letter.signature}</div>
        ) : null}
      </div>

      <div className="mt-6 pt-3 border-t border-black text-center">
        <div className="text-[8px] sm:text-[9px] tracking-[0.2em] text-black/50 uppercase">
          Sent with care via {APP_NAME}
        </div>
      </div>
    </div>
  )
}
