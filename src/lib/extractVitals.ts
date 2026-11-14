import type { VitalMetrics } from '@/types/health'

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
  const lower = text.toLowerCase()
  const metrics: VitalMetrics = {}

  const hr = firstMatch(lower, [
    /(?:heart\s*rate|hr|pulse)\s*(?:is|was|=|:)?\s*(\d{2,3})\s*(?:bpm)?/,
    /(\d{2,3})\s*bpm/,
  ])
  if (hr) {
    const value = Number(hr[1])
    if (value >= 30 && value <= 250) metrics.heartRate = value
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
    /(?:temp(?:erature)?|fever)\s*(?:is|was|=|:|of)?\s*(\d{2}(?:\.\d)?)\s*(?:°\s*)?(?:c|celsius)?/,
    /(\d{2}(?:\.\d)?)\s*(?:°\s*)?c(?:elsius)?/,
  ])
  if (temp) {
    const value = Number(temp[1])
    if (value >= 34 && value <= 43) metrics.temperatureC = value
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
