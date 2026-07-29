// Media privacy helpers.
//
// Re-encoding an image through a <canvas> drops ALL embedded metadata:
// EXIF (camera model, capture timestamp), GPS/location tags, and any
// vendor maker-notes. The browser's canvas API only keeps raw pixels, so
// exporting from it produces a clean file with no hidden provenance data.

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_MIME = 'image/jpeg'
const DEFAULT_QUALITY = 0.9

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

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

/**
 * Strip metadata from an image file and (optionally) downscale it.
 * Returns a clean Blob plus a data URL suitable for previews.
 */
export async function sanitizeImage(file, {
  maxDimension = DEFAULT_MAX_DIMENSION,
  mime = DEFAULT_MIME,
  quality = DEFAULT_QUALITY,
} = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const sourceUrl = await readFileAsDataUrl(file)
  const img = await loadImage(sourceUrl)

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  // White backdrop so transparent PNGs don't turn black when exported as JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not process image.'))),
      mime,
      quality,
    )
  })

  const dataUrl = await blobToDataUrl(blob)
  return { blob, dataUrl, width, height }
}

/**
 * Best-effort sanitization for video: re-wrap the raw bytes into a fresh Blob,
 * dropping the original File's name and lastModified fingerprint. NOTE: this
 * does NOT rewrite container-level metadata (e.g. QuickTime creation-time or
 * embedded GPS) — that requires server-side or ffmpeg.wasm transcoding.
 */
export async function sanitizeVideo(file) {
  if (!file || !file.type?.startsWith('video/')) {
    throw new Error('Please choose a video file.')
  }
  const buffer = await file.arrayBuffer()
  const blob = new Blob([buffer], { type: file.type })
  const dataUrl = await blobToDataUrl(blob)
  return { blob, dataUrl, stripped: false }
}
