import { useState } from 'react'
import Modal from '../Modal'
import FoldsLettersIcon from '../owl/FoldsLettersIcon'
import { FoldsSectionIcon, LettersSectionIcon } from './PsSectionIcons'
import LettersPanel from './LettersPanel'
import FoldsPanel from './FoldsPanel'

function ChoiceCard({ title, hint, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="letter-choice group"
    >
      <span className="letter-choice__head">
        <span className="letter-choice__icon-wrap" aria-hidden={!Icon}>
          {Icon ? <Icon /> : null}
        </span>
        <span className="letter-choice__copy">
          <span className="letter-choice__title">{title}</span>
          <span className="letter-choice__hint">{hint}</span>
        </span>
      </span>
    </button>
  )
}

export default function PsHubModal({ onClose, onSettingsChange, initialSection = null }) {
  const [section, setSection] = useState(initialSection)

  if (section === 'letters') {
    return (
      <LettersPanel
        onClose={() => setSection(null)}
        onBack={() => setSection(null)}
        onSettingsChange={onSettingsChange}
        onExit={onClose}
      />
    )
  }

  if (section === 'folds') {
    return (
      <FoldsPanel
        onClose={() => setSection(null)}
        onBack={() => setSection(null)}
        onExit={onClose}
      />
    )
  }

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2"><FoldsLettersIcon className="w-5 h-5" /> P.S.</span>}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <p className="text-xs frens-muted -mt-2 mb-5">
        Two pockets — sealed letters to frens, or folds you share on your profile.
      </p>
      <div className="grid gap-3">
        <ChoiceCard
          title="LETTERS"
          icon={LettersSectionIcon}
          hint="Sealed mail to a fren — read only when printed."
          onClick={() => setSection('letters')}
        />
        <ChoiceCard
          title="FOLDS"
          icon={FoldsSectionIcon}
          hint="Typographic zines — layout pages and share on your profile."
          onClick={() => setSection('folds')}
        />
      </div>
    </Modal>
  )
}
