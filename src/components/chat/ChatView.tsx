import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Gamepad2,
  Play,
  Rocket,
  SendHorizontal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { MessageBlocks } from '@/components/chat/MessageBlocks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { START_ROUTINE_CMD } from '@/lib/coach/classify'
import { RichText } from '@/lib/markdown'
import { triageBadgeLabel } from '@/lib/triage'
import { cn } from '@/lib/utils'
import type {
  ChatMessage,
  CoachState,
  GameTelemetryPayload,
  MeasureKind,
  TriageLevel,
} from '@/types/health'

const TRIAGE_STYLES: Record<TriageLevel, string> = {
  info: 'bg-zinc-800 text-zinc-300',
  monitor: 'bg-amber-500/15 text-amber-300',
  urgent: 'bg-orange-500/15 text-orange-300',
  emergency: 'bg-red-500/15 text-red-300',
}

const STRENGTH_GAME_URL = '/games/asteroid-run.html'
function readingMessage(kind: MeasureKind, value: number): string {
  if (kind === 'heart_rate') return `My heart rate is ${value} bpm`
  if (kind === 'temperature') return `My temperature is ${value} C`
  return `Grip strength reps ${value}`
}

interface ChatViewProps {
  messages: ChatMessage[]
  isTyping: boolean
  coachState?: CoachState
  demoActive?: boolean
  onSend: (text: string) => void
  onClear: () => void
  onLogTelemetry?: (telemetry: GameTelemetryPayload) => void
}

