import { loadJson, saveJson } from '@/lib/storage'

const BASE = '/proxy/exercise/v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Spacecraft training bay — resistive load paths only (ARED-like / cables / bands / machines).
 * Free weights are excluded: they need gravity.
 */
export const STATION_EQUIPMENT = ['cable', 'bands', 'machine'] as const

export type StationEquipment = (typeof STATION_EQUIPMENT)[number]

interface CacheEnvelope<T> {
  savedAt: number
  value: T
}

/** Fetch catalog equipment names and intersect with our station bay (cached 24h). */
export async function resolveStationEquipment(apiKey: string): Promise<string[]> {
  if (!apiKey) return [...STATION_EQUIPMENT]

  const cacheKey = 'exercise:mg4:equipment:station'
  const cached = loadJson<CacheEnvelope<string[]> | null>(cacheKey, null)
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return cached.value
  }

  try {
    const res = await fetch(`${BASE}/equipment`, {
      headers: { 'X-API-Key': apiKey },
    })
    if (!res.ok) return [...STATION_EQUIPMENT]
    const body = (await res.json()) as { data?: string[] }
    const catalog = (body.data ?? []).map((e) => e.toLowerCase())
    const resolved = STATION_EQUIPMENT.filter((item) =>
      catalog.some((c) => c === item || c.includes(item) || item.includes(c)),
    )
    const value = resolved.length > 0 ? resolved : [...STATION_EQUIPMENT]
    saveJson(cacheKey, { savedAt: Date.now(), value } satisfies CacheEnvelope<string[]>)
    return value
  } catch {
    return [...STATION_EQUIPMENT]
  }
}

export function formatStationInventory(equipment: string[]): string {
  return `${equipment.join(', ')} (NO dumbbells/kettlebells/barbells — gravity required)`
}
