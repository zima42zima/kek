/** P.S. / Letters / Folds marks. */

import foldsMark from '../../assets/icons/folds-mark.png'

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

function MarkIcon({ src, className = '', title, style, ...props }) {
  return (
    <span
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{
        display: 'block',
        backgroundColor: 'currentColor',
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        ...style,
      }}
      {...props}
    />
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

/** Folds section — provided FOLDS artwork. */
export function FoldsMarkIcon({ className = '', title, ...props }) {
  return (
    <MarkIcon
      src={foldsMark}
      title={title}
      className={`letter-choice__icon letter-choice__icon--folds ${className}`.trim()}
      {...props}
    />
  )
}
