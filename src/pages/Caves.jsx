import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCaves } from '../context/CavesContext'
import CavesList from '../components/caves/CavesList'
import CreateCaveModal from '../components/caves/CreateCaveModal'
import CaveDetail from '../components/caves/CaveDetail'

export default function Caves({ caveId: urlCaveId = null, onCaveChange }) {
  const { profile } = useAuth()
  const {
    caves,
    myCaves,
    meId,
    createCave,
    updateCave,
    sendCaveMessage,
    pendingOpenId,
    clearPendingOpen,
    findCaveById,
    ensureCaveLoaded,
    rememberCaveCover,
  } = useCaves()
  const [selectedId, setSelectedId] = useState(urlCaveId)
  const [showCreate, setShowCreate] = useState(false)
  const [loadingCave, setLoadingCave] = useState(false)
  const heldCaveRef = useRef(null)

  useEffect(() => {
    setSelectedId(urlCaveId || null)
  }, [urlCaveId])

  function selectCave(id, preview) {
    if (preview?.coverUrl) rememberCaveCover(id, preview.coverUrl)
    setSelectedId(id)
    onCaveChange?.(id || null)
    if (!id) heldCaveRef.current = null
  }

  // Open a cave requested from elsewhere (e.g. a notification or profile chip).
  useEffect(() => {
    if (pendingOpenId) {
      selectCave(pendingOpenId)
      clearPendingOpen()
    }
  }, [pendingOpenId, clearPendingOpen])

  const selectedCave =
    findCaveById(selectedId)
    ?? caves.find((c) => String(c.id) === String(selectedId))
    ?? myCaves.find((c) => String(c.id) === String(selectedId))
    ?? null

  if (selectedCave) heldCaveRef.current = selectedCave

  const displayCave =
    selectedCave
    ?? (selectedId && String(heldCaveRef.current?.id) === String(selectedId) ? heldCaveRef.current : null)

  useEffect(() => {
    if (!selectedId) {
      setLoadingCave(false)
      return undefined
    }
    let cancelled = false
    setLoadingCave(true)
    ;(async () => {
      try {
        // Always pull server cave on open so join seeds / stale local state cannot stick.
        await ensureCaveLoaded(selectedId, { requireHydrated: true })
      } finally {
        if (!cancelled) setLoadingCave(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedId, ensureCaveLoaded])

  function handleCreate(name, options = {}) {
    const id = createCave(name, options)
    setShowCreate(false)
    selectCave(id)
  }

  if (selectedId && !displayCave && loadingCave) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm frens-muted">Opening cave…</p>
      </div>
    )
  }

  if (selectedId && !displayCave) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm frens-muted">This cave is not available yet.</p>
        <p className="text-xs frens-hint">If you were just invited, wait a moment and try again.</p>
        <button
          type="button"
          onClick={() => selectCave(null)}
          className="frens-btn-outline px-4 py-2 text-sm"
        >
          Back to caves
        </button>
      </div>
    )
  }

  if (displayCave) {
    const caveId = displayCave.id
    return (
      <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
        <CaveDetail
          cave={displayCave}
          currentUserId={meId}
          currentUserProfile={profile}
          onUpdateCave={(updater) => updateCave(caveId, updater)}
          onSendMessage={(fields, author) => sendCaveMessage(caveId, fields, author)}
          onBack={() => selectCave(null)}
          onDeleted={() => {
            heldCaveRef.current = null
            selectCave(null)
          }}
        />
      </div>
    )
  }

  return (
    <>
      <CavesList
        caves={myCaves}
        currentUserId={meId}
        onOpenCave={selectCave}
        onCreateClick={() => setShowCreate(true)}
        onJoinedPublic={async (id) => {
          await ensureCaveLoaded(id, { requireHydrated: true })
          selectCave(id)
        }}
      />
      {showCreate && (
        <CreateCaveModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </>
  )
}
