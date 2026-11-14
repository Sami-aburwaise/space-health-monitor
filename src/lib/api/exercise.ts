import { loadJson, saveJson } from '@/lib/storage'
import type { ExerciseCardData } from '@/types/health'

const BASE = '/proxy/exercise/v1'
/** Video URLs come back absolute; image paths are relative to the free-exercise-db dataset. */
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
/** Bump when micro-g rules change so stale dumbbell/etc. cache is ignored. */
const CACHE_VER = 'mg6'

/**
 * Only resistive gear that works with a harness / load path in microgravity.
 * Free weights (dumbbell, kettlebell, barbell) need gravity — excluded.
 */
export const MICRO_G_EQUIPMENT = ['cable', 'bands', 'band', 'machine'] as const

/** Names / cues that imply gravity, standing balance, or free-weight presses. */
const GRAVITY_DEPENDENT =
  /\b(arnold|dumbbell|kettlebell|barbell|bench\s*press|overhead\s*press|military\s*press|standing|walking|running|jump|squat\s*jump|push[\s-]?up|pull[\s-]?up|burpee|lunge|deadlift|romanian|goblet|clean|snatch|thruster|floor\s*press|sit[\s-]?up|crunch|plank|yoga|free\s*weight)\b/i

export interface ExerciseApiExercise {
  id: string
  name: string
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  equipment: string | null
  level?: string
  category?: string
  instructions?: string[]
  exerciseTips?: string[]
  commonMistakes?: string[]
  safetyInfo?: string
  overview?: string
  images?: string[]
  videos?: {
    url: string
    format?: string
    resolution?: string
    aspectRatio?: string
    durationSeconds?: number
  }[]
}

interface ListResponse {
  data: ExerciseApiExercise[]
  total: number | null
  limit: number
  offset: number
}

interface CacheEnvelope<T> {
  savedAt: number
  value: T
}

/** Repairs image URLs saved in older chat messages, which pointed at a CDN that 404s. */
export function exerciseImageSrc(url: string | undefined): string | undefined {
  if (!url) return undefined
  const legacy = url.match(/^https:\/\/cdn\.exerciseapi\.dev\/v1\/(.+\.(?:jpe?g|png|gif|webp))$/i)
  return legacy ? `${IMAGE_BASE}/${legacy[1]}` : url
}

/**
 * Demo frames for a card. free-exercise-db stores a start (0.jpg) and end (1.jpg) pose,
 * so cards saved before `imageUrls` existed get the second frame derived from the first.
 */
export function exerciseFrames(card: Pick<ExerciseCardData, 'imageUrl' | 'imageUrls'>): string[] {
  const frames = (card.imageUrls ?? []).map(exerciseImageSrc).filter((u): u is string => !!u)
  if (frames.length > 0) return frames
  const first = exerciseImageSrc(card.imageUrl)
  if (!first) return []
  return first.startsWith(IMAGE_BASE) && /\/0\.jpg$/.test(first)
    ? [first, first.replace(/0\.jpg$/, '1.jpg')]
    : [first]
}

function imageUrl(path?: string): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http')) return path
  return `${IMAGE_BASE}/${path.replace(/^\//, '')}`
}

export function toExerciseCard(ex: ExerciseApiExercise): ExerciseCardData {
  const video = ex.videos?.[0]
  return {
    id: ex.id,
    name: ex.name,
    equipment: ex.equipment,
    level: ex.level,
    category: ex.category,
    primaryMuscles: ex.primaryMuscles ?? [],
    overview: ex.overview,
    instructions: ex.instructions ?? [],
    exerciseTips: ex.exerciseTips ?? [],
    commonMistakes: ex.commonMistakes ?? [],
    safetyInfo: ex.safetyInfo,
    imageUrl: imageUrl(ex.images?.[0]),
    imageUrls: (ex.images ?? []).map(imageUrl).filter((u): u is string => !!u),
    videoUrl: video?.url,
    aspectRatio: video?.aspectRatio,
  }
}

/** Chat bubbles need a demo — most API rows have empty videos/images. */
export function hasExerciseMedia(card: Pick<ExerciseCardData, 'imageUrl' | 'videoUrl'>): boolean {
  return Boolean(card.videoUrl || card.imageUrl)
}

function isAllowedEquipment(equipment: string | null | undefined): boolean {
  if (!equipment) return false
  const e = equipment.toLowerCase()
  if (e === 'body only' || e.includes('body only')) return false
  if (e.includes('dumbbell') || e.includes('kettlebell') || e.includes('barbell')) return false
  return MICRO_G_EQUIPMENT.some((allowed) => e === allowed || e.includes(allowed))
}

