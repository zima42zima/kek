import {
  parseOwlLetterBody,
  letterForPrint,
  formatLetterDate,
  letterBlockStyle,
  OWL_LETTER_VERSION,
  LETTER_CANVAS_VERSION,
} from './owlLetterFormat'
import { normalizeOwlFontId, owlFontStack, owlFontPrintClass, owlFontsStylesheetUrl } from './owlLetterFonts'
import { isFullBleedImage, normalizeImageLayout } from './letterImageLayout'
import { PS_STAMP_HTML } from './psStampMarkup'

const STAMP_HTML = PS_STAMP_HTML

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A4 home-printer layout (210×297mm).
 * Default margins: top 10mm (1cm), sides/bottom 12mm.
 * Full-bleed when image is stretched across the page.
 */
const PRINT_STYLES = `
  @import url('${owlFontsStylesheetUrl()}');

  @page {
    size: A4 portrait;
    /* 1cm all sides — home printer safe */
    margin: 10mm;
  }

  /* Full-bleed photo pages — edge to edge */
  @page bleed {
    size: A4 portrait;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .letter {
    background: #fff;
    border: none;
    box-shadow: none;
    position: relative;
    width: 100%;
    max-width: none;
    /* Full printable height of A4 with 10mm margins: 297 − 20 = 277mm */
    min-height: 277mm;
    margin: 0;
    padding: 0;
    font-size: 11pt;
    line-height: 1.5;
    color: #111;
    box-sizing: border-box;
  }
  .letter.full-bleed {
    min-height: 297mm;
    page: bleed;
  }
  .letter.handwritten { font-size: 12pt; line-height: 1.55; }
  .letter.script { font-size: 12.5pt; line-height: 1.45; }
  .letter.pixel { font-size: 12pt; line-height: 1.4; letter-spacing: 0.03em; }
  .letter.mono { font-size: 10.5pt; line-height: 1.5; letter-spacing: 0.01em; }

  .post-stamp {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 5;
    pointer-events: none;
    opacity: 0.9;
  }
  .post-stamp svg {
    width: 10mm;
    height: 10mm;
    display: block;
  }
  .letter.full-bleed .post-stamp {
    top: 8mm;
    right: 8mm;
  }

  .letter-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6mm;
    margin: 0 0 6mm;
    padding-right: 12mm;
  }
  .letter.full-bleed .letter-top {
    position: absolute;
    left: 10mm;
    right: 10mm;
    top: 8mm;
    z-index: 4;
    margin: 0;
    color: #111;
    mix-blend-mode: difference;
  }
  .meta {
    font-size: 10pt;
    line-height: 1.35;
    color: #111;
  }
  .meta div { margin: 0.12em 0; }
  .meta .label {
    font-weight: 600;
    margin-right: 0.4em;
  }
  .date {
    flex-shrink: 0;
    font-size: 9pt;
    color: #555;
    text-align: right;
    line-height: 1.3;
  }

  .content {
    margin: 0;
  }
  .greeting {
    margin: 0 0 0.4em;
    font-size: 1.05em;
    font-weight: 600;
  }
  .body {
    white-space: pre-wrap;
    margin: 0 0 0.75em;
    min-height: 0;
  }
  .body p { margin: 0 0 0.4em; }
  .body p:last-child { margin-bottom: 0; }
  .closing {
    margin: 0.75em 0 0.12em;
  }
  .signature {
    margin: 0;
    font-weight: 600;
  }

  .letter-image-flow {
    margin: 0 0 0.6em;
    max-width: 100%;
  }
  .letter-image-flow img {
    display: block;
    max-width: 100%;
    max-height: 90mm;
    width: auto;
    height: auto;
    object-fit: contain;
    border: none;
  }
  .letter.full-bleed .letter-image-flow {
    position: absolute;
    inset: 0;
    margin: 0;
    z-index: 0;
  }
  .letter.full-bleed .letter-image-flow img {
    width: 100%;
    height: 100%;
    max-height: none;
    object-fit: cover;
  }
  .letter.full-bleed .content {
    position: relative;
    z-index: 2;
    padding: 28mm 12mm 12mm;
  }

  /* Freeform canvas — entire printable A4 area is the writing surface */
  .letter-image-wrap {
    position: absolute;
    box-sizing: border-box;
    z-index: 1;
  }
  .letter-image {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    border: none;
  }
  .canvas-block {
    position: absolute;
    white-space: pre-wrap;
    box-sizing: border-box;
    z-index: 2;
  }
  .canvas-body {
    position: relative;
    width: 100%;
    /* Full A4 content height under default margins */
    min-height: 277mm;
    margin: 0;
  }
  .letter.full-bleed .canvas-body {
    min-height: 297mm;
  }

  @media print {
    html, body {
      width: 100%;
      height: auto;
    }
    .letter {
      width: 100%;
    }
  }
`

