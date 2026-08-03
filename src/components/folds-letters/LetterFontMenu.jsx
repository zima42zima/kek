import { useEffect, useState } from 'react'
import {
  OWL_FONT_CATEGORIES,
  normalizeOwlFontId,
  owlFontFamilyStyle,
  owlFontMeta,
  owlFontPresentation,
  owlFontsByCategory,
  preloadOwlFont,
} from '../../lib/owlLetterFonts'

function previewSample(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  return (raw || 'Dear friend,').slice(0, 48)
}

/**
 * Two-panel typeface picker — section tabs on the left, fonts on the right.
 */
export default function LetterFontMenu({ activeId, sampleText = '', onPick, className = '', variant = 'toolbar' }) {
  const active = normalizeOwlFontId(activeId)
  const sample = previewSample(sampleText)
  const groups = owlFontsByCategory()
  const [section, setSection] = useState(() => owlFontMeta(active).category)

  useEffect(() => {
    setSection(owlFontMeta(activeId).category)
  }, [activeId])

  const visible = groups.find((g) => g.category === section) || groups[0]

  function pick(id) {
    preloadOwlFont(id)
    onPick?.(id)
  }

  return (
    <div
      className={`letter-font-menu letter-font-menu--${variant} ${className}`.trim()}
      role="listbox"
      aria-label="Typefaces"
    >
      <div className="letter-font-menu__sections" role="tablist" aria-label="Font categories">
        {OWL_FONT_CATEGORIES.map((cat) => {
          const meta = groups.find((g) => g.category === cat)?.meta
          const isOpen = section === cat
          const hasActive = owlFontMeta(active).category === cat
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isOpen}
              title={meta?.hint || cat}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSection(cat)}
              className={`letter-font-menu__section ${isOpen ? 'letter-font-menu__section--open' : ''} ${hasActive ? 'letter-font-menu__section--has-active' : ''}`}
            >
              {cat}
            </button>
          )
        })}
      </div>

      <div className="letter-font-menu__fonts">
        {visible?.fonts.map((font) => {
          const meta = owlFontMeta(font.id)
          const isActive = active === font.id
          const { style: treatStyle } = owlFontPresentation(font.id)
          return (
            <button
              key={font.id}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(font.id)}
              className={`letter-tool-menu__item ${isActive ? 'letter-tool-menu__item--active' : ''}`}
            >
              <span
                className="block text-sm truncate letter-font-menu__preview"
                style={{ ...owlFontFamilyStyle(font.id), ...treatStyle }}
              >
                {sample}
              </span>
              <span className="letter-tool-menu__meta">
                {meta.label}
                <span className="letter-tool-menu__hint"> · {meta.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
