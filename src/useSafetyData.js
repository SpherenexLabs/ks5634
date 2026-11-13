import { useCallback, useEffect, useState } from 'react'
import { ref, onValue, set } from 'firebase/database'
import { database, ROOT_PATH } from './firebase'

import { loadThresholds, validateThresholds, THRESHOLD_STORAGE_KEY } from './safetyThresholds'

const HR_LOW_DANGER = 40
const HR_LOW_WARNING = 50
const HR_HIGH_WARNING = 100
const HR_HIGH_DANGER = 120
const SPO2_WARNING = 95
const SPO2_DANGER = 90
const BP_SYS_HIGH_WARNING = 140
const BP_SYS_HIGH_DANGER = 160
const BP_SYS_LOW_WARNING = 90
const BP_DIA_HIGH_WARNING = 90
const BP_DIA_HIGH_DANGER = 100

function readField(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return source[key]
    }
  }
  return null
}

function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function parseBP(raw) {
  const match = typeof raw === 'string' ? raw.match(/^(\d+)\s*\/\s*(\d+)$/) : null
  if (!match) return { systolic: null, diastolic: null }
  return { systolic: Number(match[1]), diastolic: Number(match[2]) }
}

function isDangerousHeartRate(value) {
  return value < HR_LOW_DANGER || value > HR_HIGH_DANGER
}

