/** Letter format — structured JSON in `body` (v1/v2) with plain-text fallback. */

import { normalizeOwlFontId, OWL_DEFAULT_FONT, owlFontStack } from './owlLetterFonts'
import { DEFAULT_IMAGE_LAYOUT } from './letterImageLayout'

export { OWL_FONT_OPTIONS, OWL_FONT_CATEGORIES, owlFontsByCategory } from './owlLetterFonts'

export const OWL_LETTER_VERSION = 1
export const LETTER_CANVAS_VERSION = 2

export function newLetterBlockId() {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createLetterBlock(overrides = {}) {
  return {
    id: newLetterBlockId(),
    x: 8,
    y: 10,
    w: 55,
    text: '',
    fontSize: 16,
    font: OWL_DEFAULT_FONT,
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    layout: 'prose',
    role: 'body',
    lineHeight: 1.65,
    kind: null,
    ...overrides,
  }
}

function blocksFromLegacy(letter) {
  const blocks = []
  let y = 8
  if (letter.greeting) {
    blocks.push(createLetterBlock({
      x: 8, y, w: 60, text: letter.greeting, fontSize: 22, bold: true, font: letter.font,
    }))
    y += 14
  }
  if (letter.body) {
    blocks.push(createLetterBlock({
      x: 8, y, w: 75, text: letter.body, fontSize: 15, font: letter.font,
    }))
    y += Math.min(40, 12 + Math.ceil(letter.body.length / 48) * 4)
  }
  if (letter.closing) {
    blocks.push(createLetterBlock({
      x: 8, y: Math.min(y, 72), w: 45, text: letter.closing, fontSize: 15, font: letter.font,
    }))
    y += 10
  }
  if (letter.signature) {
    blocks.push(createLetterBlock({
      x: 8, y: Math.min(y + 4, 82), w: 50, text: letter.signature, fontSize: 20, bold: true, font: letter.font,
    }))
  }
  if (blocks.length === 0) {
    blocks.push(createLetterBlock({ x: 12, y: 20, w: 60, text: '', fontSize: 18, font: letter.font }))
  }
  return blocks
}

function blocksFromV1Parsed(parsed) {
  return blocksFromLegacy(parsed)
}

function canvasDraftBlocks(ex, fromName, font) {
  return [
    createLetterBlock({ x: 6, y: 5, w: 42, text: formatLetterDate(todayIsoDate()), fontSize: 10, font: 'source-code-pro' }),
    createLetterBlock({ x: 55, y: 8, w: 38, text: 'LETTER', fontSize: 28, bold: true, font }),
    createLetterBlock({ x: 8, y: 22, w: 55, text: ex.greeting, fontSize: 18, bold: true, font }),
    createLetterBlock({ x: 8, y: 32, w: 78, text: ex.body, fontSize: 14, font }),
    createLetterBlock({ x: 8, y: 68, w: 40, text: ex.closing, fontSize: 14, font }),
    createLetterBlock({ x: 8, y: 78, w: 45, text: fromName || '', fontSize: 18, bold: true, font }),
  ]
}

export const OWL_OCCASION_OPTIONS = [
  { id: 'general', label: 'Standard / General Letter' },
  { id: 'birthday', label: 'Birthday Celebration' },
  { id: 'thankyou', label: 'Thank You Note' },
  { id: 'casual', label: 'Thinking of You / Casual' },
  { id: 'love', label: 'Affectionate / Close Fren' },
]

export const OWL_OCCASION_EXAMPLES = {
  general: {
    greeting: 'Dear friend,',
    body: 'I was thinking about you today and wanted to send a proper letter instead of just a message. Hope this finds you well.',
    closing: '',
  },
  birthday: {
    greeting: 'Happy Birthday, you legend!',
    body: "Another trip around the sun and you're still the best fren anyone could ask for. Hope your day is full of cake and good people.",
    closing: 'With all the birthday chaos,',
  },
  thankyou: {
    greeting: 'Dear friend,',
    body: 'I just wanted to say thank you properly. Your kindness the other day meant more than you know.',
    closing: 'Grateful beyond words,',
  },
  casual: {
    greeting: 'Hey you,',
    body: "Just wanted to drop a line and say I'm thinking about you. Life's been busy but you popped into my head.",
    closing: 'Catch you soon,',
  },
  love: {
    greeting: 'My dear friend,',
    body: "Some people make the world feel a little softer just by existing. You're one of those people for me.",
    closing: 'With so much love,',
  },
}

export function todayIsoDate() {
  return new Date().toISOString().split('T')[0]
}

export function createOwlLetterDraft({ fromName = '', toName = '', occasion = 'general' } = {}) {
  const ex = OWL_OCCASION_EXAMPLES[occasion] || OWL_OCCASION_EXAMPLES.general
  const font = OWL_DEFAULT_FONT
  return {
    v: LETTER_CANVAS_VERSION,
    font,
    occasion,
    fromName,
    toName,
    date: todayIsoDate(),
    showDate: true,
    showStamp: true,
    writeFrom: 'left',
    greeting: ex.greeting,
    body: ex.body,
    closing: ex.closing,
    signature: fromName,
    image: null,
    imageLayout: { ...DEFAULT_IMAGE_LAYOUT },
    blocks: [
      createLetterBlock({ kind: 'date', x: 6, y: 4, w: 44, fontSize: 10, font: 'source-code-pro', layout: 'line', role: 'line', text: formatLetterDate(todayIsoDate()) }),
      createLetterBlock({ x: 8, y: 22, w: 55, text: ex.greeting, fontSize: 18, bold: true, font, role: 'title', layout: 'line' }),
      createLetterBlock({ x: 8, y: 32, w: 78, text: ex.body, fontSize: 14, font, role: 'body', layout: 'prose' }),
      createLetterBlock({ x: 8, y: 68, w: 45, text: ex.closing, fontSize: 14, font, role: 'line', layout: 'line' }),
      createLetterBlock({ x: 8, y: 78, w: 45, text: fromName || '', fontSize: 18, bold: true, font, role: 'subtitle', layout: 'line' }),
    ],
  }
}

export function parseOwlLetterBody(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return {
      v: LETTER_CANVAS_VERSION,
      body: '',
      font: OWL_DEFAULT_FONT,
      occasion: 'general',
      fromName: '',
      toName: '',
      date: '',
      greeting: '',
      closing: '',
      signature: '',
      image: null,
      blocks: [createLetterBlock({ x: 12, y: 20, w: 60, text: '', fontSize: 18 })],
    }
  }
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed?.v === LETTER_CANVAS_VERSION && Array.isArray(parsed.blocks)) {
        return {
          v: LETTER_CANVAS_VERSION,
          font: normalizeOwlFontId(parsed.font),
          occasion: parsed.occasion || 'general',
          fromName: parsed.fromName || '',
          toName: parsed.toName || '',
          date: parsed.date || '',
          greeting: parsed.greeting || '',
          body: parsed.body || '',
          closing: parsed.closing || '',
          signature: parsed.signature || parsed.fromName || '',
          image: parsed.image || null,
          imageLayout: parsed.imageLayout || { ...DEFAULT_IMAGE_LAYOUT },
          blocks: parsed.blocks.map((b) => ({
            ...createLetterBlock(),
            ...b,
            id: b.id || newLetterBlockId(),
            font: normalizeOwlFontId(b.font || parsed.font),
            align: b.align || 'left',
            layout: b.layout || 'prose',
            role: b.role || 'body',
          })),
          showDate: parsed.showDate !== false,
          showStamp: parsed.showStamp !== false,
          writeFrom: parsed.writeFrom || 'left',
          fieldHtml: parsed.fieldHtml || {},
        }
      }
      if (parsed?.v === OWL_LETTER_VERSION) {
        const base = {
          v: LETTER_CANVAS_VERSION,
          font: normalizeOwlFontId(parsed.font),
          occasion: parsed.occasion || 'general',
          fromName: parsed.fromName || '',
          toName: parsed.toName || '',
          date: parsed.date || '',
          greeting: parsed.greeting || '',
          body: parsed.body || '',
          closing: parsed.closing || '',
          signature: parsed.signature || parsed.fromName || '',
          image: parsed.image || null,
          showDate: parsed.showDate !== false,
          showStamp: parsed.showStamp !== false,
          writeFrom: parsed.writeFrom || 'left',
        }
        return { ...base, blocks: blocksFromV1Parsed(base) }
      }
    } catch { /* legacy plain text */ }
  }
  const legacy = {
    v: LETTER_CANVAS_VERSION,
    font: OWL_DEFAULT_FONT,
    occasion: 'general',
    fromName: '',
    toName: '',
    date: '',
    greeting: '',
    body: text,
    closing: '',
    signature: '',
    image: null,
  }
  return { ...legacy, blocks: blocksFromLegacy(legacy) }
}

