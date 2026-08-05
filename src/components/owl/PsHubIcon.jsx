import psHubQuotes from '../../assets/icons/ps-hub-quotes.png'

/** P.S. profile hub — yellow quote mark (user-provided test). */
export default function PsHubIcon({ className = 'w-[1.06rem] h-[1.06rem]' }) {
  return (
    <img
      src={psHubQuotes}
      alt=""
      aria-hidden
      draggable={false}
      className={`inline-block shrink-0 align-middle object-contain ${className}`}
    />
  )
}
