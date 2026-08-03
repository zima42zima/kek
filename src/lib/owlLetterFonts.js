/**
 * Curated Google Fonts for letters & folds — 6 per category (3 defaults + 3 extras).
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
  // Classic — mixed order
  {
    id: 'lora',
    label: 'Lora',
    hint: 'Warm contemporary',
    category: 'Classic',
    stack: 'Lora, Georgia, serif',
    google: 'Lora:ital,wght@0,400;0,600;0,700;1,400',
    treatment: 'serif',
  },
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
    id: 'libre-baskerville',
    label: 'Libre Baskerville',
    hint: 'Book Baskerville',
    category: 'Classic',
    stack: "'Libre Baskerville', Georgia, serif",
    google: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
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
    id: 'eb-garamond',
    label: 'EB Garamond',
    hint: 'Classical Garamond',
    category: 'Classic',
    stack: "'EB Garamond', Georgia, serif",
    google: 'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400',
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
  // Modern — mixed order
  {
    id: 'dm-sans',
    label: 'DM Sans',
    hint: 'Quiet UI sans',
    category: 'Modern',
    stack: "'DM Sans', system-ui, sans-serif",
    google: 'DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400',
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
    id: 'outfit',
    label: 'Outfit',
    hint: 'Clean modern',
    category: 'Modern',
    stack: 'Outfit, system-ui, sans-serif',
    google: 'Outfit:wght@400;600;700',
    treatment: 'sans',
  },
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
    id: 'plus-jakarta-sans',
    label: 'Plus Jakarta Sans',
    hint: 'Friendly geometric',
    category: 'Modern',
    stack: "'Plus Jakarta Sans', system-ui, sans-serif",
    google: 'Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;1,400',
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
  // Typewriting — mixed order
  {
    id: 'courier-prime',
    label: 'Courier Prime',
    hint: 'Screen typewriter',
    category: 'Typewriting',
    stack: "'Courier Prime', ui-monospace, monospace",
    google: 'Courier+Prime:ital,wght@0,400;0,700;1,400',
    treatment: 'typewriter',
  },
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
    id: 'special-elite',
    label: 'Special Elite',
    hint: 'Vintage typed',
    category: 'Typewriting',
    stack: "'Special Elite', ui-monospace, monospace",
    google: 'Special+Elite',
    treatment: 'typewriter',
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
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    hint: 'Precise mono',
    category: 'Typewriting',
    stack: "'IBM Plex Mono', ui-monospace, monospace",
    google: 'IBM+Plex+Mono:ital,wght@0,400;0,600;0,700;1,400',
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
  // Handwritten — mixed order
  {
    id: 'caveat',
    label: 'Caveat',
    hint: 'Marker notes',
    category: 'Handwritten',
    stack: 'Caveat, cursive',
    google: 'Caveat:wght@400;600;700',
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
    id: 'dancing-script',
    label: 'Dancing Script',
    hint: 'Lively cursive',
    category: 'Handwritten',
    stack: "'Dancing Script', cursive",
    google: 'Dancing+Script:wght@400;600;700',
    treatment: 'handwritten',
  },
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
    id: 'kalam',
    label: 'Kalam',
    hint: 'Ballpoint pen',
    category: 'Handwritten',
    stack: 'Kalam, cursive',
    google: 'Kalam:wght@300;400;700',
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
  tinos: 'lora',
  literata: 'lora',
  merriweather: 'libre-baskerville',
  cormorant: 'eb-garamond',
  arimo: 'dm-sans',
  jost: 'plus-jakarta-sans',
  fredoka: 'comic-neue',
  vt323: 'special-elite',
  geist: 'geist-mono',
  'space-mono': 'ibm-plex-mono',
  inconsolata: 'ibm-plex-mono',
  'great-vibes': 'dancing-script',
  'nothing-you-could-do': 'kalam',
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
