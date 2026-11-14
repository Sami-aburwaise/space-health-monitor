export type MessageIntent =
  | 'start_routine'
  | 'vital_report'
  | 'food_query'
  | 'strength_test'
  | 'exercise_done'
  | 'symptom'
  | 'play_game'
  | 'general'

/** Sent by the Start routine button; rendered as "Started routine" in the chat. */
export const START_ROUTINE_CMD = '[START_ROUTINE]'

const START = /\[start_routine\]|\b(start\s+(my\s+)?(routine|session|training)|begin\s+routine)\b/i
const FOOD = /\b(calor(?:ie|ies)|food|meal|eat|tortilla|protein|macro)\b/i
const STRENGTH = /\b(strength\s*test|grip|asteroid\s*run|shield\s*charge)\b/i
const DONE = /\b(done|finished|completed|next\s*set|next\s*exercise)\b/i
/** Mid-workout "keep going" / "where's the card" — not a symptom report. */
const CONTINUE =
  /^(ok|okay|sure|yes|yep|yeah|ready|continue|let'?s\s+go|next|go\s+ahead)[.!]?$|\b(where\s+(is|'?s)\s+(it|the\s+exercise)|send\s+(it|the\s+exercise)|show\s+(me\s+)?(the\s+)?exercise)\b/i
const SYMPTOM = /\b(headache|dizzy|nausea|pain|sore|fatigue|tired|hurt)\b/i
const PLAY = /\bplay\b/i
const VITAL =
  /\b(heart\s*rate|hr|pulse|bpm|temp(?:erature)?|spo\s*2|blood\s*pressure|b\.?p\.?|°\s*c)\b/i

/** True when the crew is mid-set and the message is just agreeing to continue. */
export function isWorkoutContinue(text: string): boolean {
  return CONTINUE.test(text.trim())
}

/** Lightweight local classifier so the coach picks the right bubble type. */
export function classifyMessage(text: string): MessageIntent {
  const t = text.trim()
  if (!t) return 'general'
  if (START.test(t)) return 'start_routine'
  if (PLAY.test(t) && STRENGTH.test(t)) return 'play_game'
  if (PLAY.test(t)) return 'play_game'
  if (STRENGTH.test(t)) return 'strength_test'
  if (FOOD.test(t)) return 'food_query'
  if (VITAL.test(t) || /\d/.test(t)) {
    // Prefer vital if numbers look like readings
    if (VITAL.test(t) || /\d{2,3}\s*(bpm|c|°)/i.test(t)) return 'vital_report'
  }
  if (DONE.test(t)) return 'exercise_done'
  if (SYMPTOM.test(t)) return 'symptom'
  return 'general'
}
