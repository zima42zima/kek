import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePosts } from '../context/PostsContext'
import { ProfileAvatar } from './FrogLogo'
import AudienceSelect from './AudienceSelect'
import { SharedImage } from './SharedMedia'
import { prepareImageAttachment, finalizeImageUrl, finalizeGifUrl } from '../lib/imageAttach'
import { insertAtCaret } from '../lib/insertText'
import PillComposer from './PillComposer'
import PostMorseRule from './PostMorseRule'

export default function PostComposer({ collapsible = false }) {
  const { user, profile } = useAuth()
  const { addPost } = usePosts()
  const [open, setOpen] = useState(!collapsible)
  const [draft, setDraft] = useState('')
  const [attachedImage, setAttachedImage] = useState(null)
  const [attachedBlob, setAttachedBlob] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const [audience, setAudience] = useState('everyone')
  const [tagInput, setTagInput] = useState('')
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  function addEmoji(emoji) {
    setDraft((prev) => insertAtCaret(textareaRef.current, prev, emoji))
  }

  async function attachGif(url) {
    if (!url) return
    setImageError('')
    const image = await finalizeGifUrl(url, { prefix: 'posts' })
    setAttachedImage(image)
    setAttachedBlob(null)
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')

    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.')
      return
    }

    setImageBusy(true)
    try {
      const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 1600 })
      setAttachedImage(dataUrl)
      setAttachedBlob(blob)
    } catch (err) {
      setImageError(err.message || 'Could not process that image.')
    } finally {
      setImageBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function resetComposer() {
    setDraft('')
    setAttachedImage(null)
    setAttachedBlob(null)
    setTagInput('')
    setImageError('')
    setAudience('everyone')
    if (collapsible) setOpen(false)
  }

  async function handlePost(e) {
    e.preventDefault()
    const text = draft.trim()
    if ((!text && !attachedImage) || !profile || posting) return

    const tags =
      audience === 'other'
        ? tagInput.split(',').map((t) => t.trim().replace(/^@/, '')).filter(Boolean)
        : []

    setPosting(true)
    let image = attachedImage
    if (attachedBlob) {
      image = await finalizeImageUrl({ image: attachedImage, blob: attachedBlob, prefix: 'posts' })
    }

    try {
      await addPost({
        userId: user?.id ?? null,
        frenName: profile.frenName,
        avatarType: profile.avatarType,
        avatarUrl: profile.avatarUrl,
        text,
        image,
        audience,
        tags,
        timestamp: 'just now',
        echoes: 0,
        reactions: 0,
      })
      resetComposer()
    } finally {
      setPosting(false)
    }
  }

  if (collapsible && !open) {
    return (
      <div className="frens-post-block">
        <PostMorseRule />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition"
        >
          <ProfileAvatar profile={profile} className="w-11 h-11 shrink-0" logoClassName="w-6 h-auto" />
          <span className="text-sm frens-muted">Add a post…</span>
          <span className="ml-auto frens-btn-primary px-4 py-1.5 text-xs rounded-full">Post</span>
        </button>
        <PostMorseRule />
      </div>
    )
  }

  return (
    <div className="frens-post-block">
      <PostMorseRule />
      <form onSubmit={handlePost} className="p-3">
        <div className="flex items-start gap-3 mb-2">
          <ProfileAvatar profile={profile} className="w-11 h-11 shrink-0 self-start" logoClassName="w-6 h-auto" />
          <div className="flex-1 min-w-0 space-y-2">
            <AudienceSelect
              compact
              showLabel
              showTagInput={false}
              value={audience}
              onChange={setAudience}
              tagInput={tagInput}
              onTagInputChange={setTagInput}
            />
            {audience === 'other' ? (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tag frens by name, comma separated"
                className="frens-input py-1.5 text-xs w-full"
              />
            ) : null}
          </div>
          {collapsible ? (
            <button
              type="button"
              onClick={resetComposer}
              aria-label="Cancel"
              className="frens-muted text-lg leading-none self-start shrink-0"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="ml-14">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/gif,.gif"
            className="hidden"
            onChange={handleImageSelect}
          />
          <PillComposer
            asForm={false}
            value={draft}
            onChange={setDraft}
            onSubmit={handlePost}
            placeholder="What's on your mind, fren?"
            busy={posting}
            attachBusy={imageBusy}
            error={imageError}
            inputRef={textareaRef}
            submitDisabled={(!draft.trim() && !attachedImage) || imageBusy || posting}
            onPhoto={() => fileInputRef.current?.click()}
            onEmoji={addEmoji}
            onGif={attachGif}
          />
        </div>

        {attachedImage && (
          <div className="relative mt-2 ml-14">
            <SharedImage src={attachedImage} className="max-h-64" />
            <button
              type="button"
              onClick={() => {
                setAttachedImage(null)
                setAttachedBlob(null)
              }}
              aria-label="Remove photo"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80 transition"
            >
              ×
            </button>
          </div>
        )}
      </form>
      <PostMorseRule />
    </div>
  )
}
