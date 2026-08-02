import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LetterCanvas, { duplicateBlock } from './LetterCanvas'
import LetterMetaBar, { LetterMetaTools } from './LetterMetaBar'
import LetterPageToolbar from './LetterPageToolbar'
import FoldPageToolbar from './FoldPageToolbar'
import LetterBlockToolbar from './LetterBlockToolbar'
import LetterStandardSheet from './LetterStandardSheet'
import {
  OWL_OCCASION_EXAMPLES,
  createOwlLetterDraft,
  createLetterBlock,
  formatLetterDate,
} from '../../lib/owlLetterFormat'
import {
  anchorForWriteFrom,
  DEFAULT_PENDING_STYLE,
  pendingStyleToBlockSeed,
  STANDARD_FIELD_DEFAULTS,
  styleFromBlock,
  syncLetterChrome,
  syncStandardLetterBlocks,
} from '../../lib/letterStudio'
import { preloadOwlFont } from '../../lib/owlLetterFonts'
import {
  applyPatchToSelection,
  selectionInElement,
  stylesForFieldToolbar,
} from '../../lib/letterFieldRichText'
import { printOwlLetter, canUseBrowserPrint } from '../../lib/owlPrint'
import { DEFAULT_IMAGE_LAYOUT } from '../../lib/letterImageLayout'
import { serializeOwlLetterBody } from '../../lib/owlLetterFormat'
import { sanitizeImage } from '../../lib/media'

