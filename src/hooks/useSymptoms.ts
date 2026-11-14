import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { SymptomEntry } from '@/types/health'

export function useSymptoms() {
  const [symptoms, setSymptoms] = useLocalStorage<SymptomEntry[]>('symptoms', [])

  const addSymptom = useCallback(
    (input: Omit<SymptomEntry, 'id' | 'recordedAt'> & { recordedAt?: string }) => {
      const entry: SymptomEntry = {
        ...input,
        id: uuid(),
        recordedAt: input.recordedAt ?? new Date().toISOString(),
      }
      setSymptoms((prev) =>
        [entry, ...prev].sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        ),
      )
    },
    [setSymptoms],
  )

  const removeSymptom = useCallback(
    (id: string) => setSymptoms((prev) => prev.filter((s) => s.id !== id)),
    [setSymptoms],
  )

  const clearSymptoms = useCallback(() => setSymptoms([]), [setSymptoms])

  return { symptoms, addSymptom, removeSymptom, clearSymptoms }
}
