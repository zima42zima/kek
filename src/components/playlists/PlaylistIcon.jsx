import playlistIcon from '../../assets/icons/playlist.svg'

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
        maskImage: `url(${playlistIcon})`,
        WebkitMaskImage: `url(${playlistIcon})`,
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