/** True when the movement itself depends on gravity / free weights. */
export function isGravityDependent(ex: {
  id?: string
  name?: string
  equipment?: string | null
  instructions?: string[]
  overview?: string
}): boolean {
  if (!isAllowedEquipment(ex.equipment)) return true
  // Machine / free "chest press" needs a bench; cable fly/press with harness is OK
  const name = ex.name ?? ''
  if (/\bchest\s*press\b/i.test(name) && !/cable|band/i.test(ex.equipment ?? '')) return true
  const blob = [ex.id, ex.name, ex.overview, ...(ex.instructions ?? [])].filter(Boolean).join(' ')
  return GRAVITY_DEPENDENT.test(blob)
}

function isMicroGSafe(ex: ExerciseApiExercise): boolean {
  return !isGravityDependent(ex)
}

async function apiGet<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === '') continue
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) {
    let hint = res.statusText
    try {
      const body = await res.json()
      hint = body?.error?.hint || body?.error?.message || hint
    } catch {
      /* ignore */
    }
    throw new Error(`Exercise API ${res.status}: ${hint}`)
  }
  return res.json() as Promise<T>
}

function readCache<T>(key: string): T | null {
  const cached = loadJson<CacheEnvelope<T> | null>(key, null)
  if (!cached) return null
  if (Date.now() - cached.savedAt > CACHE_TTL_MS) return null
  return cached.value
}

function writeCache<T>(key: string, value: T) {
  saveJson(key, { savedAt: Date.now(), value } satisfies CacheEnvelope<T>)
}

const FALLBACK_EQUIPMENT = ['cable', 'bands', 'machine'] as const

export async function searchMicroGExercises(
  apiKey: string,
  opts: {
    q?: string
    muscle?: string
    equipment?: string
    limit?: number
    preferVideo?: boolean
    random?: boolean
    /** Internal: set on fallback calls so equipment fallbacks don't recurse forever */
    noFallback?: boolean
  } = {},
): Promise<ExerciseCardData[]> {
  let equipment = (opts.equipment || 'cable').toLowerCase()
  if (!MICRO_G_EQUIPMENT.some((e) => equipment === e || equipment.includes(e))) {
    equipment = 'cable'
  }
  // Normalize "band" → API often uses "bands"
  if (equipment === 'band') equipment = 'bands'

  const cacheKey = `exercise:${CACHE_VER}:search:${equipment}:${opts.q ?? ''}:${opts.muscle ?? ''}:${opts.random ? 1 : 0}`
  if (!opts.random) {
    const hit = readCache<ExerciseCardData[]>(cacheKey)
    if (hit) return hit.filter((c) => !isGravityDependent(c))
  }

  // Most API rows have no video yet, so never filter server-side on hasVideo —
  // accept any demo image and rank video rows first instead.
  const raw = await apiGet<ListResponse>(apiKey, `${BASE}/exercises`, {
    q: opts.q,
    muscle: opts.muscle,
    equipment,
    category: 'strength',
    random: opts.random ? true : undefined,
    limit: 20,
  })

  let cards = raw.data
    .filter(isMicroGSafe)
    .map(toExerciseCard)
    .filter(hasExerciseMedia)
    .sort((a, b) => Number(Boolean(b.videoUrl)) - Number(Boolean(a.videoUrl)))
    .slice(0, opts.limit ?? 12)

  // Nothing with media on this gear → other station equipment, in parallel
  if (cards.length === 0 && !opts.noFallback) {
    const others = FALLBACK_EQUIPMENT.filter((e) => e !== equipment)
    const results = await Promise.allSettled(
      others.map((next) =>
        searchMicroGExercises(apiKey, {
          ...opts,
          q: undefined,
          equipment: next,
          noFallback: true,
        }),
      ),
    )
    cards =
      results.find(
        (r): r is PromiseFulfilledResult<ExerciseCardData[]> =>
          r.status === 'fulfilled' && r.value.length > 0,
      )?.value ?? []
  }

  // Don't pin an empty result for 24h — retry next time
  if (!opts.random && cards.length > 0) writeCache(cacheKey, cards)
  return cards
}

export async function getExercise(apiKey: string, id: string): Promise<ExerciseCardData> {
  const cacheKey = `exercise:${CACHE_VER}:id:${id}`
  const hit = readCache<ExerciseCardData>(cacheKey)
  if (hit) {
    if (isGravityDependent(hit)) {
      throw new Error(`Rejected gravity-dependent exercise: ${hit.name}`)
    }
    if (!hasExerciseMedia(hit)) {
      throw new Error(`Rejected exercise with no demo media: ${hit.name}`)
    }
    return hit
  }
  const raw = await apiGet<{ data: ExerciseApiExercise }>(
    apiKey,
    `${BASE}/exercises/${encodeURIComponent(id)}`,
  )
  if (!isMicroGSafe(raw.data)) {
    throw new Error(`Rejected gravity-dependent exercise: ${raw.data.name}`)
  }
  const card = toExerciseCard(raw.data)
  if (!hasExerciseMedia(card)) {
    throw new Error(`Rejected exercise with no demo media: ${card.name}`)
  }
  writeCache(cacheKey, card)
  return card
}
