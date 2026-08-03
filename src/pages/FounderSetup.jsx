import { useEffect, useState } from 'react'
import FrogLogo from '../components/FrogLogo'
import ThemeControls from '../components/ThemeControls'
import {
  isFrenHandleAvailable,
  normalizeDisplayName,
  normalizeFrenHandle,
  validateDisplayNameFormat,
  validateFrenHandleFormat,
} from '../lib/frenName'

const ADJECTIVES = ['silly', 'cozy', 'sleepy', 'croaky', 'wiggly', 'mossy', 'giggly', 'chill', 'goofy', 'snacky']
const NOUNS = ['frog', 'fren', 'tadpole', 'lily', 'hopper', 'ribbit', 'pepe', 'toad']

async function generateAvailableHandle() {
  for (let i = 0; i < 12; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    const num = Math.floor(Math.random() * 900) + 100
    const candidate = `${adj}_${noun}${num}`
    const check = await isFrenHandleAvailable(candidate)
    if (check.ok) return candidate
  }
  return `fren_${Date.now().toString().slice(-6)}`
}

const FounderSetup = ({ onComplete, inviterName, onBack }) => {
  const [frenHandle, setFrenHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [oneHumanThing, setOneHumanThing] = useState('')
  const [handleError, setHandleError] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const h = normalizeFrenHandle(frenHandle)
    if (!h) {
      setHandleError('')
      setAvailable(null)
      return
    }

    const formatErr = validateFrenHandleFormat(h)
    if (formatErr) {
      setHandleError(formatErr)
      setAvailable(false)
      return
    }

    setChecking(true)
    const t = setTimeout(() => {
      isFrenHandleAvailable(h)
        .then((res) => {
          setAvailable(res.ok)
          setHandleError(res.ok ? '' : res.reason)
        })
        .catch((err) => {
          setAvailable(null)
          setHandleError(err.message)
        })
        .finally(() => setChecking(false))
    }, 350)

    return () => clearTimeout(t)
  }, [frenHandle])

  async function handleGenerateRandom() {
    setGenerating(true)
    try {
      const handle = await generateAvailableHandle()
      setFrenHandle(handle)
    } finally {
      setGenerating(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const handle = normalizeFrenHandle(frenHandle)
    const name = normalizeDisplayName(displayName) || handle
    const displayErr = validateDisplayNameFormat(name)
    if (!handle || validateFrenHandleFormat(handle) || available === false || displayErr) return
    onComplete?.({
      frenHandle: handle,
      frenName: name,
      oneHumanThing: oneHumanThing.trim(),
    })
  }

  const handle = normalizeFrenHandle(frenHandle)
  const canSubmit = handle && !handleError && available !== false && !checking

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FrogLogo className="w-10 h-10 shrink-0" alt="" />
          <h1 className="text-3xl sm:text-4xl text-center">Claim your handle</h1>
        </div>
        {inviterName && (
          <p className="text-sm frens-muted text-center mb-6">
            <span className="frens-stat">{inviterName}</span> invited you in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="fren-handle" className="block frens-label mb-2">
              Handle <span className="frens-hint">(permanent — friends find you with this)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm frens-muted pointer-events-none">@</span>
                <input
                  id="fren-handle"
                  type="text"
                  value={frenHandle}
                  onChange={(e) => setFrenHandle(e.target.value)}
                  placeholder="lenchi"
                  autoComplete="username"
                  spellCheck={false}
                  className="frens-input w-full py-3 pl-7"
                  required
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateRandom}
                disabled={generating}
                className="frens-btn-outline shrink-0 px-4 py-3 disabled:opacity-50"
              >
                {generating ? '...' : 'random'}
              </button>
            </div>
            {checking && frenHandle.trim() && (
              <p className="text-xs frens-muted mt-1">checking availability...</p>
            )}
            {!checking && available === true && frenHandle.trim() && (
              <p className="text-xs text-[#6BC06B] mt-1">✓ available</p>
            )}
            {handleError && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{handleError}</p>
            )}
            <p className="text-xs frens-hint mt-2">
              Letters, numbers, underscores. 3–20 chars. Tied to your email — cannot change later.
            </p>
          </div>

          <div>
            <label htmlFor="display-name" className="block frens-label mb-2">
              Display name <span className="frens-hint">(change anytime)</span>
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={handle || 'Lenchi, unga bunga, …'}
              className="frens-input py-3"
            />
            <p className="text-xs frens-hint mt-2">
              What shows on your posts. Can include spaces. Defaults to your handle if left blank.
            </p>
          </div>

          <div>
            <label htmlFor="one-human-thing" className="block frens-label mb-2">
              One human thing <span className="frens-hint">(optional)</span>
            </label>
            <textarea
              id="one-human-thing"
              value={oneHumanThing}
              onChange={(e) => setOneHumanThing(e.target.value)}
              placeholder="I cried because my toast landed butter side down"
              rows={3}
              className="frens-input"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="frens-btn-primary w-full px-8 py-4 text-lg mt-4 disabled:opacity-50"
          >
            Continue
          </button>
        </form>

        {onBack && (
          <p className="text-center text-sm frens-muted mt-6">
            <button
              type="button"
              onClick={onBack}
              className="underline hover:text-black dark:hover:text-white transition"
            >
              Back to invite gate
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

export default FounderSetup
