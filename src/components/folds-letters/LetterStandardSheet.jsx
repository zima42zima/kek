import { useCallback, useEffect, useRef, useState } from 'react'
import { formatLetterDate } from '../../lib/owlLetterFormat'
import { owlFontFamilyStyle, owlFontStack } from '../../lib/owlLetterFonts'
import { fieldPlainText, sanitizeFieldHtml } from '../../lib/letterFieldRichText'
import { DEFAULT_IMAGE_LAYOUT, measureLetterPageOverflow } from '../../lib/letterImageLayout'
import { STANDARD_FIELD_DEFAULTS } from '../../lib/letterStudio'
import LetterSheetImage from './LetterSheetImage'
import PsLetterStamp from './PsLetterStamp'

const FIELDS = [
  { id: 'greeting', placeholder: 'Dear friend,', className: 'letter-standard-field--greeting', multiline: false },
  { id: 'body', placeholder: 'Write your letter…', className: 'letter-standard-field--body', multiline: true },
  { id: 'closing', placeholder: 'Warmly,', className: 'letter-standard-field--closing', multiline: false },
  { id: 'signature', placeholder: 'Your name', className: 'letter-standard-field--signature', multiline: false },
]

function fieldStyle(letter, id) {
  const defaults = STANDARD_FIELD_DEFAULTS[id] || {}
  const o = letter.styleOverrides?.[id] || {}
  const fontSize = o.fontSize ?? defaults.fontSize
  const bold = o.bold ?? defaults.bold
  return {
    ...owlFontFamilyStyle(letter.font),
    fontSize: fontSize ? `${fontSize}px` : undefined,
    fontWeight: bold ? 600 : 400,
    fontStyle: o.italic ? 'italic' : 'normal',
    textDecoration: o.underline ? 'underline' : 'none',
    textAlign: o.align || defaults.align || 'left',
  }
}

function RichField({
  id,
  letter,
  focused,
  onFocus,
  onChange,
  onSelectionChange,
  onContentChange,
  registerRef,
  placeholder,
  className,
  multiline,
}) {
  const localRef = useRef(null)

  useEffect(() => {
    const el = localRef.current
    if (!el) return
    const html = letter.fieldHtml?.[id]
    if (html != null) {
      if (el.innerHTML !== html) {
        el.innerHTML = sanitizeFieldHtml(html)
      }
      return
    }
    if (!el.innerText && letter[id]) {
      el.textContent = letter[id]
    }
  }, [id, letter.fieldHtml?.[id], letter[id]])

  function handleInput(e) {
    const el = e.currentTarget
    onChange?.(id, fieldPlainText(el), sanitizeFieldHtml(el.innerHTML))
    onContentChange?.()
    if (!multiline) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div
      ref={(node) => {
        localRef.current = node
        registerRef?.(node)
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      data-placeholder={placeholder}
      className={`letter-standard-field letter-standard-field--rich ${className} ${focused ? 'letter-standard-field--active' : ''}`}
      style={fieldStyle(letter, id)}
      onFocus={() => onFocus?.(id)}
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyUp={() => {
        onSelectionChange?.(id)
        onContentChange?.()
      }}
      onMouseUp={() => {
        onSelectionChange?.(id)
        onContentChange?.()
      }}
    />
  )
}

export default function LetterStandardSheet({
  letter,
  focusedField,
  imageSelected = false,
  onFieldFocus,
  onFieldChange,
  onSelectionChange,
  onImageSelect,
  onImageLayoutChange,
  fieldRefs,
}) {
  const sheetRef = useRef(null)
  const contentRef = useRef(null)
  const imageWrapRef = useRef(null)
  const [pageOverflow, setPageOverflow] = useState({ overflow: false, overflowPx: 0, pageHeight: 0 })

  const remeasure = useCallback(() => {
    const result = measureLetterPageOverflow(
      sheetRef.current,
      contentRef.current,
      imageWrapRef.current,
    )
    setPageOverflow(result)
  }, [])

  useEffect(() => {
    remeasure()
    const sheet = sheetRef.current
    const content = contentRef.current
    if (!sheet) return undefined
    const ro = new ResizeObserver(remeasure)
    ro.observe(sheet)
    if (content) ro.observe(content)
    if (imageWrapRef.current) ro.observe(imageWrapRef.current)
    window.addEventListener('resize', remeasure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', remeasure)
    }
  }, [letter, remeasure])

  const imageLayout = letter.imageLayout || DEFAULT_IMAGE_LAYOUT
  const page2PreviewHeight = pageOverflow.overflow
    ? Math.min(Math.max(pageOverflow.overflowPx, 48), pageOverflow.pageHeight * 0.55)
    : 0

  return (
    <div className="letter-standard-pages">
      {pageOverflow.overflow ? (
        <div className="letter-page-overflow-badge" role="status">
          Content runs onto a second page when printed
        </div>
      ) : null}

      <div
        ref={sheetRef}
        className={`letter-standard-sheet ${pageOverflow.overflow ? 'letter-standard-sheet--overflow' : ''}`}
        onClick={() => onImageSelect?.(false)}
      >
        {pageOverflow.overflow ? (
          <div className="letter-page-break" aria-hidden>
            <span>Page break</span>
          </div>
        ) : null}

        {letter.showStamp !== false && <PsLetterStamp />}

        <div ref={contentRef} className="letter-standard-content">
          {letter.showDate !== false && (
            <p
              className="letter-standard-date"
              style={{ fontFamily: owlFontStack('source-code-pro') }}
            >
              {formatLetterDate(letter.date)}
            </p>
          )}

          <div className="letter-standard-body">
            {FIELDS.map(({ id, placeholder, className, multiline }) => (
              <RichField
                key={id}
                id={id}
                letter={letter}
                focused={focusedField === id}
                placeholder={placeholder}
                className={className}
                multiline={multiline}
                registerRef={(node) => {
                  if (fieldRefs?.current) fieldRefs.current[id] = node
                }}
                onFocus={onFieldFocus}
                onChange={onFieldChange}
                onSelectionChange={onSelectionChange}
                onContentChange={remeasure}
              />
            ))}
          </div>
        </div>

        {letter.image ? (
          <LetterSheetImage
            ref={imageWrapRef}
            src={letter.image}
            layout={imageLayout}
            selected={imageSelected}
            onSelect={() => onImageSelect?.(true)}
            onChange={onImageLayoutChange}
            onLayoutChange={remeasure}
          />
        ) : null}
      </div>

      {pageOverflow.overflow ? (
        <div
          className="letter-standard-sheet letter-standard-sheet--page2"
          style={{ minHeight: page2PreviewHeight }}
          aria-hidden
        >
          <span className="letter-page-continuation">Page 2</span>
          <span className="letter-page-continuation-note">Continues from above</span>
        </div>
      ) : null}
    </div>
  )
}

export { FIELDS as LETTER_STANDARD_FIELDS }