export function serializeOwlLetterBody(letter) {
  const blocks = letter.blocks?.length
    ? letter.blocks
    : blocksFromLegacy(letter)
  const bodyText = blocks.map((b) => b.text).filter(Boolean).join('\n\n')
  return JSON.stringify({
    v: LETTER_CANVAS_VERSION,
    font: letter.font || OWL_DEFAULT_FONT,
    occasion: letter.occasion || 'general',
    fromName: letter.fromName || '',
    toName: letter.toName || '',
    date: letter.date || todayIsoDate(),
    greeting: letter.greeting || '',
    body: bodyText || letter.body || '',
    closing: letter.closing || '',
    signature: letter.signature || letter.fromName || '',
    image: letter.image || null,
    imageLayout: letter.imageLayout || { ...DEFAULT_IMAGE_LAYOUT },
    showDate: letter.showDate !== false,
    showStamp: letter.showStamp !== false,
    writeFrom: letter.writeFrom || 'left',
    fieldHtml: letter.fieldHtml || {},
    blocks,
  })
}

export function syncLetterLegacyFields(letter) {
  const blocks = letter.blocks || []
  const joined = blocks.map((b) => b.text).filter(Boolean).join('\n\n')
  return {
    ...letter,
    body: joined,
    greeting: blocks[0]?.text || letter.greeting || '',
    signature: blocks[blocks.length - 1]?.text || letter.signature || letter.fromName || '',
  }
}

