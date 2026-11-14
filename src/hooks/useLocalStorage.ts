import { useEffect, useState } from 'react'
import { loadJson, saveJson } from '@/lib/storage'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJson(key, initial))
  const [activeKey, setActiveKey] = useState(key)

  // Re-hydrate when the storage key changes (e.g. profile switch)
  if (key !== activeKey) {
    setActiveKey(key)
    setValue(loadJson(key, initial))
  }

  useEffect(() => {
    saveJson(key, value)
  }, [key, value])

  return [value, setValue] as const
}
