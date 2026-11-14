import { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { extractVitalsFromText } from '@/lib/extractVitals'
import { simulateHealthReply } from '@/lib/triage'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { ChatMessage, GameTelemetryPayload, SymptomEntry, VitalMetrics, VitalReading } from '@/types/health'

export function useChat(
  vitals: VitalReading[],
  symptoms: SymptomEntry[],
  delayMs: number,
  onVitalsExtracted: (metrics: VitalMetrics) => VitalReading,
) {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>('chat', [])
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isTyping) return

      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMsg])
      setIsTyping(true)

      const extracted = extractVitalsFromText(trimmed)
      let nextVitals = vitals
      if (extracted) {
        const saved = onVitalsExtracted(extracted)
        nextVitals = [saved, ...vitals]
      }

      await new Promise((r) => setTimeout(r, delayMs))

      const reply = simulateHealthReply(trimmed, nextVitals, symptoms, extracted)
      const assistantMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: reply.content,
        createdAt: new Date().toISOString(),
        triageLevel: reply.triageLevel,
        gameAction: reply.gameAction,
      }

      setMessages((prev) => [...prev, assistantMsg])
      setIsTyping(false)
    },
    [delayMs, isTyping, onVitalsExtracted, setMessages, symptoms, vitals],
  )

  const logGameTelemetry = useCallback(
    (telemetry: GameTelemetryPayload) => {
      const summaryMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: `🛰️ **Crew Neuromuscular Assessment Logged**\n\n• **Grip Squeezes**: ${telemetry.metrics.totalGripReps} reps ${telemetry.goalAchieved ? '(30-rep quota achieved ✓)' : ''}\n• **Isometric Hold Time**: ${telemetry.metrics.isometricShieldHoldSeconds}s\n• **Average Squeeze Cadence**: ${telemetry.metrics.averageSqueezeRatePerMin} reps/min\n• **Solar Storms Deflected**: ${telemetry.metrics.solarStormsDeflected}\n• **Session Survival**: ${telemetry.metrics.survivalDurationSeconds}s (Score: ${telemetry.metrics.telemetryScore})\n• **Outcome**: ${telemetry.terminationCause}\n\nNeuromuscular metrics have been logged to your astronaut telemetry history.`,
        createdAt: new Date().toISOString(),
        triageLevel: telemetry.goalAchieved ? 'info' : 'monitor',
        gameTelemetry: telemetry,
      }
      setMessages((prev) => [...prev, summaryMsg])
    },
    [setMessages],
  )

  const clearChat = useCallback(() => {
    setMessages([])
  }, [setMessages])

  return { messages, isTyping, sendMessage, clearChat, logGameTelemetry }
}
