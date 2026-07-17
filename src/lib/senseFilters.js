/**
 * Echo visual filters — delegates to glitch FX pipeline.
 */

import {
  applyGlitchFilter,
  glitchFilterLabel,
  isGlitchFilterActive,
  normalizeEchoFilter,
  GLITCH_FILTER_IDS,
} from './glitchFilters'

export { GLITCH_FILTER_IDS }

export function applySenseFilter(ctx, video, w, h, filterId, _facingUser = false, time = 0, _engine = null) {
  if (!ctx || !video) return
  if (!filterId || filterId === 'clear') {
    ctx.drawImage(video, 0, 0, w, h)
    return
  }
  applyGlitchFilter(ctx, video, w, h, filterId, time)
}

export function senseFilterLabel(filterId) {
  return glitchFilterLabel(filterId)
}

export function lidarFilterLabel(filterId) {
  return glitchFilterLabel(normalizeEchoFilter(filterId))
}

export function isSenseFilterActive(filterId) {
  return isGlitchFilterActive(filterId)
}

export function normalizeSenseFilter(id) {
  return normalizeEchoFilter(id)
}