export function useSafetyData(cameraFireDetected = false) {
  const [environmentThresholds, setEnvironmentThresholds] = useState(loadThresholds)
  const { TEMP_WARNING, TEMP_DANGER, GAS_WARNING, GAS_DANGER } = environmentThresholds

  function updateThresholds(next) {
    const validationError = validateThresholds(next)
    if (validationError) throw new Error(validationError)
    localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(next))
    setEnvironmentThresholds(next)
  }

  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [relayError, setRelayError] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  useEffect(() => {
    const dataRef = ref(database, ROOT_PATH)
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        setData(snapshot.val())
        setConnected(true)
        setError(null)
        setLastUpdatedAt(Date.now())
      },
      (err) => {
        setError(err.message)
        setConnected(false)
      }
    )
    return () => unsubscribe()
  }, [])

  const temp = parseNumber(readField(data, ['Temp', 'Temperature', 'temperature']))
  const gas = parseNumber(readField(data, ['Gas', 'Smoke', 'AirQuality', 'gas', 'smoke', 'airQuality']))
  const sensorFireDetected = Number(readField(data, ['Fire', 'fire'])) === 1
  const fireDetected = sensorFireDetected || cameraFireDetected
  const fanOn = Number(readField(data, ['Relay1', 'Fan', 'relay1', 'fan'])) === 1
  const pumpOn = Number(readField(data, ['Relay2', 'Pump', 'relay2', 'pump'])) === 1

  const heartRate = parseNumber(readField(data, ['HR', 'HeartRate', 'heartRate']))
  const pulseSensorReading = parseNumber(readField(data, ['Pulse', 'pulse']))
  const spo2 = parseNumber(readField(data, ['Spo2', 'SpO2', 'spo2']))
  const bpRaw = readField(data, ['BP', 'BloodPressure', 'bloodPressure'])
  const { systolic: bpSystolic, diastolic: bpDiastolic } = parseBP(bpRaw)

  const hasHeartReading = heartRate !== null && heartRate > 0
  const hasPulseSensorReading = pulseSensorReading !== null && pulseSensorReading > 0
  const hasSpo2Reading = spo2 !== null && spo2 > 0
  const hasBpReading = bpSystolic !== null && bpDiastolic !== null && (bpSystolic > 0 || bpDiastolic > 0)
  const hasHealthReading = hasHeartReading || hasPulseSensorReading || hasSpo2Reading || hasBpReading

  // No dedicated pulse sensor on this rig: mirror the heart-rate reading so the
  // Pulse card always shows a real number. Falls back to 0 when nothing at all
  // is connected, which is fine to display as-is.
  const pulse = hasPulseSensorReading ? pulseSensorReading : hasHeartReading ? heartRate : 0
  const pulseSource = hasPulseSensorReading ? 'sensor' : hasHeartReading ? 'heart-rate' : 'none'
  const hasPulseReading = pulseSource !== 'none'

  const hrAbnormal = hasHeartReading && (heartRate < HR_LOW_WARNING || heartRate > HR_HIGH_WARNING)
  const hrDanger = hasHeartReading && isDangerousHeartRate(heartRate)
  const pulseAbnormal = hasPulseReading && (pulse < HR_LOW_WARNING || pulse > HR_HIGH_WARNING)
  const pulseDanger = hasPulseReading && isDangerousHeartRate(pulse)
  const spo2Abnormal = hasSpo2Reading && spo2 < SPO2_WARNING
  const spo2Danger = hasSpo2Reading && spo2 < SPO2_DANGER
  const bpAbnormal =
    hasBpReading && (bpSystolic >= BP_SYS_HIGH_WARNING || bpSystolic < BP_SYS_LOW_WARNING || bpDiastolic >= BP_DIA_HIGH_WARNING)
  const bpDanger = hasBpReading && (bpSystolic >= BP_SYS_HIGH_DANGER || bpDiastolic >= BP_DIA_HIGH_DANGER)
  const healthAbnormal = hrAbnormal || pulseAbnormal || spo2Abnormal || bpAbnormal

  const health = hasHealthReading
    ? {
        heartRate,
        pulse,
        pulseSource,
        spo2,
        bpSystolic,
        bpDiastolic,
        bpText: bpRaw ?? null,
        hrAbnormal,
        hrDanger,
        pulseAbnormal,
        pulseDanger,
        spo2Abnormal,
        spo2Danger,
        bpAbnormal,
        bpDanger,
        abnormal: healthAbnormal,
      }
    : null

  const alerts = []
  if (sensorFireDetected) alerts.push('Fire sensor triggered - water spray requested')
  if (cameraFireDetected && !sensorFireDetected) alerts.push('AI camera detected fire - water spray requested')
  if (temp !== null && temp >= TEMP_DANGER) alerts.push(`Critical temperature: ${temp} C`)
  else if (temp !== null && temp >= TEMP_WARNING) alerts.push(`High temperature: ${temp} C`)
  if (gas !== null && gas >= GAS_DANGER) alerts.push(`Hazardous gas level: ${gas}`)
  else if (gas !== null && gas >= GAS_WARNING) alerts.push(`Elevated gas level: ${gas}`)
  if (hrAbnormal) alerts.push(`Worker heart rate abnormal: ${heartRate} bpm`)
  if (pulseAbnormal && pulseSource === 'sensor') alerts.push(`Worker pulse abnormal: ${pulse} bpm`)
  if (spo2Abnormal) alerts.push(`Worker SpO2 low: ${spo2}%`)
  if (bpAbnormal) alerts.push(`Worker blood pressure abnormal: ${bpSystolic}/${bpDiastolic}`)

  let condition = 'Normal'
  if (
    fireDetected ||
    (temp !== null && temp >= TEMP_DANGER) ||
    (gas !== null && gas >= GAS_DANGER) ||
    hrDanger ||
    pulseDanger ||
    spo2Danger ||
    bpDanger
  ) {
    condition = 'Danger'
  } else if (
    (temp !== null && temp >= TEMP_WARNING) ||
    (gas !== null && gas >= GAS_WARNING) ||
    healthAbnormal
  ) {
    condition = 'Warning'
  }

  const setRelay = useCallback((relayKey, value) => {
    return set(ref(database, `${ROOT_PATH}/${relayKey}`), value ? 1 : 0)
      .then(() => setRelayError(null))
      .catch((err) => {
        setRelayError(`${relayKey} write failed: ${err.message}`)
        throw err
      })
  }, [])

  const setPump = useCallback((on) => setRelay('Relay2', on), [setRelay])
  const setFan = useCallback((on) => {
    // Fan callers are event/effect handlers; errors are shown through relayError.
    return setRelay('Relay1', on).catch(() => {})
  }, [setRelay])

  let systemHealth = 'Operational'
  let systemHealthTone = 'ok'
  if (!connected) {
    systemHealth = 'Offline'
    systemHealthTone = 'default'
  } else if (condition === 'Danger') {
    systemHealth = 'Critical'
    systemHealthTone = 'danger'
  } else if (condition === 'Warning') {
    systemHealth = 'Attention'
    systemHealthTone = 'warning'
  }

  return {
    raw: data,
    connected,
    error,
    relayError,
    lastUpdatedAt,
    temp,
    gas,
    fireDetected,
    sensorFireDetected,
    fanOn,
    pumpOn,
    health,
    alerts,
    condition,
    systemHealth,
    systemHealthTone,
    setFan,
    setPump,
    updateThresholds,
    thresholds: {
      TEMP_WARNING,
      TEMP_DANGER,
      GAS_WARNING,
      GAS_DANGER,
      HR_LOW_DANGER,
      HR_LOW_WARNING,
      HR_HIGH_WARNING,
      HR_HIGH_DANGER,
      SPO2_WARNING,
      SPO2_DANGER,
      BP_SYS_HIGH_WARNING,
      BP_SYS_HIGH_DANGER,
      BP_SYS_LOW_WARNING,
      BP_DIA_HIGH_WARNING,
      BP_DIA_HIGH_DANGER,
    },
  }
}
