import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { VitalMetrics, VitalReading } from '@/types/health'

export function useVitals(storageKey = 'vitals') {
  const [vitals, setVitals] = useLocalStorage<VitalReading[]>(storageKey, [])

  const addVitalFromChat = useCallback(
    (metrics: VitalMetrics, recordedAt?: string) => {
      const reading: VitalReading = {
        ...metrics,
        id: uuid(),
        recordedAt: recordedAt ?? new Date().toISOString(),
        source: 'chat',
      }
      setVitals((prev) =>
        [reading, ...prev].sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        ),
      )
      return reading
    },
    [setVitals],
  )

  const clearVitals = useCallback(() => setVitals([]), [setVitals])

  return { vitals, addVitalFromChat, clearVitals, latest: vitals[0] ?? null }
}
