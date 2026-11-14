const PREFIX = 'shm:'

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

export function clearAllAppData(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))
  keys.forEach((k) => localStorage.removeItem(k))
}
