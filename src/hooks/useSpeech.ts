import { useCallback, useEffect, useRef, useState } from 'react'
import { splitForSpeech } from '@/lib/speech'

const ARABIC = /[\u0600-\u06FF]/

interface SpeakOptions {
  onWord?: () => void
}

function pickVoice(lang: 'en' | 'ar'): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(lang))
  return (
    matching.find((v) => /google|natural|samantha|aria|jenny/i.test(v.name)) ?? matching[0]
  )
}

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const sessionRef = useRef(0)

  useEffect(() => {
    if (!supported) return
    const warm = () => window.speechSynthesis.getVoices()
    warm()
    window.speechSynthesis.addEventListener('voiceschanged', warm)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', warm)
      sessionRef.current += 1
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    sessionRef.current += 1
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, { onWord }: SpeakOptions = {}) => {
      if (!supported) return
      const chunks = splitForSpeech(text)
      if (chunks.length === 0) return

      const session = ++sessionRef.current
      window.speechSynthesis.cancel()

      const lang = ARABIC.test(text) ? 'ar' : 'en'
      const voice = pickVoice(lang)
      const isCurrent = () => sessionRef.current === session

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
        if (voice) utterance.voice = voice
        utterance.rate = 1
        utterance.pitch = 1.1

        utterance.onboundary = (event) => {
          if (isCurrent() && event.name === 'word') onWord?.()
        }
        utterance.onerror = () => {
          if (!isCurrent()) return
          sessionRef.current += 1
          window.speechSynthesis.cancel()
          setSpeaking(false)
        }
        if (index === chunks.length - 1) {
          utterance.onend = () => {
            if (isCurrent()) setSpeaking(false)
          }
        }

        window.speechSynthesis.speak(utterance)
      })

      setSpeaking(true)
    },
    [supported],
  )

  return { supported, speaking, speak, stop }
}
