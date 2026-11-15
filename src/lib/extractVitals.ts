import type { MeasureKind, VitalMetrics, VitalReading } from '@/types/health'

const NUM = '(-?\\d+(?:\\.\\d+)?)'

function firstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match
  }
  return null
}

/** Realistic human ranges. Anything outside is refused with a reason, never stored. */
export const PLAUSIBLE = {
  heart_rate: { min: 25, max: 250, unit: 'bpm', name: 'heart rate' },
  systolic: { min: 60, max: 260, unit: 'mmHg', name: 'top blood pressure number' },
  diastolic: { min: 30, max: 160, unit: 'mmHg', name: 'bottom blood pressure number' },
  temperature: { min: 30, max: 43, unit: '°C', name: 'body temperature' },
  glucose: { min: 20, max: 600, unit: 'mg/dL', name: 'blood glucose' },
  sleep: { min: 0, max: 24, unit: 'hours', name: 'sleep' },
  mood: { min: 1, max: 5, unit: '', name: 'mood score' },
  spo2: { min: 50, max: 100, unit: '%', name: 'blood oxygen' },
  weight: { min: 30, max: 300, unit: 'kg', name: 'weight' },
} as const

type PlausibleKey = keyof typeof PLAUSIBLE

export function rangeError(key: PlausibleKey, value: number): string | null {
  const r = PLAUSIBLE[key]
  if (value >= r.min && value <= r.max) return null
  const unit = r.unit ? ` ${r.unit}` : ''
  return `${value}${unit} is not a realistic ${r.name}. I expect ${r.min}–${r.max}${unit}. Please measure again.`
}

export interface ParsedReadings {
  metrics: VitalMetrics | null
  /** Human-readable reasons for every value that was refused */
  rejected: string[]
  /** Measure cards to offer again for refused values */
  rejectedKinds: MeasureKind[]
}

const WORD_ONLY = new RegExp(
  '\\b(heart\\s*rate|pulse|blood\\s*pressure|bp|temperature|temp|glucose|blood\\s*sugar|oxygen|spo\\s*2|mood|sleep)\\s+(?:is|was)\\s+(?:very\\s+|really\\s+|a\\s+bit\\s+|kind\\s+of\\s+)?(high|low|fast|slow|bad|good|fine|ok|okay|normal|great|terrible)\\b',
)

const WORD_KIND: Record<string, { kind: MeasureKind; name: string; example: string }> = {
  heart: { kind: 'heart_rate', name: 'heart rate', example: 'My heart rate is 72 bpm' },
  pulse: { kind: 'heart_rate', name: 'heart rate', example: 'My heart rate is 72 bpm' },
  blood: { kind: 'blood_pressure', name: 'blood pressure', example: 'My blood pressure is 118/76' },
  bp: { kind: 'blood_pressure', name: 'blood pressure', example: 'My blood pressure is 118/76' },
  temp: { kind: 'temperature', name: 'temperature', example: 'My temperature is 36.8 C' },
  glucose: { kind: 'glucose', name: 'blood glucose', example: 'My glucose is 90 mg/dL' },
  sugar: { kind: 'glucose', name: 'blood glucose', example: 'My glucose is 90 mg/dL' },
  oxygen: { kind: 'spo2', name: 'blood oxygen', example: 'My SpO2 is 98%' },
  spo: { kind: 'spo2', name: 'blood oxygen', example: 'My SpO2 is 98%' },
  mood: { kind: 'mood', name: 'mood', example: 'My mood is 4 out of 5' },
  sleep: { kind: 'sleep', name: 'sleep', example: 'I slept 7.5 hours' },
}

function wordKind(word: string) {
  const w = word.toLowerCase()
  if (w.startsWith('blood s')) return WORD_KIND.sugar
  const key = Object.keys(WORD_KIND).find((k) => w.startsWith(k))
  return key ? WORD_KIND[key] : null
}

/**
 * Parse health readings from free text and refuse impossible values.
 * Accepts heart rate, blood pressure, temperature, glucose, sleep, mood, SpO₂ and weight.
 */
