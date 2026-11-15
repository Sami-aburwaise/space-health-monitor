import { loadJson, removeKey, saveJson } from '@/lib/storage'

/**
 * Generated speech kept in localStorage so repeated lines (tour, prompts, replies)
 * never cost ElevenLabs credits twice. Least recently played clips go first.
 */

const INDEX_KEY = 'tts:index'
const CLIP_PREFIX = 'tts:clip:'
/** Characters of base64 we allow; leaves most of the ~5M-char quota for chat and vitals */
const BUDGET_CHARS = 2_000_000

interface IndexEntry {
  id: string
  size: number
  usedAt: number
}

/** Short stable hash (cyrb53) so long texts make compact keys. */
function hash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export function ttsCacheId(...parts: string[]): string {
  return hash(parts.join('\u0000'))
}

function readIndex(): IndexEntry[] {
  return loadJson<IndexEntry[]>(INDEX_KEY, [])
}

function writeIndex(index: IndexEntry[]) {
  try {
    saveJson(INDEX_KEY, index)
  } catch {
    /* index is rebuilt lazily; a failed write only costs a cache miss */
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export function getCachedSpeech(id: string): Blob | null {
  const data = loadJson<string | null>(CLIP_PREFIX + id, null)
  const index = readIndex()
  const entry = index.find((e) => e.id === id)
  if (!data) {
    if (entry) writeIndex(index.filter((e) => e.id !== id))
    return null
  }
  if (entry) {
    entry.usedAt = Date.now()
    writeIndex(index)
  }
  return base64ToBlob(data, 'audio/mpeg')
}

export async function putCachedSpeech(id: string, blob: Blob): Promise<void> {
  const data = await blobToBase64(blob)
  if (!data || data.length > BUDGET_CHARS / 4) return

  let index = readIndex().filter((e) => e.id !== id)
  index.sort((a, b) => a.usedAt - b.usedAt)
  const evict = () => {
    const oldest = index.shift()
    if (oldest) removeKey(CLIP_PREFIX + oldest.id)
    return Boolean(oldest)
  }

  let used = index.reduce((sum, e) => sum + e.size, 0)
  while (used + data.length > BUDGET_CHARS && index.length > 0) {
    used -= index[0]!.size
    evict()
  }

  // Other app data may already fill the quota; make room or give up quietly
  for (;;) {
    try {
      saveJson(CLIP_PREFIX + id, data)
      break
    } catch {
      if (!evict()) return
    }
  }

  index.push({ id, size: data.length, usedAt: Date.now() })
  writeIndex(index)
}
