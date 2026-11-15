import { DAILY_CHECKIN_CMD, START_ROUTINE_CMD } from '@/lib/coach/classify'
import { buildEmergencyTurn } from '@/lib/coach/emergency'
import { measurePrompt } from '@/lib/coach/measurePrompts'
import { prescribeRoutineExercise } from '@/lib/coach/prescribe'
import { moodSupportBlocks } from '@/lib/coach/support'
import { currentVitals, isCriticalVitals } from '@/lib/extractVitals'
import { ENVIRONMENTS } from '@/lib/health/environment'
import {
  INDICATORS,
  LEVEL_LABEL,
  LEVEL_RANK,
  indicatorsIn,
  type IndicatorId,
  type StatusLevel,
} from '@/lib/health/indicators'
import { evaluateStatus } from '@/lib/health/status'
import type {
  AvatarEmotion,
  AvatarMood,
  CoachState,
  MeasureKind,
  MessageBlock,
  MissionEnvironment,
  TriageLevel,
  VitalMetrics,
  VitalReading,
} from '@/types/health'

export interface VitalReply {
  content: string
  speakText: string
  blocks: MessageBlock[]
  avatarEmotion: AvatarEmotion
  avatarMood: AvatarMood
  coachState: CoachState
  /** When set, updates the coach session's routine slot */
  routineSlot?: number
  triageLevel: TriageLevel
  loggedVitals: boolean
}

export interface VitalReplyContext {
  crewName: string
  exerciseApiKey: string
  routineSlot: number
  environment: MissionEnvironment
  /** Every stored reading, newest first, including the one just saved */
  readings: VitalReading[]
}

const PRE_EXERCISE: CoachState[] = ['collect_vitals', 'measure_hr']
const MID_WORKOUT: CoachState[] = ['coach_set', 'prescribe_exercise']

/** Daily check-in order; mood is last so support can close the check-in. */
export const CHECKIN_ORDER: IndicatorId[] = [
  'temperature',
  'heart_rate',
  'blood_pressure',
  'glucose',
  'sleep',
  'mood',
]

const CHECKIN_ASK: Partial<Record<IndicatorId, string>> = {
  temperature: 'your temperature',
  heart_rate: 'your heart rate',
  blood_pressure: 'your blood pressure',
  glucose: 'your fasting blood glucose',
  sleep: 'how many hours you slept last night',
  mood: 'how you are feeling today',
}

const CHECKIN_SKIP = /^\[CHECKIN_SKIP:([a-z_]+)\]$/

export function checkinSkipCmd(id: IndicatorId): string {
  return `[CHECKIN_SKIP:${id}]`
}

/** The indicator a skip button refers to, or null when the text is not a skip. */
export function parseCheckinSkip(text: string): IndicatorId | null {
  const id = text.match(CHECKIN_SKIP)?.[1] as IndicatorId | undefined
  return id && CHECKIN_ORDER.includes(id) ? id : null
}

const TONE: Record<StatusLevel, { emotion: AvatarEmotion; mood: AvatarMood; triage: TriageLevel }> = {
  normal: { emotion: 'cheering', mood: 'happy', triage: 'info' },
  watch: { emotion: 'sad', mood: 'sad', triage: 'monitor' },
  alert: { emotion: 'sad', mood: 'emergency', triage: 'urgent' },
}

const SUPPORT_TONE = { emotion: 'sad', mood: 'sad', triage: 'monitor' } as const

function worst(levels: StatusLevel[]): StatusLevel {
  return levels.reduce<StatusLevel>((w, l) => (LEVEL_RANK[l] > LEVEL_RANK[w] ? l : w), 'normal')
}

/** A body indicator whose newest reading in the last 30 minutes is in the alert range. */
function recentAlert(readings: VitalReading[]): IndicatorId | undefined {
  const current = currentVitals(readings)
  return indicatorsIn(current).find(
    (id) => id !== 'mood' && INDICATORS[id].assess(current)?.level === 'alert',
  )
}

function statusBlock(readings: VitalReading[], force = false): MessageBlock | null {
  const status = evaluateStatus(readings)
  const measured = Object.values(status.indicators).filter((s) => s.level != null).length
  if (status.level == null || (!force && measured < 2 && status.notes.length === 0)) return null
  return {
    type: 'overall_status',
    level: status.level,
    sentence: status.sentence,
    notes: status.notes,
  }
}

