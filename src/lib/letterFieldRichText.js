import { normalizeOwlFontId, owlFontStack, OWL_LETTER_FONTS } from './owlLetterFonts'

export function fieldPlainText(el) {
  if (!el) return ''
  return el.innerText.replace(/\u00A0/g, ' ').replace(/\n$/, '')
}

export function selectionInElement(el) {
  const sel = window.getSelection()
  if (!sel?.rangeCount || sel.isCollapsed || !el) return null
  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) return null
  return { sel, range }
}

function fontIdFromFamily(family) {
  const needle = String(family || '').toLowerCase()
  if (!needle) return null
  for (const font of OWL_LETTER_FONTS) {
    const primary = font.stack.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
    if (needle.includes(primary)) return font.id
  }
  return null
}

function styleFromNode(node, el) {
  let current = node
  if (current?.nodeType === Node.TEXT_NODE) current = current.parentElement
  const styles = {}
  while (current && current !== el) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const inline = current.style
      if (!styles.font && inline.fontFamily) {
        styles.font = fontIdFromFamily(inline.fontFamily)
      }
      if (inline.fontWeight && styles.bold === undefined) {
        styles.bold = inline.fontWeight === 'bold' || Number.parseInt(inline.fontWeight, 10) >= 600
      }
      if (inline.fontStyle && styles.italic === undefined) {
        styles.italic = inline.fontStyle === 'italic'
      }
      if (inline.textDecoration && styles.underline === undefined) {
        styles.underline = inline.textDecoration.includes('underline')
      }
      if (inline.fontSize && styles.fontSize === undefined) {
        const px = Number.parseInt(inline.fontSize, 10)
        if (px) styles.fontSize = px
      }
    }
    current = current.parentElement
  }
  return styles
}

export function stylesAtCaret(el) {
  const sel = window.getSelection()
  if (!sel?.rangeCount || !el?.contains(sel.anchorNode)) return {}
  return styleFromNode(sel.anchorNode, el)
}

export function stylesForFieldToolbar(el, defaults = {}) {
  const hit = selectionInElement(el)
  if (hit) {
    const fragment = hit.range.cloneContents()
    const probe = document.createElement('div')
    probe.appendChild(fragment)
    const fromSelection = styleFromNode(probe.firstChild || probe, probe)
    return { ...defaults, ...fromSelection }
  }
  return { ...defaults, ...stylesAtCaret(el) }
}

function wrapRange(range, buildSpan) {
  const span = buildSpan()
  try {
    range.surroundContents(span)
  } catch {
    const fragment = range.extractContents()
    span.appendChild(fragment)
    range.insertNode(span)
  }
  return span
}

function execToggle(command, enabled) {
  const active = document.queryCommandState(command)
  if (Boolean(enabled) !== Boolean(active)) {
    document.execCommand(command)
  }
}

export function applyPatchToSelection(el, patch) {
  const hit = selectionInElement(el)
  if (!hit) return false

  el.focus()
  const { range } = hit

  if (patch.font) {
    const fontId = normalizeOwlFontId(patch.font)
    wrapRange(range, () => {
      const span = document.createElement('span')
      span.style.fontFamily = owlFontStack(fontId)
      span.dataset.letterFont = fontId
      return span
    })
    return true
  }

  if (patch.fontSize !== undefined) {
    wrapRange(range, () => {
      const span = document.createElement('span')
      span.style.fontSize = `${patch.fontSize}px`
      return span
    })
    return true
  }

  if (patch.bold !== undefined) {
    execToggle('bold', patch.bold)
    return true
  }

  if (patch.italic !== undefined) {
    execToggle('italic', patch.italic)
    return true
  }

  if (patch.underline !== undefined) {
    execToggle('underline', patch.underline)
    return true
  }

  return false
}

export function sanitizeFieldHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}
