import { prescribeRoutineExercise } from '@/lib/coach/prescribe'
import type { AvatarEmotion, AvatarMood, CoachState, MessageBlock, TriageLevel } from '@/types/health'

export interface LocalExerciseTurn {
  content: string
  speakText: string
  blocks: MessageBlock[]
  avatarEmotion: AvatarEmotion
  avatarMood: AvatarMood
  coachState: CoachState
  routineSlot: number
  triageLevel: TriageLevel
  loggedVitals: boolean
}

const SPEAK_NEXT = 'Nice work. Here is your next exercise.'
const SPEAK_DONE = 'Workout complete. Great job! Please measure your heart rate once more.'

/** Coach said a new set is coming — the card must be in the same bubble. */
const PROMISES_EXERCISE =
  /\b(next (exercise|set|one)|here'?s your|try this|start this|your next|take (this|the) next|easier pace)\b/i

function turnText(turn: { content: string; speakText: string; blocks: MessageBlock[] }): string {
  const fromBlocks = turn.blocks
    .filter((b): b is Extract<MessageBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
  return [turn.content, turn.speakText, ...fromBlocks].join(' ')
}

/**
 * Attach the next routine exercise under an existing coach reply that promised a set
 * but forgot the card (common when Claude is in chat mode without search tools).
 */
export async function withNextExerciseAttached(
  turn: {
    content: string
    speakText: string
    blocks: MessageBlock[]
    coachState: CoachState
    routineSlot?: number
    avatarEmotion?: AvatarEmotion
    avatarMood?: AvatarMood
    triageLevel: TriageLevel
    loggedVitals: boolean
  },
  crewName: string,
  exerciseApiKey: string,
  routineSlot: number,
): Promise<typeof turn & { routineSlot?: number }> {
  if (turn.blocks.some((b) => b.type === 'exercise')) return turn
  if (turn.coachState !== 'coach_set' && turn.coachState !== 'prescribe_exercise') return turn
  if (turn.triageLevel === 'urgent' || turn.triageLevel === 'emergency') return turn
  if (!PROMISES_EXERCISE.test(turnText(turn))) return turn

  const prescribed = await prescribeRoutineExercise(crewName, exerciseApiKey, routineSlot)
  if (!prescribed || prescribed.done) return turn

  return {
    ...turn,
    coachState: 'coach_set',
    routineSlot: routineSlot + 1,
    blocks: [
      ...turn.blocks,
      prescribed.block,
      {
        type: 'text',
        text: `**${prescribed.sets}** — ${prescribed.label}. Tap **done** when finished.`,
      },
    ],
  }
}

/** After "done" — prescribe the next routine slot locally (no Claude). */
export async function buildNextExerciseTurn(
  crewName: string,
  exerciseApiKey: string,
  routineSlot: number,
): Promise<LocalExerciseTurn> {
  const prescribed = await prescribeRoutineExercise(crewName, exerciseApiKey, routineSlot)

  if (!prescribed || prescribed.done) {
    const text = SPEAK_DONE
    return {
      content: text,
      speakText: text,
      blocks: [
        { type: 'text', text },
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
      ],
      avatarEmotion: 'cheering',
      avatarMood: 'happy',
      coachState: 'debrief',
      routineSlot,
      triageLevel: 'info',
      loggedVitals: false,
    }
  }

  return {
    content: SPEAK_NEXT,
    speakText: SPEAK_NEXT,
    blocks: [
      { type: 'text', text: SPEAK_NEXT },
      prescribed.block,
      {
        type: 'text',
        text: `**${prescribed.sets}** — ${prescribed.label}. Tap **done** when finished.`,
      },
    ],
    avatarEmotion: 'excited',
    avatarMood: 'happy',
    coachState: 'coach_set',
    routineSlot: routineSlot + 1,
    triageLevel: 'info',
    loggedVitals: false,
  }
}
