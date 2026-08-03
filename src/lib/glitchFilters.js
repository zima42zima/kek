/**
 * Retro / glitch live filters for echo recording (canvas 2D).
 * Inspired by glitch.app, Efecto, VHS & early-internet aesthetics.
 */

export const GLITCH_FILTER_IDS = [
  'ascii',
  'dither',
  'chromatic',
  'scanline',
  'thermal',
  'wave',
  'nodes',
  'gradient',
  'pixel',
  'outline',
]

const ASCII_RAMP = ' .:-=+*#%@'
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const GB = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']

let scratchCanvas
let scratchCtx

function scratch(w, h) {
  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas')
    scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true })
  }
  scratchCanvas.width = w
  scratchCanvas.height = h
  return scratchCtx
}

function luma(r, g, b) {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255
}

function heatColor(t) {
  const stops = [
    [0, 10, 20, 80],
    [0.25, 80, 0, 120],
    [0.5, 220, 60, 20],
    [0.75, 255, 180, 0],
    [1, 255, 255, 220],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0] || 1)
      return `rgb(${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)},${Math.round(a[3] + (b[3] - a[3]) * f)})`
    }
  }
  return 'rgb(255,255,220)'
}

function synthGradient(t) {
  if (t < 0.5) {
    const f = t * 2
    return `rgb(${Math.round(45 + 62 * f)},${Math.round(27 + 165 * f)},${Math.round(105 - 38 * f)})`
  }
  const f = (t - 0.5) * 2
  return `rgb(${Math.round(107 + 117 * f)},${Math.round(192 - 80 * f)},${Math.round(107 + 51 * f)})`
}

/** 1. ASCII — terminal character mosaic */
function renderAscii(ctx, video, w, h) {
  const cell = Math.max(6, Math.round(w / 48))
  const cols = Math.floor(w / cell)
  const rows = Math.floor(h / cell)
  const sctx = scratch(cols, rows)
  sctx.drawImage(video, 0, 0, cols, rows)
  const img = sctx.getImageData(0, 0, cols, rows)

  ctx.fillStyle = '#0a0f0a'
  ctx.fillRect(0, 0, w, h)
  ctx.font = `${cell}px ui-monospace, monospace`
  ctx.textBaseline = 'top'

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4
      const L = luma(img.data[i], img.data[i + 1], img.data[i + 2])
      const ch = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor(L * ASCII_RAMP.length))]
      const g = Math.floor(L * 200 + 55)
      ctx.fillStyle = `rgb(${g * 0.4},${g},${g * 0.55})`
      ctx.fillText(ch, x * cell, y * cell)
    }
  }
}

/** 2. Dither — Game Boy ordered dither */
function renderDither(ctx, video, w, h) {
  const scale = 2
  const sw = Math.ceil(w / scale)
  const sh = Math.ceil(h / scale)
  const sctx = scratch(sw, sh)
  sctx.drawImage(video, 0, 0, sw, sh)
  const img = sctx.getImageData(0, 0, sw, sh)

  ctx.fillStyle = GB[0]
  ctx.fillRect(0, 0, w, h)

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const L = luma(img.data[i], img.data[i + 1], img.data[i + 2])
      const threshold = (BAYER_4[y % 4][x % 4] + 0.5) / 16
      const level = L + (L > threshold ? 0.08 : -0.08)
      const idx = Math.min(3, Math.max(0, Math.floor(level * 4)))
      ctx.fillStyle = GB[idx]
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
}

/** 3. Chromatic — RGB channel split (VHS drift) */
function renderChromatic(ctx, video, w, h, time) {
  const drift = 3 + Math.sin(time * 0.003) * 2
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.85
  ctx.drawImage(video, -drift, 0, w, h)
  ctx.globalAlpha = 0.75
  ctx.drawImage(video, drift, 0, w, h)
  ctx.globalAlpha = 0.55
  ctx.drawImage(video, 0, 0, w, h)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

/** 4. Scanline — CRT phosphor rows */
function renderScanline(ctx, video, w, h, time) {
  ctx.drawImage(video, 0, 0, w, h)
  const flicker = 0.08 + Math.sin(time * 0.01) * 0.03
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = `rgba(0,0,0,${0.35 + flicker})`
    ctx.fillRect(0, y, w, 1)
  }
  ctx.fillStyle = 'rgba(107,192,107,0.04)'
  ctx.fillRect(0, 0, w, h)
}

/** 5. Thermal — false-color heat / infrared */
function renderThermal(ctx, video, w, h) {
  const scale = 2
  const sw = Math.ceil(w / scale)
  const sh = Math.ceil(h / scale)
  const sctx = scratch(sw, sh)
  sctx.drawImage(video, 0, 0, sw, sh)
  const img = sctx.getImageData(0, 0, sw, sh)

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const L = luma(img.data[i], img.data[i + 1], img.data[i + 2])
      ctx.fillStyle = heatColor(L)
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
}

/** 6. Wave — horizontal slice displacement */
function renderWave(ctx, video, w, h, time) {
  const sliceH = 4
  for (let y = 0; y < h; y += sliceH) {
    const offset = Math.sin(y * 0.04 + time * 0.004) * 14
    ctx.drawImage(video, 0, y, w, sliceH, offset, y, w, sliceH)
  }
}

