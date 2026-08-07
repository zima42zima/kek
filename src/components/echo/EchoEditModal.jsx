import { useState } from 'react'
import Modal from '../Modal'
import { ECHO_PUBLIC_VISIBILITIES, ECHO_VISIBILITY } from '../../lib/echoConstants'
import { EchoVisibilityIcon } from './EchoMeta'
import { EchoDiscoverRadiusPicker } from './EchoRangeSelect'
import { OPTION_ACTIVE, GlobeIcon } from '../icons/UiIcons'

const EDIT_VISIBILITY = ECHO_VISIBILITY.filter((v) => v.id !== 'private')

export default function EchoEditModal({ echo, onSave, onDelete, onClose }) {
  const isAnon = Boolean(echo.anonymous)
  const [label, setLabel] = useState(echo.label || '')
  const [visibility, setVisibility] = useState(isAnon ? 'world' : (echo.visibility || 'world'))
  const [discoverRadiusM, setDiscoverRadiusM] = useState(echo.discoverRadiusM ?? 420)
  const [allowComments, setAllowComments] = useState(Boolean(echo.allowComments))
  const [browseGlobally, setBrowseGlobally] = useState(Boolean(echo.browseGlobally))

  const showRange = ECHO_PUBLIC_VISIBILITIES.has(visibility)

  function handleSave() {
    const vis = isAnon ? 'world' : visibility
    onSave?.({
      label: label.trim(),
      visibility: vis,
      discoverRadiusM: showRange ? discoverRadiusM : null,
      shareOnProfile: isAnon ? false : ECHO_PUBLIC_VISIBILITIES.has(vis),
      allowComments,
      browseGlobally: showRange && vis === 'world' ? browseGlobally : false,
      anonymous: isAnon,
    })
    onClose?.()
  }

  function handleDelete() {
    onDelete?.(echo.id)
  }

  return (
    <Modal title="Edit echo" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs frens-muted">Label (only you see this)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. coffee shop bit, beach day…"
            className="frens-input py-2 text-sm"
          />
        </label>

        {isAnon ? (
          <p className="text-[11px] frens-muted text-center leading-snug px-1">
            Anonymous · bat for everyone · World only · can’t undo
          </p>
        ) : null}

        <div className="flex gap-1.5 justify-center">
          {EDIT_VISIBILITY.map((v) => {
            const locked = isAnon && v.id === 'friends'
            const active = visibility === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => !locked && setVisibility(v.id)}
                disabled={locked}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition touch-manipulation ${
                  active ? OPTION_ACTIVE : 'frens-border frens-muted'
                } ${locked ? 'opacity-35 cursor-not-allowed' : ''}`}
              >
                <EchoVisibilityIcon visibility={v.id} className="w-4 h-4" />
                {v.label}
              </button>
            )
          })}
        </div>

        {showRange ? (
          <>
            <EchoDiscoverRadiusPicker value={discoverRadiusM} onChange={setDiscoverRadiusM} />
            {visibility === 'world' ? (
              <label className="flex items-center justify-between gap-3 rounded-xl border frens-border px-3 py-2.5 cursor-pointer">
                <span className="text-sm inline-flex items-center gap-1.5">
                  <GlobeIcon className="w-4 h-4" /> Browse anywhere
                </span>
                <input
                  type="checkbox"
                  checked={browseGlobally}
                  onChange={(e) => setBrowseGlobally(e.target.checked)}
                  className="rounded"
                />
              </label>
            ) : null}
          </>
        ) : null}

        <label className="flex items-center justify-between gap-3 text-sm px-1 cursor-pointer">
          <span>Comments</span>
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
            className="rounded"
            aria-label="Comments on or off"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="frens-btn-outline flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="frens-btn-primary flex-1 py-2.5 text-sm">
            Save
          </button>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="frens-btn-outline w-full py-2.5 text-sm"
        >
          Delete echo
        </button>
      </div>
    </Modal>
  )
}