/** Next check-in indicator not measured today, after `after` in the check-in order. */
function nextDue(readings: VitalReading[], after?: IndicatorId): IndicatorId | undefined {
  const due = evaluateStatus(readings).notMeasured
  const start = after ? CHECKIN_ORDER.indexOf(after) + 1 : 0
  return CHECKIN_ORDER.slice(start).find((id) => due.includes(id))
}

function checkinStep(id: IndicatorId): MessageBlock[] {
  return [
    measurePrompt(INDICATORS[id].measureKind),
    { type: 'choices', choices: [{ label: 'Skip this one', message: checkinSkipCmd(id) }] },
  ]
}

/** Offered when the check-in ends, unless a reading says to rest. */
function workoutChoice(readings: VitalReading[]): MessageBlock[] {
  if (recentAlert(readings)) return []
  return [{ type: 'choices', choices: [{ label: 'Start workout', message: START_ROUTINE_CMD }] }]
}

function textOf(blocks: MessageBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'text') return b.text
      if (b.type === 'overall_status') {
        const head = `Today’s status: **${LEVEL_LABEL[b.level]}**. ${b.sentence}`
        return b.notes.length ? [head, ...b.notes].join('\n') : head
      }
      return null
    })
    .filter((t): t is string => Boolean(t))
    .join('\n\n')
}

/**
 * Local reply to a reading — never calls Claude.
 * Before a workout, temperature leads to heart rate, and heart rate to the first exercise.
 * During the daily check-in, each reading leads to the next indicator.
 */