export function parseReadings(text: string): ParsedReadings {
  const lower = text.toLowerCase().replace(/,/g, ' ')
  const metrics: VitalMetrics = {}
  const rejected: string[] = []
  const rejectedKinds: MeasureKind[] = []

  function refuse(key: PlausibleKey, value: number, kind: MeasureKind): boolean {
    const err = rangeError(key, value)
    if (!err) return false
    rejected.push(err)
    if (!rejectedKinds.includes(kind)) rejectedKinds.push(kind)
    return true
  }

  const hr = firstMatch(lower, [
    new RegExp(`(?:heart\\s*rate|heart\\s*beat|\\bhr\\b|pulse)\\s*(?:is|was|=|:|of)?\\s*${NUM}`),
    new RegExp(`${NUM}\\s*(?:bpm|beats(?:\\s*per\\s*minute)?)`),
  ])
  if (hr) {
    const value = Number(hr[1])
    if (!refuse('heart_rate', value, 'heart_rate')) metrics.heartRate = Math.round(value)
  }

  const bp = firstMatch(lower, [
    new RegExp(
      `(?:blood\\s*pressure|\\bb\\.?p\\.?)\\s*(?:is|was|=|:|of)?\\s*${NUM}\\s*(?:/|over)\\s*${NUM}`,
    ),
    /(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\s*(?:mm\s*hg)?/,
  ])
  if (bp) {
    const systolic = Number(bp[1])
    const diastolic = Number(bp[2])
    const badS = refuse('systolic', systolic, 'blood_pressure')
    const badD = refuse('diastolic', diastolic, 'blood_pressure')
    if (!badS && !badD && diastolic >= systolic) {
      rejected.push(
        `${systolic}/${diastolic} is not a realistic blood pressure. The top number should be higher than the bottom. Please measure again.`,
      )
      if (!rejectedKinds.includes('blood_pressure')) rejectedKinds.push('blood_pressure')
    } else if (!badS && !badD) {
      metrics.systolic = Math.round(systolic)
      metrics.diastolic = Math.round(diastolic)
    }
  }

  const spo2 = firstMatch(lower, [
    new RegExp(`(?:spo\\s*2|oxygen(?:\\s*sat(?:uration)?)?|o2\\s*sat)\\s*(?:is|was|=|:|of)?\\s*${NUM}\\s*%?`),
    new RegExp(`${NUM}\\s*%`),
  ])
  if (spo2) {
    const value = Number(spo2[1])
    if (!refuse('spo2', value, 'spo2')) metrics.spo2 = Math.round(value)
  }

  const temp = firstMatch(lower, [
    new RegExp(`(?:temp(?:erature)?|fever)\\s*(?:is|was|=|:|of)?\\s*${NUM}`),
    new RegExp(`${NUM}\\s*(?:°\\s*)?(?:c|celsius)\\b`),
    new RegExp(`${NUM}\\s*(?:°|degrees?|deg)`),
  ])
  if (temp) {
    const value = Number(temp[1])
    if (!refuse('temperature', value, 'temperature')) {
      metrics.temperatureC = Math.round(value * 10) / 10
    }
  }

  const glucose = firstMatch(lower, [
    new RegExp(
      `(?:glucose|blood\\s*sugar|\\bsugar\\b|\\bbg\\b)\\s*(?:level)?\\s*(?:is|was|=|:|of)?\\s*${NUM}\\s*(mg\\s*/?\\s*dl|mmol(?:\\s*/\\s*l)?)?`,
    ),
    new RegExp(`${NUM}\\s*(mg\\s*/?\\s*dl|mmol\\s*/?\\s*l)`),
  ])
  if (glucose) {
    let value = Number(glucose[1])
    if (glucose[2]?.startsWith('mmol')) value = Math.round(value * 18)
    if (!refuse('glucose', value, 'glucose')) metrics.glucoseMgDl = Math.round(value)
  }

  const sleep = firstMatch(lower, [
    new RegExp(`(?:slept|sleep|sleeping)\\s*(?:for|was|is|=|:|of)?\\s*(?:about|around)?\\s*${NUM}`),
    new RegExp(`${NUM}\\s*(?:h|hrs?|hours?)\\s*(?:of\\s*)?sleep`),
  ])
  if (sleep) {
    const value = Number(sleep[1])
    if (!refuse('sleep', value, 'sleep')) metrics.sleepHours = Math.round(value * 10) / 10
  }

  const mood = firstMatch(lower, [
    new RegExp(`\\bmood\\s*(?:today)?\\s*(?:is|was|=|:|of)?\\s*(?:a\\s*)?${NUM}`),
  ])
  if (mood) {
    const value = Number(mood[1])
    if (!Number.isInteger(value)) {
      rejected.push(`Please rate your mood as a whole number from 1 to 5.`)
      if (!rejectedKinds.includes('mood')) rejectedKinds.push('mood')
    } else if (!refuse('mood', value, 'mood')) {
      metrics.moodScore = value
    }
  }

  const weight = firstMatch(lower, [
    new RegExp(`(?:weight|weigh(?:s|ed)?)\\s*(?:is|was|=|:)?\\s*${NUM}\\s*(kg|kgs|kilograms?|lb|lbs|pounds?)?`),
  ])
  if (weight) {
    let value = Number(weight[1])
    if (/lb|pound/.test(weight[2] ?? '')) value = value * 0.453592
    value = Math.round(value * 10) / 10
    if (!refuse('weight', value, 'strength')) metrics.weightKg = value
  }

  if (!/\d/.test(lower)) {
    const word = lower.match(WORD_ONLY)
    const k = word ? wordKind(word[1]) : null
    if (k) {
      rejected.push(
        `I need a number to log your ${k.name}. For example: “${k.example}”.`,
      )
      rejectedKinds.push(k.kind)
    }
  }

  const hasAny = Object.keys(metrics).length > 0
  if (hasAny) metrics.rawExcerpt = text.trim().slice(0, 160)

  return {
    metrics: hasAny ? metrics : null,
    rejected,
    rejectedKinds: rejectedKinds.filter((k) => k !== 'strength'),
  }
}

export function extractVitalsFromText(text: string): VitalMetrics | null {
  return parseReadings(text).metrics
}

export function formatExtractedMetrics(metrics: VitalMetrics): string {
  const parts: string[] = []
  if (metrics.heartRate != null) parts.push(`HR ${metrics.heartRate} bpm`)
  if (metrics.systolic != null && metrics.diastolic != null) {
    parts.push(`BP ${metrics.systolic}/${metrics.diastolic} mmHg`)
  }
  if (metrics.spo2 != null) parts.push(`SpO₂ ${metrics.spo2}%`)
  if (metrics.temperatureC != null) parts.push(`Temp ${metrics.temperatureC}°C`)
  if (metrics.glucoseMgDl != null) parts.push(`Glucose ${metrics.glucoseMgDl} mg/dL`)
  if (metrics.sleepHours != null) parts.push(`Sleep ${metrics.sleepHours} h`)
  if (metrics.moodScore != null) parts.push(`Mood ${metrics.moodScore}/5`)
  if (metrics.weightKg != null) parts.push(`Weight ${metrics.weightKg} kg`)
  return parts.join(' · ')
}

/**
 * Readings that start the onboard emergency procedure, beyond the "alert" band.
 * Kept in sync with the critical line in the coach prompt (`agent.ts`).
 */
export const CRITICAL = {
  hrLow: 40,
  hrHigh: 140,
  tempLow: 35,
  tempHigh: 39.5,
  spo2Low: 88,
  systolicHigh: 180,
  diastolicHigh: 120,
  systolicLow: 70,
  glucoseLow: 54,
} as const

export function isCriticalVitals(metrics: VitalMetrics | null | undefined): boolean {
  if (!metrics) return false
  return criticalFlags(metrics).length > 0
}

function criticalFlags(m: VitalMetrics): string[] {
  const flags: string[] = []
  if (m.heartRate != null && (m.heartRate < CRITICAL.hrLow || m.heartRate > CRITICAL.hrHigh)) {
    flags.push(`HR ${m.heartRate} bpm`)
  }
  if (
    m.temperatureC != null &&
    (m.temperatureC < CRITICAL.tempLow || m.temperatureC >= CRITICAL.tempHigh)
  ) {
    flags.push(`Temp ${m.temperatureC}°C`)
  }
  if (m.spo2 != null && m.spo2 <= CRITICAL.spo2Low) flags.push(`SpO₂ ${m.spo2}%`)
  if (
    (m.systolic != null && (m.systolic >= CRITICAL.systolicHigh || m.systolic < CRITICAL.systolicLow)) ||
    (m.diastolic != null && m.diastolic >= CRITICAL.diastolicHigh)
  ) {
    flags.push(`BP ${m.systolic ?? '—'}/${m.diastolic ?? '—'}`)
  }
  if (m.glucoseMgDl != null && m.glucoseMgDl < CRITICAL.glucoseLow) {
    flags.push(`Glucose ${m.glucoseMgDl} mg/dL`)
  }
  return flags
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
    glucoseMgDl: extracted?.glucoseMgDl ?? latest?.glucoseMgDl,
    sleepHours: extracted?.sleepHours ?? latest?.sleepHours,
    moodScore: extracted?.moodScore ?? latest?.moodScore,
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
    if (current.systolic == null && r.systolic != null) {
      current.systolic = r.systolic
      current.diastolic = r.diastolic
    }
    current.spo2 ??= r.spo2
    current.temperatureC ??= r.temperatureC
    current.weightKg ??= r.weightKg
    current.glucoseMgDl ??= r.glucoseMgDl
    current.sleepHours ??= r.sleepHours
    current.moodScore ??= r.moodScore
  }
  return current
}

export function criticalVitalLabel(metrics: VitalMetrics): string {
  return criticalFlags(metrics).join(' · ') || formatExtractedMetrics(metrics) || 'Critical vitals'
}
