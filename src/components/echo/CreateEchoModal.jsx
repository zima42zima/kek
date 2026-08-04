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
  ECHO_SAFETY_KEY,
} from '../../lib/echoConstants'
import {
  EchoTypeIcon,
  EchoVisibilityIcon,
  echoVisibilitySummary,
} from './EchoMeta'
import { EchoDiscoverRadiusPicker } from './EchoRangeSelect'
import EchoDurationPicker, { durationToExpiresAt } from './EchoDurationPicker'
import { formatRangeM } from '../../lib/echoRange'
import { bakeMemeCaption, ECHO_TITLE_MAX } from '../../lib/memeText'
import { OPTION_ACTIVE, OPTION_IDLE, GlobeIcon } from '../icons/UiIcons'

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

/** One-time privacy note — shown once, then never again in create flow. */
function SafetyNoticeOnce({ visibility }) {
  const [show, setShow] = useState(() => !readSafetySeen())
  if (!show || !ECHO_PUBLIC_VISIBILITIES.has(visibility)) return null
  return (
    <div className="rounded-xl border border-amber-500/35 px-3 py-2 text-left">
      <p className="text-[11px] text-amber-800 dark:text-amber-200">
        Public pins can reveal you were nearby — GPS is scattered ±{ECHO_PIN_OFFSET_MAX_M}m.
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

function VisibilityIconRow({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ECHO_VISIBILITY.map((v) => {
        const active = value === v.id
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-pressed={active}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition touch-manipulation ${
              active ? OPTION_ACTIVE : OPTION_IDLE
            }`}
          >
            <EchoVisibilityIcon visibility={v.id} className="w-5 h-5" />
            <span className="text-xs font-medium">{v.label}</span>
          </button>
        )
      })}
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
  const [echoTitle, setEchoTitle] = useState('')
  const [memeCaption, setMemeCaption] = useState({ text: '', style: 'outline' })
  const [memeCaptionOpen, setMemeCaptionOpen] = useState(false)

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
    setMemeCaption({ text: '', style: 'outline' })
    setMemeCaptionOpen(false)
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
  const titleTrimmed = echoTitle.trim().slice(0, ECHO_TITLE_MAX)

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
      title: titleTrimmed || '',
    })
  }

  async function publish() {
    setPublishError('')
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
          voiceFilter: null,
          senseFilter: null,
        })
      } catch (err) {
        setPublishError(err.message || 'Could not publish aftersound.')
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
      setPublishError(err.message || 'Could not publish aftersound.')
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
      title={<span className="inline-flex items-center gap-2">Leave an aftersound <EchoIcon className="w-5 h-4" /></span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {step === 'type' && (
        <div className="space-y-3">
          <p className="text-sm frens-body-text text-center">What kind of aftersound?</p>

          <div className="space-y-2">
            {[FEATURED_TYPE, ...ALT_TYPES].map((t) => {
              const selected = echoType === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setEchoType(t.id)
                    setStep('visibility')
                  }}
                  className={`w-full text-left rounded-xl border p-3 transition touch-manipulation ${
                    selected ? OPTION_ACTIVE : OPTION_IDLE
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <EchoTypeIcon kind={t.id} className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-sm">{t.label}</span>
                  </span>
                  <p className="text-xs frens-muted mt-1 ml-6">{t.hint}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 'visibility' && (
        <div className="space-y-3">
          <p className="text-sm frens-body-text text-center">Who can find this?</p>
          <VisibilityIconRow value={visibility} onChange={setVisibility} />
          <SafetyNoticeOnce visibility={visibility} />
          <label className="block">
            <span className="text-xs frens-muted">Title / note (optional)</span>
            <input
              type="text"
              value={echoTitle}
              onChange={(e) => setEchoTitle(e.target.value.slice(0, ECHO_TITLE_MAX))}
              placeholder="Short joke, thought, or note…"
              className="frens-input mt-1 text-sm w-full"
              maxLength={ECHO_TITLE_MAX}
            />
            <p className="text-[10px] frens-muted mt-1">{echoTitle.trim().length}/{ECHO_TITLE_MAX}</p>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm px-1 cursor-pointer">
            <span>Comments</span>
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(e) => setAllowComments(e.target.checked)}
              className="rounded"
              aria-label="Comments on or off"
            />
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
            <label className="flex items-center justify-between gap-3 rounded-xl border frens-border px-3 py-2.5 cursor-pointer">
              <span className="text-sm inline-flex items-center gap-1.5">
                <GlobeIcon className="w-4 h-4" /> Browse anywhere
              </span>
              <input
                type="checkbox"
                checked={browseGlobally}
                onChange={(e) => setBrowseGlobally(e.target.checked)}
                className="rounded"
              />
            </label>
          )}
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
          <p className="text-sm frens-body-text text-center">Place your aftersound</p>
          <p className="text-xs frens-muted text-center -mt-1">
            Drag the pin in the {ECHO_PIN_OFFSET_MAX_M}m circle — GPS stays private.
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
            <p className="text-[11px] frens-muted mt-1">
              Name a café or landmark and pick 420m range — frens can jump right to that spot on the map.
            </p>
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
                ? (publishing ? 'Publishing…' : 'Publish aftersound')
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
          <EchoImagePicker
            value={imagePick}
            onChange={setImagePick}
            title="Add photo"
            hint="GIF or image"
            captionEnabled
            captionOpen={memeCaptionOpen}
            onCaptionOpenChange={setMemeCaptionOpen}
            caption={memeCaption}
            onCaptionChange={setMemeCaption}
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
                  : 'Publish aftersound'}
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
          <EchoRecorder
            kind={echoType}
            senseFilter={echoType === 'video' ? senseFilter : 'clear'}
            maxSeconds={typeMeta?.maxSec}
            onRecorded={setRecording}
          />

          {isAudio && recording && (
            <div className="space-y-2 border-t frens-border pt-3">
              <p className="text-xs font-medium text-center">Cover image (optional)</p>
              <EchoImagePicker
                compact
                value={audioCover}
                onChange={setAudioCover}
                title="Add cover"
                hint="Photo or meme while frens listen"
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
              {publishing ? 'Publishing…' : 'Publish aftersound'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
