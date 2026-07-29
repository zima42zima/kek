import monadLogo from '../../assets/monad-logo.svg'

export default function PsLetterStamp({ className = '' }) {
  return (
    <img
      src={monadLogo}
      alt=""
      aria-hidden
      draggable={false}
      className={`letter-canvas__stamp ${className}`}
    />
  )
}
