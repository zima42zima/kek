/**
 * Bake meme caption text onto an image (pixels — uploaded as final art).
 * Styles: classic Impact outline, or white caption box.
 */

const DEFAULT_MIME = 'image/jpeg'
const DEFAULT_QUALITY = 0.92
const IMPACT = 'Impact, Haettenschweiler, "Arial Black", sans-serif'
const BOX_FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines = []
  let line = words[0]
  for (let i = 1; i < words.length; i += 1) {
    const test = `${line} ${words[i]}`
    if (ctx.measureText(test).width <= maxWidth) line = test
    else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

function pickImpactSize(ctx, lines, maxWidth, width) {
  const maxSize = Math.max(22, Math.round(width * 0.085))
  const minSize = Math.max(14, Math.round(width * 0.042))
  let size = maxSize
  while (size > minSize) {
    ctx.font = `bold ${size}px ${IMPACT}`
    if (lines.every((l) => ctx.measureText(l).width <= maxWidth)) return size
    size -= 2
  }
  return minSize
}

function drawImpactBlock(ctx, text, width, height, edge) {
  const maxWidth = width * 0.92
  ctx.font = `bold ${Math.round(width * 0.08)}px ${IMPACT}`
  const lines = wrapLines(ctx, String(text).toUpperCase(), maxWidth).slice(0, 3)
  if (!lines.length) return
  const size = pickImpactSize(ctx, lines, maxWidth, width)
  const lineHeight = size * 1.15
  const stroke = Math.max(3, Math.round(size * 0.12))
  const blockH = lines.length * lineHeight
  const margin = Math.round(height * 0.035)
  let y = edge === 'top'
    ? margin + lineHeight * 0.55
    : height - margin - blockH + lineHeight * 0.55

  ctx.font = `bold ${size}px ${IMPACT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  for (const line of lines) {
    ctx.lineWidth = stroke
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#fff'
    ctx.strokeText(line, width / 2, y)
    ctx.fillText(line, width / 2, y)
    y += lineHeight
  }
}

function drawWhiteBox(ctx, text, width) {
  const padX = Math.round(width * 0.04)
  const padY = Math.round(width * 0.028)
  const maxWidth = width - padX * 2
  let size = Math.max(16, Math.round(width * 0.048))
  const minSize = 12
  ctx.font = `${size}px ${BOX_FONT}`
  let lines = wrapLines(ctx, text, maxWidth)
  while (size > minSize && lines.length > 4) {
    size -= 1
    ctx.font = `${size}px ${BOX_FONT}`
    lines = wrapLines(ctx, text, maxWidth)
  }
  const lineHeight = size * 1.25
  const boxH = padY * 2 + lines.length * lineHeight
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, boxH)
  ctx.fillStyle = '#111'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `${size}px ${BOX_FONT}`
  let y = padY
  for (const line of lines) {
    ctx.fillText(line, padX, y)
    y += lineHeight
  }
}

/**
 * @param {Blob} blob
 * @param {{ text?: string, style?: 'outline' | 'box' }} caption
 */
export async function bakeMemeCaption(blob, caption = {}) {
  const text = String(caption.text || '').trim()
  if (!text) {
    return { blob, dataUrl: await blobToDataUrl(blob) }
  }

  const img = await loadImage(await blobToDataUrl(blob))
  const { width, height } = img
  const style = caption.style === 'box' ? 'box' : 'outline'

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0)

  if (style === 'box') {
    drawWhiteBox(ctx, text, width)
  } else {
    const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      drawImpactBlock(ctx, parts[0], width, height, 'top')
      drawImpactBlock(ctx, parts.slice(1).join(' '), width, height, 'bottom')
    } else {
      drawImpactBlock(ctx, parts[0] || text, width, height, 'bottom')
    }
  }

  const outBlob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not bake meme text.'))),
      DEFAULT_MIME,
      DEFAULT_QUALITY,
    )
  })
  return { blob: outBlob, dataUrl: await blobToDataUrl(outBlob) }
}

export const MEME_CAPTION_MAX = 120
export const ECHO_TITLE_MAX = 222
