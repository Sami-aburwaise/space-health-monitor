/** Default: Adam — override via Settings / VITE_ELEVENLABS_VOICE_ID */
export const DEFAULT_ELEVEN_VOICE = 'pNInz6obpgDQGcFmaJgB'

/** Fast model with style exaggeration support */
const MODEL_ID = 'eleven_turbo_v2_5'

const CACHE_LIMIT = 24
const blobCache = new Map<string, Blob>()
const inflight = new Map<string, Promise<Blob>>()

function cacheKey(voiceId: string, text: string): string {
  return `${voiceId}::${text}`
}

function remember(key: string, blob: Blob) {
  if (blobCache.has(key)) blobCache.delete(key)
  blobCache.set(key, blob)
  while (blobCache.size > CACHE_LIMIT) {
    const oldest = blobCache.keys().next().value
    if (oldest === undefined) break
    blobCache.delete(oldest)
  }
}

export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voiceId = DEFAULT_ELEVEN_VOICE,
): Promise<Blob> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Nothing to speak')

  const dramatic = exaggerateForTts(trimmed)
  const key = cacheKey(voiceId, dramatic)

  const cached = blobCache.get(key)
  if (cached) return cached

  const pending = inflight.get(key)
  if (pending) return pending

  const request = (async () => {
    const res = await fetch(
      `/proxy/elevenlabs/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128&optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: dramatic.slice(0, 2500),
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.12,
            similarity_boost: 0.9,
            style: 0.95,
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = body?.detail?.message || body?.detail || detail
      } catch {
        /* ignore */
      }
      throw new Error(`ElevenLabs ${res.status}: ${detail}`)
    }

    const blob = await res.blob()
    remember(key, blob)
    return blob
  })()

  inflight.set(key, request)
  try {
    return await request
  } finally {
    inflight.delete(key)
  }
}

/** Nudge prosody without adding many words. */
function exaggerateForTts(text: string): string {
  let t = text.trim()
  if (!/[!?]$/.test(t)) t = `${t}!`
  return t.replace(/\b(heart rate|temperature|strength|routine|logged|ready)\b/gi, (m) =>
    m.toUpperCase(),
  )
}
