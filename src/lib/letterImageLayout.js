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

export function measureLetterPageOverflow(sheetEl, contentEl, imageEl) {
  if (!sheetEl || !contentEl) return { overflow: false, overflowPx: 0, pageHeight: 0 }

  const pageHeight = sheetEl.clientHeight
  let maxBottom = contentEl.offsetTop + contentEl.scrollHeight

  if (imageEl) {
    maxBottom = Math.max(maxBottom, imageEl.offsetTop + imageEl.offsetHeight)
  }

  const overflowPx = Math.max(0, maxBottom - pageHeight + 4)
  return {
    overflow: overflowPx > 2,
    overflowPx,
    pageHeight,
  }
}