export function ChatView({
  messages,
  isTyping,
  coachState,
  demoActive = false,
  onSend,
  onClear,
  onLogTelemetry,
}: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const empty = messages.length === 0 && !isTyping

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'RETURN_TO_CHAT') {
        setActiveGameUrl(null)
        if (e.data.telemetry && onLogTelemetry) {
          onLogTelemetry(e.data.telemetry)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onLogTelemetry])

  function submit() {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  function startRoutine() {
    onSend(START_ROUTINE_CMD)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      <header className="flex items-center justify-between border-b border-[#222226] px-4 py-3 md:px-6">
        <div>
          <h1 className="text-base font-medium tracking-tight text-zinc-100">Health Chat</h1>
          <p className="text-xs text-zinc-500">
            {demoActive
              ? 'Guided tour · sample readings are not saved'
              : `Micro-g coach · station gear assigned automatically${
                  coachState && coachState !== 'idle' ? ` · ${coachState}` : ''
                }`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#222226] bg-[#111113] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          onClick={onClear}
          disabled={empty && !demoActive}
        >
          {demoActive ? <X data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
          {demoActive ? 'Skip tour' : 'Clear'}
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {empty ? (
            <EmptyState
              className="border-[#222226] bg-[#111113]"
              icon={
                <div className="flex size-10 items-center justify-center rounded-md border border-[#222226] bg-[#0A0A0B] text-emerald-400">
                  <Zap className="size-4" />
                </div>
              }
              title="Ready for today's routine"
              description="Station cable, bands, machine, and strapped weights are already assigned. Start when you are suited up."
              actions={
                <Button
                  type="button"
                  size="lg"
                  className="mt-1 bg-emerald-500 px-6 text-emerald-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
                  disabled={isTyping}
                  onClick={startRoutine}
                >
                  <Zap data-icon="inline-start" />
                  Start routine
                </Button>
              }
            />
          ) : (
            messages.map((m, idx) => {
              const isStartCmd = m.content === START_ROUTINE_CMD
              const isLatest = idx === messages.length - 1
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col gap-1.5',
                    m.role === 'user' ? 'items-end' : 'items-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/15'
                        : 'border border-[#222226] bg-[#111113] text-zinc-100',
                    )}
                  >
                    {m.role === 'assistant' && m.blocks && m.blocks.length > 0 ? (
                      <MessageBlocks
                        blocks={m.blocks}
                        onSubmitReading={(kind, value) => onSend(readingMessage(kind, value))}
                        onLaunchStrengthGame={() => setActiveGameUrl(STRENGTH_GAME_URL)}
                        onExerciseDone={
                          isLatest && !isTyping && !demoActive ? () => onSend('Done') : undefined
                        }
                      />
                    ) : (
                      <RichText
                        text={isStartCmd ? 'Started routine' : m.content}
                        className={
                          m.role === 'user' ? 'text-emerald-950 [&_strong]:text-emerald-950' : undefined
                        }
                      />
                    )}

                    {m.gameAction && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveGameUrl(m.gameAction!.url)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setActiveGameUrl(m.gameAction!.url)
                          }
                        }}
                        className="group mt-3 flex cursor-pointer flex-col gap-2.5 overflow-hidden rounded-xl border border-sky-500/30 bg-gradient-to-b from-[#0b132b] to-[#070b18] p-3.5 text-left transition hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/15 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-400">
                              <Gamepad2 className="size-4" />
                            </span>
                            <span className="font-mono text-[11px] font-semibold tracking-wider text-sky-400">
                              {m.gameAction.badge || 'NASA BIO-SYS // CREW EXERCISE'}
                            </span>
                          </div>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-300">
                            Ready
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100 transition group-hover:text-sky-200">
                            {m.gameAction.title}
                          </h3>
                          <p className="mt-0.5 text-xs leading-snug text-zinc-400">
                            {m.gameAction.description}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-1 w-full bg-gradient-to-r from-sky-500 to-blue-600 font-mono text-xs font-semibold tracking-wider text-white uppercase shadow-md shadow-sky-500/25"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveGameUrl(m.gameAction!.url)
                          }}
                        >
                          <Play className="mr-1.5 size-3.5 fill-current" />
                          Play Asteroid Run &amp; Shield Charge
                        </Button>
                      </div>
                    )}
                  </div>

                  {m.role === 'assistant' && m.triageLevel && m.triageLevel !== 'info' && (
                    <Badge className={cn('border-0', TRIAGE_STYLES[m.triageLevel])}>
                      {triageBadgeLabel(m.triageLevel)}
                    </Badge>
                  )}                </div>
              )
            })
          )}
          {isTyping && (
            <div className="flex items-baseline text-xs text-teal-400/80" aria-live="polite">
              Thinking
              <span aria-hidden className="inline-flex">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="animate-pulse"
                    style={{ animationDelay: `${i * 200}ms`, animationDuration: '1s' }}
                  >
                    .
                  </span>
                ))}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-[#222226] bg-[#0A0A0B] p-4 md:px-6">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={demoActive}
            placeholder={
              demoActive ? 'Tour in progress…' : 'Optional note — use measure bubbles for readings…'
            }
            className="min-h-[44px] max-h-32 resize-none border-[#222226] bg-[#111113] text-zinc-50 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <Button
            type="button"
            size="icon-lg"
            className="shrink-0 self-end bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
            disabled={!draft.trim() || isTyping || demoActive}
            onClick={submit}
            aria-label="Send message"
          >
            <SendHorizontal />
          </Button>
        </div>
      </div>

      {activeGameUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#050914] md:absolute">
          <div className="flex items-center justify-between border-b border-[#222226] bg-[#0b132b]/95 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/15 text-sky-400">
                <Rocket className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
                  Asteroid Run &amp; Shield Charge
                </h2>
                <p className="font-mono text-[11px] text-sky-400/80">
                  ASTRONAUT NEUROMUSCULAR &amp; GRIP ASSESSMENT
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-sky-500/40 bg-[#111c3d] font-mono text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25 hover:text-white"
              onClick={() => setActiveGameUrl(null)}
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              Return to Chat
            </Button>
          </div>
          <div className="relative size-full flex-1 bg-[#03060f]">
            <iframe
              src={activeGameUrl}
              title="Asteroid Run & Shield Charge"
              className="size-full border-none"
              allow="autoplay"
            />
          </div>
        </div>
      )}
    </div>
  )
}
