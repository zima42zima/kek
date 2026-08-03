import { useEffect, useRef } from 'react'
import { ProfileAvatar } from '../FrogLogo'
import FrenHandle from '../FrenHandle'
import { useDmCalls } from '../../context/DmCallsContext'
import { MicIcon, MuteIcon, CameraIcon, VideoCallIcon } from '../icons/UiIcons'

function VideoPane({ stream, muted, mirror, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream || null
    if (stream) el.play().catch(() => {})
  }, [stream])
  if (!stream) return null
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${mirror ? 'scale-x-[-1]' : ''} ${className}`}
    />
  )
}

function EndReason({ reason }) {
  const labels = {
    declined: 'Call declined',
    busy: 'They\'re on another call',
    'no-answer': 'No answer',
    error: 'Call failed',
    ended: 'Call ended',
  }
  return <p className="text-sm frens-muted">{labels[reason] || 'Call ended'}</p>
}

export default function DmCallOverlay() {
  const {
    call,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useDmCalls()

  if (!call) return null

  const peer = {
    frenName: call.peerName,
    avatarType: call.peerAvatarType,
    avatarUrl: call.peerAvatarUrl,
  }

  const isVideo = call.type === 'video'
  const active = call.status === 'active' || call.status === 'connecting'
  const ended = call.status === 'ended'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="frens-surface border frens-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        {active || call.status === 'outgoing' ? (
          <div className="relative bg-black aspect-[3/4] max-h-[55vh] w-full">
            {isVideo && call.remoteStream ? (
              <VideoPane stream={call.remoteStream} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <ProfileAvatar profile={peer} className="w-24 h-24" logoClassName="w-14 h-auto" />
                <FrenHandle size="lg" className="text-white">{call.peerName}</FrenHandle>
                <p className="text-white/70 text-sm">
                  {call.status === 'outgoing' ? 'Calling…' : call.status === 'connecting' ? 'Connecting…' : 'On call'}
                </p>
              </div>
            )}
            {isVideo && call.localStream && !call.videoOff ? (
              <VideoPane
                stream={call.localStream}
                muted
                mirror
                className="absolute bottom-3 right-3 w-24 h-32 rounded-xl object-cover border-2 border-white/30 shadow-lg"
              />
            ) : null}
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <ProfileAvatar profile={peer} className="w-20 h-20" logoClassName="w-12 h-auto" />
            <div>
              <FrenHandle size="lg">{call.peerName}</FrenHandle>
              {ended ? (
                <EndReason reason={call.endReason} />
              ) : (
                <p className="text-sm frens-muted">
                  Incoming {isVideo ? 'video' : 'audio'} call
                </p>
              )}
            </div>
          </div>
        )}

        <div className="p-4 flex flex-wrap items-center justify-center gap-3">
          {call.status === 'incoming' && !ended ? (
            <>
              <button
                type="button"
                onClick={() => declineCall()}
                className="px-5 py-2.5 rounded-full bg-red-500/90 text-white text-sm font-medium"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => acceptCall()}
                className="px-5 py-2.5 rounded-full bg-[#6BC06B] text-black text-sm font-medium"
              >
                Accept
              </button>
            </>
          ) : ended ? null : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`w-11 h-11 rounded-full border frens-border flex items-center justify-center ${call.muted ? 'bg-red-500/20' : ''}`}
                title={call.muted ? 'Unmute' : 'Mute'}
              >
                {call.muted ? <MuteIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
              </button>
              {isVideo ? (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`w-11 h-11 rounded-full border frens-border flex items-center justify-center ${call.videoOff ? 'bg-red-500/20' : ''}`}
                  title={call.videoOff ? 'Turn camera on' : 'Turn camera off'}
                >
                  {call.videoOff ? <CameraIcon className="w-5 h-5" /> : <VideoCallIcon className="w-5 h-5" />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => endCall()}
                className="px-5 py-2.5 rounded-full bg-red-500 text-white text-sm font-medium"
              >
                {call.status === 'outgoing' ? 'Cancel' : 'Hang up'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
