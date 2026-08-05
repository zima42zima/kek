import psHubMask from '../../assets/icons/ps-hub-mark-mask.png'
import psHubSeal from '../../assets/icons/ps-hub-mark-seal.png'
import { maskImageStyle } from '../../lib/maskIcon'

/** P.S. profile hub — user's outline envelope + red seal artwork. */
export default function PsHubIcon({ className = 'w-[1.06rem] h-[0.66rem]' }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 align-middle ${className}`}
    >
      <span
        className="frens-mask-icon absolute inset-0"
        style={maskImageStyle(psHubMask)}
      />
      <img
        src={psHubSeal}
        alt=""
        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
        draggable={false}
      />
    </span>
  )
}
