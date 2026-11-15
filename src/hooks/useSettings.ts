import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { AppSettings } from '@/types/health'

const DEFAULTS: AppSettings = {
  simulateDelayMs: 700,
  sidebarCollapsed: true,
  environment: 'station',
  ttsEnabled: true,
  arduinoPort: '',
  arduinoBaudRate: 9600,
  arduinoBridgeUrl: '',
}

function normalizeBaud(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 300 || n > 1_000_000) return DEFAULTS.arduinoBaudRate
  return n
}

export function useSettings() {
  const [stored, setSettings] = useLocalStorage<Partial<AppSettings>>('settings', {})
  const settings: AppSettings = {
    ...DEFAULTS,
    ...stored,
    // Strip legacy key fields if they linger in localStorage
    simulateDelayMs: stored.simulateDelayMs ?? DEFAULTS.simulateDelayMs,
    sidebarCollapsed: stored.sidebarCollapsed ?? DEFAULTS.sidebarCollapsed,
    environment: stored.environment ?? DEFAULTS.environment,
    ttsEnabled: stored.ttsEnabled ?? DEFAULTS.ttsEnabled,
    arduinoPort: typeof stored.arduinoPort === 'string' ? stored.arduinoPort : '',
    arduinoBaudRate: normalizeBaud(stored.arduinoBaudRate),
    arduinoBridgeUrl: typeof stored.arduinoBridgeUrl === 'string' ? stored.arduinoBridgeUrl : '',
  }

  return {
    settings,
    setSettings,
    update: (patch: Partial<AppSettings>) =>
      setSettings((prev) => ({ ...prev, ...patch })),
  }
}
