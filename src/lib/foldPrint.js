/**
 * Print Folds — rasterize to simple JPEG sheet(s), then print that image.
 *
 * Printers often fail (“communication failed”) on huge multi-image HTML jobs.
 * We paint the full A4 layout onto one canvas → one JPEG → tiny print page.
 */
import {
  ZINE_PRINT_GRID,
  foldFormatById,
  normalizeImageTransform,
  zineLayoutMm,
  FOLD_PRINT_MARGIN_MM,
} from './foldFormats'

/** ~180 DPI A4 landscape: reliable quality without oversized spool jobs */
const A4_LANDSCAPE_PX = { w: 2102, h: 1488 }
const A4_PORTRAIT_PX = { w: 1488, h: 2102 }
const SHEET_JPEG_QUALITY = 0.9
/** Source panel decode cap before drawing onto the sheet */
const PANEL_DECODE_MAX = 900

export function canUseBrowserPrint() {
  return typeof window !== 'undefined' && typeof window.print === 'function'
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for print.'))
    img.src = src
  })
}

/**
 * Re-encode any image as a plain JPEG (white bg). Used for single-page folds too.
 */
export async function toPrintJpeg(dataUrl, {
  maxDimension = PANEL_DECODE_MAX,
  quality = 0.88,
} = {}) {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl
  const img = await loadImage(dataUrl)
  const nw = img.naturalWidth || img.width
  const nh = img.naturalHeight || img.height
  const scale = Math.min(1, maxDimension / Math.max(nw, nh, 1))
  const width = Math.max(1, Math.round(nw * scale))
  const height = Math.max(1, Math.round(nh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  try {
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}

/**
 * Draw one panel into a cell rectangle (contain + transform + optional cell rotate).
 */
function drawPanelInCell(ctx, img, cellX, cellY, cellW, cellH, {
  cellRotate = 0,
  transform = null,
  margins = false,
} = {}) {
  if (!img) return
  const t = normalizeImageTransform(transform)
  const pad = margins ? Math.min(cellW, cellH) * 0.06 : 0
  const boxX = cellX + pad
  const boxY = cellY + pad
  const boxW = cellW - pad * 2
  const boxH = cellH - pad * 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(cellX, cellY, cellW, cellH)
  ctx.clip()

  const cx = cellX + cellW / 2
  const cy = cellY + cellH / 2
  if (cellRotate) {
    ctx.translate(cx, cy)
    ctx.rotate((cellRotate * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }

  // Match CSS: object-fit contain in box, then transform from center
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const fit = Math.min(boxW / iw, boxH / ih)
  const dw = iw * fit
  const dh = ih * fit
  const ox = boxX + (boxW - dw) / 2
  const oy = boxY + (boxH - dh) / 2

  const tcx = boxX + boxW / 2
  const tcy = boxY + boxH / 2
  ctx.translate(tcx, tcy)
  ctx.translate((t.x / 100) * boxW, (t.y / 100) * boxH)
  ctx.rotate((t.rotate * Math.PI) / 180)
  ctx.scale(t.scale, t.scale)
  ctx.translate(-tcx, -tcy)

  ctx.drawImage(img, ox, oy, dw, dh)
  ctx.restore()
}

function drawCellBorder(ctx, x, y, w, h) {
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}

/**
 * Paint the full A4 landscape zine onto one canvas → JPEG data URL.
 */
export async function renderZineSheetJpeg(fold, {
  width = A4_LANDSCAPE_PX.w,
  height = A4_LANDSCAPE_PX.h,
  quality = SHEET_JPEG_QUALITY,
} = {}) {
  const layout = zineLayoutMm()
  // Fixed sheet margin only (FOLD_PRINT_MARGIN_MM) — no extra per-panel inset
  const sx = width / layout.pageW
  const sy = height / layout.pageH

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const gridX = layout.offsetX * sx
  const gridY = layout.offsetY * sy
  const cellW = layout.square * sx
  const cellH = layout.square * sy

  // Preload all panel images
  const imgs = {}
  await Promise.all(
    ZINE_PRINT_GRID.map(async (cell) => {
      const slot = fold.panels?.[cell.panelId]
      if (slot?.kind === 'image' && slot.dataUrl) {
        try {
          // Decode via modest JPEG first for memory
          const jpg = await toPrintJpeg(slot.dataUrl, { maxDimension: PANEL_DECODE_MAX })
          imgs[cell.panelId] = await loadImage(jpg)
        } catch {
          imgs[cell.panelId] = null
        }
      }
    }),
  )

  ZINE_PRINT_GRID.forEach((cell, i) => {
    const col = i % layout.cols
    const row = Math.floor(i / layout.cols)
    const x = gridX + col * cellW
    const y = gridY + row * cellH
    const slot = fold.panels?.[cell.panelId]
    const img = imgs[cell.panelId]

    // Empty cell
    if (!img) {
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(x, y, cellW, cellH)
      drawCellBorder(ctx, x, y, cellW, cellH)
      return
    }

    drawPanelInCell(ctx, img, x, y, cellW, cellH, {
      cellRotate: cell.rotate || 0,
      transform: slot?.transform,
      margins: false,
    })
    drawCellBorder(ctx, x, y, cellW, cellH)
  })

  // Center cut mark (middle half of horizontal fold)
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.setLineDash([6, 5])
  ctx.lineWidth = Math.max(1, width / 900)
  const cutY = gridY + cellH
  const cutX0 = gridX + cellW
  const cutX1 = gridX + cellW * 3
  ctx.beginPath()
  ctx.moveTo(cutX0, cutY)
  ctx.lineTo(cutX1, cutY)
  ctx.stroke()
  ctx.restore()

  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Paint one A4 portrait page → JPEG.
 * Content sits inside fixed equal FOLD_PRINT_MARGIN_MM on all sides.
 */
export async function renderPageJpeg(slot, {
  width = A4_PORTRAIT_PX.w,
  height = A4_PORTRAIT_PX.h,
  quality = SHEET_JPEG_QUALITY,
  /** @deprecated ignored — margin is always FOLD_PRINT_MARGIN_MM */
  margins: _legacyMargins,
} = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Equal mm margin on all four sides of A4 portrait (210 × 297)
  const mx = (FOLD_PRINT_MARGIN_MM / 210) * width
  const my = (FOLD_PRINT_MARGIN_MM / 297) * height
  const contentW = width - mx * 2
  const contentH = height - my * 2

  if (slot?.kind === 'image' && slot.dataUrl) {
    try {
      const jpg = await toPrintJpeg(slot.dataUrl, { maxDimension: 1600 })
      const img = await loadImage(jpg)
      drawPanelInCell(ctx, img, mx, my, contentW, contentH, {
        transform: slot.transform,
        margins: false,
      })
    } catch { /* empty white page */ }
  }

  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Build print HTML that only embeds one or more full-page JPEG images.
 * Much more reliable for real printers than multi-panel CSS HTML.
 */
function buildJpegSheetPrintHtml({
  title,
  formatLabel,
  pageHint,
  images,
  landscape = true,
}) {
  const safeTitle = escapeHtml(title || 'Fold')
  const safeFormat = escapeHtml(formatLabel || 'FOLD')
  const imgs = (images || [])
    .map(
      (src, i) =>
        `<img class="sheet" src="${src}" alt="Print page ${i + 1}" />`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Print · ${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: #0a0a0a; color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media screen {
      body {
        min-height: 100vh;
        padding: 20px 16px 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .chrome {
        width: 100%;
        max-width: 420px;
        margin: 0 auto 20px;
        text-align: center;
      }
      .chrome .meta {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #666;
        margin: 0 0 6px;
      }
      .chrome h1 {
        font-size: 1.125rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin: 0 0 18px;
        color: #f5f5f5;
        line-height: 1.25;
      }
      .actions {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        margin: 0 0 12px;
      }
      .actions-row {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      .btn {
        appearance: none;
        border: none;
        border-radius: 999px;
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s ease, background 0.15s ease;
      }
      .btn:active { opacity: 0.85; }
      .btn-print {
        background: #fff;
        color: #111;
        padding: 13px 28px;
        width: 100%;
      }
      .btn-dl, .btn-close {
        background: transparent;
        color: #a3a3a3;
        border: 1px solid #333;
        padding: 10px 18px;
        font-weight: 500;
        font-size: 0.8125rem;
        flex: 1;
      }
      .btn-dl:hover, .btn-close:hover {
        color: #fff;
        border-color: #555;
      }
      .hint {
        font-size: 0.6875rem;
        color: #555;
        margin: 0;
        line-height: 1.45;
        letter-spacing: 0.01em;
      }
      .preview {
        width: 100%;
        max-width: 720px;
        margin: 0 auto;
        padding: 0;
        background: transparent;
      }
      .sheet {
        display: block;
        width: 100%;
        height: auto;
        background: #fff;
        margin: 0 auto 12px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      }
    }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; }
      .chrome { display: none !important; }
      .preview { margin: 0 !important; padding: 0 !important; max-width: none !important; }
      @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
      .sheet {
        width: ${landscape ? '297mm' : '210mm'} !important;
        height: ${landscape ? '210mm' : '297mm'} !important;
        max-width: none !important;
        object-fit: fill;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        page-break-after: always;
        page-break-inside: avoid;
        display: block;
      }
      .sheet:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="chrome">
    <p class="meta">${safeFormat}${pageHint ? ` · ${escapeHtml(pageHint)}` : ''}</p>
    <h1>${safeTitle}</h1>
    <div class="actions">
      <button type="button" class="btn btn-print" id="btn-print">Print</button>
      <div class="actions-row">
        <button type="button" class="btn btn-dl" id="btn-download">Download JPG</button>
        <button type="button" class="btn btn-close" id="btn-close">Close</button>
      </div>
    </div>
    <p class="hint">One JPG sheet · if print fails, download and open in Preview</p>
  </div>
  <div class="preview">
    ${imgs}
  </div>
  <script>
    (function () {
      var sheets = Array.prototype.slice.call(document.querySelectorAll('img.sheet'));
      function doPrint() {
        try { window.focus(); window.print(); } catch (e) {}
      }
      function waitReady(cb) {
        if (!sheets.length) { cb(); return; }
        var left = sheets.length, done = false;
        function finish() { if (done) return; done = true; cb(); }
        var t = setTimeout(finish, 5000);
        function one() { left -= 1; if (left <= 0) { clearTimeout(t); finish(); } }
        sheets.forEach(function (img) {
          if (img.complete && img.naturalWidth) one();
          else {
            img.addEventListener('load', one, { once: true });
            img.addEventListener('error', one, { once: true });
          }
        });
      }
      document.getElementById('btn-print').addEventListener('click', doPrint);
      document.getElementById('btn-close').addEventListener('click', function () {
        try { window.close(); } catch (e) {}
      });
      document.getElementById('btn-download').addEventListener('click', function () {
        sheets.forEach(function (img, i) {
          var a = document.createElement('a');
          a.href = img.src;
          a.download = (document.title || 'fold').replace(/^Print ·\\s*/, '') + (sheets.length > 1 ? ('-' + (i + 1)) : '') + '.jpg';
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
      });
      waitReady(function () { setTimeout(doPrint, 150); });
    })();
  </script>
</body>
</html>`
}

function writeLoadingDoc(win, title = 'Preparing print…', detail = 'Building print JPG…') {
  if (!win?.document) return
  try {
    win.document.open()
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;
  background:#111;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
  p{margin:8px 0;color:#aaa;font-size:14px;max-width:300px;line-height:1.4}
  strong{color:#fff}
</style></head><body>
  <div>
    <p><strong>${escapeHtml(title)}</strong></p>
    <p>${escapeHtml(detail)}</p>
  </div>
</body></html>`)
    win.document.close()
  } catch { /* ignore */ }
}

function openPrintHtml(html) {
  let url
  try {
    url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  } catch (err) {
    return Promise.reject(new Error(err?.message || 'Could not prepare print file.'))
  }

  let w = null
  try {
    w = window.open(url, '_blank')
  } catch {
    w = null
  }

  if (w) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch { /* ignore */ }
    }, 120_000)
    try {
      w.focus()
    } catch { /* ignore */ }
    return Promise.resolve({ ok: true, mode: 'window' })
  }

  try {
    window.location.assign(url)
    return Promise.resolve({ ok: true, mode: 'sameTab' })
  } catch {
    return Promise.reject(new Error('Pop-up blocked. Allow pop-ups, then try Print again.'))
  }
}

/**
 * Rasterize fold → simple full-page JPEG(s) → open print page.
 */
export async function printFold(fold) {
  if (!fold) throw new Error('No fold to print.')
  if (typeof window === 'undefined') throw new Error('Print only works in the browser.')

  // Open tab during click (before await)
  let prepWin = null
  try {
    prepWin = window.open('about:blank', '_blank')
  } catch {
    prepWin = null
  }
  if (prepWin) {
    writeLoadingDoc(prepWin, 'Preparing print…', 'Rendering sheet as one JPG for your printer…')
  }

  const format = foldFormatById(fold.formatId)
  const title = fold.title || 'Fold'
  const formatLabel = format?.label || fold.formatId || 'FOLD'
  const isZine = fold.formatId === 'zine'

  let images = []
  try {
    if (isZine) {
      const sheet = await renderZineSheetJpeg(fold)
      images = [sheet]
    } else {
      const pages = (fold.pages || []).filter(Boolean)
      if (pages.length === 0) {
        throw new Error('Nothing to print — add an image first.')
      }
      images = await Promise.all(pages.map((slot) => renderPageJpeg(slot)))
    }
  } catch (err) {
    try {
      prepWin?.close()
    } catch { /* ignore */ }
    throw new Error(err?.message || 'Could not build print JPG.')
  }

  const html = buildJpegSheetPrintHtml({
    title,
    formatLabel,
    pageHint: isZine
      ? 'A4 landscape · single-sided'
      : images.length > 1
        ? `A4 · ${images.length} pages`
        : 'A4 portrait',
    images,
    landscape: isZine,
  })

  if (prepWin && !prepWin.closed) {
    try {
      prepWin.document.open()
      prepWin.document.write(html)
      prepWin.document.close()
      try {
        prepWin.focus()
      } catch { /* ignore */ }
      return { ok: true, mode: 'window' }
    } catch {
      try {
        prepWin.close()
      } catch { /* ignore */ }
    }
  }

  return openPrintHtml(html)
}

/** @deprecated HTML multi-panel path kept for any external import; prefer printFold. */
export function buildFoldPrintHtml(fold) {
  // Minimal stub — real path is JPEG sheet
  const title = escapeHtml(fold?.title || 'Fold')
  return `<!DOCTYPE html><html><body><p>Use printFold() for JPEG sheet print (${title}).</p></body></html>`
}