export async function buildVitalReply(
  extracted: VitalMetrics,
  coachState: CoachState,
  ctx: VitalReplyContext,
  rejected: string[] = [],
): Promise<VitalReply | null> {
  if (isCriticalVitals(extracted)) {
    const turn = buildEmergencyTurn(extracted, ctx.environment)
    if (rejected.length) turn.blocks.unshift({ type: 'text', text: rejected.join('\n') })
    return turn
  }

  const ids = indicatorsIn(extracted)
  if (ids.length === 0) return null

  const status = evaluateStatus(ctx.readings)
  const items = ids.map((id) => {
    const assessment = INDICATORS[id].assess(extracted)!
    const escalated = status.indicators[id].escalated
    return {
      id,
      assessment,
      level: escalated ? ('alert' as const) : assessment.level,
      escalated,
    }
  })

  // Low mood gets support and options, not a clinical alert card
  const moodItem = items.find((i) => i.id === 'mood')
  const moodLow = moodItem != null && moodItem.level !== 'normal'
  const body = items.filter((i) => i.id !== 'mood')
  const level = worst(body.map((i) => i.level))
  const lines = items
    .filter((i) => !(moodLow && i.id === 'mood'))
    .map((i) =>
      i.escalated ? `${i.assessment.line} That is 3 days in a row on watch.` : i.assessment.line,
    )

  const blocks: MessageBlock[] = []
  if (rejected.length) blocks.push({ type: 'text', text: rejected.join('\n') })

  let next: CoachState = coachState
  let routineSlot: number | undefined
  let spoken: string
  let checkinDone = false

  if (level === 'alert') {
    const alerting = body.filter((i) => i.level === 'alert')
    spoken = `${lines.join(' ')} Please stop exercising and contact the flight surgeon.`
    blocks.push({ type: 'text', text: spoken })
    blocks.push({
      type: 'procedure',
      procedure: {
        title: 'Alert — contact the flight surgeon',
        readings: alerting.map((i) => INDICATORS[i.id].format(extracted) ?? INDICATORS[i.id].name),
        steps: [
          ENVIRONMENTS[ctx.environment].contactGround,
          ...body.filter((i) => i.level !== 'normal').map((i) => i.assessment.action),
        ],
      },
    })
    const rechecked = new Set<MeasureKind>()
    for (const { id } of alerting) {
      const { measureKind, name } = INDICATORS[id]
      if (rechecked.has(measureKind)) continue
      rechecked.add(measureKind)
      blocks.push(measurePrompt(measureKind, { title: `Re-check ${name.toLowerCase()}` }))
    }
    // Stay in check-in so a later good re-check continues the remaining vitals
    // instead of treating the reply as the pre-workout temp/HR path.
    if (coachState === 'checkin') {
      next = 'checkin'
      if (nextDue(ctx.readings)) {
        blocks.push({
          type: 'choices',
          choices: [{ label: 'Continue check-in', message: DAILY_CHECKIN_CMD }],
        })
      }
    } else {
      next = 'collect_vitals'
    }
  } else {
    const tips = body.filter((i) => i.level === 'watch').map((i) => i.assessment.action)
    spoken = [...lines, ...tips].join(' ')
    const has = (id: IndicatorId) => ids.includes(id)
    const followUps: MessageBlock[] = []

    if (coachState === 'checkin') {
      const last = ids.reduce<IndicatorId | undefined>(
        (best, id) =>
          CHECKIN_ORDER.indexOf(id) > (best ? CHECKIN_ORDER.indexOf(best) : -1) ? id : best,
        undefined,
      )
      const upcoming = nextDue(ctx.readings, last)
      if (upcoming) {
        spoken += ` Next, ${CHECKIN_ASK[upcoming]}.`
        followUps.push(...checkinStep(upcoming))
        next = 'checkin'
      } else {
        checkinDone = true
        next = 'idle'
      }
    } else if (has('temperature') && !has('heart_rate') && PRE_EXERCISE.includes(coachState)) {
      spoken += ' Now please measure your heart rate.'
      followUps.push(measurePrompt('heart_rate'))
      next = 'measure_hr'
    } else if (
      has('heart_rate') &&
      (PRE_EXERCISE.includes(coachState) || MID_WORKOUT.includes(coachState)) &&
      recentAlert(ctx.readings)
    ) {
      const id = recentAlert(ctx.readings)!
      spoken += ` Your ${INDICATORS[id].name.toLowerCase()} was in the alert range, so let's skip the workout until it is back to normal.`
      followUps.push(measurePrompt(INDICATORS[id].measureKind, { title: `Re-check ${INDICATORS[id].name.toLowerCase()}` }))
      next = 'collect_vitals'
    } else if (
      has('heart_rate') &&
      (PRE_EXERCISE.includes(coachState) || MID_WORKOUT.includes(coachState))
    ) {
      const prescribed = await prescribeRoutineExercise(
        ctx.crewName,
        ctx.exerciseApiKey,
        ctx.routineSlot,
      )
      if (prescribed?.done) {
        spoken += ' Workout complete. Great job!'
        next = 'debrief'
        followUps.push(
          prescribed.block,
          measurePrompt('heart_rate', {
            title: 'Cool-down heart rate',
            hint: 'Measure your pulse after the workout.',
          }),
        )
        routineSlot = ctx.routineSlot
      } else if (prescribed) {
        spoken += level === 'watch' ? ' Take it easy on this one.' : ' Here is your exercise.'
        followUps.push(prescribed.block, {
          type: 'text',
          text: `**${prescribed.sets}** — ${prescribed.label}. Tap **done** when finished.`,
        })
        next = 'coach_set'
        routineSlot = ctx.routineSlot + 1
      }
    }

    spoken = spoken.trim()
    if (spoken) blocks.push({ type: 'text', text: spoken })
    blocks.push(...followUps)
  }

  if (checkinDone) blocks.push({ type: 'text', text: 'That’s today’s check-in done. Thank you!' })
  // Low mood ends on support and its options; the status strip already shows the level
  const overall = next === 'checkin' || moodLow ? null : statusBlock(ctx.readings, checkinDone)
  if (overall) blocks.push(overall)

  if (moodLow) {
    const support = moodSupportBlocks(extracted.moodScore!)
    blocks.push(...support.blocks)
    spoken = spoken ? `${spoken} ${support.spoken}` : support.spoken
  } else if (checkinDone) {
    blocks.push(...workoutChoice(ctx.readings))
  }

  const tone = moodLow && level !== 'alert' ? SUPPORT_TONE : TONE[level]
  return {
    content: textOf(blocks),
    speakText: checkinDone && !moodLow ? `${spoken} That’s today’s check-in done. Thank you!` : spoken,
    blocks,
    avatarEmotion: tone.emotion,
    avatarMood: tone.mood,
    coachState: next,
    routineSlot,
    triageLevel: tone.triage,
    loggedVitals: true,
  }
}

