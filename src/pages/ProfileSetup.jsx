import { useState, useRef } from 'react'
import { ProfileAvatar } from '../components/FrogLogo'
import { sanitizeImage } from '../lib/media'
import ThemeControls from '../components/ThemeControls'

const ProfileSetup = ({ onComplete, onBack }) => {
  const [bio, setBio] = useState('')
  const [shareLocation, setShareLocation] = useState(false)
  const [avatarType, setAvatarType] = useState('frog')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef(null)

  const previewProfile = { avatarType, avatarPreview }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }

    try {
      const { dataUrl } = await sanitizeImage(file, { maxDimension: 256 })
      setAvatarType('photo')
      setAvatarPreview(dataUrl)
    } catch (err) {
      setPhotoError(err.message || 'Could not process that image.')
    }
  }

  function handleChooseFrog() {
    setAvatarType('frog')
    setAvatarPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    onComplete?.({
      bio: bio.trim(),
      shareLocation,
      avatarType,
      avatarPreview: avatarType === 'photo' ? avatarPreview : null,
    })
  }

  return (
    <div className="frens-screen relative">
      <ThemeControls className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl mb-8 text-center">
          Let&apos;s finish setting up your fren profile
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <p className="frens-label mb-4 text-center">Profile Picture</p>
            <div className="flex flex-col items-center gap-4">
              <ProfileAvatar
                profile={previewProfile}
                className="w-32 h-32"
                logoClassName="w-20 h-auto"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleChooseFrog}
                  className={`frens-btn-outline px-4 py-2 ${avatarType === 'frog' ? 'border-[#6BC06B] text-[#6BC06B] dark:border-white dark:text-white' : ''}`}
                >
                  Choose pixel avatar
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`frens-btn-outline px-4 py-2 ${avatarType === 'photo' ? 'border-[#6BC06B] text-[#6BC06B] dark:border-white dark:text-white' : ''}`}
                >
                  Upload photo
                </button>
              </div>
              {photoError && (
                <p className="text-xs text-red-500 dark:text-red-400">{photoError}</p>
              )}
              <p className="text-xs frens-hint text-center max-w-xs">
                Photos are stripped of location &amp; timestamp data before they leave your device.
              </p>
            </div>
          </section>

          <section>
            <label htmlFor="bio" className="block frens-label mb-2">
              Bio <span className="frens-hint">(optional)</span>
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="I love drawing frogs and sending real letters..."
              rows={3}
              className="frens-input"
            />
          </section>

          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm frens-body-text">Share my city on Echoes</p>
                <p className="text-xs frens-hint mt-1">Only city level, never exact location</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={shareLocation}
                onClick={() => setShareLocation((prev) => !prev)}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                  shareLocation
                    ? 'bg-black dark:bg-white'
                    : 'bg-gray-200 border border-frens dark:bg-gray-800'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-transform ${
                    shareLocation
                      ? 'translate-x-5 bg-white dark:bg-black'
                      : 'translate-x-0 bg-gray-400 dark:bg-gray-500'
                  }`}
                />
              </button>
            </div>
          </section>

          <button type="submit" className="frens-btn-primary w-full px-8 py-4 text-lg">
            Continue to account
          </button>
        </form>

        {onBack && (
          <p className="text-center text-sm frens-muted mt-6">
            <button
              type="button"
              onClick={onBack}
              className="underline hover:text-black dark:hover:text-white transition"
            >
              Back to handle
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

export default ProfileSetup
