import { useState } from 'react'
import Modal from '../Modal'
import { ECHO_PUBLIC_VISIBILITIES, ECHO_VISIBILITY } from '../../lib/echoConstants'
import { EchoVisibilityIcon } from './EchoMeta'
import { EchoDiscoverRadiusPicker } from './EchoRangeSelect'
import { OPTION_ACTIVE, OPTION_IDLE } from '../icons/UiIcons'

export default function EchoEditModal({ echo, onSave, onDelete, onClose }) {
  const [label, setLabel] = useState(echo.label || '')
  const [visibility, setVisibility] = useState(echo.visibility || 'world')
  const [discoverRadiusM, setDiscoverRadiusM] = useState(echo.discoverRadiusM ?? 800)
  const [allowComments, setAllowComments] = useState(Boolean(echo.allowComments))
  const [browseGlobally, setBrowseGlobally] = useState(Boolean(echo.browseGlobally))

  const showRange = ECHO_PUBLIC_VISIBILITIES.has(visibility)

  function handleSave() {
    onSave?.({
      label: label.trim(),
      visibility,
      discoverRadiusM: showRange ? discoverRadiusM : null,
      shareOnProfile: ECHO_PUBLIC_VISIBILITIES.has(visibility),
      allowComments,
      browseGlobally: showRange && visibility === 'world' ? browseGlobally : false,
    })
    onClose?.()
  }

  function handleDelete() {
    if (!window.confirm('Delete this aftersound? This cannot be undone.')) return
    onDelete?.(echo.id)
    onClose?.()
  }

  return (
    <Modal title="Edit aftersound" onClose={onClose} maxWidth="max-w-md">
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

        <div className="space-y-2">
          <p className="text-xs frens-muted">Audience</p>
          <div className="grid gap-2">
            {ECHO_VISIBILITY.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisibility(v.id)}
                className={`text-left rounded-xl border p-3 transition ${
                  visibility === v.id ? OPTION_ACTIVE : OPTION_IDLE
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <EchoVisibilityIcon visibility={v.id} className="w-4 h-4 shrink-0" />
                  <span className="font-medium text-sm">{v.label}</span>
                </span>
                <p className="text-[11px] frens-muted mt-1 ml-6">{v.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {showRange ? (
          <>
            <EchoDiscoverRadiusPicker value={discoverRadiusM} onChange={setDiscoverRadiusM} />
            {visibility === 'world' ? (
              <label className="flex items-start gap-2 text-xs frens-muted cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={browseGlobally}
                  onChange={(e) => setBrowseGlobally(e.target.checked)}
                  className="rounded mt-0.5"
                />
                <span>
                  Browsable from anywhere — frens can open this aftersound from the world map even when far away
                </span>
              </label>
            ) : null}
          </>
        ) : null}

        <label className="flex items-center gap-2 text-xs frens-muted px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
            className="rounded"
          />
          Allow comments after someone finds it
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
          className="w-full py-2.5 text-sm text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition"
        >
          Delete aftersound
        </button>
      </div>
    </Modal>
  )
}
