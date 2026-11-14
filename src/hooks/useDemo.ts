import { useCallback, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { prefetchRoutine, prescribeRoutineExercise } from '@/lib/coach/prescribe'
import type {
  AvatarEmotion,
  AvatarMood,
  ChatMessage,
  MessageBlock,
  TriageLevel,
} from '@/types/health'

/** Upper bound per spoken line so a stalled voice can't freeze the tour. */
const MAX_LINE_MS = 9000
const USER_BEAT_MS = 700

/** Sample readings shown only inside the tour — never saved as vitals. */
const DEMO_TEMP = 36.8
const DEMO_HR = 74

interface DemoOptions {
  crewName: string
  exerciseApiKey: string
  /** Called after the tour so the real routine begins */
  onFinished: () => void
}

class DemoCancelled extends Error {}

export function useDemo({ crewName, exerciseApiKey, onFinished }: DemoOptions) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const runRef = useRef(0)
  const speechWaiters = useRef(new Map<string, () => void>())

  const notifySpeechEnd = useCallback((messageId: string) => {
    speechWaiters.current.get(messageId)?.()
  }, [])

  const cancel = useCallback(() => {
    runRef.current += 1
    for (const resolve of speechWaiters.current.values()) resolve()
    speechWaiters.current.clear()
    setMessages(null)
  }, [])

  const start = useCallback(async () => {
    const run = ++runRef.current
    const alive = () => {
      if (runRef.current !== run) throw new DemoCancelled()
    }
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms)).then(alive)

    const push = (msg: ChatMessage) => setMessages((prev) => [...(prev ?? []), msg])

    const user = async (content: string) => {
      await sleep(USER_BEAT_MS)
      push({ id: uuid(), role: 'user', content, createdAt: new Date().toISOString() })
    }

    const coach = async (
      speak: string,
      extra: MessageBlock[] = [],
      emotion: AvatarEmotion = 'happy',
      tone: { mood: AvatarMood; triage: TriageLevel } = { mood: 'happy', triage: 'info' },
    ) => {
      const id = uuid()
      const spoken = new Promise<void>((resolve) => {
        speechWaiters.current.set(id, resolve)
        setTimeout(resolve, MAX_LINE_MS)
      })
      push({
        id,
        role: 'assistant',
        content: speak,
        speakText: speak,
        createdAt: new Date().toISOString(),
        triageLevel: tone.triage,
        avatarEmotion: emotion,
        avatarMood: tone.mood,
        blocks: [{ type: 'text', text: speak }, ...extra],
      })
      await spoken
      speechWaiters.current.delete(id)
      alive()
    }

    prefetchRoutine(crewName, exerciseApiKey)
    const exercise = prescribeRoutineExercise(crewName, exerciseApiKey, 0).catch(() => null)
    setMessages([])

    try {
      await coach(
        "Hi! Here's a quick tour. Every workout starts with your vitals, so first I ask for your temperature.",
        [
          {
            type: 'measure_prompt',
            prompt: {
              kind: 'temperature',
              title: 'Temperature',
              hint: 'Enter your body temperature in °C.',
              unit: '°C',
              demoFill: DEMO_TEMP,
            },
          },
        ],
        'excited',
      )
      await user(`My temperature is ${DEMO_TEMP} C`)

      await coach('Then your heart rate. If anything looks off, I tell you exactly what to do.', [
        {
          type: 'measure_prompt',
          prompt: {
            kind: 'heart_rate',
            title: 'Heart rate',
            hint: 'Enter your pulse in beats per minute.',
            unit: 'bpm',
            demoFill: DEMO_HR,
          },
        },
      ])
      await user(`My heart rate is ${DEMO_HR} bpm`)

      const prescribed = await exercise
      alive()
      const card: MessageBlock[] =
        prescribed && !prescribed.done
          ? [
              prescribed.block,
              {
                type: 'text',
                text: `**${prescribed.sets}** — ${prescribed.label}. Tap **done** when finished.`,
              },
            ]
          : []
      await coach(
        'Then I give you zero gravity exercises with a demo. Tap done and I send the next one.',
        card,
        'cheering',
      )
      await user('Done')

      await coach('And if you ever feel unwell, just tell me.', [], 'emergency', {
        mood: 'emergency',
        triage: 'emergency',
      })

      await coach(
        "And whenever you want to talk about anything, not just your health, I'm here for you. Let's start your workout.",
        [],
        'happy',
      )
      await sleep(400)
    } catch (err) {
      if (err instanceof DemoCancelled) return
      throw err
    }

    if (runRef.current !== run) return
    setMessages(null)
    onFinished()
  }, [crewName, exerciseApiKey, onFinished])

  return {
    demoMessages: messages,
    demoActive: messages !== null,
    startDemo: start,
    cancelDemo: cancel,
    notifySpeechEnd,
  }
}