function buildLegacyPrintHtml(body, fromDisplay) {
  const safeFrom = escapeHtml(fromDisplay || 'a fren')
  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br/>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Letter</title>
<style>
@page{size:A4;margin:10mm}
body{font-family:Georgia,serif;color:#111;line-height:1.5;margin:0;padding:0;font-size:11pt}
.meta{font-size:10pt;margin-bottom:8mm}
.date{float:right;font-size:9pt;color:#555}
.body{white-space:pre-wrap}
</style></head>
<body>
  <div class="meta"><span style="font-weight:600">From</span> ${safeFrom}</div>
  <div class="body">${bodyHtml}</div>
</body></html>`
}

function fieldHtml(letter, key) {
  const rich = letter.fieldHtml?.[key]
  if (rich && String(rich).trim()) {
    // Editor HTML is already sanitized on input; keep structure, drop underlines forced by chrome.
    return String(rich)
      .replace(/text-decoration\s*:\s*underline;?/gi, '')
      .replace(/<u(\s[^>]*)?>/gi, '<span>')
      .replace(/<\/u>/gi, '</span>')
  }
  const plain = letter[key]
  if (!plain) return ''
  return escapeHtml(plain).replace(/\n/g, '<br/>')
}

function blocksPrintHtml(letter) {
  if (!letter.blocks?.length) return ''
  // Skip date blocks — date lives once in the top chrome
  return letter.blocks
    .filter((block) => block.kind !== 'date' && String(block.text || '').trim())
    .map((block) => {
      const style = letterBlockStyle(block)
      const css = [
        `left:${style.left}`,
        `top:${style.top}`,
        `width:${style.width}`,
        `font-size:${style.fontSize}`,
        `font-family:${style.fontFamily}`,
        `font-weight:${style.fontWeight}`,
        `font-style:${style.fontStyle}`,
        // Never force underline chrome on print
        `text-decoration:${style.textDecoration === 'underline' ? 'none' : style.textDecoration}`,
        `text-align:${style.textAlign}`,
        `line-height:${style.lineHeight}`,
      ].join(';')
      return `<div class="canvas-block" style="${css}">${escapeHtml(block.text).replace(/\n/g, '<br/>')}</div>`
    })
    .join('')
}

/** Standard letters print as flowing text (max content space). Freeform folds keep canvas. */
function prefersFlowLayout(letter) {
  if (letter.greeting || letter.body || letter.closing || letter.signature) return true
  if (letter.fieldHtml && Object.keys(letter.fieldHtml).length) return true
  if (!letter.blocks?.length) return true
  // Pure freeform canvas only
  return false
}

function flowContentHtml(letter) {
  const greeting = fieldHtml(letter, 'greeting')
  const body = fieldHtml(letter, 'body')
  const closing = fieldHtml(letter, 'closing')
  const signature = fieldHtml(letter, 'signature')

  const image = letter.image
    ? `<div class="letter-image-flow"><img src="${letter.image.replace(/"/g, '&quot;')}" alt=""/></div>`
    : ''

  return `
    <div class="content">
      ${greeting ? `<div class="greeting">${greeting}</div>` : ''}
      ${image}
      ${body ? `<div class="body">${body}</div>` : ''}
      ${closing ? `<div class="closing">${closing}</div>` : ''}
      ${signature ? `<div class="signature">${signature}</div>` : ''}
    </div>
  `
}

