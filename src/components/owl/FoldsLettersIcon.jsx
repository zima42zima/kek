import { LettersEnvelopeSvg } from '../folds-letters/PsMarks'

/** P.S. header envelope mark. */
export default function FoldsLettersIcon({ className = 'w-5 h-5' }) {
  return (
    <LettersEnvelopeSvg
      aria-hidden
      className={`inline-block shrink-0 ps-envelope-icon ${className}`.trim()}
    />
  )
}