/** Holds the workout while a recent reading is in the alert range; null when it is safe to go on. */
export function buildWorkoutHold(readings: VitalReading[]): VitalReply | null {
  const id = recentAlert(readings)
  if (!id) return null
  const name = INDICATORS[id].name.toLowerCase()
  const text = `Let's pause the workout. Your ${name} was in the alert range. Rest, contact the flight surgeon if you have not yet, and re-check it.`
  return {
    content: text,
    speakText: text,
    blocks: [{ type: 'text', text }, measurePrompt(INDICATORS[id].measureKind, { title: `Re-check ${name}` })],
    avatarEmotion: 'sad',
    avatarMood: 'sad',
    coachState: 'collect_vitals',
    triageLevel: 'urgent',
    loggedVitals: false,
  }
}

/** Every value in the message was refused — say why and offer the card again. */
export function buildRejectionReply(
  rejected: string[],
  kinds: MeasureKind[],
  coachState: CoachState,
): VitalReply {
  const text = rejected.join('\n')
  return {
    content: text,
    speakText: rejected.length > 1 ? 'Some of those numbers look off. Please measure again.' : text,
    blocks: [{ type: 'text', text }, ...kinds.map((k) => measurePrompt(k))],
    avatarEmotion: 'sad',
    avatarMood: 'neutral',
    coachState,
    triageLevel: 'info',
    loggedVitals: false,
  }
}

function checkinTurn(text: string, blocks: MessageBlock[], coachState: CoachState, done: boolean): VitalReply {
  return {
    content: textOf([{ type: 'text', text }, ...blocks]),
    speakText: text,
    blocks: [{ type: 'text', text }, ...blocks],
    avatarEmotion: done ? 'cheering' : 'happy',
    avatarMood: 'happy',
    coachState,
    triageLevel: 'info',
    loggedVitals: false,
  }
}

/** Starts (or resumes) the daily check-in with the first indicator not measured today. */
export function buildDailyCheckIn(readings: VitalReading[], coachState: CoachState): VitalReply {
  const first = nextDue(readings)
  if (!first) {
    const overall = statusBlock(readings, true)
    return checkinTurn(
      'You have measured everything today. Nice work!',
      [...(overall ? [overall] : []), ...workoutChoice(readings)],
      coachState === 'checkin' ? 'idle' : coachState,
      true,
    )
  }
  const started = evaluateStatus(readings).notMeasured.length < CHECKIN_ORDER.length
  const text = started
    ? `Let’s finish today’s check-in, one at a time. Next, ${CHECKIN_ASK[first]}.`
    : `Let’s do today’s check-in, one at a time. First, ${CHECKIN_ASK[first]}.`
  return checkinTurn(text, checkinStep(first), 'checkin', false)
}

/** Skips one check-in indicator and moves to the next. */
export function buildCheckinSkip(skipped: IndicatorId, readings: VitalReading[]): VitalReply {
  const upcoming = nextDue(readings, skipped)
  if (upcoming) {
    return checkinTurn(
      `No problem, we can skip that today. Next, ${CHECKIN_ASK[upcoming]}.`,
      checkinStep(upcoming),
      'checkin',
      false,
    )
  }
  const overall = statusBlock(readings, true)
  return checkinTurn(
    'No problem. That’s today’s check-in done. Thank you!',
    [...(overall ? [overall] : []), ...workoutChoice(readings)],
    'idle',
    true,
  )
}

/**
 * Starts the workout at the first exercise when temperature and heart rate were just
 * measured (e.g. right after the check-in). Null means ask for them first as usual.
 */
export async function buildWorkoutStart(
  readings: VitalReading[],
  crewName: string,
  exerciseApiKey: string,
): Promise<VitalReply | null> {
  const current = currentVitals(readings)
  if (current.temperatureC == null || current.heartRate == null) return null
  const hold = buildWorkoutHold(readings)
  if (hold) return hold
  const prescribed = await prescribeRoutineExercise(crewName, exerciseApiKey, 0)
  if (!prescribed || prescribed.done) return null
  const text = 'Your temperature and heart rate are fresh, so let’s go straight to your first exercise.'
  return {
    content: text,
    speakText: text,
    blocks: [
      { type: 'text', text },
      prescribed.block,
      { type: 'text', text: `**${prescribed.sets}** — ${prescribed.label}. Tap **done** when finished.` },
    ],
    avatarEmotion: 'excited',
    avatarMood: 'happy',
    coachState: 'coach_set',
    routineSlot: 1,
    triageLevel: 'info',
    loggedVitals: false,
  }
}

/** True when this user message is a reading we can answer locally. */
export function canReplyLocally(extracted: VitalMetrics | null): extracted is VitalMetrics {
  return extracted != null && indicatorsIn(extracted).length > 0
}