function canvasContentHtml(letter) {
  const imageHtml = letter.image
    ? (() => {
      const img = normalizeImageLayout(letter.imageLayout)
      return `<div class="letter-image-wrap" style="left:${img.x}%;top:${img.y}%;width:${img.w}%;"><img class="letter-image" src="${letter.image.replace(/"/g, '&quot;')}" alt="" /></div>`
    })()
    : ''
  return `${imageHtml}<div class="canvas-body">${blocksPrintHtml(letter)}</div>`
}

export function buildOwlLetterPrintHtml(rawBody, { fromDisplay, anonymous } = {}) {
  const parsed = parseOwlLetterBody(rawBody)
  if (parsed.v !== OWL_LETTER_VERSION && parsed.v !== LETTER_CANVAS_VERSION) {
    return buildLegacyPrintHtml(rawBody, fromDisplay)
  }

  const letter = letterForPrint(parsed, { fromDisplay, anonymous })
  const fontId = normalizeOwlFontId(letter.font)
  const fontFamily = owlFontStack(fontId)
  const treatmentClass = owlFontPrintClass(fontId)
  const fullBleed = Boolean(letter.image && isFullBleedImage(letter.imageLayout))
  const fromName = escapeHtml(letter.fromName || fromDisplay || 'A friend')
  const toName = escapeHtml(letter.toName || 'You')
  const dateHtml = letter.showDate !== false
    ? `<div class="date">${escapeHtml(formatLetterDate(letter.date))}</div>`
    : ''
  const content = prefersFlowLayout(letter)
    ? flowContentHtml(letter)
    : canvasContentHtml(letter)

  const letterClass = `letter${treatmentClass}${fullBleed ? ' full-bleed' : ''}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Letter</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="${letterClass}" style="font-family:${fontFamily}">
    ${letter.showStamp !== false ? STAMP_HTML : ''}
    <div class="letter-top">
      <div class="meta">
        <div><span class="label">From</span>${fromName}</div>
        <div><span class="label">To</span>${toName}</div>
      </div>
      ${dateHtml}
    </div>
    ${content}
  </div>
</body>
</html>`
}

/**
 * Opens the OS print dialog with the letter contents.
 */
export function printOwlLetter({ body, fromDisplay, anonymous }) {
  const trimmed = String(body ?? '').trim()
  if (!trimmed) {
    return Promise.reject(new Error('Letter is empty or not ready to print.'))
  }

  const parsed = parseOwlLetterBody(trimmed)
  const letter = letterForPrint(parsed, { fromDisplay, anonymous })
  const hasBlocks = letter.blocks?.some((b) => String(b.text || '').trim())
  if (!hasBlocks && !letter.body?.trim() && !letter.image) {
    return Promise.reject(new Error('Letter is empty or not ready to print.'))
  }

  const html = buildOwlLetterPrintHtml(trimmed, { fromDisplay, anonymous })

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = win?.document
    if (!doc) {
      iframe.remove()
      reject(new Error('Could not open print view.'))
      return
    }

    let settled = false
    const finish = (err) => {
      if (settled) return
      settled = true
      setTimeout(() => iframe.remove(), 400)
      if (err) reject(err)
      else resolve()
    }

    const runPrint = () => {
      try {
        win.focus()
        win.print()
      } catch (err) {
        finish(err instanceof Error ? err : new Error('Print failed.'))
        return
      }

      if (typeof win.matchMedia === 'function') {
        const mq = win.matchMedia('print')
        const onChange = (e) => {
          if (!e.matches) {
            mq.removeEventListener('change', onChange)
            finish()
          }
        }
        mq.addEventListener('change', onChange)
      }

      win.addEventListener('afterprint', () => finish(), { once: true })
      setTimeout(() => finish(), 120_000)
    }

    doc.open()
    doc.write(html)
    doc.close()

    if (doc.readyState === 'complete') {
      setTimeout(runPrint, 400)
    } else {
      iframe.onload = () => setTimeout(runPrint, 400)
    }
  })
}

export function canUseBrowserPrint() {
  return typeof window !== 'undefined' && typeof window.print === 'function'
}
