import { useCallback, useEffect, useState } from 'react'
import { useSafetyData } from './useSafetyData'
import { useHistory } from './useHistory'
import { WaveChart } from './WaveChart'
import { FireCamera } from './FireCamera'
import { createFirePumpResponse } from './firePumpResponse'
import { validateThresholds } from './safetyThresholds'
import './App.css'

const TONE_COLORS = {
  default: '#4f7cff',
  ok: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
}

const SECONDARY_TREND_COLOR = '#06b6d4'

const NAV_GROUPS = [
  {
    label: 'Monitoring',
    items: [
      { id: 'overview', label: 'Overview', icon: '📊' },
    ],
  },
  {
    label: 'Safety Response',
    items: [
      { id: 'camera', label: 'AI Camera Fire Detection', icon: '🎥' },
      { id: 'actuators', label: 'Safety Actuators', icon: '⚙️' },
    ],
  },
  {
    label: 'Personnel',
    items: [{ id: 'health', label: 'Worker Health Monitoring', icon: '❤️' }],
  },
]

function StatusPill({ condition }) {
  return <span className={`status-pill status-${condition.toLowerCase()}`}>{condition}</span>
}

function Sidebar({ activeSection, onSelect, connected }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">AI</span>
        <div>
          <div className="brand-name">Smart Safety</div>
          <div className="brand-sub">Industrial Monitoring</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className={`conn-dot ${connected ? 'conn-on' : 'conn-off'}`} />
        <div>
          <div className="sidebar-footer-title">{connected ? 'Live' : 'Connecting...'}</div>
          <div className="sidebar-footer-sub">Firebase stream</div>
        </div>
      </div>
    </aside>
  )
}

function MetricCard({ label, value, unit, sub, children, tone = 'default' }) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
      {children}
    </div>
  )
}

function ThresholdEditor({ label, unit, warningKey, criticalKey, thresholds, onSave }) {
  const [warning, setWarning] = useState(String(thresholds[warningKey]))
  const [critical, setCritical] = useState(String(thresholds[criticalKey]))
  const [feedback, setFeedback] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    const next = {
      TEMP_WARNING: thresholds.TEMP_WARNING,
      TEMP_DANGER: thresholds.TEMP_DANGER,
      GAS_WARNING: thresholds.GAS_WARNING,
      GAS_DANGER: thresholds.GAS_DANGER,
      [warningKey]: warning.trim() === '' ? NaN : Number(warning),
      [criticalKey]: critical.trim() === '' ? NaN : Number(critical),
    }
    const error = validateThresholds(next)
    if (error) {
      setFeedback({ error: true, text: error })
      return
    }
    try {
      onSave(next)
      setFeedback({ error: false, text: 'Saved in this browser.' })
    } catch {
      setFeedback({ error: true, text: 'Could not save thresholds. Check browser storage and try again.' })
    }
  }

  return (
    <form className="threshold-editor" onSubmit={handleSubmit} aria-label={`${label} thresholds`}>
      <div className="threshold-fields">
        <label>
          Warning ({unit})
          <input
            type="number"
            step="any"
            min={unit === 'ppm' ? 0 : undefined}
            required
            value={warning}
            onChange={(event) => { setWarning(event.target.value); setFeedback(null) }}
          />
        </label>
        <label>
          Critical ({unit})
          <input
            type="number"
            step="any"
            min={unit === 'ppm' ? 0 : undefined}
            required
            value={critical}
            onChange={(event) => { setCritical(event.target.value); setFeedback(null) }}
          />
        </label>
      </div>
      <button type="submit" className="threshold-save">Save thresholds</button>
      {feedback && (
        <p className={`threshold-feedback ${feedback.error ? 'threshold-error' : ''}`} role="status">
          {feedback.text}
        </p>
      )}
    </form>
  )
}

