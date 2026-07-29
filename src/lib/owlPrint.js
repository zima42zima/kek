import {
  parseOwlLetterBody,
  letterForPrint,
  formatLetterDate,
  letterBlockStyle,
  OWL_LETTER_VERSION,
  LETTER_CANVAS_VERSION,
} from './owlLetterFormat'
import { normalizeOwlFontId, owlFontStack, owlFontPrintClass, owlFontsStylesheetUrl } from './owlLetterFonts'
import { normalizeImageLayout } from './letterImageLayout'
import { APP_NAME } from './brand'
import { PS_STAMP_HTML } from './psStampMarkup'

const STAMP_HTML = PS_STAMP_HTML

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PRINT_STYLES = `
  @import url('${owlFontsStylesheetUrl()}');
  @page { margin: 0.5in; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .letter {
    background-color: #fff;
    box-shadow: none;
    border: 2px solid #000;
    position: relative;
    width: 8.5in;
    min-height: 11in;
    margin: 0 auto;
    padding: 0.75in;
    font-size: 14pt;
    line-height: 1.65;
    color: #000;
    box-sizing: border-box;
  }
  .letter.handwritten { font-size: 15.5pt; line-height: 1.75; }
  .letter.script { font-size: 17pt; line-height: 1.55; }
  .letter.pixel { font-size: 17pt; line-height: 1.45; letter-spacing: 0.06em; }
  .letter.mono { font-size: 13pt; line-height: 1.6; letter-spacing: 0.02em; }
  .letter::before {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px solid #000;
    pointer-events: none;
  }
  .post-stamp {
    position: absolute;
    top: 0.35in;
    right: 0.35in;
    pointer-events: none;
    opacity: 0.9;
  }
  .post-stamp svg {
    width: 0.84in;
    height: 0.84in;
    display: block;
  }
  .letter-header { font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.15em; text-transform: uppercase; color: #000; }
  .meta-row { margin-bottom: 2rem; font-size: 13pt; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 0.35in 0; }
  .meta-row div { margin: 0.15rem 0; }
  .greeting { margin-bottom: 1.25rem; font-size: 16pt; font-weight: 500; }
  .body { white-space: pre-wrap; margin-bottom: 2rem; min-height: 2in; }
  .letter-image-wrap { position: absolute; box-sizing: border-box; }
  .letter-image { display: block; width: 100%; height: auto; object-fit: contain; border: 1px solid #ccc; }
  .closing { font-size: 15pt; margin-bottom: 0.25rem; }
  .signature { font-size: 16pt; font-weight: 500; }
  .canvas-block { position: absolute; white-space: pre-wrap; box-sizing: border-box; }
  .canvas-body { position: relative; min-height: 6in; margin-bottom: 1rem; }
  .footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid #000; text-align: center; font-size: 8pt; letter-spacing: 0.15em; color: #666; text-transform: uppercase; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-right: 1in; }
  .brand-title { font-size: 20pt; font-weight: 700; color: #000; letter-spacing: 0.2em; }
  .brand-sub { font-size: 8pt; letter-spacing: 0.25em; color: #666; margin-top: 2pt; text-transform: uppercase; }
  .date { text-align: right; font-size: 11pt; color: #333; }
`

function buildLegacyPrintHtml(body, fromDisplay) {
  const safeFrom = escapeHtml(fromDisplay || 'a fren')
  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br/>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Letter</title>
<style>@page{margin:1.2in}body{font-family:Georgia,serif;color:#111;line-height:1.55;padding:0.5in}.meta{font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.5rem;color:#555}.body{font-size:15px;white-space:pre-wrap}</style></head>
<body><div class="meta">P.S. · from ${safeFrom}</div><div class="body">${bodyHtml}</div></body></html>`
}

function blocksPrintHtml(letter) {
  if (!letter.blocks?.length) return ''
  return letter.blocks.map((block) => {
    const style = letterBlockStyle(block)
    const css = [
      `left:${style.left}`,
      `top:${style.top}`,
      `width:${style.width}`,
      `font-size:${style.fontSize}`,
      `font-family:${style.fontFamily}`,
      `font-weight:${style.fontWeight}`,
      `font-style:${style.fontStyle}`,
      `text-decoration:${style.textDecoration}`,
      `text-align:${style.textAlign}`,
      `line-height:${style.lineHeight}`,
    ].join(';')
    return `<div class="canvas-block" style="${css}">${escapeHtml(block.text).replace(/\n/g, '<br/>')}</div>`
  }).join('')
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
  const imageHtml = letter.image
    ? (() => {
      const img = normalizeImageLayout(letter.imageLayout)
      return `<div class="letter-image-wrap" style="left:${img.x}%;top:${img.y}%;width:${img.w}%;"><img class="letter-image" src="${letter.image.replace(/"/g, '&quot;')}" alt="" /></div>`
    })()
    : ''

  const canvasHtml = letter.blocks?.length
    ? `<div class="canvas-body">${blocksPrintHtml(letter)}</div>`
    : `<div class="body">${escapeHtml(letter.body).replace(/\n/g, '<br/>')}</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Letter</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="letter${treatmentClass}" style="font-family:${fontFamily}">
    ${letter.showStamp !== false ? STAMP_HTML : ''}
    <div class="head">
      <div class="brand">
        <div class="brand-title letter-header">P.S.</div>
        <div class="brand-sub">From ${APP_NAME}</div>
      </div>
      ${letter.showDate !== false ? `<div class="date">${escapeHtml(formatLetterDate(letter.date))}</div>` : ''}
    </div>
    <div class="meta-row">
      <div><strong>From</strong> ${escapeHtml(letter.fromName || fromDisplay || 'A friend')}</div>
      <div><strong>To</strong> ${escapeHtml(letter.toName || 'You')}</div>
    </div>
    ${imageHtml}
    ${canvasHtml}
    <div class="footer">Sent with care via ${APP_NAME} · Keep it human</div>
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
