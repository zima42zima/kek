import { useState } from 'react'
import ReportContentModal from './ReportContentModal'
import { FlagIcon } from './icons/UiIcons'

/**
 * Opens the in-app report modal and files a platform report.
 * Hide for own content at the call site.
 *
 * Use `variant="flag"` for a compact icon button (echo preview, etc.).
 */
export default function ReportContentButton({
  kind = null,
  refId = null,
  reportedUserId = null,
  preview = '',
  subjectLabel = 'this content',
  label = 'Report',
  variant = 'text',
  className = 'text-[10px] frens-action shrink-0',
  disabled = false,
  reportFn = null,
  onReported,
}) {
  const [open, setOpen] = useState(false)

  if (!reportFn && (!refId || !kind)) return null

  const isFlag = variant === 'flag'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={
          isFlag
            ? `inline-flex items-center justify-center shrink-0 rounded-full frens-muted hover:text-black dark:hover:text-white transition disabled:opacity-40 ${className}`
            : className
        }
        aria-label={isFlag ? `Report ${subjectLabel}` : undefined}
        title={isFlag ? `Report ${subjectLabel}` : undefined}
      >
        {isFlag ? <FlagIcon className="w-3.5 h-3.5" /> : label}
      </button>
      <ReportContentModal
        open={open}
        kind={kind}
        refId={refId}
        reportedUserId={reportedUserId}
        preview={preview}
        subjectLabel={subjectLabel}
        reportFn={reportFn}
        onClose={() => setOpen(false)}
        onReported={onReported}
      />
    </>
  )
}