/** 7. Nodes — edge mesh wireframe */
function renderNodes(ctx, video, w, h) {
  const scale = 3
  const sw = Math.ceil(w / scale)
  const sh = Math.ceil(h / scale)
  const sctx = scratch(sw, sh)
  sctx.drawImage(video, 0, 0, sw, sh)
  const img = sctx.getImageData(0, 0, sw, sh)
  const points = []

  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 0.2
  ctx.drawImage(video, 0, 0, w, h)
  ctx.globalAlpha = 1

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = (y * sw + x) * 4
      const gx = luma(img.data[i + 4], img.data[i + 5], img.data[i + 6])
        - luma(img.data[i - 4], img.data[i - 3], img.data[i - 2])
      const gy = luma(img.data[i + sw * 4], img.data[i + sw * 4 + 1], img.data[i + sw * 4 + 2])
        - luma(img.data[i - sw * 4], img.data[i - sw * 4 + 1], img.data[i - sw * 4 + 2])
      if (Math.abs(gx) + Math.abs(gy) > 0.22) {
        points.push({ x: x * scale, y: y * scale })
      }
    }
  }

  ctx.strokeStyle = 'rgba(107, 192, 107, 0.25)'
  ctx.lineWidth = 0.6
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    for (let j = i + 1; j < Math.min(i + 8, points.length); j++) {
      const b = points[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < 28) {
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
    ctx.beginPath()
    ctx.arc(a.x, a.y, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(107, 192, 107, 0.85)'
    ctx.fill()
  }
}

/** 8. Gradient — synthwave duotone remap */
function renderGradient(ctx, video, w, h) {
  const scale = 2
  const sw = Math.ceil(w / scale)
  const sh = Math.ceil(h / scale)
  const sctx = scratch(sw, sh)
  sctx.drawImage(video, 0, 0, sw, sh)
  const img = sctx.getImageData(0, 0, sw, sh)

  ctx.fillStyle = '#12081f'
  ctx.fillRect(0, 0, w, h)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const L = luma(img.data[i], img.data[i + 1], img.data[i + 2])
      ctx.fillStyle = synthGradient(L)
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
}

/** 9. Pixel — chunky 8-bit blocks */
function renderPixel(ctx, video, w, h) {
  const block = Math.max(8, Math.round(w / 40))
  const sw = Math.ceil(w / block)
  const sh = Math.ceil(h / block)
  const sctx = scratch(sw, sh)
  sctx.imageSmoothingEnabled = false
  sctx.drawImage(video, 0, 0, sw, sh)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(scratchCanvas, 0, 0, sw, sh, 0, 0, w, h)
  ctx.imageSmoothingEnabled = true
}

/** 10. Outline — contour line art */
function renderOutline(ctx, video, w, h) {
  const scale = 2
  const sw = Math.ceil(w / scale)
  const sh = Math.ceil(h / scale)
  const sctx = scratch(sw, sh)
  sctx.drawImage(video, 0, 0, sw, sh)
  const img = sctx.getImageData(0, 0, sw, sh)

  ctx.fillStyle = '#060608'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 0.15
  ctx.drawImage(video, 0, 0, w, h)
  ctx.globalAlpha = 1

  ctx.strokeStyle = 'rgba(107, 192, 107, 0.9)'
  ctx.lineWidth = 1.2

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = (y * sw + x) * 4
      const L = luma(img.data[i], img.data[i + 1], img.data[i + 2])
      const Lr = luma(img.data[i + 4], img.data[i + 5], img.data[i + 6])
      const Ld = luma(img.data[i + sw * 4], img.data[i + sw * 4 + 1], img.data[i + sw * 4 + 2])
      if (Math.abs(L - Lr) + Math.abs(L - Ld) > 0.18) {
        ctx.strokeRect(x * scale, y * scale, scale, scale)
      }
    }
  }
}

export function applyGlitchFilter(ctx, video, w, h, filterId, time = 0) {
  if (!ctx || !video) return
  switch (filterId) {
    case 'ascii': renderAscii(ctx, video, w, h); break
    case 'dither': renderDither(ctx, video, w, h); break
    case 'chromatic': renderChromatic(ctx, video, w, h, time); break
    case 'scanline': renderScanline(ctx, video, w, h, time); break
    case 'thermal': renderThermal(ctx, video, w, h); break
    case 'wave': renderWave(ctx, video, w, h, time); break
    case 'nodes': renderNodes(ctx, video, w, h); break
    case 'gradient': renderGradient(ctx, video, w, h); break
    case 'pixel': renderPixel(ctx, video, w, h); break
    case 'outline': renderOutline(ctx, video, w, h); break
    default: ctx.drawImage(video, 0, 0, w, h)
  }
}

export function glitchFilterLabel(id) {
  const labels = {
    clear: 'Clear',
    ascii: 'ASCII',
    dither: 'Dither',
    chromatic: 'Split',
    scanline: 'CRT',
    thermal: 'Heat',
    wave: 'Wave',
    nodes: 'Nodes',
    gradient: 'Gradient',
    pixel: '8-bit',
    outline: 'Outline',
    trace: 'Trace',
    place: 'Place',
    ambience: 'Ambience',
  }
  return labels[id] || ''
}

export function isGlitchFilterActive(id) {
  return Boolean(id && id !== 'clear' && GLITCH_FILTER_IDS.includes(id))
}

export function normalizeEchoFilter(id) {
  if (!id || id === 'clear') return 'clear'
  if (GLITCH_FILTER_IDS.includes(id)) return id
  const legacy = {
    trace: 'nodes',
    place: 'outline',
    ambience: 'wave',
    'depth-portrait': 'outline',
    'ghost-trace': 'ascii',
    'distance-fog': 'thermal',
    'proximity-spotlight': 'gradient',
    'surface-wireframe': 'nodes',
  }
  return legacy[id] || 'clear'
}
