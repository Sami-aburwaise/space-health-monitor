import { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { loadJson, removeKey, saveJson } from '@/lib/storage'
import type { AppSettings, CrewProfile, ProfilesState } from '@/types/health'

const PROFILE_DATA_KEYS = ['chat', 'vitals', 'symptoms', 'coach'] as const
const STORE_KEY = 'profiles'

export function profileDataKey(profileId: string, leaf: string): string {
  return `p:${profileId}:${leaf}`
}

function readProfiles(): ProfilesState {
  const stored = loadJson<ProfilesState | null>(STORE_KEY, null)
  if (stored?.profiles?.length) {
    const activeId = stored.profiles.some((p) => p.id === stored.activeId)
      ? stored.activeId
      : stored.profiles[0]!.id
    return { activeId, profiles: stored.profiles }
  }

  const legacySettings = loadJson<Partial<AppSettings>>('settings', {})
  const id = uuid()
  const name = legacySettings.crewName?.trim() || 'Crew Member'

  for (const leaf of PROFILE_DATA_KEYS) {
    const raw = localStorage.getItem(`shm:${leaf}`)
    if (raw) {
      localStorage.setItem(`shm:${profileDataKey(id, leaf)}`, raw)
      localStorage.removeItem(`shm:${leaf}`)
    }
  }

  const next: ProfilesState = {
    activeId: id,
    profiles: [{ id, name, createdAt: new Date().toISOString() }],
  }
  saveJson(STORE_KEY, next)
  return next
}

export function useProfiles() {
  const [state, setState] = useState<ProfilesState>(readProfiles)

  const persist = useCallback((next: ProfilesState | ((prev: ProfilesState) => ProfilesState)) => {
    setState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      saveJson(STORE_KEY, resolved)
      return resolved
    })
  }, [])

  const activeProfile =
    state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0]!

  const switchProfile = useCallback(
    (id: string) => {
      persist((prev) => {
        if (!prev.profiles.some((p) => p.id === id)) return prev
        return { ...prev, activeId: id }
      })
    },
    [persist],
  )

  const createProfile = useCallback(
    (name: string) => {
      const profile: CrewProfile = {
        id: uuid(),
        name: name.trim() || 'Crew Member',
        createdAt: new Date().toISOString(),
      }
      persist((prev) => ({
        activeId: profile.id,
        profiles: [...prev.profiles, profile],
      }))
      return profile
    },
    [persist],
  )

  const renameProfile = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      persist((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
      }))
    },
    [persist],
  )

  const deleteProfile = useCallback(
    (id: string) => {
      persist((prev) => {
        if (prev.profiles.length <= 1) return prev
        const profiles = prev.profiles.filter((p) => p.id !== id)
        for (const leaf of PROFILE_DATA_KEYS) {
          removeKey(profileDataKey(id, leaf))
        }
        return {
          activeId: prev.activeId === id ? profiles[0]!.id : prev.activeId,
          profiles,
        }
      })
    },
    [persist],
  )

  return {
    profiles: state.profiles,
    activeId: state.activeId,
    activeProfile,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
  }
}
