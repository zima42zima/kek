/**
 * Sense engine — mixes camera, motion, and mic for echo creation.
 * Works on any device with camera (+ mic for ambience).
 */

const GRID_COLS = 40
const GRID_ROWS = 54

function clamp01(n) {
  return Math.min(1, Math.max(0, n))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

export class SenseEngine {
  constructor() {
    this.cols = GRID_COLS
    this.rows = GRID_ROWS
    this.size = GRID_COLS * GRID_ROWS
    this.motion = new Float32Array(this.size)
    this.prevGray = null
    this.motionReady = false
    this.frameCount = 0
    this.motionBoost = 1
    this.audioLevel = 0
    this.audioPeak = 0

    this.sampleCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
    this.sampleCtx = this.sampleCanvas?.getContext('2d', { willReadFrequently: true }) ?? null

    this.audioCtx = null
    this.analyser = null
    this.audioData = null
    this._stopMotion = watchMotion((mag) => {
      this.motionBoost = 1 + mag * 2.2
    })
  }

  attachStream(stream) {
    this.detachAudio()
    const track = stream?.getAudioTracks?.()?.[0]
    if (!track || typeof AudioContext === 'undefined') return

    try {
      this.audioCtx = new AudioContext()
      const source = this.audioCtx.createMediaStreamSource(new MediaStream([track]))
      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.72
      source.connect(this.analyser)
      this.audioData = new Uint8Array(this.analyser.frequencyBinCount)
    } catch { /* mic optional */ }
  }

  detachAudio() {
    try {
      this.audioCtx?.close()
    } catch { /* ignore */ }
    this.audioCtx = null
    this.analyser = null
    this.audioData = null
  }

  dispose() {
    this._stopMotion?.()
    this._stopMotion = null
    this.detachAudio()
  }

  readAudioLevel() {
    if (!this.analyser || !this.audioData) return 0
    this.analyser.getByteFrequencyData(this.audioData)
    let sum = 0
    for (let i = 0; i < this.audioData.length; i++) sum += this.audioData[i]
    const avg = sum / (this.audioData.length * 255)
    this.audioLevel = lerp(this.audioLevel, clamp01(avg * 2.8), 0.35)
    this.audioPeak = Math.max(this.audioPeak * 0.98, this.audioLevel)
    return this.audioLevel
  }

  updateFromVideo(video) {
    if (!video || video.readyState < 2 || !this.sampleCtx || !this.sampleCanvas) return

    this.readAudioLevel()

    this.sampleCanvas.width = this.cols
    this.sampleCanvas.height = this.rows
    this.sampleCtx.drawImage(video, 0, 0, this.cols, this.rows)
    const img = this.sampleCtx.getImageData(0, 0, this.cols, this.rows)
    const gray = new Float32Array(this.size)

    for (let i = 0; i < this.size; i++) {
      const p = i * 4
      gray[i] = (img.data[p] * 0.299 + img.data[p + 1] * 0.587 + img.data[p + 2] * 0.114) / 255
    }

    if (this.prevGray) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const i = r * this.cols + c
          let diff = Math.abs(gray[i] - this.prevGray[i])
          if (c > 0) diff += Math.abs(gray[i] - gray[i - 1]) * 0.4
          if (r > 0) diff += Math.abs(gray[i] - gray[i - this.cols]) * 0.4
          const signal = clamp01(diff * 6.5 * this.motionBoost)
          this.motion[i] = lerp(this.motion[i], signal, 0.28)
        }
      }
      this.motionReady = this.frameCount > 6
    }

    this.prevGray = gray
    this.frameCount += 1
  }

  getMotionAt(col, row) {
    const c = Math.min(this.cols - 1, Math.max(0, col))
    const r = Math.min(this.rows - 1, Math.max(0, row))
    return this.motion[r * this.cols + c] ?? 0
  }

  get colsCount() { return this.cols }
  get rowsCount() { return this.rows }
}

export function createSenseEngine() {
  return new SenseEngine()
}

export function senseStatusLabel(filterId, engine) {
  if (filterId === 'trace') {
    return engine?.motionReady ? '🦇 Motion · pan to trace' : '🦇 Motion · warming up'
  }
  if (filterId === 'place') return '🏞️ Camera · show the spot'
  if (filterId === 'ambience') {
    const lvl = engine?.audioLevel ?? 0
    return lvl > 0.12 ? '🌊 Sound · room is alive' : '🌊 Sound · listening…'
  }
  return ''
}

function watchMotion(onMag) {
  if (typeof window === 'undefined') return () => {}

  let last = { x: 0, y: 0, z: 0 }
  function handler(e) {
    const a = e.accelerationIncludingGravity
    if (!a) return
    const mag = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z)
    last = { x: a.x, y: a.y, z: a.z }
    onMag(clamp01(mag / 4))
  }

  function attach() {
    window.addEventListener('devicemotion', handler, true)
  }

  if (typeof DeviceMotionEvent?.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then((s) => { if (s === 'granted') attach() })
      .catch(() => {})
  } else {
    attach()
  }

  return () => window.removeEventListener('devicemotion', handler, true)
}
