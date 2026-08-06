import psHubMark from '../../assets/icons/ps-hub-mark.png'
import { maskImageStyle } from '../../lib/maskIcon'

/**
 * P.S. profile hub mark — solid letter silhouette, theme-colored via CSS mask.
 * Sized to sit with other profile hub chips (caves, tools).
 */
export default function PsHubIcon({ className = 'w-[1.05rem] h-[1.05rem]' }) {
  return (
    <span
      aria-hidden
      className={`frens-mask-icon inline-block align-middle shrink-0 ${className}`}
      style={{
        ...maskImageStyle(psHubMark),
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
