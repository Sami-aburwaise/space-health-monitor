import { useEffect, useMemo, useRef } from 'react'
import { useAvatarVoice } from '@/hooks/useAvatarVoice'
import {
  RobotAstronaut,
  type AvatarEmotion,
  type AvatarMood,
} from '@/lib/avatar/robotAstronaut'
import { CURRENT_VITALS_WINDOW_MS } from '@/lib/extractVitals'
import { toSpeakableText } from '@/lib/speech'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/health'

const GREETING =
  "Hi, I'm your Space Health coach. I'll ask for readings and assign harness-compatible equipment exercises for microgravity."

function isEmergencyReply(reply: ChatMessage) {
  return (
    reply.triageLevel === 'emergency' ||
    reply.avatarEmotion === 'emergency' ||
    reply.avatarMood === 'emergency'
  )
}

function isRecent(reply: ChatMessage) {
  return Date.now() - new Date(reply.createdAt).getTime() <= CURRENT_VITALS_WINDOW_MS
}

function moodFor(reply: ChatMessage | undefined, critical: boolean): AvatarMood {
  if (critical) return 'emergency'
  if (!reply) return 'neutral'
  if (isEmergencyReply(reply)) return isRecent(reply) ? 'emergency' : 'neutral'
  if (reply.avatarMood) return reply.avatarMood
  if (reply.triageLevel === 'urgent') return 'sad'
  if (reply.triageLevel === 'info') return 'happy'
  return 'neutral'
}

function emotionFor(reply: ChatMessage, mood: AvatarMood): AvatarEmotion | null {
  if (mood === 'emergency') return 'emergency'
  if (reply.avatarEmotion === 'emergency') return 'sad'
  if (reply.avatarEmotion) return reply.avatarEmotion
  if (reply.loggedVitals && mood !== 'sad') return 'cheering'
  return null
}

interface AvatarPanelProps {
  messages: ChatMessage[]
  isTyping: boolean
  /** True while the newest value of any vital is in the critical range */
  criticalVitals?: boolean
  elevenLabsApiKey?: string
  elevenLabsVoiceId?: string
  autoSpeak?: boolean
  /** Double-click toggles the guided tour */
  onToggleDemo?: () => void
  demoActive?: boolean
  /** Fired when an auto-spoken reply finishes (or can't be spoken) */
  onSpeechEnd?: (messageId: string) => void
  className?: string
}

/** Long enough to tell a single click from the first half of a double-click. */
const CLICK_DELAY_MS = 250
const NO_VOICE_LINE_MS = 2500

export function AvatarPanel({
  messages,
  isTyping,
  criticalVitals = false,
  elevenLabsApiKey = '',
  elevenLabsVoiceId = '',
  autoSpeak = true,
  onToggleDemo,
  demoActive = false,
  onSpeechEnd,
  className,
}: AvatarPanelProps) {
  const stageRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<RobotAstronaut | null>(null)
  const { supported, speaking, loading, speak, stop, usingElevenLabs } = useAvatarVoice({
    elevenLabsApiKey,
    elevenLabsVoiceId,
  })

  const latestReply = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  )
  const mood = moodFor(latestReply, criticalVitals)
  const seenReplyId = useRef(latestReply?.id)
  const seenReplyAt = useRef(latestReply ? new Date(latestReply.createdAt).getTime() : 0)
  const pendingEmotion = useRef<AvatarEmotion | null>(null)
  const clickTimer = useRef<number | null>(null)
  const onSpeechEndRef = useRef(onSpeechEnd)
  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechEnd])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const avatar = new RobotAstronaut(stage)
    avatarRef.current = avatar
    return () => {
      avatar.dispose()
      avatarRef.current = null
    }
  }, [])

  useEffect(() => {
    if (speaking) {
      avatarRef.current?.setState('speaking')
      return
    }
    if (loading || isTyping) {
      avatarRef.current?.setState('thinking')
      return
    }
    avatarRef.current?.setState('idle')
  }, [speaking, loading, isTyping])

  useEffect(() => {
    avatarRef.current?.setMood(mood)
  }, [mood])

  useEffect(() => {
    if (!latestReply || latestReply.id === seenReplyId.current) return
    seenReplyId.current = latestReply.id
    // Only speak replies newer than anything heard — leaving the tour must not replay old chat
    const at = new Date(latestReply.createdAt).getTime()
    if (at <= seenReplyAt.current) return
    seenReplyAt.current = at

    pendingEmotion.current = emotionFor(latestReply, mood)
    const replyId = latestReply.id
    const finished = () => onSpeechEndRef.current?.(replyId)

    if (autoSpeak && supported) {
      const line = latestReply.speakText || latestReply.content
      void speak(toSpeakableText(line), {
        onWord: () => avatarRef.current?.pulse(),
        onLevel: (level) => avatarRef.current?.setMouthLevel(level),
        onStart: () => {
          const emotion = pendingEmotion.current
          pendingEmotion.current = null
          if (emotion) avatarRef.current?.play(emotion)
        },
        onEnd: finished,
      })
    } else {
      if (pendingEmotion.current) {
        avatarRef.current?.play(pendingEmotion.current)
        pendingEmotion.current = null
      }
      window.setTimeout(finished, NO_VOICE_LINE_MS)
    }
  }, [latestReply, mood, autoSpeak, speak, supported])

  useEffect(
    () => () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current)
    },
    [],
  )

  function handleAvatarDoubleClick() {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    stop()
    onToggleDemo?.()
  }

  function handleAvatarClick() {
    if (!onToggleDemo) {
      replayOrStop()
      return
    }
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null
      replayOrStop()
    }, CLICK_DELAY_MS)
  }

  function replayOrStop() {
    if (demoActive) return
    if (speaking || loading) {
      stop()
      return
    }
    const emotion = latestReply ? emotionFor(latestReply, mood) : 'happy'
    void speak(
      latestReply
        ? toSpeakableText(latestReply.speakText || latestReply.content)
        : GREETING,
      {
        onWord: () => avatarRef.current?.pulse(),
        onLevel: (level) => avatarRef.current?.setMouthLevel(level),
        onStart: () => {
          if (emotion) avatarRef.current?.play(emotion)
        },
      },
    )
  }

  const status = demoActive
    ? 'Tour running — double-click me to stop'
    : !supported
    ? 'Add an ElevenLabs key or use a browser with speech synthesis'
    : speaking
      ? `Speaking (${usingElevenLabs ? 'ElevenLabs radio' : 'browser'}) — click to stop`
      : loading
        ? 'Tuning radio…'
        : isTyping
          ? 'Thinking…'
          : latestReply
            ? 'Click to replay · double-click for a tour'
            : 'Click to say hello · double-click for a tour'

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-[#222226] bg-[#0A0A0B]',
        className,
      )}
    >
      <div className="shrink-0 border-b border-[#222226] px-4 py-3">
        <p className="text-sm font-medium tracking-tight text-zinc-100">Assistant</p>
        <p className="text-xs text-zinc-500" aria-live="polite">
          {status}
        </p>
      </div>

      <button
        type="button"
        onClick={handleAvatarClick}
        onDoubleClick={handleAvatarDoubleClick}
        aria-label={speaking ? 'Stop the assistant voice' : 'Hear the assistant speak'}
        className="relative min-h-0 flex-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset disabled:cursor-not-allowed"
      >
        <span ref={stageRef} className="absolute inset-0 block origin-center scale-x-[-1]" />
      </button>
    </aside>
  )
}
