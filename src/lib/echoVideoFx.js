/**
 * Bake glitch FX into a recorded video blob (reliable on iOS Safari).
 * Records raw camera first, then re-encodes through canvas so saved = preview.
 */

import { applySenseFilter } from './senseFilters'

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus'
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus'
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm'
  if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4'
  return ''
}

function loadVideo(blob) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.playsInline = true
    video.preload = 'auto'
    video.volume = 0
    video.muted = false
    const url = URL.createObjectURL(blob)
    video.src = url
    video.onloadedmetadata = () => resolve({ video, url })
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load recorded video'))
    }
  })
}

function audioTrackFromVideo(video, audioCtx) {
  if (typeof video.captureStream === 'function') {
    try {
      const track = video.captureStream().getAudioTracks()[0]
      if (track) return track
    } catch { /* fall through */ }
  }
  if (!audioCtx) return null
  try {
    const dest = audioCtx.createMediaStreamDestination()
    const source = audioCtx.createMediaElementSource(video)
    source.connect(dest)
    return dest.stream.getAudioTracks()[0] ?? null
  } catch {
    return null
  }
}

/**
 * Re-encode rawBlob with filterId applied to every frame.
 * @param {number} [knownDurationSec] — wall-clock record length when blob duration is unreliable
 */
export async function bakeGlitchFilterIntoVideo(rawBlob, filterId, { facingUser = false, knownDurationSec = 0 } = {}) {
  if (!rawBlob || !filterId || filterId === 'clear') return rawBlob

  const mime = pickMime()
  if (!mime) throw new Error('MediaRecorder not supported')

  const { video, url } = await loadVideo(rawBlob)
  const w = video.videoWidth || 720
  const h = video.videoHeight || 1280
  let duration = knownDurationSec > 0 ? knownDurationSec : video.duration
  if (!Number.isFinite(duration) || duration <= 0) {
    duration = await estimateDuration(video, knownDurationSec)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px'
  document.body.appendChild(canvas)
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px'
  document.body.appendChild(video)

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    canvas.remove()
    video.remove()
    URL.revokeObjectURL(url)
    throw new Error('Canvas not available')
  }

  const canvasStream = canvas.captureStream(0)
  const videoTrack = canvasStream.getVideoTracks()[0]
  if (!videoTrack) {
    canvas.remove()
    video.remove()
    URL.revokeObjectURL(url)
    throw new Error('Could not capture filtered video')
  }

  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null
  if (audioCtx?.state === 'suspended') await audioCtx.resume().catch(() => {})

  const audioTrack = audioTrackFromVideo(video, audioCtx)
  const outStream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack])

  return new Promise((resolve, reject) => {
    const chunks = []
    let recorder
    try {
      recorder = new MediaRecorder(outStream, { mimeType: mime })
    } catch {
      recorder = new MediaRecorder(outStream)
    }

    let stopped = false
    const cleanup = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      canvas.remove()
      URL.revokeObjectURL(url)
      audioCtx?.close().catch(() => {})
    }

    const finish = () => {
      if (stopped) return
      stopped = true
      cleanup()
      const type = recorder.mimeType || mime.split(';')[0] || 'video/webm'
      resolve(new Blob(chunks, { type }))
    }

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunks.push(e.data)
    }
    recorder.onstop = finish
    recorder.onerror = () => {
      if (stopped) return
      stopped = true
      cleanup()
      reject(new Error('Failed to bake glitch FX'))
    }

    const stopSoon = () => {
      if (stopped) return
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, 250)
    }

    const paint = () => {
      if (stopped) return
      if (video.ended || video.currentTime >= duration - 0.05) {
        applySenseFilter(ctx, video, w, h, filterId, facingUser, video.currentTime * 1000)
        stopSoon()
        return
      }
      applySenseFilter(ctx, video, w, h, filterId, facingUser, video.currentTime * 1000)
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(paint)
      } else {
        requestAnimationFrame(paint)
      }
    }

    video.onended = stopSoon
    video.onerror = () => {
      if (stopped) return
      stopped = true
      cleanup()
      reject(new Error('Playback failed during FX bake'))
    }

    recorder.start(100)
    video.currentTime = 0

    video.play()
      .then(() => {
        paint()
        setTimeout(stopSoon, Math.ceil(duration * 1000) + 400)
      })
      .catch((err) => {
        stopped = true
        cleanup()
        reject(err)
      })
  })
}

function estimateDuration(video, fallbackSec) {
  if (fallbackSec > 0) return fallbackSec
  return new Promise((resolve) => {
    const done = (sec) => resolve(Math.max(sec, 0.5))
    const onMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.removeEventListener('durationchange', onMeta)
        done(video.duration)
      }
    }
    video.addEventListener('durationchange', onMeta)
    if (Number.isFinite(video.duration) && video.duration > 0) {
      done(video.duration)
      return
    }
    video.currentTime = 1e6
    video.onseeked = () => done(video.currentTime)
    setTimeout(() => done(fallbackSec || 15), 800)
  })
}
