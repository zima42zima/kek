/**
 * Curated Google Fonts for letters & folds — 3 per voice.
 */

export const OWL_FONT_CATEGORIES = ['Classic', 'Modern', 'Typewriting', 'Handwritten']

export const OWL_FONT_CATEGORY_META = {
  Classic: { label: 'Classic', hint: 'Serif letters' },
  Modern: { label: 'Modern', hint: 'Clean sans' },
  Typewriting: { label: 'Typewriting', hint: 'Mono & typed' },
  Handwritten: { label: 'Handwritten', hint: 'Script & pen' },
}

/** @type {{ id: string, label: string, hint: string, category: string, stack: string, google: string, treatment: string }[]} */
export const OWL_LETTER_FONTS = [
  // Classic
  {
    id: 'playfair',
    label: 'Playfair',
    hint: 'Elegant display',
    category: 'Classic',
    stack: "'Playfair Display', Georgia, serif",
    google: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'serif',
  },
  {
    id: 'crimson-text',
    label: 'Crimson Text',
    hint: 'Book serif',
    category: 'Classic',
    stack: "'Crimson Text', Georgia, serif",
    google: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'serif',
  },
  {
    id: 'arvo',
    label: 'Arvo',
    hint: 'Slab serif',
    category: 'Classic',
    stack: 'Arvo, Georgia, serif',
    google: 'Arvo:ital,wght@0,400;0,700;1,400',
    treatment: 'serif',
  },
  // Modern
  {
    id: 'montserrat',
    label: 'Montserrat',
    hint: 'Geometric sans',
    category: 'Modern',
    stack: "'Montserrat', system-ui, sans-serif",
    google: 'Montserrat:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'sans',
  },
  {
    id: 'inter',
    label: 'Inter',
    hint: 'Neutral sans',
    category: 'Modern',
    stack: "'Inter', system-ui, sans-serif",
    google: 'Inter:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'sans',
  },
  {
    id: 'work-sans',
    label: 'Work Sans',
    hint: 'Friendly sans',
    category: 'Modern',
    stack: "'Work Sans', system-ui, sans-serif",
    google: 'Work+Sans:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'sans',
  },
  // Typewriting
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    hint: 'Code mono',
    category: 'Typewriting',
    stack: "'JetBrains Mono', ui-monospace, monospace",
    google: 'JetBrains+Mono:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'mono',
  },
  {
    id: 'geist-mono',
    label: 'Geist',
    hint: 'Modern mono',
    category: 'Typewriting',
    stack: "'Geist Mono', ui-monospace, monospace",
    google: 'Geist+Mono:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'mono',
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    hint: 'Classic code',
    category: 'Typewriting',
    stack: "'Source Code Pro', ui-monospace, monospace",
    google: 'Source+Code+Pro:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'mono',
  },
  // Handwritten
  {
    id: 'comic-neue',
    label: 'Comic Neue',
    hint: 'Casual script',
    category: 'Handwritten',
    stack: "'Comic Neue', cursive",
    google: 'Comic+Neue:ital,wght@0,400;0,700;1,400',
    treatment: 'handwritten',
  },
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    hint: 'Neat handwriting',
    category: 'Handwritten',
    stack: "'Patrick Hand', cursive",
    google: 'Patrick+Hand',
    treatment: 'handwritten',
  },
  {
    id: 'just-me-again',
    label: 'Just Me Again Down Here',
    hint: 'Loose handwriting',
    category: 'Handwritten',
    stack: "'Just Me Again Down Here', cursive",
    google: 'Just+Me+Again+Down+Here',
    treatment: 'handwritten',
  },
]

