export const THRESHOLD_STORAGE_KEY = 'smart-safety.environment-thresholds.v1'

export const DEFAULT_THRESHOLDS = {
  TEMP_WARNING: 45,
  TEMP_DANGER: 60,
  GAS_WARNING: 2000,
  GAS_DANGER: 3000,
}

export function validateThresholds(values) {
  if (!values || !Object.keys(DEFAULT_THRESHOLDS).every((key) => Number.isFinite(values[key]))) {
    return 'Enter a valid number for every threshold.'
  }
  if (values.TEMP_WARNING >= values.TEMP_DANGER || values.GAS_WARNING >= values.GAS_DANGER) {
    return 'Critical must be higher than warning.'
  }
  if (values.GAS_WARNING < 0 || values.GAS_DANGER < 0) {
    return 'Gas thresholds cannot be negative.'
  }
  return null
}

export function loadThresholds() {
  try {
    const saved = JSON.parse(localStorage.getItem(THRESHOLD_STORAGE_KEY))
    if (!validateThresholds(saved)) return saved
  } catch {
    // Fall back to defaults when storage is unavailable or contains invalid data.
  }
  return { ...DEFAULT_THRESHOLDS }
}
