import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CAVE_ROLES,
  MAX_CAVE_ROLES,
  normalizeCaveRoles,
  newRoleId,
  roleMark,
} from '../../lib/caveRoles'
import { prepareImageAttachment, finalizeImageUrl } from '../../lib/imageAttach'
import { PlusIcon, CameraIcon } from '../icons/UiIcons'

const SUGGESTED_EMOJIS = ['🪨', '🌌', '📻', '📼', '🫀', '🕳️', '✦', '🕯️', '🪞', '🫧', '⚡', '🎭', '🌀', '📡', '🧬', '🃏']

function RoleMark({ role, className = 'w-8 h-8' }) {
  const { emoji, markUrl } = roleMark(role)
  if (markUrl) {
    return (
      <img
        src={markUrl}
        alt=""
        className={`${className} rounded-lg object-contain shrink-0 border frens-border bg-black/[0.03] dark:bg-white/[0.04]`}
      />
    )
  }
  return (
    <span
      className={`${className} rounded-lg flex items-center justify-center text-lg shrink-0 border frens-border bg-black/[0.03] dark:bg-white/[0.04]`}
      aria-hidden
    >
      {emoji}
    </span>
  )
}

/**
 * Keeper UI: edit this cave's role catalog (examples + custom, max 12).
 */
