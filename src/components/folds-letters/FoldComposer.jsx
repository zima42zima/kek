import { useRef, useState } from 'react'
import {
  ZINE_PANELS,
  ZINE_PRINT_GRID,
  FOLD_STORY_MAX_PAGES,
  FOLD_PRINT_MARGIN_MM,
  foldFormatById,
  foldHasContent,
  countFilled,
  foldPrintMarginInset,
  DEFAULT_IMAGE_TRANSFORM,
  normalizeImageTransform,
} from '../../lib/foldFormats'
import { sanitizeImage } from '../../lib/media'
import FoldImageFill from './FoldImageFill'
import FoldPanelAdjust from './FoldPanelAdjust'

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf,.pdf'

async function fileToSlot(file) {
  if (!file) return null
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
  if (isPdf) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => reject(new Error('Could not read PDF'))
      r.readAsDataURL(file)
    })
    return {
      kind: 'pdf',
      name: file.name || 'page.pdf',
      dataUrl,
      transform: { ...DEFAULT_IMAGE_TRANSFORM },
    }
  }
  // Keep fold images modest so drafts persist (IndexedDB still has practical size limits)
  const { dataUrl } = await sanitizeImage(file, {
    maxDimension: 1400,
    quality: 0.82,
  })
  return {
    kind: 'image',
    name: file.name || 'image',
    dataUrl,
    transform: { ...DEFAULT_IMAGE_TRANSFORM },
  }
}

