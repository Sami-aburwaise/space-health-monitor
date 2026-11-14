import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { CoachSession, CoachState } from '@/types/health'

const DEFAULT: CoachSession = {
  state: 'idle',
  routineSlot: 0,
  updatedAt: new Date(0).toISOString(),
}

export function useCoachSession(storageKey = 'coach') {
  const [stored, setSession] = useLocalStorage<Partial<CoachSession>>(storageKey, DEFAULT)
  const session: CoachSession = {
    state: stored.state ?? 'idle',
    routineSlot: stored.routineSlot ?? 0,
    updatedAt: stored.updatedAt ?? DEFAULT.updatedAt,
  }

  function setState(state: CoachState, routineSlot?: number) {
    setSession({
      state,
      routineSlot: routineSlot ?? session.routineSlot,
      updatedAt: new Date().toISOString(),
    })
  }

  function reset() {
    setSession({
      state: 'idle',
      routineSlot: 0,
      updatedAt: new Date().toISOString(),
    })
  }

  return { session, setState, reset }
}
