export const DEFAULT_IMAGE_LAYOUT = { x: 22.5, y: 14, w: 55 }

export function normalizeImageLayout(layout) {
  const src = layout || DEFAULT_IMAGE_LAYOUT
  const w = clamp(Number(src.w) || DEFAULT_IMAGE_LAYOUT.w, 12, 92)
  const x = clamp(Number(src.x) || DEFAULT_IMAGE_LAYOUT.x, 0, 100 - w)
  const y = clamp(Number(src.y) || DEFAULT_IMAGE_LAYOUT.y, 0, 92)
  return { x, y, w }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Compare content bottom to the sheet’s content box (inside padding).
 * Matches A4 printable area used by the editor preview.
 */
export function measureLetterPageOverflow(sheetEl, contentEl, imageEl) {
  if (!sheetEl || !contentEl) return { overflow: false, overflowPx: 0, pageHeight: 0 }

  const style = window.getComputedStyle(sheetEl)
  const padBottom = Number.parseFloat(style.paddingBottom) || 0
  const pageHeight = sheetEl.clientHeight
  const usableBottom = Math.max(0, pageHeight - padBottom)

  let maxBottom = contentEl.offsetTop + contentEl.scrollHeight

  if (imageEl) {
    maxBottom = Math.max(maxBottom, imageEl.offsetTop + imageEl.offsetHeight)
  }

  // Small slack so sub-pixel / line-box rounding doesn’t flash a false page break
  const overflowPx = Math.max(0, maxBottom - usableBottom + 1)
  return {
    overflow: overflowPx > 6,
    overflowPx,
    pageHeight,
  }
}

/** True when image is stretched near full page (print with zero margins). */
export function isFullBleedImage(layout) {
  const L = normalizeImageLayout(layout)
  return L.w >= 88 && L.y <= 6
}
