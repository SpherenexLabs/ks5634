import { useEffect, useRef, useState } from 'react'

const PIXEL_STRIDE = 4 * 6
const COVERAGE_TRIGGER = 0.035
const CONFIRM_FRAMES = 3
const ANALYSIS_INTERVAL_MS = 350
const ANALYSIS_WIDTH = 160

function isFireColorPixel(r, g, b) {
  return r > 150 && r - b > 60 && g > 60 && g < r && g >= b * 0.9
}

export function FireCamera({ onStatusChange }) {
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const hitStreakRef = useRef(0)

  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [running, setRunning] = useState(false)
  const [coverage, setCoverage] = useState(0)
  const [fireDetected, setFireDetected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((list) => {
      setDevices(list.filter((d) => d.kind === 'videoinput'))
    })
    return () => stopStream()
  }, [])

  function stopStream() {
    clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setRunning(false)
    setFireDetected(false)
    setCoverage(0)
    hitStreakRef.current = 0
    onStatusChangeRef.current?.(false, 0)
  }

  async function startStream(deviceId) {
    setError(null)
    try {
      stopStream()
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const list = await navigator.mediaDevices.enumerateDevices()
      const cams = list.filter((d) => d.kind === 'videoinput')
      setDevices(cams)

      let activeId = deviceId
      if (!activeId) {
        const track = stream.getVideoTracks()[0]
        activeId = track?.getSettings?.().deviceId || ''
      }
      setSelectedDeviceId(activeId)

      setRunning(true)
      hitStreakRef.current = 0
      analyzeLoop()
    } catch (err) {
      setError(err.message)
      setRunning(false)
    }
  }

  function handleStart() {
    if (!selectedDeviceId && devices.length > 1) {
      const external = devices.find((d) => !/integrated|built-in|facetime/i.test(d.label))
      startStream(external?.deviceId || selectedDeviceId)
    } else {
      startStream(selectedDeviceId)
    }
  }

  function handleDeviceChange(id) {
    setSelectedDeviceId(id)
    if (running) startStream(id)
  }

  function analyzeLoop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      timerRef.current = setTimeout(analyzeLoop, 200)
      return
    }
    const w = ANALYSIS_WIDTH
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 90
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    let hits = 0
    let sampled = 0
    for (let i = 0; i < data.length; i += PIXEL_STRIDE) {
      sampled++
      if (isFireColorPixel(data[i], data[i + 1], data[i + 2])) hits++
    }
    const ratio = sampled > 0 ? hits / sampled : 0
    setCoverage(ratio)

    hitStreakRef.current = ratio >= COVERAGE_TRIGGER ? hitStreakRef.current + 1 : 0
    const detected = hitStreakRef.current >= CONFIRM_FRAMES
    setFireDetected(detected)
    onStatusChangeRef.current?.(detected, ratio)

    timerRef.current = setTimeout(analyzeLoop, ANALYSIS_INTERVAL_MS)
  }

  return (
    <div className="camera-panel">
      <div className="camera-controls">
        <select
          className="camera-select"
          value={selectedDeviceId}
          onChange={(e) => handleDeviceChange(e.target.value)}
        >
          <option value="">
            {devices.length ? 'Select webcam…' : 'Grant camera access to list devices'}
          </option>
          {devices.map((d, idx) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${idx + 1}`}
            </option>
          ))}
        </select>
        {!running ? (
          <button type="button" className="cam-btn cam-start" onClick={handleStart}>
            Start Detection
          </button>
        ) : (
          <button type="button" className="cam-btn cam-stop" onClick={stopStream}>
            Stop
          </button>
        )}
      </div>

      {error && <div className="cam-error">Camera error: {error}</div>}

      <div className={`camera-frame ${fireDetected ? 'frame-alert' : ''}`}>
        <video ref={videoRef} className="camera-video" muted playsInline />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {running && (
          <div className="camera-overlay">
            <span>Fire-color coverage: {(coverage * 100).toFixed(1)}%</span>
            {fireDetected && <span className="fire-tag">FIRE DETECTED</span>}
          </div>
        )}
        {!running && !error && <div className="camera-placeholder">Camera feed will appear here</div>}
      </div>
    </div>
  )
}
