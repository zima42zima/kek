import { useState } from 'react'
import Modal from '../Modal'
import {
  foldFormatById,
  ZINE_PRINT_GRID,
  ZINE_FOLD_GUIDE,
  countFilled,
  FOLD_PRINT_MARGIN_MM,
  foldPrintMarginInset,
} from '../../lib/foldFormats'
import { printFold, canUseBrowserPrint } from '../../lib/foldPrint'
import FoldImageFill from './FoldImageFill'

/** One A4 landscape sheet (zine) or stacked A4 pages — as printed. */
function FoldPrintPreview({ fold }) {
  const isZine = fold.formatId === 'zine'
  const m = FOLD_PRINT_MARGIN_MM

  if (isZine) {
    const gridW = ((297 - m * 2) / 297) * 100
    const squareMm = (297 - m * 2) / 4
    const gridH = ((squareMm * 2) / 210) * 100
    const topPct = ((210 - squareMm * 2) / 2 / 210) * 100
    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <p className="text-[10px] frens-muted uppercase tracking-wide">
            Print sheet · 8 pages · {m} mm margin
          </p>
          <p className="text-[10px] frens-muted">297 × 210 mm</p>
        </div>
        <div
          className="relative border frens-border rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 mx-auto w-full max-w-xl shadow-md"
          style={{ aspectRatio: '297 / 210' }}
        >
          <div
            className="absolute bg-white shadow-sm"
            style={{
              left: `${(m / 297) * 100}%`,
              top: `${topPct}%`,
              width: `${gridW}%`,
              height: `${gridH}%`,
            }}
          >
            <div className="grid grid-cols-4 grid-rows-2 h-full w-full">
              {ZINE_PRINT_GRID.map((cell, i) => {
                const slot = fold.panels?.[cell.panelId]
                return (
                  <div
                    key={`${cell.panelId}-${i}`}
                    className="relative overflow-hidden border border-black/10"
                  >
                    <div
                      className="absolute inset-0"
                      style={{ transform: cell.rotate ? `rotate(${cell.rotate}deg)` : undefined }}
                    >
                      {slot ? (
                        <FoldImageFill slot={slot} sheetMargins={false} />
                      ) : (
                        <div className="absolute inset-0 bg-neutral-50" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div
              className="pointer-events-none absolute left-1/4 right-1/4 top-1/2 border-t border-dashed border-black/30"
              aria-hidden
            />
          </div>
        </div>
        <details className="border frens-border rounded-xl p-3 text-xs frens-muted">
          <summary className="cursor-pointer text-black dark:text-white font-medium tracking-wide text-[11px] uppercase">
            How to fold after print
          </summary>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside">
            {ZINE_FOLD_GUIDE.map((g) => (
              <li key={g.step}>{g.text}</li>
            ))}
          </ol>
        </details>
      </div>
    )
  }

  const pages = (fold.pages || []).filter(Boolean)
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <p className="text-[10px] frens-muted uppercase tracking-wide">
          {pages.length <= 1 ? 'A4 print preview' : `${pages.length} × A4 pages`}
          {` · ${m} mm margin`}
        </p>
        <p className="text-[10px] frens-muted">210 × 297 mm</p>
      </div>
      {pages.map((slot, i) => (
        <div
          key={i}
          className="relative border frens-border rounded-xl overflow-hidden bg-white mx-auto w-full max-w-xs shadow-md aspect-[210/297]"
        >
          <FoldImageFill slot={slot} sheetMargins />
          <div
            className="pointer-events-none absolute border border-dashed border-black/20 rounded-sm"
            style={foldPrintMarginInset(false)}
            aria-hidden
          />
        </div>
      ))}
    </div>
  )
}

/**
 * Two steps only: 1) Preview sheet  2) Print → OS printer dialog.
 */
export default function FoldViewerModal({
  fold,
  onClose,
  titleExtra = null,
  footer = null,
  showPrint = true,
  subtitle = null,
}) {
  /** 1 = preview, 2 = ready to print */
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!fold) return null
  const format = foldFormatById(fold.formatId)
  const isZine = fold.formatId === 'zine'
  const printOk = canUseBrowserPrint()

  function handlePrint() {
    if (!printOk) {
      setError('This browser cannot print. Try Safari or Chrome.')
      return
    }
    setBusy(true)
    setError('')
    // printFold opens a tab on this click, converts all panels to JPG, then prints.
    try {
      Promise.resolve(printFold(fold))
        .then((r) => {
          if (r?.mode === 'sameTab') return
          setBusy(false)
        })
        .catch((err) => {
          setError(
            err?.message
              || 'Could not open printer. Allow pop-ups for this site, then try again.',
          )
          setBusy(false)
        })
    } catch (err) {
      setError(err?.message || 'Could not open printer.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title={(
        <span className="min-w-0">
          <span className="block truncate">{fold.title || 'Fold'}</span>
          <span className="block text-[10px] frens-muted font-normal tracking-wide">
            {format?.label || fold.formatId}
            {fold.ownerName ? ` · ${fold.ownerName}` : ''}
            {' · '}
            {isZine ? `${countFilled(fold)}/8 panels` : `${countFilled(fold)} page(s)`}
          </span>
        </span>
      )}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      {titleExtra}

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span
          className={`text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded-full ${
            step === 1
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'border border-black/20 dark:border-white/30 frens-muted'
          }`}
        >
          1 · Preview
        </span>
        <span className="text-[10px] frens-muted" aria-hidden>
          →
        </span>
        <span
          className={`text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded-full ${
            step === 2
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'border border-black/20 dark:border-white/30 frens-muted'
          }`}
        >
          2 · Print
        </span>
      </div>

      {step === 1 ? (
        <>
          {subtitle ? (
            <p className="text-xs frens-muted mb-3 text-center">{subtitle}</p>
          ) : (
            <p className="text-xs frens-muted mb-3 text-center">
              Check the sheet looks right. Next step sends it to your printer.
            </p>
          )}

          <div className="letter-studio-ui max-h-[52vh] overflow-y-auto pb-2">
            <FoldPrintPreview fold={fold} />
          </div>

          {showPrint ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full px-4 py-2.5 text-sm border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setStep(2)
                }}
                className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium bg-black text-white dark:bg-white dark:text-black"
              >
                Continue to print
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="letter-studio-ui space-y-4 text-center py-2">
            <p className="text-sm text-black dark:text-white font-medium">
              Ready to print
            </p>
            <ul className="text-xs frens-muted max-w-sm mx-auto leading-relaxed text-left space-y-1.5 list-disc list-inside">
              {isZine ? (
                <>
                  <li>Paper: <strong className="text-black dark:text-white">A4</strong></li>
                  <li>Orientation: <strong className="text-black dark:text-white">Landscape</strong></li>
                  <li>Sides: <strong className="text-black dark:text-white">Single-sided</strong></li>
                  <li>
                    Built-in margin:{' '}
                    <strong className="text-black dark:text-white">{FOLD_PRINT_MARGIN_MM} mm equal</strong>
                    {' '}all sides
                  </li>
                  <li>Printer margins: <strong className="text-black dark:text-white">None</strong></li>
                </>
              ) : (
                <>
                  <li>Paper: <strong className="text-black dark:text-white">A4</strong></li>
                  <li>Orientation: <strong className="text-black dark:text-white">Portrait</strong></li>
                  <li>
                    Built-in margin:{' '}
                    <strong className="text-black dark:text-white">{FOLD_PRINT_MARGIN_MM} mm equal</strong>
                    {' '}all sides
                  </li>
                  <li>Printer margins: <strong className="text-black dark:text-white">None</strong></li>
                </>
              )}
              <li>
                If images look pale, enable{' '}
                <strong className="text-black dark:text-white">Background graphics</strong>
              </li>
            </ul>
            <p className="text-xs frens-muted max-w-sm mx-auto">
              Tap <strong className="text-black dark:text-white">Print</strong> — the whole sheet is rendered as{' '}
              <strong className="text-black dark:text-white">one JPG</strong> (easier for printers).
              If the printer still fails, use <strong className="text-black dark:text-white">Download JPG</strong> on the print page and print that file from Preview.
            </p>
          </div>

          {error ? (
            <p className="text-xs text-red-500 dark:text-red-400 text-center mt-2">{error}</p>
          ) : null}

          {showPrint ? (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setStep(1)
                  }}
                  className="flex-1 rounded-full px-4 py-2.5 text-sm border border-black/25 dark:border-white/35 text-black dark:text-white bg-transparent"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy || !printOk}
                  onClick={handlePrint}
                  className="flex-1 rounded-full px-4 py-3 text-sm font-semibold bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                >
                  {busy ? 'Building JPG sheet…' : 'Print'}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {footer ? <div className="mt-3">{footer}</div> : null}
    </Modal>
  )
}

export { FoldPrintPreview }
