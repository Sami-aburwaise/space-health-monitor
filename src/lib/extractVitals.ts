import type { VitalMetrics, VitalReading } from '@/types/health'

function firstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match
  }
  return null
}

/**
 * Parse conversational health metrics from free text.
 * Returns null when no recognizable vitals are present.
 */
export function extractVitalsFromText(text: string): VitalMetrics | null {
  const lower = text.toLowerCase().replace(/,/g, ' ')
  const metrics: VitalMetrics = {}

  const hr = firstMatch(lower, [
    /(?:heart\s*rate|heart\s*beat|hr|pulse)\s*(?:is|was|=|:)?\s*(\d{2,3})\s*(?:bpm)?/,
    /(\d{2,3})\s*(?:bpm|beats(?:\s*per\s*minute)?)/,
    /(?:bpm|beats)\s*(?:of\s*)?(\d{2,3})/,
  ])
  if (hr) {
    const value = Number(hr[1])
    // Accept extreme reported rates — never reject as "recount"
    if (value >= 1 && value <= 400) metrics.heartRate = value
  }

  const bp = firstMatch(lower, [
    /(?:blood\s*pressure|b\.?p\.?)\s*(?:is|was|=|:)?\s*(\d{2,3})\s*[\/\-]\s*(\d{2,3})/,
    /(\d{2,3})\s*[\/]\s*(\d{2,3})\s*(?:mm\s*hg|mmhg)?/,
  ])
  if (bp) {
    const systolic = Number(bp[1])
    const diastolic = Number(bp[2])
    if (systolic >= 70 && systolic <= 250 && diastolic >= 40 && diastolic <= 150) {
      metrics.systolic = systolic
      metrics.diastolic = diastolic
    }
  }

  const spo2 = firstMatch(lower, [
    /(?:spo\s*2|oxygen(?:\s*sat(?:uration)?)?|o2\s*sat)\s*(?:is|was|=|:)?\s*(\d{2,3})\s*%?/,
    /(\d{2,3})\s*%\s*(?:spo\s*2|oxygen)?/,
  ])
  if (spo2) {
    const value = Number(spo2[1])
    if (value >= 70 && value <= 100) metrics.spo2 = value
  }

  const temp = firstMatch(lower, [
    /(?:temp(?:erature)?|fever)\s*(?:is|was|=|:|of)?\s*(\d{2}(?:\.\d+)?)\s*(?:°\s*)?(?:c|celsius|degrees?|deg)?/,
    /(\d{2}(?:\.\d+)?)\s*(?:°\s*)?(?:c|celsius)\b/,
    /(\d{2}(?:\.\d+)?)\s*(?:degrees?|deg)\s*(?:c|celsius)?/,
    /(\d{2}(?:\.\d+)?)\s*°/,
    // "40 degree temp" / "40 degrees temperature"
    /(\d{2}(?:\.\d+)?)\s*(?:degrees?|deg)\s*(?:temp(?:erature)?)?/,
  ])
  if (temp) {
    const value = Number(temp[1])
    // Accept any reported reading — never reject as "not body temp"
    if (value >= 15 && value <= 50) metrics.temperatureC = value
  }

  const weight = firstMatch(lower, [
    /(?:weight|weigh(?:s|ed)?)\s*(?:is|was|=|:)?\s*(\d{2,3}(?:\.\d)?)\s*(kg|kgs|kilograms?|lb|lbs|pounds?)?/,
  ])
  if (weight) {
    let value = Number(weight[1])
    const unit = weight[2] ?? 'kg'
    if (/lb|pound/.test(unit)) value = value * 0.453592
    if (value >= 30 && value <= 300) metrics.weightKg = Math.round(value * 10) / 10
  }

  const hasAny =
    metrics.heartRate != null ||
    metrics.systolic != null ||
    metrics.diastolic != null ||
    metrics.spo2 != null ||
    metrics.temperatureC != null ||
    metrics.weightKg != null

  if (!hasAny) return null

  metrics.rawExcerpt = text.trim().slice(0, 160)
  return metrics
}

