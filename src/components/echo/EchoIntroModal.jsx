import Modal from '../Modal'
import EchoIcon from './EchoIcon'
import { MapIcon } from '../icons/UiIcons'
import { ECHO_DISCOVER_RADIUS_MIN_M, ECHO_PIN_OFFSET_MAX_M } from '../../lib/echoConstants'

export default function EchoIntroModal({ onClose, onStart }) {
  return (
    <Modal title="Echo" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4 text-center">
        <MapIcon className="w-12 h-12 mx-auto opacity-70" />
        <p className="text-sm frens-body-text">
          Turn places into meme spots — drop images for nearby frens to find, or keep private memories on your map.
        </p>
        <ol className="text-left text-xs frens-muted space-y-2 list-decimal list-inside">
          <li>Enable location — we scatter pins up to {ECHO_PIN_OFFSET_MAX_M}m from your spot</li>
          <li>Drop a meme or photo — the main way to leave an echo</li>
          <li>Optionally leave voice or short glitchy video instead</li>
          <li>Choose who can find it and how close they must be (420m – city)</li>
          <li>Scroll the in-range gallery when you walk into discoverable echoes</li>
          <li>Bats show approximate areas — nobody knows the exact spot</li>
        </ol>
        <p className="text-[11px] frens-hint text-left">
          Public meme spots can reveal you were somewhere. Only share on the map when you&apos;re comfortable with that.
        </p>
        <button type="button" onClick={onStart} className="frens-btn-primary w-full py-3 text-sm inline-flex items-center justify-center gap-2">
          <EchoIcon className="w-5 h-4" /> Drop your first meme spot
        </button>
      </div>
    </Modal>
  )
}
