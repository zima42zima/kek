import playlistIcon from '../../assets/icons/playlist.svg'
import { maskImageStyle } from '../../lib/maskIcon'

/**
 * Playlist / music note mark — monochrome via CSS mask (theme-colored).
 */
export default function PlaylistIcon({ className = 'w-5 h-5' }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 align-middle ${className}`}
      style={{
        backgroundColor: 'currentColor',
        ...maskImageStyle(playlistIcon),
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
