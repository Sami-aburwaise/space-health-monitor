import type { CoachState } from '@/types/health'

export const COACH_STATES: CoachState[] = [
  'idle',
  'greet',
  'collect_vitals',
  'prescribe_exercise',
  'coach_set',
  'measure_strength',
  'measure_hr',
  'debrief',
  'checkin',
]

export const COACH_TRANSITIONS: Record<CoachState, CoachState[]> = {
  idle: ['greet', 'collect_vitals', 'checkin', 'coach_set'],
  greet: ['collect_vitals', 'prescribe_exercise'],
  collect_vitals: ['prescribe_exercise', 'measure_hr', 'debrief'],
  prescribe_exercise: ['coach_set', 'measure_hr', 'collect_vitals'],
  coach_set: ['measure_strength', 'measure_hr', 'prescribe_exercise', 'debrief'],
  measure_strength: ['measure_hr', 'coach_set', 'debrief'],
  measure_hr: ['prescribe_exercise', 'coach_set', 'debrief'],
  debrief: ['idle', 'greet', 'collect_vitals'],
  checkin: ['idle', 'collect_vitals', 'coach_set', 'checkin'],
}

export function canTransition(from: CoachState, to: CoachState): boolean {
  if (from === to) return true
  return COACH_TRANSITIONS[from]?.includes(to) ?? false
}

export function describeStateMachine(): string {
  return COACH_STATES.map((s) => {
    const next = COACH_TRANSITIONS[s].join(', ')
    return `- ${s} → ${next}`
  }).join('\n')
}
