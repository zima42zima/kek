import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import EchoRecorder from './EchoRecorder'
import EchoImagePicker from './EchoImagePicker'
import EchoPinPlacer from './EchoPinPlacer'
import EchoIcon from './EchoIcon'
import { senseFilterLabel } from '../../lib/senseFilters'
import { randomOffsetInRadius } from '../../lib/geo'
import {
  ECHO_TYPES,
  ECHO_VISIBILITY,
  ECHO_VOICE_FILTERS,
  ECHO_GLITCH_FILTERS,
  ECHO_PIN_OFFSET_MAX_M,
  ECHO_PUBLIC_VISIBILITIES,
  ECHO_DEFAULT_DISCOVER_RADIUS_M,
} from '../../lib/echoConstants'
import {
  EchoTypeIcon,
  EchoVisibilityIcon,
  echoVisibilitySummary,
} from './EchoMeta'
import { EchoDiscoverRadiusPicker } from './EchoRangeSelect'
import EchoDurationPicker, { durationToExpiresAt } from './EchoDurationPicker'
import { formatRangeM } from '../../lib/echoRange'
import { OPTION_ACTIVE, OPTION_IDLE, GlobeIcon } from '../icons/UiIcons'

function StepDots({ steps, step }) {
  const idx = steps.indexOf(step)
  return (
    <div className="flex justify-center gap-1.5 mb-4">
      {steps.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            i === idx ? 'w-6 bg-black dark:bg-white' : i < idx ? 'w-1.5 bg-black/40 dark:bg-white/40' : 'w-1.5 bg-black/10 dark:bg-white/15'
          }`}
        />
      ))}
    </div>
  )
}

function SafetyNotice({ visibility }) {
  if (!ECHO_PUBLIC_VISIBILITIES.has(visibility)) return null
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/8 px-3 py-2.5 text-left">
      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
        Public meme spots can reveal you were here
      </p>
      <p className="text-[11px] frens-muted mt-1">
        We scatter your pin up to {ECHO_PIN_OFFSET_MAX_M}m. Nobody sees the exact spot — only an approximate area until they walk into your chosen range.
        {visibility === 'friends' ? ' Only frens you follow can discover it.' : ''}
      </p>
    </div>
  )
}

const FEATURED_TYPE = ECHO_TYPES.find((t) => t.featured) || ECHO_TYPES[0]
const ALT_TYPES = ECHO_TYPES.filter((t) => !t.featured)

export default function CreateEchoModal({ userPos, onPublish, onClose }) {
  const [step, setStep] = useState('type')
  const [echoType, setEchoType] = useState(FEATURED_TYPE.id)
  const [visibility, setVisibility] = useState('world')
  const [voiceFilter, setVoiceFilter] = useState('normal')
  const [senseFilter, setSenseFilter] = useState('clear')
  const [allowComments, setAllowComments] = useState(false)
  const [recording, setRecording] = useState(null)
  const [imagePick, setImagePick] = useState(null)
  const [audioCover, setAudioCover] = useState(null)
  const [pinPosition, setPinPosition] = useState(null)
  const [discoverRadiusM, setDiscoverRadiusM] = useState(ECHO_DEFAULT_DISCOVER_RADIUS_M)
  const [placeLabel, setPlaceLabel] = useState('')
  const [browseGlobally, setBrowseGlobally] = useState(false)
  const [durationId, setDurationId] = useState('days')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const needsPinStep = ECHO_PUBLIC_VISIBILITIES.has(visibility)
  const isImage = echoType === 'image'
  const isAudio = echoType === 'audio'

  const steps = useMemo(() => {
    const list = ['type', 'visibility']
    if (isImage) {
      list.push('capture')
      if (needsPinStep) {
        list.push('range', 'duration', 'place')
      }
    } else {
      if (needsPinStep) {
        list.push('range', 'duration', 'place')
      }
      list.push('filters', 'record')
    }
    return list
  }, [needsPinStep, isImage])

  const typeMeta = ECHO_TYPES.find((t) => t.id === echoType)

  useEffect(() => {
    if (!steps.includes(step)) setStep(steps[0])
  }, [steps, step])

  useEffect(() => {
    setRecording(null)
    setImagePick(null)
    setAudioCover(null)
    setPublishError('')
  }, [echoType])

  useEffect(() => {
    if (!userPos || !needsPinStep) {
      setPinPosition(null)
      return
    }
    setPinPosition(randomOffsetInRadius(userPos, ECHO_PIN_OFFSET_MAX_M))
  }, [userPos, needsPinStep, visibility])

  const readyToPublish = isImage ? Boolean(imagePick?.blob) : Boolean(recording)
  const expiresAt = durationToExpiresAt(durationId)

  async function publishPayload(extra = {}) {
    await onPublish({
      kind: extra.kind,
      mediaUrl: extra.mediaUrl,
      mediaBlob: extra.mediaBlob,
      coverUrl: extra.coverUrl,
      coverBlob: extra.coverBlob,
      visibility,
      allowComments,
      voiceFilter: extra.voiceFilter,
      senseFilter: extra.senseFilter,
      spatial: null,
      pinPosition: needsPinStep ? pinPosition : null,
      discoverRadiusM: needsPinStep ? discoverRadiusM : null,
      placeLabel: needsPinStep ? placeLabel.trim() : '',
      browseGlobally: needsPinStep && visibility === 'world' ? browseGlobally : false,
      expiresAt,
    })
  }

  async function publish() {
    setPublishError('')
    if (isImage) {
      if (!imagePick?.blob) return
      setPublishing(true)
      try {
        await publishPayload({
          kind: 'image',
          mediaUrl: imagePick.url,
          mediaBlob: imagePick.blob,
          coverUrl: null,
          coverBlob: null,
          voiceFilter: null,
          senseFilter: null,
        })
      } catch (err) {
        setPublishError(err.message || 'Could not publish meme spot.')
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
        voiceFilter: recording.kind === 'audio' ? voiceFilter : null,
        senseFilter: recording.kind === 'video' ? (recording.senseFilter || senseFilter) : null,
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

  const visibilitySummary = echoVisibilitySummary(visibility)

  return (
    <Modal
      title={<span className="inline-flex items-center gap-2">Drop a meme spot <EchoIcon className="w-5 h-4" /></span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <StepDots steps={steps} step={step} />

      {step === 'type' && (
        <div className="space-y-3">
          <p className="text-sm frens-body-text text-center">What are you leaving?</p>

          <button
            type="button"
            onClick={() => setEchoType(FEATURED_TYPE.id)}
            className={`w-full text-left rounded-xl border p-4 transition ${
              echoType === FEATURED_TYPE.id ? OPTION_ACTIVE : OPTION_IDLE
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <EchoTypeIcon kind={FEATURED_TYPE.id} className="w-5 h-5 shrink-0" />
              <span className="font-medium text-sm">{FEATURED_TYPE.label}</span>
              <span className="text-[10px] uppercase tracking-wide frens-muted ml-auto">main</span>
            </span>
            <p className="text-xs frens-muted mt-1 ml-7">{FEATURED_TYPE.hint}</p>
          </button>

          <div className="space-y-2">
            <p className="text-[11px] frens-muted text-center">Or something else</p>
            {ALT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEchoType(t.id)}
                className={`w-full text-left rounded-xl border p-3 transition ${
                  echoType === t.id ? OPTION_ACTIVE : OPTION_IDLE
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <EchoTypeIcon kind={t.id} className="w-4 h-4 shrink-0" />
                  <span className="font-medium text-sm">{t.label}</span>
                </span>
                <p className="text-xs frens-muted mt-1 ml-6">{t.hint}</p>
              </button>
            ))}
          </div>

          {echoType === 'video' && (
            <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-center">
              <p className="text-[11px] font-medium">Glitch your echo</p>
              <p className="text-[10px] frens-muted mt-0.5">
                Retro FX live on camera — ASCII, CRT, heat, 8-bit &amp; more
              </p>
            </div>
          )}

          <button type="button" onClick={next} className="frens-btn-primary w-full py-2.5 text-sm mt-2">
            Continue
          </button>
        </div>
      )}

      {step === 'visibility' && (
        <div className="space-y-3">
          <p className="text-sm frens-body-text text-center">Who can find this?</p>
          <div className="grid gap-2">
            {ECHO_VISIBILITY.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisibility(v.id)}
                className={`text-left rounded-xl border p-4 transition ${
                  visibility === v.id ? OPTION_ACTIVE : OPTION_IDLE
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <EchoVisibilityIcon visibility={v.id} className="w-5 h-5 shrink-0" />
                  <span className="font-medium text-sm">{v.label}</span>
                </span>
                <p className="text-xs frens-muted mt-1 ml-7">{v.hint}</p>
              </button>
            ))}
          </div>
          <SafetyNotice visibility={visibility} />
          <label className="flex items-center gap-2 text-xs frens-muted px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(e) => setAllowComments(e.target.checked)}
              className="rounded"
            />
            Let frens leave comments after they find it
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button type="button" onClick={next} className="frens-btn-primary flex-1 py-2.5 text-sm">Continue</button>
          </div>
        </div>
      )}

      {step === 'range' && (
        <div className="space-y-3">
          <EchoDiscoverRadiusPicker value={discoverRadiusM} onChange={setDiscoverRadiusM} />
          {visibility === 'world' && (
            <label className="flex items-start gap-3 rounded-xl border frens-border p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={browseGlobally}
                onChange={(e) => setBrowseGlobally(e.target.checked)}
                className="mt-1 rounded"
              />
              <span>
                <span className="text-sm font-medium inline-flex items-center gap-1.5">
                  <GlobeIcon className="w-4 h-4" /> Browsable from anywhere
                </span>
                <span className="block text-xs frens-muted mt-1">
                  Shows a world icon — frens can find this spot by searching cities and exploring the map, not only by walking here.
                </span>
              </span>
            </label>
          )}
          <SafetyNotice visibility={visibility} />
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button type="button" onClick={next} className="frens-btn-primary flex-1 py-2.5 text-sm">Continue</button>
          </div>
        </div>
      )}

      {step === 'duration' && (
        <div className="space-y-3">
          <EchoDurationPicker value={durationId} onChange={setDurationId} />
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button type="button" onClick={next} className="frens-btn-primary flex-1 py-2.5 text-sm">Continue</button>
          </div>
        </div>
      )}

      {step === 'place' && (
        <div className="space-y-3">
          <p className="text-sm frens-body-text text-center">Place your meme spot</p>
          <p className="text-xs frens-muted text-center -mt-1">
            Drag the pin anywhere inside the {ECHO_PIN_OFFSET_MAX_M}m circle — your GPS stays private.
          </p>
          <label className="block">
            <span className="text-xs frens-muted">Place name (optional)</span>
            <input
              type="text"
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              placeholder="e.g. Blue Bottle, Golden Gate, that weird alley…"
              className="frens-input mt-1 text-sm w-full"
              maxLength={80}
            />
          </label>
          {userPos && pinPosition ? (
            <EchoPinPlacer
              userPos={userPos}
              pinPos={pinPosition}
              onPinChange={setPinPosition}
            />
          ) : (
            <div className="h-52 rounded-xl border frens-border flex items-center justify-center text-xs frens-muted">
              Waiting for location…
            </div>
          )}
          <SafetyNotice visibility={visibility} />
          {publishError ? (
            <p className="text-xs text-red-500 dark:text-red-400 text-center">{publishError}</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button
              type="button"
              onClick={isImage ? publish : next}
              disabled={isImage ? (!readyToPublish || publishing || !pinPosition) : !pinPosition}
              className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
            >
              {isImage
                ? (publishing ? 'Publishing…' : 'Publish meme spot')
                : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {step === 'filters' && (
        <div className="space-y-3">
          {echoType === 'video' ? (
            <>
              <p className="text-sm frens-body-text text-center">Pick a glitch</p>
              <p className="text-xs frens-muted text-center -mt-1">
                Old-internet vibes — live preview while you record.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-[42vh] overflow-y-auto pr-1">
                {ECHO_GLITCH_FILTERS.map((f) => {
                  const active = senseFilter === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSenseFilter(f.id)}
                      className={`text-left rounded-xl border p-3 transition ${
                        active ? OPTION_ACTIVE : OPTION_IDLE
                      }`}
                    >
                      <span className="font-medium text-xs">{f.label}</span>
                      <p className="text-[10px] frens-muted mt-1">{f.hint}</p>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm frens-body-text text-center">Voice vibe (optional)</p>
              <div className="grid grid-cols-2 gap-2">
                {ECHO_VOICE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVoiceFilter(f.id)}
                    className={`py-2.5 rounded-lg text-xs border ${
                      voiceFilter === f.id
                        ? OPTION_ACTIVE
                        : 'frens-border frens-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button type="button" onClick={next} className="frens-btn-primary flex-1 py-2.5 text-sm">
              {echoType === 'video' ? 'Record' : 'Record audio'}
            </button>
          </div>
        </div>
      )}

      {step === 'capture' && (
        <div className="space-y-3">
          <p className="text-xs frens-muted text-center inline-flex items-center justify-center gap-1 flex-wrap">
            <EchoTypeIcon kind="image" className="w-3.5 h-3.5" />
            Meme spot · {visibilitySummary}{needsPinStep ? ` · ${formatRangeM(discoverRadiusM)} range` : ''}
          </p>
          <SafetyNotice visibility={visibility} />
          <EchoImagePicker
            value={imagePick}
            onChange={setImagePick}
            title="Drop your meme"
            hint="GIFs, memes, and photos work — EXIF stripped for privacy"
          />
          {publishError ? (
            <p className="text-xs text-red-500 dark:text-red-400 text-center">{publishError}</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button
              type="button"
              onClick={needsPinStep ? next : publish}
              disabled={!readyToPublish || publishing}
              className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
            >
              {publishing
                ? 'Publishing…'
                : needsPinStep
                  ? 'Continue'
                  : 'Publish meme spot'}
            </button>
          </div>
        </div>
      )}

      {step === 'record' && (
        <div className="space-y-3">
          <p className="text-xs frens-muted text-center inline-flex items-center justify-center gap-1 flex-wrap">
            <EchoTypeIcon kind={echoType} className="w-3.5 h-3.5" />
            {typeMeta?.label}
            {echoType === 'video' && senseFilter !== 'clear' ? ` · ${senseFilterLabel(senseFilter)}` : ''}
            {' · '}
            {visibilitySummary}
            {needsPinStep ? ` · ${formatRangeM(discoverRadiusM)} range` : ''}
          </p>
          <SafetyNotice visibility={visibility} />
          <EchoRecorder
            kind={echoType}
            senseFilter={echoType === 'video' ? senseFilter : 'clear'}
            maxSeconds={typeMeta?.maxSec}
            onRecorded={setRecording}
          />

          {isAudio && recording && (
            <div className="space-y-2 border-t frens-border pt-3">
              <p className="text-xs font-medium text-center">Cover meme (optional)</p>
              <p className="text-[10px] frens-muted text-center -mt-1">
                Show a meme or photo while frens listen
              </p>
              <EchoImagePicker
                compact
                value={audioCover}
                onChange={setAudioCover}
                title="Add a cover meme"
                hint="Meme, album art, scene — anything visual"
              />
            </div>
          )}

          {publishError ? (
            <p className="text-xs text-red-500 dark:text-red-400 text-center">{publishError}</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={back} className="frens-btn-outline flex-1 py-2.5 text-sm">Back</button>
            <button
              type="button"
              onClick={publish}
              disabled={!readyToPublish || publishing}
              className="frens-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
            >
              {publishing ? 'Publishing…' : 'Publish echo'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
