import { ProfileAvatar } from '../components/FrogLogo'
import ThemeControls from '../components/ThemeControls'
import InviteGenerator from '../components/InviteGenerator'

const OnboardingSuccess = ({ profile, bootstrapSignup, inviterName, onContinue }) => {
  const name = profile?.frenName
  const isFirst = Boolean(bootstrapSignup)

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md text-center">
        <ProfileAvatar
          profile={profile}
          className="w-24 h-24 mx-auto mb-6"
          logoClassName="w-14 h-auto"
        />

        <h1 className="text-3xl sm:text-4xl mb-4">Welcome to the cave!</h1>

        {isFirst ? (
          <p className="text-lg frens-body-text mb-2">
            You&apos;re the first fren{name ? `, ${name}` : ''}.
          </p>
        ) : (
          <p className="text-lg frens-body-text mb-2">
            You&apos;re in{name ? `, ${name}` : ''}.
            {inviterName ? (
              <>
                {' '}
                <span className="frens-stat">{inviterName}</span> invited you.
              </>
            ) : null}
          </p>
        )}

        {profile?.oneHumanThing && (
          <p className="text-sm frens-muted mb-2 italic">&ldquo;{profile.oneHumanThing}&rdquo;</p>
        )}
        {profile?.bio && (
          <p className="text-sm frens-body-text mb-4">{profile.bio}</p>
        )}

        <p className="text-sm frens-muted mb-6">
          {isFirst
            ? 'Invite a few frens to get the cave moving.'
            : 'Follow your inviter, say hi, and explore when you are ready.'}
        </p>

        {isFirst ? (
          <div className="text-left mb-8">
            <InviteGenerator compact />
          </div>
        ) : null}

        <button
          type="button"
          className="frens-btn-primary px-8 py-4 text-lg"
          onClick={() => onContinue?.()}
        >
          Go to Home
        </button>
      </div>
    </div>
  )
}

export default OnboardingSuccess
