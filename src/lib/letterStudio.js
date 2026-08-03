import { createLetterBlock, formatLetterDate, todayIsoDate } from './owlLetterFormat'
import {
  clampLetterFontSize,
  buildLetterSizeSteps,
  LETTER_MIN_FONT_SIZE,
  LETTER_MAX_FONT_SIZE,
  LETTER_A4_PRINTABLE_MM,
} from './letterMetrics'

export {
  clampLetterFontSize,
  LETTER_MIN_FONT_SIZE,
  LETTER_MAX_FONT_SIZE,
  LETTER_A4_PRINTABLE_MM,
}

export const LETTER_SIZE_STEPS = buildLetterSizeSteps()

/** Text hierarchy — writer-friendly presets. */
export const LETTER_TEXT_ROLES = {
  header: { label: 'Header', fontSize: 28, bold: true, w: 40, layout: 'line', align: 'left' },
  title: { label: 'Title', fontSize: 22, bold: true, w: 55, layout: 'line', align: 'left' },
  subtitle: { label: 'Subtitle', fontSize: 16, bold: false, w: 62, layout: 'line', align: 'left' },
  body: { label: 'Body', fontSize: 14, bold: false, w: 78, layout: 'prose', align: 'left' },
  poem: { label: 'Poem', fontSize: 14, bold: false, w: 34, layout: 'poem', align: 'center' },
  line: { label: 'Line', fontSize: 14, bold: false, w: 50, layout: 'line', align: 'left' },
}

export const LETTER_LAYOUTS = {
  prose: { label: 'Long letter', lineHeight: 1.65, w: 78 },
  poem: { label: 'Poem', lineHeight: 1.85, w: 34 },
  line: { label: 'Single line', lineHeight: 1.35, w: 50 },
}

export const LETTER_ALIGN = {
  left: { label: 'Left' },
  center: { label: 'Center' },
  right: { label: 'Right' },
}

export const LETTER_WRITE_FROM = {
  left: { label: 'Left', x: 8, align: 'left' },
  center: { label: 'Center', x: 18, align: 'center' },
  right: { label: 'Right', x: 38, align: 'right' },
}

export const DEFAULT_PENDING_STYLE = {
  fontSize: 14,
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  layout: 'prose',
  role: 'body',
  lineHeight: 1.65,
}

export function styleFromBlock(block) {
  if (!block) return { ...DEFAULT_PENDING_STYLE }
  return {
    font: block.font,
    fontSize: clampLetterFontSize(block.fontSize ?? DEFAULT_PENDING_STYLE.fontSize),
    bold: Boolean(block.bold),
    italic: Boolean(block.italic),
    underline: Boolean(block.underline),
    align: block.align || 'left',
    layout: block.layout || 'prose',
    role: block.role || 'body',
    lineHeight: block.lineHeight ?? LETTER_LAYOUTS[block.layout || 'prose']?.lineHeight ?? 1.65,
  }
}

/** Style seed for a new text block from pending writer settings. */
export function pendingStyleToBlockSeed(pending, { writeFrom = 'left', font, y, x } = {}) {
  const layout = pending.layout || 'prose'
  const anchor = anchorForWriteFrom(writeFrom, layout)
  const layoutMeta = LETTER_LAYOUTS[layout] || LETTER_LAYOUTS.prose
  const role = LETTER_TEXT_ROLES[pending.role]
  return {
    x: x ?? anchor.x,
    y: y ?? 18,
    w: role?.w ?? layoutMeta.w,
    font: pending.font || font,
    fontSize: clampLetterFontSize(pending.fontSize ?? DEFAULT_PENDING_STYLE.fontSize),
    bold: pending.bold ?? false,
    italic: pending.italic ?? false,
    underline: pending.underline ?? false,
    align: pending.align ?? anchor.align,
    layout,
    role: pending.role ?? 'body',
    lineHeight: pending.lineHeight ?? layoutMeta.lineHeight,
  }
}

export function roleForBlock(block) {
  if (!block?.role) return 'body'
  return LETTER_TEXT_ROLES[block.role] ? block.role : 'body'
}

export function applyTextRole(block, roleId) {
  const role = LETTER_TEXT_ROLES[roleId]
  if (!role) return block
  return {
    ...block,
    role: roleId,
    fontSize: clampLetterFontSize(role.fontSize),
    bold: role.bold,
    w: role.w,
    layout: role.layout,
    align: role.align,
  }
}

export function applyLayout(block, layoutId) {
  const layout = LETTER_LAYOUTS[layoutId]
  if (!layout) return block
  return { ...block, layout: layoutId, w: layout.w, lineHeight: layout.lineHeight }
}

