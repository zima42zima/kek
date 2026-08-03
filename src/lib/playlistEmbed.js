/** Embed URLs for global playlist background player. */

export function playlistPlayerSrc(track, playing = true) {
  if (!track || !playing) return null
  const type = track.videoType || track.video_type
  const id = track.videoId || track.video_id
  if (!type || !id) return null

  if (type === 'youtube') {
    return `https://www.youtube.com/embed/${id}?enablejsapi=1&autoplay=1&rel=0`
  }
  if (type === 'vimeo') {
    return `https://player.vimeo.com/video/${id}?api=1&autoplay=1`
  }
  return null
}
