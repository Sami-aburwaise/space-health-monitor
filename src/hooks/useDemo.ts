import { useCallback, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { COMPANION_NAME } from '@/lib/coach/identity'
import { measurePrompt } from '@/lib/coach/measurePrompts'
import { prefetchRoutine, prescribeRoutineExercise } from '@/lib/coach/prescribe'
import type {
  AvatarEmotion,
  AvatarMood,
  ChatMessage,
  MeasureKind,
  MessageBlock,
  TriageLevel,
} from '@/types/health'

/** Upper bound per spoken line so a stalled voice can't freeze the tour. */
const MAX_LINE_MS = 9000
const USER_BEAT_MS = 700

/** Extra time on each instrument so the avatar's demonstration can be seen. */
const INSTRUMENT_HOLD_MS = 1200

/** How to measure each check-in reading; the avatar acts out the instrument for the card shown. */
const DEMO_STEPS: { kind: MeasureKind; say: string }[] = [
  {
    kind: 'temperature',
    say: 'For temperature, hold the contactless thermometer a few centimetres from your forehead and press the button.',
  },
  {
    kind: 'heart_rate',
    say: 'For heart rate, rest for five minutes, then clip the pulse oximeter on a fingertip and keep still.',
  },
  {
    kind: 'blood_pressure',
    say: 'For blood pressure, sit strapped in, put the cuff on your upper arm at heart level, and let it inflate.',
  },
  {
    kind: 'glucose',
    say: 'For blood glucose, before breakfast, prick a fingertip and touch the test strip to the drop.',
  },
  {
    kind: 'sleep',
    say: 'For sleep, check your sleep watch, or just tell me how many hours you slept.',
  },
  { kind: 'mood', say: 'And for mood, just pick how you feel today, from one to five.' },
]

interface DemoOptions {
  crewName: string
  exerciseApiKey: string
  /** Called after the tour so the real check-in begins */
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
        `Hi! I'm your ${COMPANION_NAME}. Here's a quick tour. Each day we do a short check-in, one reading at a time, and I'll show you how to measure each one.`,
        [],
        'excited',
      )

      for (const step of DEMO_STEPS) {
        await coach(step.say, [measurePrompt(step.kind)])
        await sleep(INSTRUMENT_HOLD_MS)
      }

      await coach(
        'You type each number into its card. Then I tell you if it is normal, watch or alert, and exactly what to do.',
        [{ type: 'status_key' }],
      )

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
        "And if you're ever feeling low, or just want to talk about anything, I'm here for you. Now let's do today's check-in, then your workout.",
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
