import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import EchoRecorder from './EchoRecorder'
import EchoImagePicker from './EchoImagePicker'
import { randomOffsetInRadius } from '../../lib/geo'
import {
  ECHO_TYPES,
  ECHO_VISIBILITY,
  ECHO_PIN_OFFSET_MAX_M,
  ECHO_PUBLIC_VISIBILITIES,
  ECHO_PROXIMITY_PRESETS,
  ECHO_DEFAULT_PROXIMITY_ID,
  ECHO_SAFETY_KEY,
} from '../../lib/echoConstants'
import {
  EchoTypeIcon,
  EchoVisibilityIcon,
} from './EchoMeta'
import { bakeMemeCaption } from '../../lib/memeText'
import { OPTION_ACTIVE, GlobeIcon } from '../icons/UiIcons'

const PUBLISH_VISIBILITY = ECHO_VISIBILITY.filter((v) => v.id !== 'private')

function readSafetySeen() {
  try {
    return Boolean(localStorage.getItem(ECHO_SAFETY_KEY))
  } catch {
    return true
  }
}

function markSafetySeen() {
  try {
    localStorage.setItem(ECHO_SAFETY_KEY, '1')
  } catch { /* ignore */ }
}

function SafetyNoticeOnce({ visibility }) {
  const [show, setShow] = useState(() => !readSafetySeen())
  if (!show || !ECHO_PUBLIC_VISIBILITIES.has(visibility)) return null
  return (
    <div className="rounded-xl border border-amber-500/35 px-3 py-2 text-left">
      <p className="text-[11px] text-amber-800 dark:text-amber-200">
        Exact leaves your real spot. Area / City scatter the pin ±{ECHO_PIN_OFFSET_MAX_M}m.
      </p>
      <button
        type="button"
        className="text-[10px] frens-muted underline mt-1"
        onClick={() => {
          markSafetySeen()
          setShow(false)
        }}
      >
        Got it
      </button>
    </div>
  )
}