export default function LetterStudioComposer({
  fromName: initialFrom = '',
  toName: initialTo = '',
  anonymous = false,
  onLetterChange,
  showPrint = true,
  mode = 'letter',
}) {
  const isFold = mode === 'fold'
  const [letter, setLetter] = useState(() => {
    const draft = createOwlLetterDraft({ fromName: initialFrom, toName: initialTo })
    return isFold ? draft : syncStandardLetterBlocks(draft)
  })
  const [selectedId, setSelectedId] = useState(null)
  const [focusedField, setFocusedField] = useState('body')
  const [pendingStyle, setPendingStyle] = useState(() => ({ ...DEFAULT_PENDING_STYLE }))
  const [typeAnywhere, setTypeAnywhere] = useState(false)
  const [imageError, setImageError] = useState('')
  const [selectionTick, setSelectionTick] = useState(0)
  const [imageSelected, setImageSelected] = useState(false)
  const fileRef = useRef(null)
  const fieldRefs = useRef({})

  const selected = letter.blocks?.find((b) => b.id === selectedId) || null
  const hasTextSelection = isFold && Boolean(selected && selected.kind !== 'date')

  const toolbarBlock = useMemo(() => {
    if (isFold) {
      if (hasTextSelection) return selected
      return {
        id: '__pending__',
        text: '',
        font: pendingStyle.font || letter.font,
        ...pendingStyle,
      }
    }
    const field = focusedField || 'body'
    const defaults = STANDARD_FIELD_DEFAULTS[field] || STANDARD_FIELD_DEFAULTS.body
    const overrides = letter.styleOverrides?.[field] || {}
    const fieldEl = fieldRefs.current[field]
    const inline = fieldEl ? stylesForFieldToolbar(fieldEl, {}) : {}
    return {
      id: field,
      text: letter[field] || '',
      font: inline.font || letter.font,
      ...defaults,
      ...overrides,
      ...inline,
    }
  }, [isFold, hasTextSelection, selected, pendingStyle, letter, focusedField, selectionTick])

  useEffect(() => {
    preloadOwlFont(letter.font)
  }, [letter.font])

  useEffect(() => {
    setLetter((prev) => {
      const next = {
        ...prev,
        fromName: initialFrom || prev.fromName,
        toName: initialTo || prev.toName,
      }
      if (!isFold && (initialFrom || prev.signature === prev.fromName)) {
        next.signature = initialFrom || prev.fromName
      }
      return isFold ? next : syncStandardLetterBlocks(next)
    })
  }, [initialFrom, initialTo, isFold])

  useEffect(() => {
    onLetterChange?.(letter)
  }, [letter, onLetterChange])

  useEffect(() => {
    if (isFold && selectedId && selected && selected.kind !== 'date') {
      setPendingStyle(styleFromBlock(selected))
    }
  }, [selectedId, isFold, selected])

  const update = useCallback((patchOrFn) => {
    setLetter((prev) => {
      const patch = typeof patchOrFn === 'function' ? patchOrFn(prev) : patchOrFn
      let next = { ...prev, ...patch }
      if (patch.showDate !== undefined || patch.date !== undefined || patch.showStamp !== undefined) {
        next = syncLetterChrome(next)
      }
      return isFold ? next : syncStandardLetterBlocks(next)
    })
  }, [isFold])

  const updateBlocks = useCallback((fn) => {
    setLetter((prev) => ({ ...prev, blocks: fn(prev.blocks || []) }))
  }, [])

  function patchSelected(patch) {
    if (!selectedId) return
    updateBlocks((blocks) => blocks.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)))
  }

  function applyToolbarPatch(patch) {
    if (isFold) {
      setPendingStyle((prev) => ({ ...prev, ...patch }))
      if (hasTextSelection) patchSelected(patch)
      else if (patch.font) {
        update({ font: patch.font })
        preloadOwlFont(patch.font)
      }
      return
    }

    const field = focusedField || 'body'
    const fieldEl = fieldRefs.current[field]
    const hasInlineSelection = Boolean(fieldEl && selectionInElement(fieldEl))

    if (hasInlineSelection && applyPatchToSelection(fieldEl, patch)) {
      const plain = fieldEl.innerText.replace(/\u00A0/g, ' ').replace(/\n$/, '')
      update((prev) => ({
        ...prev,
        [field]: plain,
        fieldHtml: { ...(prev.fieldHtml || {}), [field]: fieldEl.innerHTML },
      }))
      setSelectionTick((n) => n + 1)
      if (patch.font) preloadOwlFont(patch.font)
      return
    }

    update((prev) => {
      const nextOverrides = { ...(prev.styleOverrides || {}) }
      const fieldOverrides = { ...(nextOverrides[field] || {}) }
      const { font, ...fieldPatch } = patch
      Object.assign(fieldOverrides, fieldPatch)
      if (font) preloadOwlFont(font)
      nextOverrides[field] = fieldOverrides
      return { ...prev, styleOverrides: nextOverrides }
    })
    if (patch.font) {
      setPendingStyle((prev) => ({ ...prev, font: patch.font }))
    }
  }

  function applyToolbarFont(font) {
    if (isFold) {
      setPendingStyle((prev) => ({ ...prev, font }))
      update({ font })
      preloadOwlFont(font)
      if (hasTextSelection) patchSelected({ font })
      return
    }
    applyToolbarPatch({ font })
  }

  function applyOccasion(occasionId) {
    const ex = OWL_OCCASION_EXAMPLES[occasionId] || OWL_OCCASION_EXAMPLES.general
    if (isFold) {
      const font = letter.font
      const writeFrom = letter.writeFrom || 'left'
      const anchor = anchorForWriteFrom(writeFrom, 'prose')
      update({
        occasion: occasionId,
        blocks: syncLetterChrome({
          ...letter,
          occasion: occasionId,
          blocks: [
            ...(letter.showDate !== false ? [createLetterBlock({
              kind: 'date',
              x: 6,
              y: 4,
              w: 44,
              fontSize: 10,
              font: 'source-code-pro',
              layout: 'line',
              role: 'line',
              text: formatLetterDate(letter.date),
            })] : []),
            createLetterBlock({ x: anchor.x, y: 22, w: anchor.w, align: anchor.align, text: ex.greeting, fontSize: 18, bold: true, font, role: 'title', layout: 'line' }),
            createLetterBlock({ x: anchor.x, y: 32, w: 78, text: ex.body, fontSize: 14, font, role: 'body', layout: 'prose' }),
            createLetterBlock({ x: anchor.x, y: 68, w: 45, text: ex.closing, fontSize: 14, font, role: 'line', layout: 'line' }),
            createLetterBlock({ x: anchor.x, y: 78, w: 45, text: letter.fromName || '', fontSize: 18, bold: true, font, role: 'subtitle', layout: 'line' }),
          ],
        }).blocks,
      })
      setSelectedId(null)
      return
    }

    update({
      occasion: occasionId,
      greeting: ex.greeting,
      body: ex.body,
      closing: ex.closing,
      signature: letter.fromName || '',
      fieldHtml: {},
    })
    setFocusedField('body')
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')
    if (!file.type.startsWith('image/')) {
      setImageError('Choose a JPG or PNG.')
      return
    }
    try {
      const { dataUrl } = await sanitizeImage(file, { maxDimension: 1400 })
      update({ image: dataUrl, imageLayout: letter.imageLayout || { ...DEFAULT_IMAGE_LAYOUT } })
      setImageSelected(true)
    } catch (err) {
      setImageError(err.message || 'Could not add that image.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handlePrintPreview() {
    const previewLetter = anonymous
      ? { ...letter, fromName: 'A friend', signature: letter.signature ? 'Your fren' : '' }
      : letter
    await printOwlLetter({
      body: serializeOwlLetterBody(previewLetter),
      fromDisplay: previewLetter.fromName,
      anonymous,
    })
  }

  function addTextBlock() {
    const y = 20 + ((letter.blocks?.filter((b) => b.kind !== 'date').length || 0) * 3) % 50
    const block = createLetterBlock({
      text: '',
      ...pendingStyleToBlockSeed(
        { ...pendingStyle, font: pendingStyle.font || letter.font },
        { writeFrom: letter.writeFrom || 'left', font: letter.font, y },
      ),
    })
    updateBlocks((blocks) => [...blocks, block])
    setSelectedId(block.id)
  }

  function handleTypeAnywhereChange(next) {
    setTypeAnywhere(next)
    if (!next) {
      setSelectedId(null)
      updateBlocks((blocks) => blocks.filter((b) => b.kind === 'date' || String(b.text || '').trim()))
    }
  }

  function handleFieldChange(field, value, html) {
    update((prev) => ({
      ...prev,
      [field]: value,
      fieldHtml: { ...(prev.fieldHtml || {}), [field]: html },
    }))
  }

  function handleFieldFocus(field) {
    setFocusedField(field)
    setImageSelected(false)
  }

  function handleImageLayoutChange(layout) {
    update({ imageLayout: layout })
  }

  function handleFieldSelection(field) {
    setFocusedField(field)
    setImageSelected(false)
    setSelectionTick((n) => n + 1)
  }

  return (
    <div className="letter-studio-ui">
      {/* Top chrome only — tools stay off the letter page */}
      <div className="letter-studio-chrome">
        <LetterMetaBar
          fromName={letter.fromName}
          toName={letter.toName}
          anonymous={anonymous}
          onFromChange={(fromName) => update({ fromName, signature: fromName })}
          onToChange={(toName) => update({ toName })}
        />

        <div className="letter-studio-toolbar letter-studio-toolbar--top" role="toolbar" aria-label="Letter tools">
          <LetterMetaTools
            showDate={letter.showDate !== false}
            showStamp={letter.showStamp !== false}
            writeFrom={letter.writeFrom || 'left'}
            onShowDateChange={(showDate) => update({ showDate })}
            onShowStampChange={(showStamp) => update({ showStamp })}
            onWriteFromChange={(writeFrom) => update({ writeFrom })}
          />
          <span className="letter-tool-divider" aria-hidden />
          {isFold ? (
            <FoldPageToolbar
              bare
              typeAnywhere={typeAnywhere}
              onTypeAnywhereChange={handleTypeAnywhereChange}
              onAddText={addTextBlock}
              onAddImage={() => fileRef.current?.click()}
            />
          ) : (
            <LetterPageToolbar
              bare
              onAddImage={() => fileRef.current?.click()}
              onTemplate={applyOccasion}
            />
          )}
          <span className="letter-tool-divider" aria-hidden />
          <LetterBlockToolbar
            bare
            block={toolbarBlock}
            hasSelection={isFold ? hasTextSelection : Boolean(focusedField && selectionInElement(fieldRefs.current[focusedField || 'body']))}
            onPatch={applyToolbarPatch}
            onFontChange={applyToolbarFont}
            onDuplicate={() => {
              if (!selected) return
              updateBlocks((blocks) => [...blocks, duplicateBlock(selected)])
            }}
            onDelete={() => {
              if (isFold && selectedId) {
                updateBlocks((blocks) => blocks.filter((b) => b.id !== selectedId))
                setSelectedId(null)
              } else if (!isFold && focusedField) {
                update({ [focusedField]: '' })
              }
            }}
          />
        </div>
      </div>

      <div className="letter-studio-stage letter-studio-stage--clean">
        {isFold ? (
          <LetterCanvas
            letter={letter}
            onChange={setLetter}
            selectedId={selectedId}
            onSelect={setSelectedId}
            mode={mode}
            typeAnywhere={typeAnywhere}
            pendingStyle={pendingStyle}
            letterFont={letter.font}
          />
        ) : (
          <LetterStandardSheet
            letter={letter}
            focusedField={focusedField}
            imageSelected={imageSelected}
            onFieldFocus={handleFieldFocus}
            onFieldChange={handleFieldChange}
            onSelectionChange={handleFieldSelection}
            onImageSelect={setImageSelected}
            onImageLayoutChange={handleImageLayoutChange}
            fieldRefs={fieldRefs}
          />
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
      {imageError && <p className="letter-studio-note letter-studio-note--error">{imageError}</p>}

      {showPrint && canUseBrowserPrint() && (
        <button type="button" onClick={handlePrintPreview} className="letter-studio-print">
          Preview print
        </button>
      )}
    </div>
  )
}