function TrendCard({ label, value, unit, tone = 'default', chartId, history, secondary, legendPrimaryLabel }) {
  return (
    <div className={`trend-card tone-${tone}`}>
      <div className="trend-header">
        <span className="trend-label">{label}</span>
        <span className="trend-value">
          {value}
          {unit && <span className="trend-unit">{unit}</span>}
        </span>
      </div>
      {secondary && (
        <div className="trend-legend">
          <span className="legend-chip">
            <i style={{ background: TONE_COLORS[tone] }} />
            {legendPrimaryLabel || label}
          </span>
          <span className="legend-chip">
            <i style={{ background: secondary.color }} />
            {secondary.label}
          </span>
        </div>
      )}
      <div className="trend-chart">
        <WaveChart
          data={history}
          id={chartId}
          color={TONE_COLORS[tone]}
          height={110}
          secondaryData={secondary?.history}
          secondaryColor={secondary?.color}
        />
      </div>
    </div>
  )
}

function ActuatorCard({ label, isOn, onToggle, description }) {
  return (
    <div className="actuator-card">
      <div className="actuator-info">
        <div className="actuator-label">{label}</div>
        <div className="actuator-desc">{description}</div>
      </div>
      <button
        type="button"
        className={`actuator-toggle ${isOn ? 'is-on' : 'is-off'}`}
        onClick={() => onToggle(!isOn)}
      >
        {isOn ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Awaiting first sync'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(timestamp)
}

function App() {
  const [cameraFireDetected, setCameraFireDetected] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')

  const {
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
    thresholds,
    updateThresholds,
  } = useSafetyData(cameraFireDetected)

  const [pumpResponse] = useState(() => createFirePumpResponse({ write: setPump }))

  const handleCameraStatus = useCallback((detected) => {
    pumpResponse.setFire(sensorFireDetected || detected)
    setCameraFireDetected(detected)
  }, [pumpResponse, sensorFireDetected])

  useEffect(() => {
    pumpResponse.setFire(fireDetected)
  }, [pumpResponse, fireDetected])

  useEffect(() => {
    pumpResponse.observeRelay(pumpOn)
  }, [pumpResponse, pumpOn])

  useEffect(() => () => pumpResponse.dispose(), [pumpResponse])

  const tempTone =
    temp === null ? 'default' : temp >= thresholds.TEMP_DANGER ? 'danger' : temp >= thresholds.TEMP_WARNING ? 'warning' : 'ok'
  const gasTone =
    gas === null ? 'default' : gas >= thresholds.GAS_DANGER ? 'danger' : gas >= thresholds.GAS_WARNING ? 'warning' : 'ok'

  const hrTone = !health ? 'default' : health.hrDanger ? 'danger' : health.hrAbnormal ? 'warning' : 'ok'
  const pulseTone =
    !health || health.pulseSource === 'none'
      ? 'default'
      : health.pulseDanger
      ? 'danger'
      : health.pulseAbnormal
      ? 'warning'
      : 'ok'
  const spo2Tone = !health ? 'default' : health.spo2Danger ? 'danger' : health.spo2Abnormal ? 'warning' : 'ok'
  const bpTone = !health ? 'default' : health.bpDanger ? 'danger' : health.bpAbnormal ? 'warning' : 'ok'
  const workerCondition = !health ? null : health.abnormal ? 'Alert' : 'Normal'

  const fanShouldBeOn = tempTone === 'danger' || gasTone === 'danger'

  useEffect(() => {
    if (fanShouldBeOn && !fanOn) {
      setFan(true)
    } else if (!fanShouldBeOn && fanOn) {
      setFan(false)
    }
  }, [fanShouldBeOn, fanOn, setFan])

  const tempHistory = useHistory(temp)
  const gasHistory = useHistory(gas)
  const fireHistory = useHistory(fireDetected ? 1 : 0)
  const heartRateHistory = useHistory(health ? health.heartRate : null)
  const pulseHistory = useHistory(health ? health.pulse : null)
  const spo2History = useHistory(health ? health.spo2 : null)
  const bpSystolicHistory = useHistory(health ? health.bpSystolic : null)
  const bpDiastolicHistory = useHistory(health ? health.bpDiastolic : null)
  const safetySource = sensorFireDetected ? 'Fire sensor + AI pipeline armed' : 'Sensor stream active'

  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} onSelect={setActiveSection} connected={connected} />

      <div className="main-panel">
        <header className="dash-header">
          <div className="brand">
            <h1>AI-Based Smart Industrial Safety &amp; Predictive Hazard Monitoring System</h1>
            <p className="header-copy">
              Live warehouse hazard monitoring with actuator automation, wearable health telemetry,
              and AI-assisted fire detection.
            </p>
            <div className="header-meta">
              <span>Last sync: {formatTimestamp(lastUpdatedAt)}</span>
            </div>
          </div>
          <div className="header-status">
            <span className={`conn-dot ${connected ? 'conn-on' : 'conn-off'}`} />
            {connected ? 'Live' : 'Connecting...'}
            <StatusPill condition={condition} />
          </div>
        </header>

        <div className="main-scroll">
          {error && <div className="banner banner-error">Database error: {error}</div>}
          {relayError && <div className="banner banner-error" role="alert">{relayError}</div>}

          {alerts.length > 0 && (
            <div className="banner banner-alert">
              <strong>Active Alerts:</strong>
              <ul>
                {alerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
          )}

          <main className="dash-content">
          {activeSection === 'overview' && (
            <section className="section">
              <h2>Overview</h2>
              <div className="metric-grid">
                <MetricCard
                  label="Safety Condition"
                  value={condition}
                  tone={condition === 'Danger' ? 'danger' : condition === 'Warning' ? 'warning' : 'ok'}
                  sub={safetySource}
                />
                <MetricCard
                  label="System Health"
                  value={systemHealth}
                  tone={systemHealthTone}
                  sub={connected ? 'Firebase stream connected' : 'Waiting for database connection'}
                />
                <MetricCard
                  label="Ventilation Status"
                  value={fanOn ? 'ACTIVE' : 'IDLE'}
                  tone={fanOn ? 'warning' : 'ok'}
                  sub={fanShouldBeOn ? 'Auto mode requesting airflow' : 'No ventilation trigger active'}
                />
                <MetricCard
                  label="Water Spray Status"
                  value={pumpOn ? 'ACTIVE' : 'IDLE'}
                  tone={pumpOn ? 'danger' : 'ok'}
                  sub={fireDetected ? 'Fire response path armed' : 'No fire response active'}
                />

                <MetricCard
                  label="Temperature"
                  value={temp ?? '--'}
                  unit="C"
                  tone={tempTone}
                  sub={`Warning >= ${thresholds.TEMP_WARNING} C | Critical >= ${thresholds.TEMP_DANGER} C`}
                >
                  <ThresholdEditor
                    label="Temperature"
                    unit="C"
                    warningKey="TEMP_WARNING"
                    criticalKey="TEMP_DANGER"
                    thresholds={thresholds}
                    onSave={updateThresholds}
                  />
                </MetricCard>
                <MetricCard
                  label="Gas / Smoke Level"
                  value={gas ?? '--'}
                  unit="ppm"
                  tone={gasTone}
                  sub={`Warning >= ${thresholds.GAS_WARNING} ppm | Critical >= ${thresholds.GAS_DANGER} ppm`}
                >
                  <ThresholdEditor
                    label="Gas / Smoke Level"
                    unit="ppm"
                    warningKey="GAS_WARNING"
                    criticalKey="GAS_DANGER"
                    thresholds={thresholds}
                    onSave={updateThresholds}
                  />
                </MetricCard>
                <MetricCard
                  label="Fire Status"
                  value={fireDetected ? 'FIRE DETECTED' : 'No Fire'}
                  tone={fireDetected ? 'danger' : 'ok'}
                  sub={
                    sensorFireDetected
                      ? 'Triggered by hardware fire sensor'
                      : cameraFireDetected
                      ? 'Triggered by AI camera analysis'
                      : 'No fire trigger'
                  }
                />
                <MetricCard
                  label="Ventilation Logic"
                  value={fanShouldBeOn ? 'AUTO ON' : 'STANDBY'}
                  tone={fanShouldBeOn ? 'danger' : 'ok'}
                  sub="Fan auto-activates only at danger-level temperature or gas readings"
                />
              </div>
              <p className="section-divider-label">Live trend charts</p>
              <div className="trend-grid">
                <TrendCard
                  label="Temperature"
                  value={temp ?? '--'}
                  unit="C"
                  tone={tempTone}
                  chartId="temp"
                  history={tempHistory}
                />
                <TrendCard
                  label="Gas / Smoke Level"
                  value={gas ?? '--'}
                  unit="ppm"
                  tone={gasTone}
                  chartId="gas"
                  history={gasHistory}
                />
                <TrendCard
                  label="Fire Status"
                  value={fireDetected ? 1 : 0}
                  tone={fireDetected ? 'danger' : 'ok'}
                  chartId="fire"
                  history={fireHistory}
                />
              </div>
            </section>
          )}

          {activeSection === 'camera' && (
            <section className="section">
              <h2>AI Camera Fire Detection</h2>
              <p className="section-hint">
                Select the external webcam (not the laptop built-in camera) from the dropdown, then start
                detection. The feed is analyzed live in the browser for fire-colored, flickering regions.
              </p>
              <FireCamera onStatusChange={handleCameraStatus} />
            </section>
          )}

          {activeSection === 'actuators' && (
            <section className="section">
              <h2>Safety Actuators</h2>
              <div className="actuator-grid">
                <ActuatorCard
                  label="Ventilation Fan (Relay 1)"
                  description="Auto-activates only at danger-level temperature or gas, and can still be overridden manually"
                  isOn={fanOn}
                  onToggle={setFan}
                />
                <ActuatorCard
                  label="Water Spray Pump (Relay 2)"
                  description="Activates immediately on fire detection, stays on while fire is detected, and runs for at least 3 seconds"
                  isOn={pumpOn}
                  onToggle={(on) => { setPump(on).catch(() => {}) }}
                />
              </div>
            </section>
          )}

          {activeSection === 'health' && (
            <section className="section">
              <div className="section-header-row">
                <h2>Worker Health Monitoring</h2>
                {workerCondition && <StatusPill condition={workerCondition} />}
              </div>
              {health ? (
                <>
                  <div className="metric-grid">
                    <MetricCard
                      label="Heart Rate"
                      value={health.heartRate ?? '--'}
                      unit="bpm"
                      tone={hrTone}
                      sub="Primary wearable heart-rate feed"
                    />
                    <MetricCard
                      label="Pulse"
                      value={health.pulse}
                      unit="bpm"
                      tone={pulseTone}
                      sub={
                        health.pulseSource === 'sensor'
                          ? 'Dedicated pulse reading received'
                          : health.pulseSource === 'heart-rate'
                          ? 'No dedicated pulse sensor - mirroring heart-rate reading'
                          : 'No pulse sensor connected'
                      }
                    />
                    <MetricCard
                      label="SpO2"
                      value={health.spo2 ?? '--'}
                      unit="%"
                      tone={spo2Tone}
                      sub="Blood oxygen saturation"
                    />
                    <MetricCard
                      label="Blood Pressure"
                      value={health.bpText ?? '--'}
                      unit="mmHg"
                      tone={bpTone}
                      sub="Systolic / diastolic reading from the wearable"
                    />
                  </div>

                  <p className="section-divider-label">Live trend charts for the last readings</p>
                  <div className="trend-grid">
                    <TrendCard
                      label="Heart Rate"
                      value={health.heartRate ?? '--'}
                      unit="bpm"
                      tone={hrTone}
                      chartId="heart-rate"
                      history={heartRateHistory}
                    />
                    <TrendCard
                      label="Pulse"
                      value={health.pulse}
                      unit="bpm"
                      tone={pulseTone}
                      chartId="pulse"
                      history={pulseHistory}
                    />
                    <TrendCard
                      label="SpO2"
                      value={health.spo2 ?? '--'}
                      unit="%"
                      tone={spo2Tone}
                      chartId="spo2"
                      history={spo2History}
                    />
                    <TrendCard
                      label="Blood Pressure"
                      value={health.bpText ?? '--'}
                      unit="mmHg"
                      tone={bpTone}
                      chartId="bp"
                      history={bpSystolicHistory}
                      legendPrimaryLabel="Systolic"
                      secondary={{
                        label: 'Diastolic',
                        history: bpDiastolicHistory,
                        color: SECONDARY_TREND_COLOR,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  Wearable device not connected yet - no heart rate, pulse, SpO2, or BP readings received.
                </div>
              )}
            </section>
          )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