export function formatExtractedMetrics(metrics: VitalMetrics): string {
  const parts: string[] = []
  if (metrics.heartRate != null) parts.push(`HR ${metrics.heartRate} bpm`)
  if (metrics.systolic != null && metrics.diastolic != null) {
    parts.push(`BP ${metrics.systolic}/${metrics.diastolic} mmHg`)
  }
  if (metrics.spo2 != null) parts.push(`SpO₂ ${metrics.spo2}%`)
  if (metrics.temperatureC != null) parts.push(`Temp ${metrics.temperatureC}°C`)
  if (metrics.weightKg != null) parts.push(`Weight ${metrics.weightKg} kg`)
  return parts.join(' · ')
}

/** Demo thresholds for avatar emergency glow / triage escalation. */
export function isCriticalVitals(metrics: VitalMetrics | null | undefined): boolean {
  if (!metrics) return false
  const { heartRate: hr, temperatureC: temp, spo2, systolic, diastolic } = metrics
  if (hr != null && (hr < 40 || hr > 140)) return true
  if (temp != null && (temp < 35 || temp >= 39)) return true
  if (spo2 != null && spo2 < 90) return true
  if (systolic != null && (systolic >= 180 || systolic <= 80)) return true
  if (diastolic != null && diastolic >= 120) return true
  return false
}

/** Merge a new parse onto the latest stored reading for multi-turn checks. */
export function mergeVitals(
  latest: VitalReading | VitalMetrics | null | undefined,
  extracted: VitalMetrics | null | undefined,
): VitalMetrics {
  return {
    heartRate: extracted?.heartRate ?? latest?.heartRate,
    systolic: extracted?.systolic ?? latest?.systolic,
    diastolic: extracted?.diastolic ?? latest?.diastolic,
    spo2: extracted?.spo2 ?? latest?.spo2,
    temperatureC: extracted?.temperatureC ?? latest?.temperatureC,
    weightKg: extracted?.weightKg ?? latest?.weightKg,
    rawExcerpt: extracted?.rawExcerpt ?? latest?.rawExcerpt,
  }
}

/** Readings older than this no longer describe the crew member's current state. */
export const CURRENT_VITALS_WINDOW_MS = 30 * 60 * 1000

/** Newest value of each metric among recent readings (vitals[0] is newest). */
export function currentVitals(readings: VitalReading[], now = Date.now()): VitalMetrics {
  const current: VitalMetrics = {}
  for (const r of readings) {
    if (now - new Date(r.recordedAt).getTime() > CURRENT_VITALS_WINDOW_MS) continue
    current.heartRate ??= r.heartRate
    current.systolic ??= r.systolic
    current.diastolic ??= r.diastolic
    current.spo2 ??= r.spo2
    current.temperatureC ??= r.temperatureC
    current.weightKg ??= r.weightKg
  }
  return current
}

export function criticalVitalLabel(metrics: VitalMetrics): string {
  const flags: string[] = []
  if (metrics.heartRate != null && (metrics.heartRate < 40 || metrics.heartRate > 140)) {
    flags.push(`HR ${metrics.heartRate}`)
  }
  if (metrics.temperatureC != null && (metrics.temperatureC < 35 || metrics.temperatureC >= 39)) {
    flags.push(`Temp ${metrics.temperatureC}°C`)
  }
  if (metrics.spo2 != null && metrics.spo2 < 90) flags.push(`SpO₂ ${metrics.spo2}%`)
  if (metrics.systolic != null && (metrics.systolic >= 180 || metrics.systolic <= 80)) {
    flags.push(`BP ${metrics.systolic}/${metrics.diastolic ?? '—'}`)
  }
  return flags.join(' · ') || formatExtractedMetrics(metrics) || 'Critical vitals'
}