function ChipRow({ options, value, onChange, getLabel = (o) => o.label }) {
  return (
    <div className="flex gap-1.5 justify-center flex-wrap">
      {options.map((opt) => {
        const id = opt.id
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`min-w-[4.25rem] px-3.5 py-2 rounded-full border text-sm font-medium transition touch-manipulation ${
              active ? OPTION_ACTIVE : 'frens-border frens-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
            }`}
          >
            {getLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}

const TYPE_CHIPS = [
  { id: 'image', label: 'Meme' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
]

export default function CreateEchoModal({ userPos, onPublish, onClose }) {
  const [step, setStep] = useState('type')
  const [echoType, setEchoType] = useState('image')
  const [visibility, setVisibility] = useState('world')
  const [anonymous, setAnonymous] = useState(false)
  const [proximityId, setProximityId] = useState(ECHO_DEFAULT_PROXIMITY_ID)
  const [allowComments, setAllowComments] = useState(false)
  const [recording, setRecording] = useState(null)
  const [imagePick, setImagePick] = useState(null)
  const [audioCover, setAudioCover] = useState(null)
  const [browseGlobally, setBrowseGlobally] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [memeCaption, setMemeCaption] = useState({ text: '', style: 'outline' })
  const [memeCaptionOpen, setMemeCaptionOpen] = useState(false)

  const needsPin = ECHO_PUBLIC_VISIBILITIES.has(visibility)
  const isImage = echoType === 'image'
  const isAudio = echoType === 'audio'
  const proximity = ECHO_PROXIMITY_PRESETS.find((p) => p.id === proximityId) || ECHO_PROXIMITY_PRESETS[1]
  const typeMeta = ECHO_TYPES.find((t) => t.id === echoType)

  const steps = useMemo(() => ['type', 'content', 'settings'], [])

  useEffect(() => {
    if (!steps.includes(step)) setStep(steps[0])
  }, [steps, step])

  useEffect(() => {
    setRecording(null)
    setImagePick(null)
    setAudioCover(null)
    setPublishError('')
    setMemeCaption({ text: '', style: 'outline' })
    setMemeCaptionOpen(false)
  }, [echoType])

  const readyToPublish = isImage ? Boolean(imagePick?.blob) : Boolean(recording)

  function resolvePin() {
    if (!needsPin || !userPos) return null
    if (proximity.exactPin) return { lat: userPos.lat, lon: userPos.lon }
    return randomOffsetInRadius(userPos, ECHO_PIN_OFFSET_MAX_M)
  }

  async function publishPayload(extra = {}) {
    await onPublish({
      kind: extra.kind,
      mediaUrl: extra.mediaUrl,
      mediaBlob: extra.mediaBlob,
      coverUrl: extra.coverUrl,
      coverBlob: extra.coverBlob,
      visibility: anonymous ? 'world' : visibility,
      allowComments,
      anonymous,
      voiceFilter: null,
      senseFilter: null,
      spatial: null,
      pinPosition: resolvePin(),
      discoverRadiusM: needsPin ? proximity.meters : null,
      placeLabel: '',
      browseGlobally: needsPin && (anonymous || visibility === 'world') ? browseGlobally : false,
      expiresAt: null,
    })
  }

  function toggleAnonymous(next) {
    setAnonymous(next)
    if (next) setVisibility('world')
  }

  async function publish() {
    setPublishError('')
    if (needsPin && !userPos) {
      setPublishError('Enable location to place this echo.')
      return
    }
    if (isImage) {
      if (!imagePick?.blob) return
      setPublishing(true)
      try {
        let mediaBlob = imagePick.blob
        let mediaUrl = imagePick.url
        const captionText = memeCaptionOpen ? memeCaption.text.trim() : ''
        if (captionText) {
          const baked = await bakeMemeCaption(imagePick.blob, {
            text: captionText,
            style: memeCaption.style,
          })
          mediaBlob = baked.blob
          mediaUrl = baked.dataUrl
        }
        await publishPayload({
          kind: 'image',
          mediaUrl,
          mediaBlob,
          coverUrl: null,
          coverBlob: null,
        })
      } catch (err) {
        setPublishError(err.message || 'Could not publish echo.')
      } finally {
        setPublishing(false)
      }
      return
    }
    if (!recording) return
    setPublishing(true)
    try {
      await publishPayload({
        kind: recording.kind,
        mediaUrl: recording.url,
        mediaBlob: recording.blob,
        coverUrl: isAudio ? audioCover?.url : null,
        coverBlob: isAudio ? audioCover?.blob : null,
      })
    } catch (err) {
      setPublishError(err.message || 'Could not publish echo.')
    } finally {
      setPublishing(false)
    }
  }

  function next() {
    const i = steps.indexOf(step)
    if (i < steps.length - 1) setStep(steps[i + 1])
  }

  function back() {
    const i = steps.indexOf(step)
    if (i > 0) setStep(steps[i - 1])
  }

  return (
    <Modal
      title={<span className="inline-flex items-center gap-1.5">echo <span className="opacity-70">+</span></span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {step === 'type' && (
        <div className="space-y-4">
          <p className="text-sm frens-body-text text-center">What are you leaving?</p>
          <ChipRow
            options={TYPE_CHIPS}
            value={echoType}
            onChange={(id) => {
              setEchoType(id)
              setStep('content')
            }}
          />
        </div>
      )}

      {step === 'content' && (
        <div className="space-y-3">
          {isImage ? (
            <EchoImagePicker
              value={imagePick}
              onChange={setImagePick}
              title="Add meme"
              hint="GIF or image"
              captionEnabled
              captionOpen={memeCaptionOpen}
              onCaptionOpenChange={setMemeCaptionOpen}
              caption={memeCaption}
              onCaptionChange={setMemeCaption}
            />
          ) : (
            <>
              {!isAudio && (
                <p className="text-xs frens-muted text-center inline-flex items-center justify-center gap-1 flex-wrap">
                  <EchoTypeIcon kind={echoType} className="w-3.5 h-3.5" />
                  {typeMeta?.label}
                </p>
              )}
              <EchoRecorder
                kind={echoType}
                maxSeconds={typeMeta?.maxSec}
                onRecorded={setRecording}
              />
              {isAudio && recording ? (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] frens-muted text-center">Cover (optional)</p>
                  <EchoImagePicker
                    compact
                    value={audioCover}
                    onChange={setAudioCover}
                    title="Add cover"
                    hint="Photo while frens listen"
                  />
                </div>
              ) : null}
            </>
          )}
          {publishError ? (
            <p className="text-xs text-red-500 dark:text-red-400 text-center">{publishError}</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button
              type="button"
              onClick={next}
              disabled={!readyToPublish}
              className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'settings' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 justify-center">
            {PUBLISH_VISIBILITY.map((v) => {
              const locked = anonymous && v.id === 'friends'
              const active = (anonymous ? 'world' : visibility) === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => !locked && setVisibility(v.id)}
                  disabled={locked}
                  aria-pressed={active}
                  title={locked ? 'Anonymous echoes are World only' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition touch-manipulation ${
                    active ? OPTION_ACTIVE : 'frens-border frens-muted'
                  } ${locked ? 'opacity-35 cursor-not-allowed' : ''}`}
                >
                  <EchoVisibilityIcon visibility={v.id} className="w-4 h-4" />
                  {v.label}
                </button>
              )
            })}
          </div>

          <ChipRow
            options={ECHO_PROXIMITY_PRESETS}
            value={proximityId}
            onChange={setProximityId}
          />

          <label className="flex items-start gap-2.5 rounded-xl border frens-border px-3 py-2.5 cursor-pointer text-left">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => toggleAnonymous(e.target.checked)}
              className="rounded mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Anonymous</span>
              <span className="block text-[11px] frens-muted mt-0.5 leading-snug">
                Bat pin for everyone — even frens. World only. No alerts. Exact still leaves your real spot. Can’t undo after publish.
              </span>
            </span>
          </label>

          <SafetyNoticeOnce visibility={anonymous ? 'world' : visibility} />

          <div className="flex items-center justify-between gap-3 px-1 text-sm">
            {(anonymous || visibility === 'world') ? (
              <label className="inline-flex items-center gap-1.5 cursor-pointer min-w-0">
                <input
                  type="checkbox"
                  checked={browseGlobally}
                  onChange={(e) => setBrowseGlobally(e.target.checked)}
                  className="rounded"
                />
                <GlobeIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Browse anywhere</span>
              </label>
            ) : (
              <span />
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0">
              <span>Comments</span>
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
                className="rounded"
              />
            </label>
          </div>

          {publishError ? (
            <p className="text-xs text-red-500 dark:text-red-400 text-center">{publishError}</p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button
              type="button"
              onClick={publish}
              disabled={!readyToPublish || publishing || !userPos}
              className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
