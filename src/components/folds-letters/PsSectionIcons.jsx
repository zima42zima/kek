import { LettersMarkIcon, FoldsMarkIcon } from './PsMarks'

/** Fold / zine mark from provided artwork. */
export function FoldsSectionIcon(props) {
  return <FoldsMarkIcon title="Folds" {...props} />
}

/** Sealed letter — envelope from provided P.S. artwork. */
export function LettersSectionIcon(props) {
  return <LettersMarkIcon title="Letters" {...props} />
}
