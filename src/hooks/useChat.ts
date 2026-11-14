import { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { runCoachTurn, startRoutineLocal } from '@/lib/coach/agent'
import { classifyMessage, isWorkoutContinue } from '@/lib/coach/classify'
import { buildNextExerciseTurn, withNextExerciseAttached } from '@/lib/coach/nextExercise'
import { prefetchRoutine } from '@/lib/coach/prescribe'
import { buildVitalReply, canReplyLocally } from '@/lib/coach/vitalReplies'
import {
  getClaudeApiKey,
  getExerciseApiKey,
} from '@/lib/env'
import {
  currentVitals,
  extractVitalsFromText,
  isCriticalVitals,
} from '@/lib/extractVitals'
import { simulateHealthReply } from '@/lib/triage'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type {
  ChatMessage,
  CoachState,
  GameTelemetryPayload,
  VitalMetrics,
  VitalReading,
} from '@/types/health'

export function useChat(
  vitals: VitalReading[],
  crewName: string,
  simulateDelayMs: number,
  coachState: CoachState,
  routineSlot: number,
  onCoachState: (state: CoachState, routineSlot?: number) => void,
  onVitalsExtracted: (metrics: VitalMetrics) => VitalReading,
  storageKey = 'chat',
) {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(storageKey, [])
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

      // Only this chat's readings — old history must not poison a fresh log
      const sessionStart = messages[0]
        ? new Date(messages[0].createdAt).getTime()
        : new Date(userMsg.createdAt).getTime()
      const sessionVitals = nextVitals.filter(
        (v) => new Date(v.recordedAt).getTime() >= sessionStart,
      )
      const merged = currentVitals(sessionVitals)

      try {
        // Vitals never hit Claude — fixed templates; HR also attaches next exercise
        if (canReplyLocally(extracted)) {
          const turn = await buildVitalReply(
            isCriticalVitals(merged) ? merged : extracted,
            coachState,
            {
              crewName,
              exerciseApiKey: getExerciseApiKey(),
              routineSlot,
            },
          )
          if (turn) {
            onCoachState(turn.coachState, turn.routineSlot)
            setMessages((prev) => [
              ...prev,
              {
                id: uuid(),
                role: 'assistant',
                content: turn.content,
                createdAt: new Date().toISOString(),
                triageLevel: turn.triageLevel,
                loggedVitals: turn.loggedVitals,
                blocks: turn.blocks,
                avatarEmotion: turn.avatarEmotion,
                avatarMood: turn.avatarMood,
                speakText: turn.speakText,
                coachState: turn.coachState,
              },
            ])
            return
          }
        }

        // Start routine, "done", and mid-workout "ok/ready/where is it" stay local
        const intent = classifyMessage(trimmed)
        const midWorkout = coachState === 'coach_set' || coachState === 'prescribe_exercise'
        const continueWorkout = midWorkout && isWorkoutContinue(trimmed)
        if (intent === 'start_routine' || intent === 'exercise_done' || continueWorkout) {
          // Warm exercise cache while the crew logs temp + HR
          if (intent === 'start_routine') prefetchRoutine(crewName, getExerciseApiKey())
          const turn =
            intent === 'start_routine'
              ? startRoutineLocal()
              : await buildNextExerciseTurn(crewName, getExerciseApiKey(), routineSlot)
          onCoachState(turn.coachState, turn.routineSlot)
          setMessages((prev) => [
            ...prev,
            {
              id: uuid(),
              role: 'assistant',
              content: turn.content,
              createdAt: new Date().toISOString(),
              triageLevel: turn.triageLevel,
              loggedVitals: turn.loggedVitals,
              blocks: turn.blocks,
              avatarEmotion: turn.avatarEmotion,
              avatarMood: turn.avatarMood,
              speakText: turn.speakText,
              coachState: turn.coachState,
            },
          ])
          return
        }

        const claudeKey = getClaudeApiKey()

        if (claudeKey) {
          let turn = await runCoachTurn({
            keys: {
              claudeApiKey: claudeKey,
              exerciseApiKey: getExerciseApiKey(),
            },
            crewName,
            coachState,
            routineSlot,
            vitals: nextVitals,
            history: [...messages, userMsg],
            userText: trimmed,
          })

          // Chat-mode replies often say "here's your next exercise" without a card
          if (midWorkout) {
            turn = await withNextExerciseAttached(
              turn,
              crewName,
              getExerciseApiKey(),
              turn.routineSlot ?? routineSlot,
            )
          }

          onCoachState(turn.coachState, turn.routineSlot)

          setMessages((prev) => [
            ...prev,
            {
              id: uuid(),
              role: 'assistant',
              content: turn.content,
              createdAt: new Date().toISOString(),
              triageLevel: turn.triageLevel,
              loggedVitals: turn.loggedVitals,
              blocks: turn.blocks,
              avatarEmotion: turn.avatarEmotion,
              avatarMood: turn.avatarMood,
              speakText: turn.speakText,
              coachState: turn.coachState,
            },
          ])
        } else {
          await new Promise((r) => setTimeout(r, simulateDelayMs))
          const reply = simulateHealthReply(trimmed, nextVitals, extracted)
          setMessages((prev) => [
            ...prev,
            {
              id: uuid(),
              role: 'assistant',
              content: reply.content,
              createdAt: new Date().toISOString(),
              triageLevel: reply.triageLevel,
              loggedVitals: extracted != null,
              gameAction: reply.gameAction,
              blocks: [{ type: 'text', text: reply.content }],
              avatarEmotion:
                reply.triageLevel === 'emergency'
                  ? 'emergency'
                  : extracted
                    ? 'cheering'
                    : 'happy',
              avatarMood:
                reply.triageLevel === 'emergency'
                  ? 'emergency'
                  : reply.triageLevel === 'urgent'
                    ? 'sad'
                    : reply.triageLevel === 'info'
                      ? 'happy'
                      : 'neutral',
              speakText: reply.content,
            },
          ])
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Coach loop failed. Check API keys in Settings.'
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: 'assistant',
            content: message,
            createdAt: new Date().toISOString(),
            triageLevel: 'monitor',
            blocks: [{ type: 'text', text: message }],
            avatarEmotion: 'sad',
            avatarMood: 'sad',
            speakText: 'Something went wrong with the coach loop.',
          },
        ])
      } finally {
        setIsTyping(false)
      }
    },
    [
      coachState,
      crewName,
      isTyping,
      messages,
      onCoachState,
      onVitalsExtracted,
      routineSlot,
      setMessages,
      simulateDelayMs,
      vitals,
    ],
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
        avatarEmotion: telemetry.goalAchieved ? 'cheering' : 'excited',
        avatarMood: 'happy',
        speakText: telemetry.goalAchieved
          ? 'Strength quota achieved. Great work, crew.'
          : 'Strength session logged. We can run another test when you are ready.',
        blocks: [
          {
            type: 'text',
            text: `Grip assessment logged: ${telemetry.metrics.totalGripReps} reps, score ${telemetry.metrics.telemetryScore}.`,
          },
          {
            type: 'measure_prompt',
            prompt: {
              kind: 'heart_rate',
              title: 'Post-strength heart rate',
              hint: 'Log your pulse after the grip assessment.',
              starterText: 'My heart rate is ',
            },
          },
        ],
      }
      setMessages((prev) => [...prev, summaryMsg])
      onCoachState('measure_hr')
    },
    [onCoachState, setMessages],
  )

  const clearChat = useCallback(() => {
    setMessages([])
  }, [setMessages])

  return { messages, isTyping, sendMessage, clearChat, logGameTelemetry }
}
