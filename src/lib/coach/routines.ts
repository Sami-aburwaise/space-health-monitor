import type { StationEquipment } from '@/lib/coach/stationInventory'

export interface RoutineSlot {
  /** Search query for exerciseapi.dev */
  q: string
  muscle: string
  equipment: StationEquipment
  sets: string
}

export interface AstronautRoutine {
  id: string
  /** Mission ops designation shown to crew */
  designation: string
  focus: string
  slots: RoutineSlot[]
}

/** Per-crew countermeasure blocks — cable / band / machine only. */
export const ASTRONAUT_ROUTINES: AstronautRoutine[] = [
  {
    id: 'helios',
    designation: 'Helios',
    focus: 'posterior chain + pull',
    slots: [
      { q: 'seated cable row', muscle: 'back', equipment: 'cable', sets: '3x10' },
      { q: 'leg press', muscle: 'quadriceps', equipment: 'machine', sets: '3x12' },
      { q: 'face pull', muscle: 'shoulders', equipment: 'bands', sets: '3x15' },
    ],
  },
  {
    id: 'kepler',
    designation: 'Kepler',
    focus: 'press + core brace',
    slots: [
      { q: 'cable fly', muscle: 'chest', equipment: 'cable', sets: '3x10' },
      { q: 'cable shoulder press', muscle: 'shoulders', equipment: 'cable', sets: '3x10' },
      { q: 'cable woodchop', muscle: 'abdominals', equipment: 'cable', sets: '3x12' },
    ],
  },
  {
    id: 'vega',
    designation: 'Vega',
    focus: 'lat pull + lower body',
    slots: [
      { q: 'lat pulldown', muscle: 'lats', equipment: 'cable', sets: '3x10' },
      { q: 'seated leg curl', muscle: 'hamstrings', equipment: 'machine', sets: '3x12' },
      { q: 'band pull apart', muscle: 'shoulders', equipment: 'bands', sets: '3x15' },
    ],
  },
]

function hashName(name: string): number {
  let h = 0
  const s = name.trim().toLowerCase() || 'crew'
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function routineForAstronaut(crewName: string): AstronautRoutine {
  const idx = hashName(crewName) % ASTRONAUT_ROUTINES.length
  return ASTRONAUT_ROUTINES[idx]!
}

export function formatRoutineBrief(routine: AstronautRoutine): string {
  const lines = routine.slots.map(
    (s, i) => `${i + 1}. ${s.q} (${s.equipment}, ${s.sets})`,
  )
  return `Countermeasure ${routine.designation} — ${routine.focus}\n${lines.join('\n')}`
}
