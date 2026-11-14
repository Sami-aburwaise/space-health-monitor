import { criticalVitalLabel } from '@/lib/extractVitals'
import {
  PROCEDURE_FIRST_STEP,
  PROCEDURE_LAST_STEP,
  proceduresFor,
} from '@/lib/coach/procedures'
import type {
  AvatarEmotion,
  AvatarMood,
  CoachState,
  MeasureKind,
  MeasurePromptData,
  MessageBlock,
  TriageLevel,
  VitalMetrics,
} from '@/types/health'

export interface EmergencyTurn {
  content: string
  speakText: string
  blocks: MessageBlock[]
  avatarEmotion: AvatarEmotion
  avatarMood: AvatarMood
  coachState: CoachState
  triageLevel: TriageLevel
  loggedVitals: boolean
}

const RECHECK_PROMPTS: Record<Exclude<MeasureKind, 'strength'>, MeasurePromptData> = {
  heart_rate: {
    kind: 'heart_rate',
    title: 'Re-check heart rate',
    hint: 'Only once stable and restrained.',
    unit: 'bpm',
    source: 'manual',
    starterText: 'My heart rate is ',
  },
  temperature: {
    kind: 'temperature',
    title: 'Re-check temperature',
    hint: 'After cooling or warming steps.',
    unit: '°C',
    source: 'manual',
    starterText: 'My temperature is ',
  },
}

const RECHECK_LABEL: Record<MeasureKind, string> = {
  heart_rate: 'heart rate',
  temperature: 'temperature',
  strength: 'strength',
}

/** Guaranteed local emergency reply — never depends on Claude. */
export function buildEmergencyTurn(metrics: VitalMetrics): EmergencyTurn {
  const procedures = proceduresFor(metrics)
  const conditions = procedures.map((p) => p.condition)
  const title = conditions.join(' + ') || 'Critical reading'
  const readings =
    procedures.length > 0 ? procedures.map((p) => p.reading) : [criticalVitalLabel(metrics)]

  const recheckKinds = [...new Set(procedures.map((p) => p.recheck))].filter(
    (k): k is Exclude<MeasureKind, 'strength'> => k !== 'strength',
  )
  if (recheckKinds.length === 0) recheckKinds.push('heart_rate')

  const steps = [
    PROCEDURE_FIRST_STEP,
    ...procedures.flatMap((p) => p.steps),
    ...procedures.map((p) => `Re-check ${RECHECK_LABEL[p.recheck]} in ${p.recheckIn}.`),
    PROCEDURE_LAST_STEP,
  ]
  const uniqueSteps = [...new Set(steps)]

  const text = `**EMERGENCY:** ${title}. Follow the procedure now.`
  const spokenStep = procedures[0]?.spokenStep ?? ''
  const speakText = [
    `Emergency. ${title.replace(' + ', ' and ')}.`,
    'Stop exercise now.',
    spokenStep,
    'Alert the flight surgeon.',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    content: [text, ...uniqueSteps.map((s, i) => `${i + 1}. ${s}`)].join('\n'),
    speakText,
    blocks: [
      { type: 'text', text },
      { type: 'procedure', procedure: { title, readings, steps: uniqueSteps } },
      ...recheckKinds.map(
        (kind): MessageBlock => ({ type: 'measure_prompt', prompt: RECHECK_PROMPTS[kind] }),
      ),
    ],
    avatarEmotion: 'emergency',
    avatarMood: 'emergency',
    coachState: recheckKinds[0] === 'temperature' ? 'collect_vitals' : 'measure_hr',
    triageLevel: 'emergency',
    loggedVitals: true,
  }
}
