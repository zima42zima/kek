/**
 * FOLDS — peer-to-peer paper publishing on A4.
 * Formats stay minimal; everything is meant to print.
 */

/** A4 portrait mm / CSS aspect */
export const A4_ASPECT = 210 / 297 // width / height ≈ 0.707
export const A4_LANDSCAPE_ASPECT = 297 / 210

/**
 * Fixed print setting for every fold: equal white margin on all four sides of A4.
 * Applied in print raster + previews (not optional per draft).
 */
export const FOLD_PRINT_MARGIN_MM = 5

/** Max members etc. not relevant — page limits for multi-page stories */
export const FOLD_STORY_MAX_PAGES = 12

/**
 * Print formats. Zine is the special one-sheet 8-page fold.
 * Others are straight A4 (portrait) image/PDF pages.
 * All share FOLD_PRINT_MARGIN_MM on the sheet.
 */
export const FOLD_FORMATS = [
  {
    id: 'zine',
    label: 'ZINE',
    hint: 'One A4 → eight mini pages. Upload each panel; fold & cut guide included.',
    kind: 'zine',
    panels: 8,
  },
  {
    id: 'story',
    label: 'STORY',
    hint: 'Short story or sequence — up to 12 A4 pages. JPG or PDF pages.',
    kind: 'pages',
    minPages: 1,
    maxPages: FOLD_STORY_MAX_PAGES,
  },
  {
    id: 'print',
    label: 'PRINT',
    hint: 'Single A4 illustration or photo — 5 mm equal margin on print.',
    kind: 'pages',
    minPages: 1,
    maxPages: 1,
  },
  {
    id: 'poster',
    label: 'POSTER',
    hint: 'A4 poster with the same 5 mm print margin as other folds.',
    kind: 'pages',
    minPages: 1,
    maxPages: 1,
  },
]

export function foldFormatById(id) {
  return FOLD_FORMATS.find((f) => f.id === id) || null
}

/**
 * Classic one-sheet 8-page zine.
 * A4 landscape, 4 columns × 2 rows = 8 equal squares, centered with 5mm page margin.
 * Top row prints upside-down so the booklet reads correctly after fold.
 *
 * Physical grid (looking at the sheet):
 *   [ p3↑ | p2↑ | p1↑ | inside↑ ]   ← rotated 180°
 *   [ p4  | p5  | back | front  ]   ← upright
 */
export const ZINE_PANELS = [
  { id: 'front', label: 'Front cover', short: 'FRONT', readingOrder: 1 },
  { id: 'inside_front', label: 'Inside front', short: 'INSIDE', readingOrder: 2 },
  { id: 'p1', label: 'Page 1', short: 'P1', readingOrder: 3 },
  { id: 'p2', label: 'Page 2', short: 'P2', readingOrder: 4 },
  { id: 'p3', label: 'Page 3', short: 'P3', readingOrder: 5 },
  { id: 'p4', label: 'Page 4', short: 'P4', readingOrder: 6 },
  { id: 'p5', label: 'Page 5', short: 'P5', readingOrder: 7 },
  { id: 'back', label: 'Back cover', short: 'BACK', readingOrder: 8 },
]

/** A4 landscape mm + layout for the 8-square print block. */
export const ZINE_SHEET_MM = {
  pageW: 297,
  pageH: 210,
  /** Uses global FOLD_PRINT_MARGIN_MM (equal on all sides). */
  get margin() {
    return FOLD_PRINT_MARGIN_MM
  },
  cols: 4,
  rows: 2,
}

/**
 * Largest equal squares that fit inside the fixed print margin box, then centered.
 * With 5 mm margin: square = min((297−10)/4, (210−10)/2) = 71.75mm
 */
export function zineLayoutMm() {
  const pageW = ZINE_SHEET_MM.pageW
  const pageH = ZINE_SHEET_MM.pageH
  const margin = FOLD_PRINT_MARGIN_MM
  const cols = ZINE_SHEET_MM.cols
  const rows = ZINE_SHEET_MM.rows
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2
  const square = Math.min(maxW / cols, maxH / rows)
  const gridW = square * cols
  const gridH = square * rows
  return {
    pageW,
    pageH,
    margin,
    cols,
    rows,
    square,
    gridW,
    gridH,
    /** Offset of grid from top-left of sheet (centers block). */
    offsetX: (pageW - gridW) / 2,
    offsetY: (pageH - gridH) / 2,
  }
}

