import { criticalVitalLabel } from '@/lib/extractVitals'
import { measurePrompt } from '@/lib/coach/measurePrompts'
import { PROCEDURE_FIRST_STEP, proceduresFor } from '@/lib/coach/procedures'
import { ENVIRONMENTS } from '@/lib/health/environment'
import type {
  AvatarEmotion,
  AvatarMood,
  CoachState,
  MeasureKind,
  MessageBlock,
  MissionEnvironment,
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

const RECHECK_LABEL: Record<MeasureKind, string> = {
  heart_rate: 'heart rate',
  temperature: 'temperature',
  blood_pressure: 'blood pressure',
  glucose: 'blood glucose',
  sleep: 'sleep',
  mood: 'mood',
  spo2: 'blood oxygen',
  strength: 'strength',
}

/** Guaranteed local emergency reply — never depends on Claude. */
export function buildEmergencyTurn(
  metrics: VitalMetrics,
  environment: MissionEnvironment = 'station',
): EmergencyTurn {
  const procedures = proceduresFor(metrics)
  const conditions = procedures.map((p) => p.condition)
  const title = conditions.join(' + ') || 'Critical reading'
  const readings =
    procedures.length > 0 ? procedures.map((p) => p.reading) : [criticalVitalLabel(metrics)]

  const recheckKinds = [...new Set(procedures.map((p) => p.recheck))]
  if (recheckKinds.length === 0) recheckKinds.push('heart_rate')

  const steps = [
    PROCEDURE_FIRST_STEP,
    ENVIRONMENTS[environment].contactGround,
    ...procedures.flatMap((p) => p.steps),
    ...procedures.map((p) => `Re-check ${RECHECK_LABEL[p.recheck]} in ${p.recheckIn}.`),
  ]
  const uniqueSteps = [...new Set(steps)]

  const text = `**EMERGENCY:** ${title}. Contact the flight surgeon now and follow the steps.`
  const spokenStep = procedures[0]?.spokenStep ?? ''
  const speakText = [
    `Emergency. ${title.replace(' + ', ' and ')}.`,
    'Stop exercise and contact the flight surgeon now.',
    spokenStep,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    content: [text, ...uniqueSteps.map((s, i) => `${i + 1}. ${s}`)].join('\n'),
    speakText,
    blocks: [
      { type: 'text', text },
      { type: 'procedure', procedure: { title, readings, steps: uniqueSteps } },
      ...recheckKinds.map((kind) =>
        measurePrompt(kind, { title: `Re-check ${RECHECK_LABEL[kind]}` }),
      ),
    ],
    avatarEmotion: 'emergency',
    avatarMood: 'emergency',
    coachState: 'collect_vitals',
    triageLevel: 'emergency',
    loggedVitals: true,
  }
}
