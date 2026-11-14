import { useEffect, useMemo, useRef } from 'react'
import { Frown, PartyPopper, Smile, Sparkles, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSpeech } from '@/hooks/useSpeech'
import {
  RobotAstronaut,
  type AvatarEmotion,
  type AvatarMood,
} from '@/lib/avatar/robotAstronaut'
import { toSpeakableText } from '@/lib/speech'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/health'

const GREETING =
  "Hi, I'm your Space Health assistant. Tell me your readings in the chat, like your heart rate or blood pressure, and I'll log them for you."

const TEST_PHRASE = 'Speaker test. If you can hear me, audio output is working.'

const EMOTION_BUTTONS: { emotion: AvatarEmotion; label: string; icon: typeof Smile }[] = [
  { emotion: 'happy', label: 'Happy', icon: Smile },
  { emotion: 'sad', label: 'Sad', icon: Frown },
  { emotion: 'cheering', label: 'Cheering', icon: PartyPopper },
  { emotion: 'excited', label: 'Excited', icon: Sparkles },
]

function moodFor(reply: ChatMessage | undefined): AvatarMood {
  if (!reply) return 'neutral'
  if (reply.triageLevel === 'urgent' || reply.triageLevel === 'emergency') return 'sad'
  if (reply.triageLevel === 'info') return 'happy'
  return 'neutral'
}

interface AvatarPanelProps {
  messages: ChatMessage[]
  isTyping: boolean
  className?: string
}

export function AvatarPanel({ messages, isTyping, className }: AvatarPanelProps) {
  const stageRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<RobotAstronaut | null>(null)
  const { supported, speaking, speak, stop } = useSpeech()

  const latestReply = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  )
  const mood = moodFor(latestReply)
  const seenReplyId = useRef(latestReply?.id)

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
    avatarRef.current?.setState(speaking ? 'speaking' : isTyping ? 'thinking' : 'idle')
  }, [speaking, isTyping])

  useEffect(() => {
    avatarRef.current?.setMood(mood)
  }, [mood])

  useEffect(() => {
    if (!latestReply || latestReply.id === seenReplyId.current) return
    seenReplyId.current = latestReply.id
    if (latestReply.loggedVitals && mood !== 'sad') {
      avatarRef.current?.play('cheering')
    }
  }, [latestReply, mood])

  function say(text: string) {
    speak(text, { onWord: () => avatarRef.current?.pulse() })
  }

  function handleAvatarClick() {
    if (speaking) {
      stop()
      return
    }
    avatarRef.current?.play('excited')
    say(latestReply ? toSpeakableText(latestReply.content) : GREETING)
  }

  function handleTestSpeaker() {
    if (speaking) {
      stop()
      return
    }
    say(TEST_PHRASE)
  }

  const status = !supported
    ? 'Voice output is not supported in this browser'
    : speaking
      ? 'Speaking — click to stop'
      : isTyping
        ? 'Thinking…'
        : latestReply
          ? 'Click me to hear the latest reply'
          : 'Click me to say hello'

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
        disabled={!supported}
        aria-label={speaking ? 'Stop the assistant voice' : 'Hear the assistant speak'}
        className="relative min-h-0 flex-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset disabled:cursor-not-allowed"
      >
        <span ref={stageRef} className="absolute inset-0 block" />
      </button>

      <div className="flex shrink-0 flex-col gap-2 border-t border-[#222226] p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {EMOTION_BUTTONS.map(({ emotion, label, icon: Icon }) => (
            <Tooltip key={emotion}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Play ${label.toLowerCase()} emotion`}
                  className="w-full border-[#222226] bg-[#111113] text-zinc-400 hover:border-emerald-500/40 hover:bg-zinc-900 hover:text-emerald-300"
                  onClick={() => avatarRef.current?.play(emotion)}
                >
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full border-[#222226] bg-[#111113] text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50',
            speaking &&
              'border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10',
          )}
          onClick={handleTestSpeaker}
          disabled={!supported}
        >
          {speaking ? <Square data-icon="inline-start" /> : <Volume2 data-icon="inline-start" />}
          {speaking ? 'Stop' : 'Test speaker'}
        </Button>
      </div>
    </aside>
  )
}
