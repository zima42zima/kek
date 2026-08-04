/** Echo Map product constants */

/** Minimum discover / pin scatter radius (safety — no exact GPS leaks). */
export const ECHO_DISCOVER_RADIUS_MIN_M = 420

/** @deprecated use per-echo discoverRadiusM; kept for legacy copy only */
export const ECHO_CLOSE_RADIUS_M = ECHO_DISCOVER_RADIUS_MIN_M

/** City-area radius — max search & max publish discover range */
export const ECHO_CITY_RADIUS_M = 2500

/** Max scatter from your GPS when placing an echo pin */
export const ECHO_PIN_OFFSET_MAX_M = ECHO_DISCOVER_RADIUS_MIN_M

/** Preset ranges for search (map) and publish (discover radius). */
export const ECHO_RANGE_PRESETS = [
  { id: 'block', label: '420m', meters: 420, hint: 'One block — use with a place name to pin cafés & landmarks' },
  { id: 'walk', label: '800m', meters: 800, hint: 'Short walk' },
  { id: 'hood', label: '1.2km', meters: 1200, hint: 'Neighborhood' },
  { id: 'city', label: 'City', meters: 2500, hint: 'Whole city area' },
]

export const ECHO_SEARCH_RADIUS_KEY = 'frens-echo-search-radius-v1'
export const ECHO_MINE_VIEW_KEY = 'frens-echo-mine-view-v1'
export const ECHO_DEFAULT_SEARCH_RADIUS_M = 2500
export const ECHO_DEFAULT_DISCOVER_RADIUS_M = 800
export const ECHO_POSITION_REFRESH_MS = 10000
export const ECHO_MOVE_THRESHOLD_M = 20

/** How far bat hints are offset from the real pin (neighborhood fuzz) */
export const ECHO_HINT_FUZZ_RADIUS_M = 400

/** Circle drawn around a bat hint — approximate area, not exact spot */
export const ECHO_HINT_ZONE_RADIUS_M = 280

/** City-wide bat hint zone — roams the whole discover area */
export const ECHO_CITY_HINT_ZONE_RADIUS_M = 1200

/** Fuzz offset for city-wide bat hints */
export const ECHO_CITY_HINT_FUZZ_RADIUS_M = 2000

export const ECHO_VIDEO_MAX_SEC = 11
export const ECHO_AUDIO_MAX_SEC = 30

export const ECHO_TYPES = [
  {
    id: 'image',
    label: 'Meme spot',
    hint: 'Image, GIF, or photo',
    featured: true,
  },
  {
    id: 'audio',
    label: 'Voice',
    hint: 'Short audio, optional cover',
    maxSec: ECHO_AUDIO_MAX_SEC,
  },
  {
    id: 'video',
    label: 'Short video',
    hint: `Up to ${ECHO_VIDEO_MAX_SEC}s, glitchy`,
    maxSec: ECHO_VIDEO_MAX_SEC,
  },
]

export function echoKindLabel(kind, { short = false } = {}) {
  if (kind === 'video') return short ? 'short video' : 'video'
  if (kind === 'image') return short ? 'meme' : 'meme spot'
  return short ? 'audio' : 'voice'
}

export const ECHO_VISIBILITY = [
  {
    id: 'world',
    label: 'World',
    hint: 'Nearby + map',
  },
  {
    id: 'friends',
    label: 'Frens',
    hint: 'Follows only',
  },
  {
    id: 'private',
    label: 'Memory',
    hint: 'Just you',
  },
]

/** Visibility modes that appear on the world map for other frens */
export const ECHO_PUBLIC_VISIBILITIES = new Set(['world', 'friends'])

/** Playback / preview filters — minimal, fun, no face required */
export const ECHO_VOICE_FILTERS = [
  { id: 'normal', label: 'Your voice', rate: 1 },
  { id: 'deep', label: 'Deep', rate: 0.82 },
  { id: 'bright', label: 'Bright', rate: 1.18 },
  { id: 'whisper', label: 'Soft', rate: 0.95 },
]

export const ECHO_LOOK_FILTERS = [
  { id: 'normal', label: 'Clear', css: 'none' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.15)' },
  { id: 'cool', label: 'Cool', css: 'saturate(0.9) hue-rotate(12deg)' },
  { id: 'hide-face', label: 'Hide me', css: 'blur(0px)' }, // vignette overlay in component
]

/** Glitch / retro FX for video echoes — any device, live canvas preview. */
export const ECHO_GLITCH_FILTERS = [
  { id: 'clear', label: 'Clear', hint: 'Raw moment — no FX' },
  { id: 'ascii', label: 'ASCII', hint: 'Terminal character mosaic' },
  { id: 'dither', label: 'Dither', hint: 'Game Boy print dots' },
  { id: 'chromatic', label: 'Split', hint: 'RGB channel drift — VHS' },
  { id: 'scanline', label: 'CRT', hint: 'Phosphor scanlines' },
  { id: 'thermal', label: 'Heat', hint: 'False-color infrared map' },
  { id: 'wave', label: 'Wave', hint: 'Slice displacement ripples' },
  { id: 'nodes', label: 'Nodes', hint: 'Edge mesh wireframe' },
  { id: 'gradient', label: 'Gradient', hint: 'Synthwave duotone remap' },
  { id: 'pixel', label: '8-bit', hint: 'Chunky pixel blocks' },
  { id: 'outline', label: 'Outline', hint: 'Contour line art' },
]

/** @deprecated use ECHO_GLITCH_FILTERS */
export const ECHO_SENSE_FILTERS = ECHO_GLITCH_FILTERS

export const ECHO_INTRO_KEY = 'frens-echo-intro-v1'
export const ECHO_SAFETY_KEY = 'frens-echo-safety-v1'


export const DURATIONS = [
  { id: 'minutes', label: 'Minutes', ms: 30 * 60 * 1000 },
  { id: 'hours', label: 'Hours', ms: 12 * 60 * 60 * 1000 },
  { id: 'days', label: 'Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'forever', label: 'Forever', ms: null },
]
