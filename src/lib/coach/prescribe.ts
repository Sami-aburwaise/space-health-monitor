import { searchMicroGExercises } from '@/lib/api/exercise'
import { routineForAstronaut, type RoutineSlot } from '@/lib/coach/routines'
import type { ExerciseCardData, MessageBlock } from '@/types/health'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Exercise lookup timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function searchSlot(exerciseApiKey: string, slot: RoutineSlot): Promise<ExerciseCardData[]> {
  return searchMicroGExercises(exerciseApiKey, {
    q: slot.q,
    muscle: slot.muscle,
    equipment: slot.equipment,
    limit: 6,
  })
}

/** Warm the localStorage cache for every slot so later prescriptions are instant. */
export function prefetchRoutine(crewName: string, exerciseApiKey: string): void {
  if (!exerciseApiKey.trim()) return
  const routine = routineForAstronaut(crewName)
  for (const slot of routine.slots) {
    void searchSlot(exerciseApiKey, slot).catch(() => {})
  }
}

/** Fetch the next station exercise for this astronaut's fixed routine. */
export async function prescribeRoutineExercise(
  crewName: string,
  exerciseApiKey: string,
  slotIndex: number,
): Promise<{ block: MessageBlock; label: string; sets: string; done: boolean } | null> {
  const routine = routineForAstronaut(crewName)
  if (slotIndex >= routine.slots.length) {
    return {
      block: {
        type: 'text',
        text: 'Workout complete. Great job!',
      },
      label: routine.designation,
      sets: '',
      done: true,
    }
  }

  const slot = routine.slots[slotIndex]!
  if (!exerciseApiKey.trim()) return null

  let cards: ExerciseCardData[]
  try {
    cards = await withTimeout(searchSlot(exerciseApiKey, slot), 12000)
  } catch {
    return null
  }
  const pick =
    cards.find((c) => c.equipment?.toLowerCase().includes(slot.equipment)) ?? cards[0]
  if (!pick) return null

  return {
    block: { type: 'exercise', exercise: pick },
    label: pick.name,
    sets: slot.sets,
    done: false,
  }
}
