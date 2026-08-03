/** A4 letter typography — editor px aligned with owlPrint (10mm margins). */

const PRINTABLE_WIDTH_MM = 210 - 10 * 2 // 190mm

/** ~718px at 96dpi — one em must not exceed printable width. */
export const LETTER_MIN_FONT_SIZE = 10
export const LETTER_MAX_FONT_SIZE = Math.round((PRINTABLE_WIDTH_MM / 25.4) * 96)

export const LETTER_A4_PRINTABLE_MM = { width: PRINTABLE_WIDTH_MM, height: 277 }

export function clampLetterFontSize(px, fallback = 14) {
  const n = Number(px)
  if (!Number.isFinite(n)) return fallback
  return Math.min(LETTER_MAX_FONT_SIZE, Math.max(LETTER_MIN_FONT_SIZE, Math.round(n)))
}

export function buildLetterSizeSteps() {
  const steps = new Set()
  const add = (n) => steps.add(clampLetterFontSize(n))
  ;[
    10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72,
    80, 88, 96, 112, 128, 144, 160, 192, 224, 256, 320, 384, 448, 512, 576, 640,
  ].forEach(add)
  add(LETTER_MAX_FONT_SIZE)
  return [...steps].sort((a, b) => a - b)
}
