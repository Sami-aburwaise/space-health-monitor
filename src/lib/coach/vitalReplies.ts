import { buildEmergencyTurn } from '@/lib/coach/emergency'
import { prescribeRoutineExercise } from '@/lib/coach/prescribe'
import { isCriticalVitals } from '@/lib/extractVitals'
import type {
  AvatarEmotion,
  AvatarMood,
  CoachState,
  MessageBlock,
  TriageLevel,
  VitalMetrics,
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

/** Fixed band labels → identical TTS strings hit the ElevenLabs cache. */
type Band = 'low' | 'normal' | 'high'

const TEMP_TEXT: Record<Band, string> = {
  low: 'Your temperature is a bit low. Keep warm. Now please measure your heart rate.',
  normal: 'Your temperature looks good. Now please measure your heart rate.',
  high: 'Your temperature is a bit high. Drink some water. Now please measure your heart rate.',
}

/** Spoken after HR — exercise card is attached separately (TTS stays cacheable). */
const HR_TEXT: Record<Band, string> = {
  low: 'Your heart rate is a bit low. Take it easy on this first exercise.',
  normal: 'Your heart rate looks good. Here is your first exercise.',
  high: 'Your heart rate is a bit high. Take a few deep breaths, then start this exercise.',
}

const SPO2_TEXT: Record<Band, string> = {
  low: 'Your oxygen is a bit low. Take slow, deep breaths.',
  normal: 'Your oxygen level looks good.',
  high: 'Your oxygen level looks good.',
}

const BP_TEXT: Record<Band, string> = {
  low: 'Your blood pressure is a bit low. Drink some water and rest.',
  normal: 'Your blood pressure looks good.',
  high: 'Your blood pressure is a bit high. Rest for a few minutes.',
}

function tempBand(c: number): Band {
  if (c < 36) return 'low'
  if (c <= 37.5) return 'normal'
  return 'high'
}

function hrBand(bpm: number): Band {
  if (bpm < 60) return 'low'
  if (bpm <= 100) return 'normal'
  return 'high'
}

function spo2Band(pct: number): Band {
  if (pct < 95) return 'low'
  return 'normal'
}

function bpBand(systolic: number, diastolic?: number): Band {
  if (systolic < 90 || (diastolic != null && diastolic < 60)) return 'low'
  if (systolic >= 140 || (diastolic != null && diastolic >= 90)) return 'high'
  return 'normal'
}

function hrPrompt(): MessageBlock {
  return {
    type: 'measure_prompt',
    prompt: {
      kind: 'heart_rate',
      title: 'Heart rate',
      hint: 'Enter your pulse in beats per minute.',
      unit: 'bpm',
      source: 'manual',
      starterText: 'My heart rate is ',
    },
  }
}

function donePrompt(): MessageBlock {
  return {
    type: 'text',
    text: 'Tap **done** when the set is finished.',
  }
}

function emotionFor(band: Band): { emotion: AvatarEmotion; mood: AvatarMood; triage: TriageLevel } {
  if (band === 'normal') return { emotion: 'cheering', mood: 'happy', triage: 'info' }
  if (band === 'high') return { emotion: 'sad', mood: 'sad', triage: 'monitor' }
  return { emotion: 'sad', mood: 'sad', triage: 'monitor' }
}

export interface VitalReplyContext {
  crewName: string
  exerciseApiKey: string
  routineSlot: number
}

/**
 * Local vital ack — never calls Claude.
 * After HR, attaches the next routine exercise with demo media.
 */
export async function buildVitalReply(
  extracted: VitalMetrics,
  coachState: CoachState,
  ctx?: VitalReplyContext,
): Promise<VitalReply | null> {
  if (isCriticalVitals(extracted)) return buildEmergencyTurn(extracted)

  let text: string | null = null
  let band: Band = 'normal'
  let next: CoachState = coachState
  let followUps: MessageBlock[] = []
  let routineSlot: number | undefined

  if (extracted.temperatureC != null) {
    band = tempBand(extracted.temperatureC)
    text = TEMP_TEXT[band]
    next = 'measure_hr'
    followUps = [hrPrompt()]
  } else if (extracted.heartRate != null) {
    band = hrBand(extracted.heartRate)
    text = HR_TEXT[band]
    next = 'coach_set'
    if (ctx) {
      const prescribed = await prescribeRoutineExercise(
        ctx.crewName,
        ctx.exerciseApiKey,
        ctx.routineSlot,
      )
      if (prescribed?.done) {
        text = 'Workout complete. Great job!'
        next = 'debrief'
        followUps = [
          prescribed.block,
          {
            type: 'measure_prompt',
            prompt: {
              kind: 'heart_rate',
              title: 'Cool-down heart rate',
              hint: 'Measure your pulse after the workout.',
              unit: 'bpm',
              source: 'manual',
              starterText: 'My heart rate is ',
            },
          },
        ]
        routineSlot = ctx.routineSlot
      } else if (prescribed) {
        followUps = [
          prescribed.block,
          {
            type: 'text',
            text: `**${prescribed.sets}** — ${prescribed.label}. Tap **done** when finished.`,
          },
        ]
        routineSlot = ctx.routineSlot + 1
      } else {
        followUps = [donePrompt()]
        next = 'prescribe_exercise'
      }
    }
  } else if (extracted.spo2 != null) {
    band = spo2Band(extracted.spo2)
    text = SPO2_TEXT[band]
    next = coachState === 'collect_vitals' ? 'measure_hr' : 'prescribe_exercise'
  } else if (extracted.systolic != null) {
    band = bpBand(extracted.systolic, extracted.diastolic)
    text = BP_TEXT[band]
    next = 'prescribe_exercise'
  }

  if (!text) return null

  const { emotion, mood, triage } = emotionFor(band)
  const blocks: MessageBlock[] = [{ type: 'text', text }, ...followUps]

  return {
    content: text,
    speakText: text,
    blocks,
    avatarEmotion: emotion,
    avatarMood: mood,
    coachState: next,
    routineSlot,
    triageLevel: triage,
    loggedVitals: true,
  }
}

/** True when this user message is a vital reading we can answer locally. */
export function canReplyLocally(extracted: VitalMetrics | null): extracted is VitalMetrics {
  if (!extracted) return false
  return (
    extracted.temperatureC != null ||
    extracted.heartRate != null ||
    extracted.spo2 != null ||
    extracted.systolic != null
  )
}
