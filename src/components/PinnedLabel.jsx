import { PinIcon } from './icons/UiIcons'

export default function PinnedLabel({ className = '' }) {
  return (
    <span className={`text-[10px] frens-muted inline-flex items-center gap-0.5 shrink-0 ${className}`}>
      <PinIcon className="w-3 h-3" />
      pinned
    </span>
  )
}
