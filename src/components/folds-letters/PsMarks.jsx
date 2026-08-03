/** P.S. / Letters / Folds marks. */

export function LettersEnvelopeSvg({ className = '', title, style, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 44"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={style}
      {...props}
    >
      <rect x="3" y="9" width="58" height="32" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 9 L32 27 L61 9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Folds mark — folds4.svg (document + fold corner + plus).
 * Sized by className like other hub icons (e.g. w-[1.06rem] h-[1.06rem]).
 */
export function FoldsMarkSvg({ className = 'w-5 h-5', title, style, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 575 804"
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`block shrink-0 ${className}`.trim()}
      style={style}
      {...props}
    >
      <path d="M110.259 110.222V14.4219L14.4258 110.222H110.259Z" />
      <path d="M0 772.583C0 790.095 13.3961 803.487 30.914 803.487H544.086C561.604 803.487 575 790.095 575 772.583V30.9033C575 13.3914 561.604 0 544.086 0H130.869V120.523C130.869 126.704 126.747 130.824 120.564 130.824H0V772.583ZM129.839 391.442H277.195V244.136C277.195 237.956 281.317 233.835 287.5 233.835C293.683 233.835 297.805 237.956 297.805 244.136V391.442H445.161C451.344 391.442 455.466 395.563 455.466 401.743C455.466 407.924 451.344 412.044 445.161 412.044H297.805V559.35C297.805 565.531 293.683 569.651 287.5 569.651C281.317 569.651 277.195 565.531 277.195 559.35V412.044H129.839C123.656 412.044 119.534 407.924 119.534 401.743C119.534 395.563 124.686 391.442 129.839 391.442Z" />
    </svg>
  )
}

/** Letters section — P.S. envelope SVG. */
export function LettersMarkIcon({ className = '', title, ...props }) {
  return (
    <LettersEnvelopeSvg
      title={title}
      className={`letter-choice__icon letter-choice__icon--letters ${className}`.trim()}
      {...props}
    />
  )
}

/** Folds section — same glyph as hub chips; className sets size. */
export function FoldsMarkIcon({ className = 'w-5 h-5', title, ...props }) {
  return (
    <FoldsMarkSvg
      title={title}
      className={className}
      {...props}
    />
  )
}
