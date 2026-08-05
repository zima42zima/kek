import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { playlistPlayerSrc } from '../lib/playlistEmbed'
import { PauseIcon, PlayIcon } from '../components/icons/UiIcons'

const PlaylistPlaybackContext = createContext(null)

export function usePlaylistPlayback() {
  return useContext(PlaylistPlaybackContext)
}

export function PlaylistPlaybackProvider({ children }) {
  const [tracks, setTracks] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [meta, setMeta] = useState(null)
  const [inlinePreferred, setInlinePreferred] = useState(false)

  const currentTrack = activeIndex >= 0 ? tracks[activeIndex] : null
  const playerSrc = useMemo(
    () => (!inlinePreferred ? playlistPlayerSrc(currentTrack, isPlaying) : null),
    [inlinePreferred, currentTrack, isPlaying],
  )

  const trackEnded = useCallback(() => {
    setActiveIndex((idx) => {
      const next = idx + 1
      if (next < tracks.length) return next
      setIsPlaying(false)
      return idx
    })
  }, [tracks.length])

  useEffect(() => {
    if (!isPlaying || !playerSrc) return undefined

    function onMessage(event) {
      const origins = ['https://www.youtube.com', 'https://player.vimeo.com']
      if (!origins.includes(event.origin)) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (event.origin.includes('youtube')) {
          const ended = data?.info === 0
            || (data?.event === 'onStateChange' && data?.info === 0)
            || (data?.event === 'infoDelivery' && data?.info?.playerState === 0)
          if (ended) trackEnded()
        }
        if (event.origin.includes('vimeo') && data?.event === 'finish') trackEnded()
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isPlaying, playerSrc, trackEnded])

  const setQueue = useCallback((nextTracks, nextMeta, startIndex = 0) => {
    setTracks(nextTracks)
    setMeta(nextMeta)
    setActiveIndex(nextTracks.length > 0 ? Math.min(startIndex, nextTracks.length - 1) : -1)
  }, [])

  const play = useCallback((index) => {
    if (typeof index === 'number') {
      setActiveIndex(index)
    } else {
      setActiveIndex((i) => (i < 0 ? 0 : i))
    }
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => setIsPlaying(false), [])

  const toggle = useCallback(() => {
    setIsPlaying((p) => {
      if (!p && tracks.length > 0) {
        setActiveIndex((i) => (i < 0 ? 0 : i))
        return true
      }
      return !p
    })
  }, [tracks.length])

  const stop = useCallback(() => {
    setIsPlaying(false)
    setTracks([])
    setActiveIndex(-1)
    setMeta(null)
  }, [])

  const setInlinePreferredStable = useCallback((value) => {
    setInlinePreferred(Boolean(value))
  }, [])

  const value = useMemo(() => ({
    tracks,
    activeIndex,
    isPlaying,
    meta,
    inlinePreferred,
    currentTrack,
    isActivePlaylist: (playlistId) => meta?.playlistId === playlistId,
    setQueue,
    setInlinePreferred: setInlinePreferredStable,
    play,
    pause,
    toggle,
    stop,
    playTrack: play,
    trackEnded,
  }), [
    tracks,
    activeIndex,
    isPlaying,
    meta,
    inlinePreferred,
    currentTrack,
    setQueue,
    setInlinePreferredStable,
    play,
    pause,
    toggle,
    stop,
    trackEnded,
  ])

  return (
    <PlaylistPlaybackContext.Provider value={value}>
      {children}
      {playerSrc ? (
        <iframe
          key={playerSrc}
          src={playerSrc}
          title="Playlist playback"
          className="fixed w-px h-px opacity-0 pointer-events-none"
          style={{ left: -9999, top: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          aria-hidden
        />
      ) : null}
    </PlaylistPlaybackContext.Provider>
  )
}

/** Global play/pause — visible whenever a playlist queue is active, on any tab. */
export function GlobalPlaylistPauseButton({ className = '' }) {
  const playback = usePlaylistPlayback()
  const { isPlaying, toggle, currentTrack, meta, tracks } = playback || {}

  const hasQueue = Boolean(tracks?.length > 0 && meta?.playlistId)
  if (!hasQueue) return null

  const label = currentTrack?.title?.trim()
    || meta?.playlistName
    || 'Music'

  const ownerHint = meta?.ownerName && meta.ownerName !== 'You'
    ? ` · ${meta.ownerName}`
    : ''

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative w-9 h-9 rounded-full flex items-center justify-center text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 shrink-0 ${
        isPlaying ? 'ring-2 ring-[#6BC06B]/60 dark:ring-[#e0703a]/60' : ''
      } ${className}`}
      aria-label={isPlaying ? `Pause ${label}` : `Resume ${label}`}
      title={`${isPlaying ? 'Pause' : 'Play'}: ${label}${ownerHint}`}
    >
      {isPlaying ? (
        <PauseIcon className="w-5 h-5" />
      ) : (
        <PlayIcon className="w-5 h-5" />
      )}
    </button>
  )
}