const LEGACY_FONT_MAP = {
  classic: 'crimson-text',
  modern: 'inter',
  typewriter: 'jetbrains-mono',
  'eb-garamond': 'crimson-text',
  tinos: 'crimson-text',
  lora: 'crimson-text',
  literata: 'crimson-text',
  merriweather: 'crimson-text',
  cormorant: 'playfair',
  'libre-baskerville': 'crimson-text',
  arimo: 'inter',
  jost: 'montserrat',
  'dm-sans': 'work-sans',
  outfit: 'work-sans',
  fredoka: 'comic-neue',
  'courier-prime': 'source-code-pro',
  'source-code-pro': 'source-code-pro',
  vt323: 'source-code-pro',
  'special-elite': 'source-code-pro',
  'ibm-plex-mono': 'geist-mono',
  geist: 'geist-mono',
  'geist-mono': 'geist-mono',
  'jetbrains-mono': 'jetbrains-mono',
  'space-mono': 'jetbrains-mono',
  inconsolata: 'geist-mono',
  caveat: 'patrick-hand',
  'great-vibes': 'just-me-again',
  'nothing-you-could-do': 'patrick-hand',
  'patrick-hand': 'patrick-hand',
  sans: 'inter',
  serif: 'crimson-text',
  typewriting: 'jetbrains-mono',
  handwritten: 'patrick-hand',
}

const fontById = Object.fromEntries(OWL_LETTER_FONTS.map((f) => [f.id, f]))

export const OWL_FONT_OPTIONS = OWL_LETTER_FONTS.map((f) => ({
  id: f.id,
  label: f.label,
  hint: f.hint,
  category: f.category,
}))

export const OWL_DEFAULT_FONT = 'crimson-text'

export function normalizeOwlFontId(id) {
  if (!id) return OWL_DEFAULT_FONT
  if (fontById[id]) return id
  return LEGACY_FONT_MAP[id] || OWL_DEFAULT_FONT
}

export function owlFontMeta(id) {
  return fontById[normalizeOwlFontId(id)] ?? fontById[OWL_DEFAULT_FONT]
}

export function owlFontCategoryForId(id) {
  return owlFontMeta(id).category
}

export function owlFontStack(id) {
  return owlFontMeta(id).stack
}

/** Inline font-family for letter content — avoids leaking into editor UI. */
export function owlFontFamilyStyle(id) {
  return { fontFamily: owlFontStack(id) }
}

export function owlFontPresentation(id) {
  const { treatment } = owlFontMeta(id)
  switch (treatment) {
    case 'mono':
      return { className: 'owl-letter-mono', style: { fontSize: '0.94em', lineHeight: 1.6, letterSpacing: '0.015em' } }
    case 'typewriter':
      return { className: 'owl-letter-typewriter', style: { fontSize: '0.98em', lineHeight: 1.55, letterSpacing: '0.02em' } }
    case 'sans':
      return { className: 'owl-letter-sans', style: { lineHeight: 1.55 } }
    case 'handwritten':
      return { className: 'owl-letter-handwritten', style: { lineHeight: 1.45, fontSize: '1.04em' } }
    default:
      return { className: 'owl-letter-serif', style: { lineHeight: 1.65 } }
  }
}

export function owlFontPrintClass(id) {
  const { treatment } = owlFontMeta(id)
  if (treatment === 'mono' || treatment === 'typewriter') return ' mono'
  return ''
}

export function owlFontsStylesheetUrl() {
  const families = OWL_LETTER_FONTS.map((f) => `family=${f.google}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

function injectOwlFontFaceRules() {
  /* Font families are applied inline on letter content only — no global .owl-f-* rules. */
}

export function ensureOwlLetterFonts() {
  if (typeof document === 'undefined') return
  document.getElementById('owl-letter-font-faces')?.remove()
  const id = 'owl-letter-fonts'
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = owlFontsStylesheetUrl()
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
  injectOwlFontFaceRules()
}

export function owlFontCssClass(id) {
  return `owl-f-${normalizeOwlFontId(id)}`
}

export function owlFontPrimaryName(id) {
  const stack = owlFontStack(id)
  const first = stack.split(',')[0].trim()
  return first.replace(/^['"]|['"]$/g, '')
}

export async function preloadOwlFont(id) {
  ensureOwlLetterFonts()
  if (!document.fonts?.load) return
  const name = owlFontPrimaryName(id)
  try {
    await Promise.all([
      document.fonts.load(`400 18px "${name}"`),
      document.fonts.load(`700 18px "${name}"`),
      document.fonts.load(`italic 400 18px "${name}"`),
    ])
  } catch { /* optional */ }
}

export function owlFontsByCategory() {
  return OWL_FONT_CATEGORIES.map((category) => ({
    category,
    meta: OWL_FONT_CATEGORY_META[category],
    fonts: OWL_FONT_OPTIONS.filter((f) => f.category === category),
  })).filter((group) => group.fonts.length > 0)
}