/** Accurate A4 landscape print sheet: 8 equal squares, fixed print margin, centered. */
function ZineA4Preview({ draft, onSelectPanel }) {
  const m = FOLD_PRINT_MARGIN_MM
  // Match print: square block inside equal margin box
  const gridW = ((297 - m * 2) / 297) * 100
  const squareMm = (297 - m * 2) / 4
  const gridH = ((squareMm * 2) / 210) * 100
  const topPct = ((210 - squareMm * 2) / 2 / 210) * 100
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] frens-muted uppercase tracking-wide">
          A4 landscape · 8 pages · {m} mm margin
        </p>
        <p className="text-[10px] frens-muted">297 × 210 mm</p>
      </div>
      <div
        className="relative mx-auto w-full max-w-xl border frens-border rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 shadow-md"
        style={{ aspectRatio: '297 / 210' }}
      >
        <div
          className="absolute bg-white shadow-sm"
          style={{
            left: `${(m / 297) * 100}%`,
            top: `${topPct}%`,
            width: `${gridW}%`,
            height: `${gridH}%`,
          }}
        >
          <div className="grid grid-cols-4 grid-rows-2 h-full w-full">
            {ZINE_PRINT_GRID.map((cell, i) => {
              const panel = ZINE_PANELS.find((p) => p.id === cell.panelId)
              const slot = draft.panels?.[cell.panelId]
              return (
                <button
                  key={`${cell.panelId}-${i}`}
                  type="button"
                  onClick={() => onSelectPanel?.(cell.panelId)}
                  className="relative overflow-hidden border border-black/15 aspect-square focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
                  title={panel ? `Adjust ${panel.label}` : 'Adjust panel'}
                >
                  <div
                    className="absolute inset-0"
                    style={{ transform: cell.rotate ? `rotate(${cell.rotate}deg)` : undefined }}
                  >
                    {slot ? (
                      <FoldImageFill slot={slot} sheetMargins={false} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
                        <span className="text-[9px] text-neutral-400 tracking-wide">
                          {panel?.short || '+'}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <div
            className="pointer-events-none absolute left-1/4 right-1/4 top-1/2 border-t border-dashed border-black/35"
            aria-hidden
          />
        </div>
      </div>
      <p className="text-[10px] frens-muted text-center">
        Tap a panel · dashed line = cut after print · {m} mm equal sheet margin
      </p>
    </div>
  )
}

function ZineEditor({ draft, onChange }) {
  const fileRef = useRef(null)
  const [pickPanel, setPickPanel] = useState(null)
  const [adjustPanel, setAdjustPanel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const openPick = (panelId) => {
    setPickPanel(panelId)
    fileRef.current?.click()
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const panelId = pickPanel
    if (!file || !panelId) return
    setBusy(true)
    setErr('')
    try {
      const slot = await fileToSlot(file)
      // Keep existing transform if replacing? reset for new file is clearer
      onChange({
        ...draft,
        panels: { ...draft.panels, [panelId]: slot },
        updatedAt: new Date().toISOString(),
      })
      // Leave image natural size — user opens Adjust only if needed
    } catch (ex) {
      setErr(ex.message || 'Could not use that file.')
    } finally {
      setBusy(false)
      setPickPanel(null)
    }
  }

  function selectPanel(panelId) {
    const slot = draft.panels?.[panelId]
    // Empty → pick file; filled → open adjust (manual only)
    if (slot?.kind === 'image') setAdjustPanel(panelId)
    else if (slot) openPick(panelId)
    else openPick(panelId)
  }

  function saveAdjust(nextSlot) {
    if (!adjustPanel) return
    onChange({
      ...draft,
      panels: {
        ...draft.panels,
        [adjustPanel]: {
          ...nextSlot,
          transform: normalizeImageTransform(nextSlot.transform),
        },
      },
      updatedAt: new Date().toISOString(),
    })
    setAdjustPanel(null)
  }

  const filled = countFilled(draft)
  const adjustSlot = adjustPanel ? draft.panels?.[adjustPanel] : null
  const adjustMeta = ZINE_PANELS.find((p) => p.id === adjustPanel)

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />

      <p className="text-xs frens-muted">
        {filled}/8 pages · equal squares · print margin {FOLD_PRINT_MARGIN_MM} mm all sides
        {busy ? ' · loading…' : ''}
      </p>
      {err ? <p className="text-xs text-red-500 dark:text-red-400">{err}</p> : null}

      {/* True A4 landscape preview — primary workspace */}
      <ZineA4Preview draft={draft} onSelectPanel={selectPanel} />

      {/* Compact list for labels / clear */}
      <div className="grid grid-cols-4 gap-2">
        {ZINE_PANELS.map((p) => {
          const slot = draft.panels?.[p.id]
          return (
            <div key={p.id} className="min-w-0">
              <button
                type="button"
                onClick={() => selectPanel(p.id)}
                className="w-full text-left space-y-1"
              >
                <p className="text-[10px] frens-muted uppercase tracking-wide truncate">
                  {p.readingOrder}. {p.label}
                </p>
                <div className="relative w-full aspect-square overflow-hidden border frens-border rounded-md bg-black/[0.03] dark:bg-white/[0.04]">
                  {slot ? (
                    <FoldImageFill slot={slot} sheetMargins={false} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] frens-muted">
                      +
                    </div>
                  )}
                </div>
              </button>
              {slot ? (
                <div className="flex gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setAdjustPanel(p.id)}
                    className="text-[10px] frens-muted hover:underline"
                    disabled={slot.kind !== 'image'}
                  >
                    Adjust
                  </button>
                  <button
                    type="button"
                    onClick={() => openPick(p.id)}
                    className="text-[10px] frens-muted hover:underline"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        panels: { ...draft.panels, [p.id]: null },
                      })
                    }
                    className="text-[10px] frens-muted hover:underline ml-auto"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {adjustSlot && adjustPanel ? (
        <FoldPanelAdjust
          slot={adjustSlot}
          label={adjustMeta?.label || adjustPanel}
          sheetMargins={false}
          aspect="zine"
          onClose={() => setAdjustPanel(null)}
          onSave={saveAdjust}
          onReplace={() => {
            const id = adjustPanel
            setAdjustPanel(null)
            openPick(id)
          }}
          onDelete={() => {
            onChange({
              ...draft,
              panels: { ...draft.panels, [adjustPanel]: null },
              updatedAt: new Date().toISOString(),
            })
            setAdjustPanel(null)
          }}
        />
      ) : null}
    </div>
  )
}

function PagesEditor({ draft, onChange, format }) {
  const fileRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(null)
  const [adjustIndex, setAdjustIndex] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const maxPages = format?.maxPages ?? 1
  const pages = draft.pages?.length ? draft.pages : [null]

  const openPick = (index) => {
    setActiveIndex(index)
    fileRef.current?.click()
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || activeIndex == null) return
    setBusy(true)
    setErr('')
    try {
      const slot = await fileToSlot(file)
      const next = [...pages]
      next[activeIndex] = slot
      onChange({
        ...draft,
        pages: next,
        updatedAt: new Date().toISOString(),
      })
      // Leave image natural; user opens Adjust only if they want
    } catch (ex) {
      setErr(ex.message || 'Could not use that file.')
    } finally {
      setBusy(false)
      setActiveIndex(null)
    }
  }

  const addPage = () => {
    if (pages.length >= maxPages) return
    onChange({
      ...draft,
      pages: [...pages, null],
    })
  }

  const removePage = (index) => {
    if (maxPages === 1) {
      onChange({ ...draft, pages: [null] })
      return
    }
    const next = pages.filter((_, i) => i !== index)
    onChange({ ...draft, pages: next.length ? next : [null] })
  }

  const adjustSlot = adjustIndex != null ? pages[adjustIndex] : null

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />

      <p className="text-xs frens-muted">
        A4 portrait · 210 × 297 mm · {FOLD_PRINT_MARGIN_MM} mm equal margin · JPG or PDF
        {maxPages > 1 ? ` · ${pages.filter(Boolean).length}/${maxPages} pages` : ''}
        {busy ? ' · loading…' : ''}
      </p>
      {err ? <p className="text-xs text-red-500 dark:text-red-400">{err}</p> : null}

      <div className={`grid gap-4 ${maxPages === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {pages.map((slot, i) => (
          <div key={i} className="space-y-1.5">
            <p className="text-[10px] frens-muted uppercase tracking-wide">
              {maxPages > 1 ? `Page ${i + 1}` : format?.label || 'Page'}
            </p>
            <button
              type="button"
              onClick={() => (slot?.kind === 'image' ? setAdjustIndex(i) : openPick(i))}
              className="relative w-full aspect-[210/297] overflow-hidden border frens-border rounded-xl bg-white shadow-sm"
            >
              {slot ? (
                <FoldImageFill slot={slot} sheetMargins />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 frens-muted">
                  <span className="text-lg leading-none">+</span>
                  <span className="text-[10px]">JPG or PDF</span>
                </div>
              )}
              {slot ? (
                <div
                  className="pointer-events-none absolute border border-dashed border-black/20 rounded-sm"
                  style={foldPrintMarginInset(false)}
                  aria-hidden
                />
              ) : null}
            </button>
            {slot ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustIndex(i)}
                  disabled={slot.kind !== 'image'}
                  className="text-[10px] frens-muted hover:underline disabled:opacity-40"
                >
                  Adjust
                </button>
                <button
                  type="button"
                  onClick={() => openPick(i)}
                  className="text-[10px] frens-muted hover:underline"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (maxPages === 1) {
                      onChange({ ...draft, pages: [null] })
                    } else {
                      const next = [...pages]
                      next[i] = null
                      onChange({ ...draft, pages: next })
                    }
                  }}
                  className="text-[10px] frens-muted hover:underline ml-auto"
                >
                  Clear
                </button>
              </div>
            ) : null}
            {maxPages > 1 && pages.length > 1 ? (
              <button
                type="button"
                onClick={() => removePage(i)}
                className="text-[10px] frens-muted hover:underline"
              >
                Remove page
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {maxPages > 1 && pages.length < maxPages ? (
        <button
          type="button"
          onClick={addPage}
          className="w-full letter-btn-outline py-2.5 text-xs tracking-wide"
        >
          + Add page ({pages.length}/{maxPages})
        </button>
      ) : null}

      {adjustSlot != null && adjustIndex != null ? (
        <FoldPanelAdjust
          slot={adjustSlot}
          label={maxPages > 1 ? `Page ${adjustIndex + 1}` : format?.label || 'Page'}
          sheetMargins
          aspect="a4"
          onClose={() => setAdjustIndex(null)}
          onSave={(nextSlot) => {
            const next = [...pages]
            next[adjustIndex] = {
              ...nextSlot,
              transform: normalizeImageTransform(nextSlot.transform),
            }
            onChange({ ...draft, pages: next, updatedAt: new Date().toISOString() })
            setAdjustIndex(null)
          }}
          onReplace={() => {
            const idx = adjustIndex
            setAdjustIndex(null)
            openPick(idx)
          }}
          onDelete={() => {
            const next = [...pages]
            if (maxPages === 1) {
              onChange({ ...draft, pages: [null], updatedAt: new Date().toISOString() })
            } else {
              next[adjustIndex] = null
              onChange({ ...draft, pages: next, updatedAt: new Date().toISOString() })
            }
            setAdjustIndex(null)
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Compose a fold in a chosen format (zine / story / print / poster).
 */
export default function FoldComposer({ draft, onChange }) {
  const format = foldFormatById(draft?.formatId)

  if (!draft || !format) {
    return <p className="text-sm frens-muted text-center py-8">Pick a format to begin.</p>
  }

  return (
    <div className="space-y-4 letter-studio-ui">
      <label className="block space-y-1">
        <span className="text-[10px] frens-muted uppercase tracking-wide">
          Name
        </span>
        <input
          type="text"
          value={draft.title || ''}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder={`Untitled ${format.label || 'fold'}`}
          className="w-full rounded-xl border border-black/20 dark:border-white/25 bg-transparent px-3 py-2.5 text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 outline-none focus:ring-1 focus:ring-black/25 dark:focus:ring-white/25 normal-case tracking-normal"
          maxLength={80}
        />
      </label>

      {format.kind === 'zine' ? (
        <ZineEditor draft={draft} onChange={onChange} />
      ) : (
        <PagesEditor draft={draft} onChange={onChange} format={format} />
      )}

      {!foldHasContent(draft) ? (
        <p className="text-[10px] frens-muted text-center">
          Add at least one image or PDF to save this fold.
        </p>
      ) : null}
    </div>
  )
}

export { foldHasContent, countFilled, FOLD_STORY_MAX_PAGES }