/** Letter has text blocks and/or an attached image. */
export function owlLetterHasContent(letter) {
  if (!letter) return false
  if (letter.image) return true
  if (letter.blocks?.some((b) => String(b.text || '').trim())) return true
  return Boolean(owlLetterTextContent(letter))
}

/** Letter content used for empty checks and length hints. */
export function owlLetterTextContent(letter) {
  if (letter.blocks?.length) {
    return letter.blocks.map((b) => b.text).filter(Boolean).join('\n\n').trim()
  }
  return [letter.greeting, letter.body, letter.closing, letter.signature].filter(Boolean).join('\n\n').trim()
}

export function letterBlockStyle(block) {
  const fontFamily = owlFontStack(normalizeOwlFontId(block.font))
  const lineHeights = { prose: 1.65, poem: 1.85, line: 1.35 }
  const lineHeight = block.lineHeight || lineHeights[block.layout] || 1.65
  return {
    left: `${block.x}%`,
    top: `${block.y}%`,
    width: `${block.w}%`,
    fontSize: `${block.fontSize}px`,
    fontFamily,
    fontWeight: block.bold ? 700 : 400,
    fontStyle: block.italic ? 'italic' : 'normal',
    textDecoration: block.underline ? 'underline' : 'none',
    textAlign: block.align || 'left',
    lineHeight,
  }
}

export function letterForPrint(letter, { fromDisplay, anonymous }) {
  const parsed = letter.v >= OWL_LETTER_VERSION ? letter : parseOwlLetterBody(letter.body ?? letter)
  if (anonymous) {
    return {
      ...parsed,
      fromName: 'A friend',
      signature: parsed.signature ? 'Your fren' : '',
    }
  }
  if (!parsed.fromName && fromDisplay) {
    return { ...parsed, fromName: fromDisplay, signature: parsed.signature || fromDisplay }
  }
  return parsed
}

export function formatLetterDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00`)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}
