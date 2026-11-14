import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, SendHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { triageBadgeLabel } from '@/lib/triage'
import { cn } from '@/lib/utils'
import type { ChatMessage, TriageLevel } from '@/types/health'

const STARTER_PROMPTS = [
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
}

export function ChatView({ messages, isTyping, onSend, onClear }: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const empty = messages.length === 0 && !isTyping

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function submit() {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      <header className="flex items-center justify-between border-b border-[#222226] px-4 py-3 md:px-6">
        <div>
          <h1 className="text-base font-medium tracking-tight text-zinc-100">Health Chat</h1>
          <p className="text-xs text-zinc-500">
            Speak vitals in chat — they are parsed and stored locally
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
              description="Tell me a reading — e.g. heart rate, blood pressure, SpO₂, or temperature — and I’ll log it for the Vitals History panel."
              actions={
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onSend(prompt)}
                      className="rounded-full border border-[#222226] bg-[#0A0A0B] px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:border-emerald-500/40 hover:text-emerald-300 hover:shadow-md hover:shadow-emerald-500/10"
                    >
                      {prompt}
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
                    'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/15'
                      : 'border border-[#222226] bg-[#111113] text-zinc-100',
                  )}
                >
                  {m.content}
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

      <div className="border-t border-[#222226] bg-[#0A0A0B] p-4 md:px-6">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. My heart rate is 78 bpm, BP 120/80…"
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
    </div>
  )
}