/**
 * CSS padding % for equal FOLD_PRINT_MARGIN_MM on an A4 box.
 * Portrait: width 210mm, height 297mm. Landscape: swapped.
 */
export function foldPrintMarginCss(landscape = false) {
  const w = landscape ? 297 : 210
  const h = landscape ? 210 : 297
  const m = FOLD_PRINT_MARGIN_MM
  return {
    paddingTop: `${(m / h) * 100}%`,
    paddingRight: `${(m / w) * 100}%`,
    paddingBottom: `${(m / h) * 100}%`,
    paddingLeft: `${(m / w) * 100}%`,
  }
}

/** Absolute inset % for a dashed margin guide on an A4 preview box. */
export function foldPrintMarginInset(landscape = false) {
  const w = landscape ? 297 : 210
  const h = landscape ? 210 : 297
  const m = FOLD_PRINT_MARGIN_MM
  return {
    top: `${(m / h) * 100}%`,
    right: `${(m / w) * 100}%`,
    bottom: `${(m / h) * 100}%`,
    left: `${(m / w) * 100}%`,
  }
}

/**
 * Grid cell → panel id + print rotation (degrees).
 * Row-major, 4 cols × 2 rows (exactly 8 cells — one per zine page).
 */
export const ZINE_PRINT_GRID = [
  // Top row (upside-down when sheet is flat)
  { panelId: 'p3', rotate: 180 },
  { panelId: 'p2', rotate: 180 },
  { panelId: 'p1', rotate: 180 },
  { panelId: 'inside_front', rotate: 180 },
  // Bottom row (right-side up)
  { panelId: 'p4', rotate: 0 },
  { panelId: 'p5', rotate: 0 },
  { panelId: 'back', rotate: 0 },
  { panelId: 'front', rotate: 0 },
]

export const ZINE_FOLD_GUIDE = [
  { step: 1, text: 'Print this sheet single-sided on A4 (landscape).' },
  { step: 2, text: 'Fold in half short-edge to short-edge (hot-dog), then unfold.' },
  { step: 3, text: 'Fold in half long-edge to long-edge (hamburger), then unfold — 8 equal squares.' },
  { step: 4, text: 'Fold into a long strip of four, then unfold.' },
  { step: 5, text: 'Cut only the center dotted line (middle of the sheet, between the two center columns).' },
  { step: 6, text: 'Fold the sheet in half so the cut opens into a plus; push the ends together into a book.' },
  { step: 7, text: 'Crease the spine. You should have 8 pages: front → inside → 1–5 → back.' },
]

export function emptyZinePanels() {
  return Object.fromEntries(ZINE_PANELS.map((p) => [p.id, null]))
}

/** Per-image crop: scale (zoom), pan x/y %, rotation degrees. */
export const DEFAULT_IMAGE_TRANSFORM = {
  scale: 1,
  rotate: 0,
  x: 0,
  y: 0,
}

export function normalizeImageTransform(t) {
  const s = Number(t?.scale)
  const r = Number(t?.rotate)
  const x = Number(t?.x)
  const y = Number(t?.y)
  return {
    // 1 = cover panel; allow zoom out a bit but keep usable
    scale: Number.isFinite(s) ? Math.min(4, Math.max(0.5, s)) : 1,
    rotate: Number.isFinite(r) ? ((r % 360) + 360) % 360 : 0,
    x: Number.isFinite(x) ? Math.min(80, Math.max(-80, x)) : 0,
    y: Number.isFinite(y) ? Math.min(80, Math.max(-80, y)) : 0,
  }
}

export function emptyFoldDraft(formatId) {
  const format = foldFormatById(formatId)
  if (!format) return null
  if (format.kind === 'zine') {
    return {
      id: `fold-${Date.now()}`,
      formatId: 'zine',
      title: '',
      panels: emptyZinePanels(),
      // Sheet margin is global FOLD_PRINT_MARGIN_MM — not a per-draft toggle
      margins: true,
      fit: 'contain',
      updatedAt: new Date().toISOString(),
    }
  }
  const pageCount = format.maxPages === 1 ? 1 : 1
  return {
    id: `fold-${Date.now()}`,
    formatId: format.id,
    title: '',
    pages: Array.from({ length: pageCount }, () => null),
    margins: true,
    fit: 'contain', // contain | cover
    updatedAt: new Date().toISOString(),
  }
}

