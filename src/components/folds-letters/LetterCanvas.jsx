import { useCallback, useEffect, useRef } from 'react'
import {
  createLetterBlock,
  letterBlockStyle,
  newLetterBlockId,
} from '../../lib/owlLetterFormat'
import { pendingStyleToBlockSeed } from '../../lib/letterStudio'
import PsLetterStamp from './PsLetterStamp'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export default function LetterCanvas({
  letter,
  onChange,
  readOnly = false,
  selectedId,
  onSelect,
  mode = 'letter',
  typeAnywhere = false,
  pendingStyle,
  letterFont = 'classic',
}) {
  const surfaceRef = useRef(null)
  const dragRef = useRef(null)
  const inputRefs = useRef(new Map())

  const blocks = letter.blocks || []

  const updateBlocks = useCallback((next) => {
    onChange?.({ ...letter, blocks: next })
  }, [letter, onChange])

  const updateBlock = useCallback((id, patch) => {
    updateBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [blocks, updateBlocks])

  useEffect(() => {
    if (!selectedId) return
    const el = inputRefs.current.get(selectedId)
    if (el) {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [selectedId])

  function addBlockAt(clientX, clientY, seed = {}) {
    const el = surfaceRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 2, 85)
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 2, 90)
    const styleSeed = pendingStyle
      ? pendingStyleToBlockSeed(
        { ...pendingStyle, font: pendingStyle.font || letterFont },
        { writeFrom: letter.writeFrom || 'left', font: letter.font || letterFont, y, x },
      )
      : {}
    const block = createLetterBlock({
      font: letter.font || letterFont,
      text: '',
      ...styleSeed,
      ...seed,
    })
    updateBlocks([...blocks, block])
    onSelect?.(block.id)
  }

  function pruneEmptyBlocks(list) {
    return list.filter((b) => String(b.text || '').trim())
  }

  function handleSurfaceClick(e) {
    if (readOnly) return
    if (e.target.closest('[data-letter-block]')) return
    if (typeAnywhere) {
      addBlockAt(e.clientX, e.clientY)
      return
    }
    onSelect?.(null)
    const pruned = pruneEmptyBlocks(blocks)
    if (pruned.length !== blocks.length) updateBlocks(pruned)
  }

  function handlePointerDown(e, block) {
    if (readOnly) return
    if (!e.target.closest('[data-block-drag]')) return
    e.preventDefault()
    onSelect?.(block.id)
    const el = surfaceRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      id: block.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.x,
      origY: block.y,
      rect,
    }

    function onMove(ev) {
      const d = dragRef.current
      if (!d) return
      const dx = ((ev.clientX - d.startX) / d.rect.width) * 100
      const dy = ((ev.clientY - d.startY) / d.rect.height) * 100
      updateBlock(d.id, {
        x: clamp(d.origX + dx, 0, 92),
        y: clamp(d.origY + dy, 0, 94),
      })
    }

    function onUp() {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={surfaceRef}
      className={`letter-canvas ${mode === 'fold' ? 'letter-canvas--fold' : ''}`}
      onClick={handleSurfaceClick}
      role="presentation"
    >
      {letter.showStamp !== false && <PsLetterStamp />}

      {letter.image ? (
        <img src={letter.image} alt="" className="letter-canvas__image" draggable={false} />
      ) : null}

      {blocks.map((block) => {
        const active = selectedId === block.id
        const isDate = block.kind === 'date'
        return (
          <div
            key={block.id}
            data-letter-block
            className={`letter-canvas__block ${active ? 'letter-canvas__block--active' : ''} ${isDate ? 'letter-canvas__block--date' : ''}`}
            style={letterBlockStyle(block)}
            onPointerDown={(e) => handlePointerDown(e, block)}
            onClick={(e) => {
              e.stopPropagation()
              if (!isDate) onSelect?.(block.id)
            }}
          >
            {!readOnly && !isDate && (
              <span data-block-drag className="letter-canvas__grip" aria-hidden>
                <svg viewBox="0 0 10 6" className="w-2.5 h-1.5 opacity-30" fill="currentColor" aria-hidden>
                  <circle cx="1.5" cy="1" r="0.75" />
                  <circle cx="5" cy="1" r="0.75" />
                  <circle cx="8.5" cy="1" r="0.75" />
                  <circle cx="1.5" cy="5" r="0.75" />
                  <circle cx="5" cy="5" r="0.75" />
                  <circle cx="8.5" cy="5" r="0.75" />
                </svg>
              </span>
            )}
            {readOnly || isDate ? (
              <div className="letter-canvas__text whitespace-pre-wrap">{block.text}</div>
            ) : (
              <textarea
                ref={(node) => {
                  if (node) inputRefs.current.set(block.id, node)
                  else inputRefs.current.delete(block.id)
                }}
                className="letter-canvas__text"
                value={block.text}
                rows={1}
                placeholder={active ? 'type…' : ''}
                onFocus={() => onSelect?.(block.id)}
                onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                onBlur={() => {
                  if (!String(block.text || '').trim() && !typeAnywhere) {
                    updateBlocks(pruneEmptyBlocks(blocks))
                    if (selectedId === block.id) onSelect?.(null)
                  }
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
              />
            )}
          </div>
        )
      })}

      {!readOnly && blocks.length === 0 && typeAnywhere && (
        <p className="letter-canvas__hint">Tap to write</p>
      )}
    </div>
  )
}

export function duplicateBlock(block) {
  return { ...block, id: newLetterBlockId(), x: clamp(block.x + 3, 0, 90), y: clamp(block.y + 3, 0, 90) }
}
