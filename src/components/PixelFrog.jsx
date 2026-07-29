/**
 * Friendly black & white pixel frog — the MISAO mascot.
 * Rendered as a scalable SVG grid so it stays crisp at any size.
 */
const PIXEL_SIZE = 5

const PALETTE = {
  '.': null,
  W: '#F5EFE3', // bone-100 — body
  G: '#D8CEB8', // bone-300 — belly / shadow
  B: '#14130F', // cave-950 — eyes, mouth, outline
}

// 22×14 grid — friendly frog, slight smile, looking forward
const GRID = [
  '......................',
  '....WWWW....WWWW......',
  '...WWWWWWWWWWWWWWW....',
  '..WWBBWWWWWWWWBBWW....',
  '.WWWWWWWWWWWWWWWWWW...',
  '.WWWW.BB....BB.WWWW...',
  '.WWWWWWGGGGGGWWWWW....',
  'WWWWWWWWWWWWWWWWWWWW..',
  'WW..WWWWWWWWWWWW..WW..',
  'WW..WWWWWWWWWWWW..WW..',
  '...WWWWWWWWWWWWWW.....',
  '......................',
]

export default function PixelFrog({ className = 'w-36 h-36 sm:w-44 sm:h-44' }) {
  const cols = GRID[0].length
  const rows = GRID.length
  const width = cols * PIXEL_SIZE
  const height = rows * PIXEL_SIZE

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="pixel frog mascot"
    >
      {GRID.map((row, y) =>
        row.split('').map((cell, x) => {
          const fill = PALETTE[cell]
          if (!fill) return null
          return (
            <rect
              key={`${x}-${y}`}
              x={x * PIXEL_SIZE}
              y={y * PIXEL_SIZE}
              width={PIXEL_SIZE}
              height={PIXEL_SIZE}
              fill={fill}
            />
          )
        })
      )}
    </svg>
  )
}
