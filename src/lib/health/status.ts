import {
  CORE_INDICATORS,
  INDICATOR_ORDER,
  INDICATORS,
  LEVEL_RANK,
  type Assessment,
  type IndicatorId,
  type StatusLevel,
} from '@/lib/health/indicators'
import type { VitalReading } from '@/types/health'

export interface IndicatorStatus {
  id: IndicatorId
  /** null = not measured today */
  level: StatusLevel | null
  assessment: Assessment | null
  display: string | null
  recordedAt: string | null
  /** Raised to alert because it was on watch three days in a row */
  escalated: boolean
}

export interface OverallStatus {
  /** null = nothing measured today */
  level: StatusLevel | null
  sentence: string
  notes: string[]
  indicators: Record<IndicatorId, IndicatorStatus>
  notMeasured: IndicatorId[]
  /** Consecutive days with at least one check-in */
  streakDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const WATCH_DAYS_TO_ESCALATE = 3

export function dayKey(time: number): string {
  return new Date(time).toDateString()
}

export interface DailyVitalRow {
  /** Calendar day key from dayKey() */
  key: string
  /** Local midnight for this day */
  dayStart: number
  /** Newest reading used for any cell on this day */
  recordedAt: string
  /** Latest value that day for each indicator, or null if not measured */
  values: Record<IndicatorId, VitalReading | null>
}

/** One row per calendar day with the newest reading of each indicator that day. */
export function buildDailyVitalRows(readings: VitalReading[]): DailyVitalRow[] {
  const sorted = [...readings].sort(
    (x, y) => new Date(y.recordedAt).getTime() - new Date(x.recordedAt).getTime(),
  )
  const rows = new Map<string, DailyVitalRow>()

  for (const reading of sorted) {
    const at = new Date(reading.recordedAt).getTime()
    const key = dayKey(at)
    let row = rows.get(key)
    if (!row) {
      const dayStart = new Date(key).getTime()
      row = {
        key,
        dayStart,
        recordedAt: reading.recordedAt,
        values: Object.fromEntries(INDICATOR_ORDER.map((id) => [id, null])) as Record<
          IndicatorId,
          VitalReading | null
        >,
      }
      rows.set(key, row)
    }
    for (const id of INDICATOR_ORDER) {
      if (row.values[id]) continue
      if (INDICATORS[id].assess(reading)) row.values[id] = reading
    }
  }

  return [...rows.values()].sort((a, b) => b.dayStart - a.dayStart)
}

function joinNames(ids: IndicatorId[]): string {
  const names = ids.map((id) => INDICATORS[id].name.toLowerCase())
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Newest reading of this indicator on the given calendar day. */
function latestOnDay(readings: VitalReading[], id: IndicatorId, key: string) {
  for (const r of readings) {
    if (dayKey(new Date(r.recordedAt).getTime()) !== key) continue
    const assessment = INDICATORS[id].assess(r)
    if (assessment) return { reading: r, assessment }
  }
  return null
}

function streak(readings: VitalReading[], now: number): number {
  const days = new Set(
    readings
      .filter((r) => CORE_INDICATORS.some((id) => INDICATORS[id].assess(r)))
      .map((r) => dayKey(new Date(r.recordedAt).getTime())),
  )
  let start = now
  if (!days.has(dayKey(start))) start -= DAY_MS
  let count = 0
  while (days.has(dayKey(start - count * DAY_MS))) count += 1
  return count
}

/** Today's status for every indicator, plus the worst-of overall status. */
export function evaluateStatus(readings: VitalReading[], now = Date.now()): OverallStatus {
  const sorted = [...readings].sort(
    (x, y) => new Date(y.recordedAt).getTime() - new Date(x.recordedAt).getTime(),
  )
  const today = dayKey(now)
  const notes: string[] = []
  const indicators = {} as Record<IndicatorId, IndicatorStatus>

  for (const id of INDICATOR_ORDER) {
    const hit = latestOnDay(sorted, id, today)
    if (!hit) {
      indicators[id] = {
        id,
        level: null,
        assessment: null,
        display: null,
        recordedAt: null,
        escalated: false,
      }
      continue
    }

    let level = hit.assessment.level
    let escalated = false
    if (level === 'watch') {
      const watchDays = Array.from({ length: WATCH_DAYS_TO_ESCALATE }, (_, n) =>
        latestOnDay(sorted, id, dayKey(now - n * DAY_MS)),
      ).filter((d) => d?.assessment.level === 'watch').length
      if (watchDays === WATCH_DAYS_TO_ESCALATE) {
        level = 'alert'
        escalated = true
        notes.push(
          id === 'mood'
            ? `Your mood has been so-so ${WATCH_DAYS_TO_ESCALATE} days in a row. A private chat with the crew psychologist could really help.`
            : `${INDICATORS[id].name} has been on watch ${WATCH_DAYS_TO_ESCALATE} days in a row, so it is now an alert. Contact the flight surgeon.`,
        )
      }
    }

    indicators[id] = {
      id,
      level,
      assessment: hit.assessment,
      display: INDICATORS[id].format(hit.reading),
      recordedAt: hit.reading.recordedAt,
      escalated,
    }
  }

  const measured = INDICATOR_ORDER.filter((id) => indicators[id].level != null)
  const alerts = measured.filter((id) => indicators[id].level === 'alert')
  const watches = measured.filter((id) => indicators[id].level === 'watch')
  const notMeasured = CORE_INDICATORS.filter((id) => indicators[id].level == null)

  let level: StatusLevel | null = null
  for (const id of measured) {
    const l = indicators[id].level!
    if (level == null || LEVEL_RANK[l] > LEVEL_RANK[level]) level = l
  }

  let sentence: string
  if (level == null) {
    sentence = 'Nothing measured today yet. Start a daily check-in to see your status.'
  } else if (level === 'alert') {
    const body = alerts.filter((id) => id !== 'mood')
    const moodLow = alerts.includes('mood')
    sentence = body.length
      ? `${capitalize(joinNames(body))} ${body.length > 1 ? 'are' : 'is'} in the alert range. Contact the flight surgeon now.${moodLow ? ' Your mood is low too, so please lean on the people around you.' : ''}`
      : 'Your mood is low today. You don’t have to handle it alone: talk with me, a crewmate or your family, and consider a private chat with the crew psychologist.'
  } else if (level === 'watch') {
    sentence = `Keep an eye on ${joinNames(watches)}. Follow the tips and re-check later today.`
  } else {
    sentence = 'Everything you measured today is in the normal range.'
  }

  if (watches.length >= 2) {
    notes.push(
      `${watches.length} indicators are on watch today. Mention them at your next flight surgeon check-in.`,
    )
  }
  if (notMeasured.length > 0 && level != null) {
    notes.push(
      `Not measured today: ${notMeasured.map((id) => INDICATORS[id].name.toLowerCase()).join(', ')}.`,
    )
  }

  return {
    level,
    sentence,
    notes,
    indicators,
    notMeasured,
    streakDays: streak(sorted, now),
  }
}