export default function CaveRolesEditor({ roles: rolesIn, onSave, onClose }) {
  const [roles, setRoles] = useState(() => normalizeCaveRoles(rolesIn))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const fileRef = useRef(null)
  const markTargetId = useRef(null)

  useEffect(() => {
    setRoles(normalizeCaveRoles(rolesIn))
  }, [rolesIn])

  const editing = editId ? roles.find((r) => r.id === editId) : null

  function updateRole(id, patch) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRole() {
    if (roles.length >= MAX_CAVE_ROLES) {
      setError(`Max ${MAX_CAVE_ROLES} roles per cave.`)
      return
    }
    setError('')
    const role = {
      id: newRoleId(),
      label: 'New role',
      emoji: '✦',
      markUrl: null,
      blurb: '',
      weeks: 2,
      canDj: false,
    }
    setRoles((prev) => [...prev, role])
    setEditId(role.id)
  }

  function removeRole(id) {
    if (id === 'dweller') {
      setError('Dweller stays — everyone needs a zero-rank home.')
      return
    }
    setRoles((prev) => prev.filter((r) => r.id !== id))
    if (editId === id) setEditId(null)
  }

  function resetDefaults() {
    setRoles(DEFAULT_CAVE_ROLES.map((r) => ({ ...r })))
    setEditId(null)
    setError('')
  }

  async function handleMarkFile(e) {
    const file = e.target.files?.[0]
    const id = markTargetId.current
    if (!file || !id) return
    setError('')
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    const isImage = file.type.startsWith('image/')
    if (!isSvg && !isImage) {
      setError('Use an emoji, or upload an image / SVG.')
      return
    }
    try {
      if (isSvg) {
        const text = await file.text()
        const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`
        updateRole(id, { markUrl: dataUrl })
      } else {
        const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 256 })
        const url = await finalizeImageUrl({ image: dataUrl, blob, prefix: 'cave-role-marks' })
        updateRole(id, { markUrl: url })
      }
    } catch (err) {
      setError(err.message || 'Could not upload mark.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
      markTargetId.current = null
    }
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    try {
      const cleaned = normalizeCaveRoles(roles)
      const result = await onSave?.(cleaned)
      if (result && result.ok === false) {
        setError(result.message || 'Could not save.')
        return
      }
      onClose?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="frens-surface border frens-border rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="frens-title-lg">Edit roles</h2>
          <button type="button" onClick={onClose} className="frens-muted text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <p className="text-xs frens-muted mb-4">
          Up to {MAX_CAVE_ROLES} roles. Examples ship with the cave — rename them, re-mark them, or invent new ones.
        </p>

        {error ? (
          <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>
        ) : null}

        <ul className="space-y-2 mb-3">
          {roles.map((role) => {
            const open = editId === role.id
            return (
              <li key={role.id} className="border frens-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEditId(open ? null : role.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition"
                >
                  <RoleMark role={role} className="w-9 h-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{role.label}</span>
                    <span className="block text-[11px] frens-muted truncate">
                      {role.blurb || (role.canDj ? 'Sets the room frequency' : 'Custom role')}
                    </span>
                  </span>
                  <span className="text-xs frens-muted shrink-0">{open ? '▾' : '›'}</span>
                </button>

                {open && editing ? (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t frens-border bg-black/[0.015] dark:bg-white/[0.02]">
                    <label className="block">
                      <span className="text-[10px] frens-muted uppercase tracking-wide">Name</span>
                      <input
                        type="text"
                        value={editing.label}
                        maxLength={40}
                        onChange={(e) => updateRole(role.id, { label: e.target.value })}
                        className="frens-input mt-1 py-2 text-sm w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] frens-muted uppercase tracking-wide">Blurb</span>
                      <input
                        type="text"
                        value={editing.blurb || ''}
                        maxLength={160}
                        onChange={(e) => updateRole(role.id, { blurb: e.target.value })}
                        placeholder="Optional lore"
                        className="frens-input mt-1 py-2 text-sm w-full"
                      />
                    </label>

                    <div>
                      <span className="text-[10px] frens-muted uppercase tracking-wide">Mark · emoji</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {SUGGESTED_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => updateRole(role.id, { emoji: em, markUrl: null })}
                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition ${
                              editing.emoji === em && !editing.markUrl
                                ? 'border-black dark:border-white bg-black/5 dark:bg-white/10'
                                : 'frens-border hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={editing.markUrl ? '' : (editing.emoji || '')}
                          onChange={(e) => updateRole(role.id, { emoji: e.target.value.slice(0, 8), markUrl: null })}
                          placeholder="or paste any emoji"
                          className="frens-input py-1.5 text-sm flex-1"
                          disabled={Boolean(editing.markUrl)}
                        />
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*,.svg,image/svg+xml"
                          className="hidden"
                          onChange={handleMarkFile}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            markTargetId.current = role.id
                            fileRef.current?.click()
                          }}
                          className="frens-btn-outline text-xs px-2.5 py-1.5 inline-flex items-center gap-1 shrink-0"
                          title="Upload emoji/SVG/image mark"
                        >
                          <CameraIcon className="w-3.5 h-3.5" /> SVG
                        </button>
                        {editing.markUrl ? (
                          <button
                            type="button"
                            onClick={() => updateRole(role.id, { markUrl: null })}
                            className="text-xs frens-muted shrink-0"
                          >
                            Clear mark
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editing.canDj)}
                          onChange={(e) => updateRole(role.id, { canDj: e.target.checked })}
                          className="rounded"
                        />
                        Can run cave playlists
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs">
                        <span className="frens-muted">Weeks</span>
                        <input
                          type="number"
                          min={0}
                          max={52}
                          value={editing.weeks ?? ''}
                          placeholder="∞"
                          onChange={(e) => {
                            const v = e.target.value
                            updateRole(role.id, { weeks: v === '' ? null : Number(v) })
                          }}
                          className="frens-input py-1 w-14 text-xs"
                          disabled={role.id === 'dweller'}
                        />
                      </label>
                    </div>

                    {role.id !== 'dweller' ? (
                      <button
                        type="button"
                        onClick={() => removeRole(role.id)}
                        className="text-xs text-red-600 dark:text-red-400"
                      >
                        Remove role
                      </button>
                    ) : (
                      <p className="text-[10px] frens-muted">Default seat — cannot remove.</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={addRole}
          disabled={roles.length >= MAX_CAVE_ROLES}
          className="w-full border border-dashed frens-border rounded-xl py-2.5 text-sm frens-muted hover:text-black dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition inline-flex items-center justify-center gap-1.5 disabled:opacity-40 mb-4"
        >
          <PlusIcon className="w-4 h-4" />
          Add role ({roles.length}/{MAX_CAVE_ROLES})
        </button>

        <div className="flex flex-wrap gap-2 justify-between">
          <button type="button" onClick={resetDefaults} className="text-xs frens-muted hover:underline">
            Reset examples
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="frens-btn-outline px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="frens-btn-primary px-4 py-2 text-sm disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save roles'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