export function applyAlign(block, align) {
  return { ...block, align }
}

export function anchorForWriteFrom(writeFrom, layout = 'prose') {
  const side = LETTER_WRITE_FROM[writeFrom] || LETTER_WRITE_FROM.left
  const layoutMeta = LETTER_LAYOUTS[layout] || LETTER_LAYOUTS.prose
  return { x: side.x, align: side.align, w: layoutMeta.w }
}

export function createAnchoredBlock({ writeFrom = 'left', font, fontSize = 14, ...rest } = {}) {
  const anchor = anchorForWriteFrom(writeFrom)
  return createLetterBlock({
    x: anchor.x,
    y: 18,
    w: anchor.w,
    align: anchor.align,
    layout: 'prose',
    role: 'body',
    fontSize,
    font,
    ...rest,
  })
}

export function createDateBlock(date, font = 'source-code-pro') {
  return createLetterBlock({
    kind: 'date',
    x: 6,
    y: 4,
    w: 44,
    fontSize: 10,
    font,
    layout: 'line',
    role: 'line',
    align: 'left',
    text: formatLetterDate(date || todayIsoDate()),
  })
}

const STANDARD_FIELD_DEFAULTS = {
  greeting: { fontSize: 18, bold: true, role: 'title', layout: 'line', align: 'left' },
  body: { fontSize: 14, bold: false, role: 'body', layout: 'prose', align: 'left' },
  closing: { fontSize: 14, bold: false, role: 'line', layout: 'line', align: 'left' },
  signature: { fontSize: 18, bold: true, role: 'subtitle', layout: 'line', align: 'left' },
}

export { STANDARD_FIELD_DEFAULTS }

export function syncStandardLetterBlocks(letter) {
  const font = letter.font || 'classic'
  const anchor = anchorForWriteFrom(letter.writeFrom || 'left', 'prose')
  const greeting = letter.greeting ?? ''
  const body = letter.body ?? ''
  const closing = letter.closing ?? ''
  const signature = letter.signature ?? letter.fromName ?? ''
  const overrides = letter.styleOverrides || {}

  const blocks = []
  if (letter.showDate !== false) {
    blocks.push(createLetterBlock({
      kind: 'date',
      x: 6,
      y: 4,
      w: 44,
      fontSize: 10,
      font: 'source-code-pro',
      layout: 'line',
      role: 'line',
      text: formatLetterDate(letter.date),
    }))
  }

  const sections = [
    { key: 'greeting', text: greeting, y: 22, w: anchor.w, fontSize: 18, bold: true, role: 'title', layout: 'line', align: anchor.align },
    { key: 'body', text: body, y: 32, w: 78, fontSize: 14, bold: false, role: 'body', layout: 'prose', align: anchor.align },
    { key: 'closing', text: closing, y: 68, w: 45, fontSize: 14, bold: false, role: 'line', layout: 'line', align: anchor.align },
    { key: 'signature', text: signature, y: 78, w: 45, fontSize: 18, bold: true, role: 'subtitle', layout: 'line', align: anchor.align },
  ]

  sections.forEach((section) => {
    const extra = overrides[section.key] || {}
    blocks.push(createLetterBlock({
      x: anchor.x,
      y: section.y,
      w: extra.w ?? section.w,
      align: extra.align ?? section.align,
      text: section.text,
      fontSize: extra.fontSize ?? section.fontSize,
      bold: extra.bold ?? section.bold,
      italic: extra.italic ?? false,
      underline: extra.underline ?? false,
      font: extra.font ?? font,
      role: section.role,
      layout: extra.layout ?? section.layout,
    }))
  })

  return {
    ...letter,
    greeting,
    body,
    closing,
    signature,
    blocks,
  }
}

export function syncLetterChrome(letter) {
  const showDate = letter.showDate !== false
  const showStamp = letter.showStamp !== false
  let blocks = (letter.blocks || []).filter((b) => b.kind !== 'date')

  if (showDate) {
    const existing = (letter.blocks || []).find((b) => b.kind === 'date')
    blocks.unshift({
      ...(existing || createDateBlock(letter.date, letter.font)),
      text: formatLetterDate(letter.date || todayIsoDate()),
    })
  }

  return { ...letter, showDate, showStamp, blocks }
}

export function defaultLetterDraft({ fromName = '', toName = '', font } = {}) {
  const date = todayIsoDate()
  return syncLetterChrome({
    font,
    fromName,
    toName,
    date,
    showDate: true,
    showStamp: true,
    writeFrom: 'left',
    blocks: [
      createAnchoredBlock({ writeFrom: 'left', font, y: 22, text: '' }),
    ],
  })
}
