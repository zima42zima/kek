import React from 'react'
import FrogLogo from '../components/FrogLogo'
import ThemeControls from '../components/ThemeControls'

const Onboarding = ({ onContinue, onLogin }) => {
  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <FrogLogo className="w-28 h-28 sm:w-32 sm:h-32 mb-8 mx-auto" />

      <h1 className="text-4xl mb-4 text-center">welcome fren</h1>

      <p className="text-xl text-center max-w-md mb-8 frens-body-text">
        You made it inside the cave.<br />
        No titles. No masks. Just you — silly, real, human.
      </p>

      <button
        className="frens-btn-primary px-8 py-4 text-lg"
        onClick={() => onContinue?.()}
      >
        Yes, I&apos;m a real fren
      </button>

      {onLogin && (
        <p className="text-center text-sm frens-muted mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onLogin()}
            className="underline hover:text-black dark:hover:text-white transition"
          >
            Log in
          </button>
        </p>
      )}
    </div>
  )
}

export default Onboarding
