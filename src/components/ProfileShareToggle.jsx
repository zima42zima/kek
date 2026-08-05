import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  loadShowcasePrefs,
  saveShowcasePrefs,
  isShowcaseOn,
} from '../lib/profileShowcase'

/**
 * Opt-in: show this hub on your public profile for other frens.
 * You always keep private access via your own profile icons.
 */
export default function ProfileShareToggle({
  showcaseKey,
  label = 'Show on my profile',
  hint = 'When on, other frens see this when they open your profile. Off by default.',
  className = '',
  onChange,
}) {
  const { user } = useAuth()
  const userId = user?.id
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    loadShowcasePrefs(userId).then((prefs) => {
      if (!cancelled) setOn(isShowcaseOn(prefs, showcaseKey))
    })
    return () => { cancelled = true }
  }, [userId, showcaseKey])

  if (!userId || !showcaseKey) return null

  async function toggle() {
    if (busy) return
    setBusy(true)
    const nextOn = !on
    setOn(nextOn)
    try {
      const prefs = await loadShowcasePrefs(userId)
      await saveShowcasePrefs(userId, { ...prefs, [showcaseKey]: nextOn })
      onChange?.(nextOn)
    } catch {
      setOn(!nextOn)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-xl border frens-border px-3 py-2.5 ${className}`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="ps-checkbox mt-0.5 shrink-0"
          checked={on}
          disabled={busy}
          onChange={toggle}
        />
        <span className="min-w-0">
          <span className="block text-sm text-black dark:text-white">{label}</span>
          {hint ? (
            <span className="block text-[11px] frens-muted mt-0.5 leading-snug">{hint}</span>
          ) : null}
        </span>
      </label>
    </div>
  )
}
