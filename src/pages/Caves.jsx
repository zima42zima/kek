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
    syncRemoteCaves,
  } = useCaves()
  const [selectedId, setSelectedId] = useState(urlCaveId)
  const [showCreate, setShowCreate] = useState(false)
  const [loadingCave, setLoadingCave] = useState(false)
  const heldCaveRef = useRef(null)

  useEffect(() => {
    setSelectedId(urlCaveId || null)
  }, [urlCaveId])

  function selectCave(id) {
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
    caves.find((c) => c.id === selectedId)
    ?? myCaves.find((c) => c.id === selectedId)
    ?? null

  if (selectedCave) heldCaveRef.current = selectedCave

  const displayCave =
    selectedCave
    ?? (selectedId && heldCaveRef.current?.id === selectedId ? heldCaveRef.current : null)

  useEffect(() => {
    if (!selectedId || displayCave) {
      setLoadingCave(false)
      return
    }
    setLoadingCave(true)
    syncRemoteCaves().finally(() => setLoadingCave(false))
  }, [selectedId, displayCave, syncRemoteCaves])

  function handleCreate(name) {
    const id = createCave(name)
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
          onClick={() => { selectCave(null); syncRemoteCaves() }}
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
      <div className="w-full">
        <CaveDetail
          cave={displayCave}
          currentUserId={meId}
          currentUserProfile={profile}
          onUpdateCave={(updater) => updateCave(caveId, updater)}
          onSendMessage={(fields, author) => sendCaveMessage(caveId, fields, author)}
          onBack={() => selectCave(null)}
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
      />
      {showCreate && (
        <CreateCaveModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </>
  )
}
