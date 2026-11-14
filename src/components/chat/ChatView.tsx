import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Gamepad2,
  MessageSquarePlus,
  Play,
  Rocket,
  SendHorizontal,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { triageBadgeLabel } from '@/lib/triage'
import { cn } from '@/lib/utils'
import type { ChatMessage, GameTelemetryPayload, TriageLevel } from '@/types/health'

const STARTER_PROMPTS = [
  'Play Asteroid Run',
  'My heart rate is 78 bpm',
  'BP is 120/80 and SpO2 98%',
  'I have a mild headache after training',
  'Temperature is 37.2 C',
]

const TRIAGE_STYLES: Record<TriageLevel, string> = {
  info: 'bg-zinc-800 text-zinc-300',
  monitor: 'bg-amber-500/15 text-amber-300',
  urgent: 'bg-orange-500/15 text-orange-300',
  emergency: 'bg-red-500/15 text-red-300',
}

interface ChatViewProps {
  messages: ChatMessage[]
  isTyping: boolean
  onSend: (text: string) => void
  onClear: () => void
  onLogTelemetry?: (telemetry: GameTelemetryPayload) => void
}

export function ChatView({
  messages,
  isTyping,
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

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-[#222226] px-4 py-3 md:px-6">
        <div>
          <h1 className="text-base font-medium tracking-tight text-zinc-100">Health Chat</h1>
          <p className="text-xs text-zinc-500">
            Speak vitals in chat or type &quot;play&quot; for the grip telemetry assessment game
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#222226] bg-[#111113] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          onClick={onClear}
          disabled={empty}
        >
          <Trash2 data-icon="inline-start" />
          Clear
        </Button>
      </header>

      {/* Message Stream */}
      <ScrollArea className="min-h-0 flex-1 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {empty ? (
            <EmptyState
              className="border-[#222226] bg-[#111113]"
              icon={
                <div className="flex size-10 items-center justify-center rounded-md border border-[#222226] bg-[#0A0A0B] text-emerald-400">
                  <MessageSquarePlus className="size-4" />
                </div>
              }
              title="No health metrics recorded via chat yet"
              description="Tell me a reading (e.g. heart rate, blood pressure, SpO₂), or say &quot;play&quot; to launch the Asteroid Run &amp; Shield Charge grip assessment."
              actions={
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onSend(prompt)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-left text-xs transition',
                        prompt.startsWith('Play')
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:bg-sky-500/20'
                          : 'border-[#222226] bg-[#0A0A0B] text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-300 hover:shadow-md hover:shadow-emerald-500/10',
                      )}
                    >
                      {prompt.startsWith('Play') ? `⚡ ${prompt}` : prompt}
                    </button>
                  ))}
                </div>
              }
            />
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col gap-1.5',
                  m.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/15'
                      : 'border border-[#222226] bg-[#111113] text-zinc-100',
                  )}
                >
                  {m.content}

                  {/* Interactive Game Launch Card Bubble */}
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
                        className="mt-1 w-full bg-gradient-to-r from-sky-500 to-blue-600 font-mono text-xs font-semibold tracking-wider text-white uppercase shadow-md shadow-sky-500/25 transition-all hover:from-sky-400 hover:to-blue-500"
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

                {m.role === 'assistant' && m.triageLevel && (
                  <Badge className={cn('border-0', TRIAGE_STYLES[m.triageLevel])}>
                    {triageBadgeLabel(m.triageLevel)}
                  </Badge>
                )}
              </div>
            ))
          )}
          {isTyping && (
            <div className="text-xs text-teal-400/80">Assistant is thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input Field */}
      <div className="border-t border-[#222226] bg-[#0A0A0B] p-4 md:px-6">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type 'play' to launch game, or e.g. 'Heart rate 76 bpm'…"
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
            disabled={!draft.trim() || isTyping}
            onClick={submit}
            aria-label="Send message"
          >
            <SendHorizontal />
          </Button>
        </div>
      </div>

      {/* Active Game Modal Viewport */}
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
