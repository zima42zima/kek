import { useEffect, useState } from 'react'
import Modal from '../Modal'
import LetterStudioComposer from './LetterStudioComposer'
import { owlLetterHasContent, serializeOwlLetterBody } from '../../lib/owlLetterFormat'

const FOLDS_KEY = 'misao-folds-drafts'

function loadDrafts() {
  try {
    const raw = localStorage.getItem(FOLDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveDrafts(list) {
  try {
    localStorage.setItem(FOLDS_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

export default function FoldsPanel({ onBack, onExit }) {
  const [drafts, setDrafts] = useState([])
  const [composing, setComposing] = useState(false)
  const [letter, setLetter] = useState(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    setDrafts(loadDrafts())
  }, [])

  function handleSave() {
    if (!letter || !owlLetterHasContent(letter)) return
    const entry = {
      id: `f-${Date.now()}`,
      title: title.trim() || 'Untitled fold',
      body: serializeOwlLetterBody(letter),
      updatedAt: new Date().toISOString(),
    }
    const next = [entry, ...drafts]
    setDrafts(next)
    saveDrafts(next)
    setComposing(false)
    setLetter(null)
    setTitle('')
  }

  return (
    <Modal
      title={(
        <span className="inline-flex items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} className="text-xs frens-muted hover:underline mr-1">
              ←
            </button>
          )}
          FOLDS
        </span>
      )}
      onClose={onExit}
      maxWidth={composing ? 'max-w-5xl' : 'max-w-lg'}
    >
      {composing ? (
        <div className="space-y-4 letter-studio-ui">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fold title"
            className="letter-field py-2 normal-case tracking-normal"
          />
          <LetterStudioComposer
            mode="fold"
            titleWord="FOLD"
            showPrint
            onLetterChange={setLetter}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setComposing(false)} className="flex-1 letter-btn-outline py-3">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!letter || !owlLetterHasContent(letter)}
              className="flex-[2] letter-btn-primary py-3 disabled:opacity-50"
            >
              Save draft
            </button>
          </div>
          <p className="text-[10px] frens-muted text-center">
            Publishing folds to your profile is coming soon — drafts stay on this device for now.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs frens-muted -mt-2 mb-4">
            Typographic pages for your profile — zines, notes, visual thoughts.
          </p>
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="w-full letter-btn-primary py-3 mb-4 tracking-[0.15em]"
          >
            New fold
          </button>
          {drafts.length === 0 ? (
            <p className="text-sm frens-muted text-center py-8">No folds yet.</p>
          ) : (
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {drafts.map((d) => (
                <li key={d.id} className="border frens-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs frens-muted">{new Date(d.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = drafts.filter((x) => x.id !== d.id)
                      setDrafts(next)
                      saveDrafts(next)
                    }}
                    className="text-xs frens-muted hover:underline shrink-0"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}
