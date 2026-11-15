import { useEffect, useRef, useState } from 'react'
import { loadJson, saveJson } from '@/lib/storage'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJson(key, initial))
  const [activeKey, setActiveKey] = useState(key)
  // Skip the first write after mount / key change so an empty in-memory value
  // cannot wipe data that was just written to localStorage (e.g. sample vitals).
  const skipSave = useRef(true)

  // Re-hydrate when the storage key changes (e.g. profile switch)
  if (key !== activeKey) {
    skipSave.current = true
    setActiveKey(key)
    setValue(loadJson(key, initial))
  }

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveJson(key, value)
  }, [key, value])

  return [value, setValue] as const
}
