/** Repeating · − morse rhythm — horizontal post divider (no side borders). */
const MORSE_TILE = [
  'dot', 'dash', 'dot', 'dot', 'letter',
  'dot', 'dash', 'dot', 'letter',
  'dot', 'letter',
  'dash', 'dot', 'letter',
  'word',
]

export default function PostMorseRule({ className = '' }) {
  const units = Array.from({ length: 18 }, (_, i) => MORSE_TILE[i % MORSE_TILE.length])

  return (
    <div className={`frens-post-morse ${className}`.trim()} role="presentation" aria-hidden>
      <div className="frens-post-morse__track">
        {units.map((unit, i) => (
          <span key={i} className={`frens-post-morse__${unit}`} />
        ))}
      </div>
    </div>
  )
}
