import { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { runCoachTurn, startRoutineLocal } from '@/lib/coach/agent'
import { classifyMessage, isWorkoutContinue } from '@/lib/coach/classify'
import { buildNextExerciseTurn, withNextExerciseAttached } from '@/lib/coach/nextExercise'
import { measurePrompt } from '@/lib/coach/measurePrompts'
import { prefetchRoutine } from '@/lib/coach/prescribe'
import { buildOfflineSupport, buildSupportReply, supportCommand } from '@/lib/coach/support'
import {
  buildCheckinSkip,
  buildDailyCheckIn,
  buildWorkoutStart,
  buildRejectionReply,
  buildVitalReply,
  buildWorkoutHold,
  canReplyLocally,
  parseCheckinSkip,
  type VitalReply,
} from '@/lib/coach/vitalReplies'
import {
  getClaudeApiKey,
  getExerciseApiKey,
} from '@/lib/env'
import {
  currentVitals,
  isCriticalVitals,
  parseReadings,
} from '@/lib/extractVitals'
import { buildGameCommentary, type NormalizedGameResult } from '@/lib/games/host'
import { simulateHealthReply } from '@/lib/triage'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type {
  ChatMessage,
  CoachState,
  MissionEnvironment,
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
  environment: MissionEnvironment,
  storageKey = 'chat',
) {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(storageKey, [])
  const [isTyping, setIsTyping] = useState(false)

  const pushLocalTurn = useCallback(
    (turn: VitalReply) => {
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
    },
    [onCoachState, setMessages],
  )

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

      const support = supportCommand(trimmed)
      const skipped = parseCheckinSkip(trimmed)
      if (support || skipped) {
        await new Promise((r) => setTimeout(r, Math.min(simulateDelayMs, 400)))
        pushLocalTurn(
          support
            ? buildSupportReply(support, environment, coachState)
            : buildCheckinSkip(skipped!, vitals),
        )
        setIsTyping(false)
        return
      }

      const parsed = parseReadings(trimmed)
      const extracted = parsed.metrics
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
              environment,
              readings: nextVitals,
            },
            parsed.rejected,
          )
          if (turn) {
            pushLocalTurn(turn)
            return
          }
        }

        if (parsed.rejected.length > 0) {
          await new Promise((r) => setTimeout(r, simulateDelayMs))
          pushLocalTurn(buildRejectionReply(parsed.rejected, parsed.rejectedKinds, coachState))
          return
        }

        // Start routine, daily check-in, "done", and mid-workout "ok/ready/where is it" stay local
        const intent = classifyMessage(trimmed)
        if (intent === 'play_game') {
          const reply = simulateHealthReply(trimmed, nextVitals, null)
          setMessages((prev) => [
            ...prev,
            {
              id: uuid(),
              role: 'assistant',
              content: reply.content,
              createdAt: new Date().toISOString(),
              triageLevel: reply.triageLevel,
              gameAction: reply.gameAction,
              blocks: [{ type: 'text', text: reply.content }],
              avatarEmotion: 'excited',
              avatarMood: 'happy',
              speakText: 'Asteroid Run is ready when you are. It is a fitness game, not a medical test.',
            },
          ])
          return
        }
        if (intent === 'daily_checkin') {
          pushLocalTurn(buildDailyCheckIn(nextVitals, coachState))
          return
        }
        const midWorkout = coachState === 'coach_set' || coachState === 'prescribe_exercise'
        const continueWorkout = midWorkout && isWorkoutContinue(trimmed)
        const hold =
          intent === 'exercise_done' || continueWorkout ? buildWorkoutHold(nextVitals) : null
        if (hold) {
          pushLocalTurn(hold)
          return
        }
        if (intent === 'start_routine') {
          const ready = await buildWorkoutStart(nextVitals, crewName, getExerciseApiKey())
          if (ready) {
            pushLocalTurn(ready)
            return
          }
        }
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
            environment,
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
          const offlineSupport = buildOfflineSupport(trimmed, coachState)
          if (offlineSupport) {
            pushLocalTurn(offlineSupport)
            return
          }
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
      environment,
      isTyping,
      messages,
      onCoachState,
      onVitalsExtracted,
      pushLocalTurn,
      routineSlot,
      setMessages,
      simulateDelayMs,
      vitals,
    ],
  )

  const logGameResult = useCallback(
    (result: NormalizedGameResult): string | null => {
      const commentary = buildGameCommentary(result)
      if (!commentary) return null
      const summaryMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: commentary.display,
        createdAt: new Date().toISOString(),
        triageLevel: commentary.triageLevel,
        gameTelemetry: result.telemetry ?? undefined,
        avatarEmotion: commentary.avatarEmotion,
        avatarMood: commentary.avatarMood,
        speakText: commentary.speakText,
        blocks: [
          { type: 'text', text: commentary.display },
          measurePrompt('heart_rate', {
            title: 'Post-game heart rate',
            hint: 'Log your pulse after the grip game.',
          }),
        ],
      }
      setMessages((prev) => [...prev, summaryMsg])
      onCoachState('measure_hr')
      return commentary.speakText
    },
    [onCoachState, setMessages],
  )

  const clearChat = useCallback(() => {
    setMessages([])
  }, [setMessages])

  return { messages, isTyping, sendMessage, clearChat, logGameResult }
}
