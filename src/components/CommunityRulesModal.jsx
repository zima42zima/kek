import Modal from './Modal'
import CommunityRulesContent from './CommunityRulesContent'

export default function CommunityRulesModal({ open, onClose }) {
  if (!open) return null

  return (
    <Modal title="Community rules" onClose={onClose} maxWidth="max-w-md">
      <CommunityRulesContent />
    </Modal>
  )
}
