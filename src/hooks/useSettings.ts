import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { AppSettings } from '@/types/health'

const DEFAULTS: AppSettings = {
  crewName: '',
  disclaimerAccepted: false,
  simulateDelayMs: 700,
  apiKey: '',
}

export function useSettings() {
  const [stored, setSettings] = useLocalStorage<Partial<AppSettings>>('settings', DEFAULTS)
  const settings: AppSettings = { ...DEFAULTS, ...stored }

  return {
    settings,
    setSettings,
    update: (patch: Partial<AppSettings>) =>
      setSettings((prev) => ({ ...DEFAULTS, ...prev, ...patch })),
  }
}
