import { foldPrintMarginCss, FOLD_PRINT_MARGIN_MM, normalizeImageTransform } from '../../lib/foldFormats'

/**
 * Show image at natural fit (full image visible at scale 1).
 * User zooms / pans / rotates manually — no auto-cover crop.
 * When `sheetMargins` is true, applies fixed equal FOLD_PRINT_MARGIN_MM inset (A4 print setting).
 */
export default function FoldImageFill({
  slot,
  /** @deprecated use sheetMargins — old per-panel toggle, ignored for print consistency */
  margins: _legacyMargins,
  /** Apply fixed equal A4 print margin (same on all folds). */
  sheetMargins = true,
  landscape = false,
  className = '',
}) {
  if (!slot) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center frens-muted text-[10px] ${className}`}>
        empty
      </div>
    )
  }

  if (slot.kind === 'pdf') {
    return (
      <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center ${className}`}>
        <span className="text-[10px] font-medium">PDF</span>
        <span className="text-[9px] frens-muted truncate max-w-full px-1">{slot.name}</span>
      </div>
    )
  }

  const t = normalizeImageTransform(slot.transform)
  const pad = sheetMargins ? foldPrintMarginCss(landscape) : undefined

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={pad ? { ...pad, boxSizing: 'border-box' } : undefined}
      data-print-margin-mm={sheetMargins ? FOLD_PRINT_MARGIN_MM : undefined}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={slot.dataUrl}
          alt=""
          draggable={false}
          className="select-none pointer-events-none"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            maxWidth: 'none',
            transform: `translate(-50%, -50%) translate(${t.x}%, ${t.y}%) rotate(${t.rotate}deg) scale(${t.scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
    </div>
  )
}
