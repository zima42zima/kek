/**
 * Echo media prepare: duration caps + 720p video transcode for uploads.
 */

import { ECHO_AUDIO_MAX_SEC, ECHO_VIDEO_MAX_SEC } from './echoConstants'

export const ECHO_VIDEO_MAX_EDGE = 1280
export const ECHO_VIDEO_BITRATE = 1_200_000
export const ECHO_AUDIO_BITRATE = 96_000
const DURATION_SLACK_SEC = 0.35

function pickVideoMime() {
  if (typeof MediaRecorder === 'undefined') return null
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus'
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus'
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm'
  if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4'
  return ''
}

function blobToObjectUrl(blob) {
  return URL.createObjectURL(blob)
}

function loadMediaElement(tag, blob) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag)
    el.preload = 'auto'
    el.playsInline = true
    const url = blobToObjectUrl(blob)
    el.src = url
    el.onloadedmetadata = () => resolve({ el, url })
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read ${tag === 'video' ? 'video' : 'audio'} file.`))
    }
  })
}

async function readDuration(el, known = 0) {
  let duration = known > 0 ? known : el.duration
  if (Number.isFinite(duration) && duration > 0 && duration !== Infinity) return duration
  // Some formats report Infinity until we seek near the end.
  try {
    await new Promise((resolve) => {
      const onSeeked = () => {
        el.removeEventListener('seeked', onSeeked)
        resolve()
      }
      el.addEventListener('seeked', onSeeked)
      el.currentTime = 1e9
    })
    duration = el.duration
  } catch { /* ignore */ }
  if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) {
    throw new Error('Could not read media duration.')
  }
  return duration
}

function assertDuration(duration, maxSeconds, label) {
  if (duration > maxSeconds + DURATION_SLACK_SEC) {
    throw new Error(`${label} must be ${maxSeconds}s or shorter (yours is ~${Math.ceil(duration)}s).`)
  }
}

function fit720(width, height) {
  const maxW = ECHO_VIDEO_MAX_EDGE
  const maxH = 720
  const scale = Math.min(1, maxW / width, maxH / height)
  // Even dimensions help some encoders.
  const w = Math.max(2, Math.round((width * scale) / 2) * 2)
  const h = Math.max(2, Math.round((height * scale) / 2) * 2)
  return { w, h }
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
 * Transcode a video blob to ≤720p @ ~1.2 Mbps. Trims/rejects by maxSeconds.
 */
export async function transcodeEchoVideo(rawBlob, {
  maxSeconds = ECHO_VIDEO_MAX_SEC,
  videoBitsPerSecond = ECHO_VIDEO_BITRATE,
  audioBitsPerSecond = ECHO_AUDIO_BITRATE,
} = {}) {
  if (!rawBlob) throw new Error('Missing video.')
  const mime = pickVideoMime()
  if (!mime) throw new Error('Video encoding is not supported in this browser.')

  const { el: video, url } = await loadMediaElement('video', rawBlob)
  video.muted = true
  const duration = await readDuration(video)
  assertDuration(duration, maxSeconds, 'Video')

  const srcW = video.videoWidth || 1280
  const srcH = video.videoHeight || 720
  const { w, h } = fit720(srcW, srcH)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px'
  document.body.appendChild(canvas)
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px'
  document.body.appendChild(video)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    video.remove()
    URL.revokeObjectURL(url)
    throw new Error('Canvas not available')
  }

  const canvasStream = canvas.captureStream(30)
  const videoTrack = canvasStream.getVideoTracks()[0]
  if (!videoTrack) {
    canvas.remove()
    video.remove()
    URL.revokeObjectURL(url)
    throw new Error('Could not capture video')
  }

  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null
  if (audioCtx?.state === 'suspended') await audioCtx.resume().catch(() => {})
  video.muted = false
  video.volume = 1
  const audioTrack = audioTrackFromVideo(video, audioCtx)
  const outStream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack])

  return new Promise((resolve, reject) => {
    const chunks = []
    let recorder
    try {
      recorder = new MediaRecorder(outStream, {
        mimeType: mime,
        videoBitsPerSecond,
        audioBitsPerSecond,
      })
    } catch {
      try {
        recorder = new MediaRecorder(outStream, { mimeType: mime })
      } catch {
        recorder = new MediaRecorder(outStream)
      }
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
      resolve({
        blob: new Blob(chunks, { type }),
        duration,
        width: w,
        height: h,
      })
    }

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunks.push(e.data)
    }
    recorder.onstop = finish
    recorder.onerror = () => {
      if (stopped) return
      stopped = true
      cleanup()
      reject(new Error('Could not convert video to 720p.'))
    }

    const stopSoon = () => {
      if (stopped) return
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, 200)
    }

    const paint = () => {
      if (stopped) return
      ctx.drawImage(video, 0, 0, w, h)
      if (typeof videoTrack.requestFrame === 'function') {
        try { videoTrack.requestFrame() } catch { /* ignore */ }
      }
      if (video.ended || video.currentTime >= duration - 0.04) {
        stopSoon()
        return
      }
      requestAnimationFrame(paint)
    }

    video.currentTime = 0
    video.play().then(() => {
      recorder.start(200)
      requestAnimationFrame(paint)
      // Hard stop at maxSeconds even if metadata duration is wrong.
      setTimeout(stopSoon, (Math.min(duration, maxSeconds) + 0.4) * 1000)
    }).catch((err) => {
      stopped = true
      cleanup()
      reject(err)
    })
  })
}

/** Validate audio duration and wrap into a clean blob for echo upload. */
export async function prepareEchoAudio(file, { maxSeconds = ECHO_AUDIO_MAX_SEC } = {}) {
  if (!file || !(file.type?.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|webm)$/i.test(file.name || ''))) {
    throw new Error('Please choose an audio file.')
  }
  const buffer = await file.arrayBuffer()
  const type = file.type || 'audio/mpeg'
  const blob = new Blob([buffer], { type })
  const { el, url } = await loadMediaElement('audio', blob)
  try {
    const duration = await readDuration(el)
    assertDuration(duration, maxSeconds, 'Audio')
    return { blob, duration }
  } finally {
    el.removeAttribute('src')
    el.load()
    URL.revokeObjectURL(url)
  }
}

/** Validate + transcode video upload for echoes (≤11s, 720p). */
export async function prepareEchoVideo(file, { maxSeconds = ECHO_VIDEO_MAX_SEC } = {}) {
  const looksVideo = file?.type?.startsWith('video/')
    || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file?.name || '')
  if (!file || !looksVideo) {
    throw new Error('Please choose a video file.')
  }
  // Cap raw upload size before we spend time encoding (~40MB).
  if (file.size > 40 * 1024 * 1024) {
    throw new Error('Video must be under 40MB before convert.')
  }
  return transcodeEchoVideo(file, { maxSeconds })
}

/** MediaRecorder options for live echo video capture. */
export function echoVideoRecorderOptions(mime) {
  const opts = { mimeType: mime }
  try {
    return {
      ...opts,
      videoBitsPerSecond: ECHO_VIDEO_BITRATE,
      audioBitsPerSecond: ECHO_AUDIO_BITRATE,
    }
  } catch {
    return opts
  }
}
