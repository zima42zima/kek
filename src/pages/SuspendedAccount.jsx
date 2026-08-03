import { useAuth } from '../context/AuthContext'

export default function SuspendedAccount() {
  const { accountStatus, signOut } = useAuth()
  const reason = accountStatus?.suspendedReason

  return (
    <div className="frens-screen px-6 text-center max-w-md">
      <h1 className="frens-title-lg mb-2">Account paused</h1>
      <p className="text-sm frens-muted leading-relaxed">
        Your access to Misao has been suspended after a review.
        {reason ? ` Reason: ${reason}` : ''}
      </p>
      <p className="text-xs frens-muted mt-4">
        If you think this was a mistake, reach out to the team off-app.
      </p>
      <button
        type="button"
        onClick={signOut}
        className="frens-btn-outline mt-8 px-6 py-2.5 text-sm"
      >
        Sign out
      </button>
    </div>
  )
}
