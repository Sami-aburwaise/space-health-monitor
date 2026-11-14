import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { AppSettings } from '@/types/health'

const DEFAULTS: AppSettings = {
  simulateDelayMs: 700,
  sidebarCollapsed: true,
}

export function useSettings() {
  const [stored, setSettings] = useLocalStorage<Partial<AppSettings>>('settings', {})
  const settings: AppSettings = {
    ...DEFAULTS,
    ...stored,
    // Strip legacy key fields if they linger in localStorage
    simulateDelayMs: stored.simulateDelayMs ?? DEFAULTS.simulateDelayMs,
    sidebarCollapsed: stored.sidebarCollapsed ?? DEFAULTS.sidebarCollapsed,
  }

  return {
    settings,
    setSettings,
    update: (patch: Partial<AppSettings>) =>
      setSettings((prev) => ({ ...prev, ...patch })),
  }
}