export function foldHasContent(draft) {
  if (!draft) return false
  if (draft.formatId === 'zine') {
    return Object.values(draft.panels || {}).some(Boolean)
  }
  return (draft.pages || []).some(Boolean)
}

export function countFilled(draft) {
  if (!draft) return 0
  if (draft.formatId === 'zine') {
    return Object.values(draft.panels || {}).filter(Boolean).length
  }
  return (draft.pages || []).filter(Boolean).length
}

/**
 * Draft storage — IndexedDB (localStorage is too small for zine image data-URLs).
 * Sync helpers still work via an in-memory cache for immediate UI updates.
 */
const FOLDS_STORAGE_KEY = 'misao-folds-v2' // legacy localStorage (migrated once)
const FOLDS_DB_NAME = 'misao-folds-db'
const FOLDS_DB_STORE = 'drafts'
const FOLDS_DB_VERSION = 1
const FOLDS_MAX = 30

let draftsMemory = null
let dbReady = null

function openFoldsDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No IndexedDB'))
  if (dbReady) return dbReady
  dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open(FOLDS_DB_NAME, FOLDS_DB_VERSION)
    req.onerror = () => reject(req.error || new Error('Could not open drafts database'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FOLDS_DB_STORE)) {
        db.createObjectStore(FOLDS_DB_STORE)
      }
    }
  })
  return dbReady
}

function idbGetAll() {
  return openFoldsDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(FOLDS_DB_STORE, 'readonly')
        const store = tx.objectStore(FOLDS_DB_STORE)
        const req = store.get('list')
        req.onsuccess = () => {
          const val = req.result
          resolve(Array.isArray(val) ? val : [])
        }
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbSetAll(list) {
  return openFoldsDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(FOLDS_DB_STORE, 'readwrite')
        const store = tx.objectStore(FOLDS_DB_STORE)
        const req = store.put(list.slice(0, FOLDS_MAX), 'list')
        req.onsuccess = () => resolve({ ok: true })
        req.onerror = () => reject(req.error)
      }),
  )
}

function readLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(FOLDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function clearLegacyLocalStorage() {
  try {
    localStorage.removeItem(FOLDS_STORAGE_KEY)
  } catch { /* ignore */ }
}

/**
 * Load drafts (async). Migrates legacy localStorage once into IndexedDB.
 */
export async function loadFoldDrafts() {
  try {
    let list = await idbGetAll()
    if (!list.length) {
      const legacy = readLegacyLocalStorage()
      if (legacy.length) {
        list = legacy
        try {
          await idbSetAll(list)
          clearLegacyLocalStorage()
        } catch { /* keep legacy if IDB write fails */ }
      }
    }
    draftsMemory = list
    return list
  } catch {
    const legacy = readLegacyLocalStorage()
    draftsMemory = legacy
    return legacy
  }
}

/**
 * Save drafts. Returns { ok, error? }.
 * Uses IndexedDB so multi-panel zines with images actually persist.
 */
export async function saveFoldDrafts(list) {
  const next = Array.isArray(list) ? list.slice(0, FOLDS_MAX) : []
  draftsMemory = next
  try {
    await idbSetAll(next)
    // Drop legacy key so we don't keep a stale/empty copy
    clearLegacyLocalStorage()
    return { ok: true }
  } catch (err) {
    // Last resort: try localStorage (may fail on large zines)
    try {
      localStorage.setItem(FOLDS_STORAGE_KEY, JSON.stringify(next))
      return { ok: true, via: 'localStorage' }
    } catch (e2) {
      const msg =
        e2?.name === 'QuotaExceededError' || /quota/i.test(String(e2?.message || ''))
          ? 'Storage full — could not save draft. Remove an old draft or use smaller images.'
          : err?.message || e2?.message || 'Could not save draft.'
      return { ok: false, error: msg }
    }
  }
}

/** Sync snapshot for UI that already loaded drafts (may be empty until loadFoldDrafts). */
export function getFoldDraftsCached() {
  return Array.isArray(draftsMemory) ? draftsMemory : []
}
