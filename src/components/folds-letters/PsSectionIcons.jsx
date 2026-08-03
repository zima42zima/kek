import { LettersMarkIcon, FoldsMarkIcon } from './PsMarks'

/** Fold / zine mark — same size classes as other profile hub icons. */
export function FoldsSectionIcon({ className = 'w-[1.06rem] h-[1.06rem]', ...props }) {
  return <FoldsMarkIcon title="Folds" className={className} {...props} />
}

/** Sealed letter — envelope from provided P.S. artwork. */
export function LettersSectionIcon(props) {
  return <LettersMarkIcon title="Letters" {...props} />
}
