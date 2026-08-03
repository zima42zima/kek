import { useCallback, useEffect, useState } from 'react'
import { probeCameraPermission, probeSpatialEchoSupport } from '../lib/spatialEcho'

/**
 * Detect spatial / LiDAR echo support when the echo create flow is active.
 * Re-checks when camera permission becomes granted (e.g. after recorder opens).
 */
export default function useSpatialEchoSupport({ active = true } = {}) {
  const [state, setState] = useState({
    loading: true,
    supported: false,
    tier: 'none',
    label: '',
    camera: 'unknown',
    reason: '',
    lidarLikely: false,
    hasWebXR: false,
  })

  const refresh = useCallback(async () => {
    const [probe, camera] = await Promise.all([
      probeSpatialEchoSupport(),
      probeCameraPermission(),
    ])
    setState({
      loading: false,
      supported: probe.supported,
      tier: probe.tier,
      label: probe.label || '',
      camera,
      reason: probe.reason || '',
      lidarLikely: probe.lidarLikely,
      hasWebXR: probe.hasWebXR,
    })
    return { ...probe, camera }
  }, [])

  useEffect(() => {
    if (!active) return
    setState((s) => ({ ...s, loading: true }))
    refresh()
  }, [active, refresh])

  const notifyCameraGranted = useCallback(() => {
    refresh()
  }, [refresh])

  const ready = state.supported && (state.camera === 'granted' || state.camera === 'unknown')

  return {
    ...state,
    ready,
    refresh,
    notifyCameraGranted,
  }
}
