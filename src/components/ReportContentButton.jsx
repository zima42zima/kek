import { useState } from 'react'
import ReportContentModal from './ReportContentModal'

/**
 * Opens the in-app report modal and files a platform report.
 * Hide for own content at the call site.
 */
export default function ReportContentButton({
  kind = null,
  refId = null,
  reportedUserId = null,
  preview = '',
  subjectLabel = 'this content',
  label = 'Report',
  className = 'text-[10px] frens-action shrink-0',
  disabled = false,
  reportFn = null,
  onReported,
}) {
  const [open, setOpen] = useState(false)

  if (!reportFn && (!refId || !kind)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
      >
        {label}
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
