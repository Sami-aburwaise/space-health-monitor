import { v4 as uuid } from 'uuid'
import type { VitalReading } from '@/types/health'

interface DaySeed {
  /** Days before today (0 = today) */
  o: number
  hr: number
  sys: number
  dia: number
  t: number
  g: number
  sleep: number
  mood: number
  spo2: number
}

/** Varied 14-day check-ins for demo profiles — mostly normal, a few watch days. */
const TWO_WEEKS: DaySeed[] = [
  { o: 13, hr: 62, sys: 110, dia: 70, t: 36.4, g: 85, sleep: 8.0, mood: 5, spo2: 99 },
  { o: 12, hr: 68, sys: 116, dia: 74, t: 36.6, g: 90, sleep: 7.2, mood: 4, spo2: 98 },
  { o: 11, hr: 76, sys: 126, dia: 82, t: 36.9, g: 104, sleep: 5.8, mood: 3, spo2: 96 },
  { o: 10, hr: 65, sys: 114, dia: 72, t: 36.5, g: 88, sleep: 7.6, mood: 4, spo2: 98 },
  { o: 9, hr: 71, sys: 119, dia: 77, t: 36.7, g: 94, sleep: 7.0, mood: 4, spo2: 97 },
  { o: 8, hr: 69, sys: 117, dia: 75, t: 36.5, g: 91, sleep: 7.8, mood: 5, spo2: 98 },
  { o: 7, hr: 80, sys: 130, dia: 84, t: 37.1, g: 108, sleep: 5.5, mood: 2, spo2: 95 },
  { o: 6, hr: 67, sys: 115, dia: 73, t: 36.6, g: 89, sleep: 7.4, mood: 4, spo2: 98 },
  { o: 5, hr: 72, sys: 120, dia: 78, t: 36.8, g: 96, sleep: 6.9, mood: 3, spo2: 97 },
  { o: 4, hr: 64, sys: 112, dia: 71, t: 36.4, g: 86, sleep: 8.1, mood: 5, spo2: 99 },
  { o: 3, hr: 74, sys: 123, dia: 80, t: 36.9, g: 99, sleep: 6.4, mood: 3, spo2: 97 },
  { o: 2, hr: 66, sys: 114, dia: 74, t: 36.5, g: 90, sleep: 7.5, mood: 4, spo2: 98 },
  { o: 1, hr: 73, sys: 122, dia: 79, t: 36.8, g: 97, sleep: 6.6, mood: 4, spo2: 97 },
  { o: 0, hr: 68, sys: 116, dia: 75, t: 36.6, g: 91, sleep: 7.3, mood: 4, spo2: 98 },
]

/** Builds daily chat-style readings for the last two weeks, newest first. */
export function buildTwoWeekSampleVitals(now = new Date()): VitalReading[] {
  return TWO_WEEKS.map((d) => {
    const when = new Date(now)
    when.setHours(0, 0, 0, 0)
    when.setDate(when.getDate() - d.o)
    when.setHours(8, 10 + (d.o % 4) * 4, 0, 0)
    return {
      id: uuid(),
      recordedAt: when.toISOString(),
      source: 'chat' as const,
      heartRate: d.hr,
      systolic: d.sys,
      diastolic: d.dia,
      temperatureC: d.t,
      glucoseMgDl: d.g,
      sleepHours: d.sleep,
      moodScore: d.mood,
      spo2: d.spo2,
      rawExcerpt: 'Daily check-in (sample data)',
    }
  }).sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
}
