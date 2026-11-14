import { useCallback, useEffect, useRef, useState } from 'react'
import { playRadioVoice, type RadioPlayHandles } from '@/lib/audio/radioVoice'
import { DEFAULT_ELEVEN_VOICE, synthesizeSpeech } from '@/lib/api/elevenlabs'
import { splitForSpeech } from '@/lib/speech'

const ARABIC = /[\u0600-\u06FF]/

interface SpeakOptions {
  /** Browser speech only: fired on each word boundary */
  onWord?: () => void
  /** ElevenLabs only: per-frame speech loudness 0–1 */
  onLevel?: (level: number) => void
  /** Fired while waiting for TTS network/decode — avatar should stay on thinking */
  onLoading?: () => void
  /** Fired only when audible playback actually begins */
  onStart?: () => void
  /** Fired once when playback finishes or fails (not when interrupted by stop()) */
  onEnd?: () => void
}

function pickVoice(lang: 'en' | 'ar'): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(lang))
  return (
    matching.find((v) => /google|natural|samantha|aria|jenny/i.test(v.name)) ?? matching[0]
  )
}

interface UseAvatarVoiceOptions {
  elevenLabsApiKey?: string
  elevenLabsVoiceId?: string
}

export function useAvatarVoice({
  elevenLabsApiKey = '',
  elevenLabsVoiceId = '',
}: UseAvatarVoiceOptions = {}) {
  const browserSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const sessionRef = useRef(0)
  const radioRef = useRef<RadioPlayHandles | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    sessionRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    radioRef.current?.stop()
    radioRef.current = null
    if (browserSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
    setLoading(false)
  }, [browserSupported])

  useEffect(() => {
    if (!browserSupported) return
    const warm = () => window.speechSynthesis.getVoices()
    warm()
    window.speechSynthesis.addEventListener('voiceschanged', warm)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', warm)
      stop()
    }
  }, [browserSupported, stop])

  const speakBrowser = useCallback(
    (text: string, { onWord, onStart, onEnd }: SpeakOptions, session: number) => {
      if (!browserSupported) {
        onEnd?.()
        return
      }
      const chunks = splitForSpeech(text)
      if (chunks.length === 0) {
        onEnd?.()
        return
      }

      window.speechSynthesis.cancel()
      setLoading(false)
      const lang = ARABIC.test(text) ? 'ar' : 'en'
      const voice = pickVoice(lang)
      const isCurrent = () => sessionRef.current === session
      let started = false

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
        if (voice) utterance.voice = voice
        utterance.rate = 1.08
        utterance.pitch = 1.35
        utterance.onstart = () => {
          if (!isCurrent() || started) return
          started = true
          setSpeaking(true)
          onStart?.()
        }
        utterance.onboundary = (event) => {
          if (isCurrent() && event.name === 'word') onWord?.()
        }
        utterance.onerror = () => {
          if (!isCurrent()) return
          stop()
          onEnd?.()
        }
        if (index === chunks.length - 1) {
          utterance.onend = () => {
            if (!isCurrent()) return
            setSpeaking(false)
            onEnd?.()
          }
        }
        window.speechSynthesis.speak(utterance)
      })
    },
    [browserSupported, stop],
  )

  const speak = useCallback(
    async (text: string, opts: SpeakOptions = {}) => {
      const trimmed = text.trim()
      if (!trimmed) return
      stop()
      const session = ++sessionRef.current
      const key = elevenLabsApiKey.trim()
      const voiceId = elevenLabsVoiceId.trim() || DEFAULT_ELEVEN_VOICE

      if (key) {
        const ac = new AbortController()
        abortRef.current = ac
        // Only show "Tuning radio…" on a real network miss; cache hits stay snappy
        setLoading(true)
        opts.onLoading?.()
        try {
          const blob = await synthesizeSpeech(key, trimmed, voiceId)
          if (sessionRef.current !== session || ac.signal.aborted) return

          const handles = await playRadioVoice(blob, {
            signal: ac.signal,
            onStart: () => {
              if (sessionRef.current !== session) return
              setLoading(false)
              setSpeaking(true)
              opts.onStart?.()
            },
            onLevel: (level) => {
              if (sessionRef.current === session) opts.onLevel?.(level)
            },
            onEnd: () => {
              if (sessionRef.current === session) {
                setSpeaking(false)
                setLoading(false)
                opts.onEnd?.()
              }
            },
          })
          if (sessionRef.current !== session) {
            handles.stop()
            return
          }
          radioRef.current = handles
          return
        } catch (err) {
          if (sessionRef.current !== session) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setLoading(false)
          speakBrowser(trimmed, opts, session)
          return
        }
      }

      speakBrowser(trimmed, opts, session)
    },
    [elevenLabsApiKey, elevenLabsVoiceId, speakBrowser, stop],
  )

  const supported = Boolean(elevenLabsApiKey.trim()) || browserSupported

  return {
    supported,
    speaking,
    loading,
    speak,
    stop,
    usingElevenLabs: Boolean(elevenLabsApiKey.trim()),
  }
}
