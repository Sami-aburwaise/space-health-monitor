import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ClipboardCheck,
  Gamepad2,
  Play,
  Rocket,
  SendHorizontal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { MessageBlocks } from '@/components/chat/MessageBlocks'
import { StatusStrip } from '@/components/health/StatusStrip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { ControllerStatus } from '@/components/hardware/ControllerStatus'
import { Disclaimer } from '@/components/shared/Disclaimer'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ArduinoLinkPhase } from '@/hooks/useArduinoLink'
import { gameResultKey, parseGameWindowMessage, type NormalizedGameResult } from '@/lib/games/host'
import type { HallCircuit } from '@/lib/serial/hall'
import { DAILY_CHECKIN_CMD, START_ROUTINE_CMD } from '@/lib/coach/classify'
import { readingMessage } from '@/lib/coach/measurePrompts'
import { SUPPORT_LABELS } from '@/lib/coach/support'
import { parseCheckinSkip } from '@/lib/coach/vitalReplies'
import { ENVIRONMENTS } from '@/lib/health/environment'
import { INDICATORS } from '@/lib/health/indicators'
import type { OverallStatus } from '@/lib/health/status'
import { RichText } from '@/lib/markdown'
import { triageBadgeLabel } from '@/lib/triage'
import { cn } from '@/lib/utils'
import type {
  ChatMessage,
  CoachState,
  MissionEnvironment,
  TriageLevel,
} from '@/types/health'

const TRIAGE_STYLES: Record<TriageLevel, string> = {
  info: 'bg-zinc-800 text-zinc-300',
  monitor: 'bg-amber-500/15 text-amber-300',
  urgent: 'bg-orange-500/15 text-orange-300',
  emergency: 'bg-red-500/15 text-red-300',
}

const STRENGTH_GAME_URL = '/games/asteroid-run.html'

const COMMAND_LABELS: Record<string, string> = {
  [START_ROUTINE_CMD]: 'Started routine',
  [DAILY_CHECKIN_CMD]: 'Started daily check-in',
  ...SUPPORT_LABELS,
}

function commandLabel(content: string): string | undefined {
  const skipped = parseCheckinSkip(content)
  if (skipped) return `Skip ${INDICATORS[skipped].name.toLowerCase()}`
  return COMMAND_LABELS[content]
}

interface ChatViewProps {
  messages: ChatMessage[]
  isTyping: boolean
  coachState?: CoachState
  demoActive?: boolean
  status: OverallStatus
  environment: MissionEnvironment
  onSend: (text: string) => void
  onClear: () => void
  onOpenStatus?: () => void
  onGameFinished?: (result: NormalizedGameResult) => void
  controllerPhase?: ArduinoLinkPhase
  controllerHall?: HallCircuit | null
  controllerHallTick?: number
  /** Live finger-sensor pulse. Null while connected means the sensor sent no beat. */
  controllerHeartRate?: number | null
  controllerPort?: string
  onOpenControllerSettings?: () => void
}

export function ChatView({
  messages,
  isTyping,
  coachState,
  demoActive = false,
  status,
  environment,
  onSend,
  onClear,
  onOpenStatus,
  onGameFinished,
  controllerPhase = 'idle',
  controllerHall = null,
  controllerHallTick = 0,
  controllerHeartRate = null,
  controllerPort = '',
  onOpenControllerSettings,
}: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const [emptyHint, setEmptyHint] = useState(false)
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const finishedKey = useRef<string | null>(null)
  const hallTickAtOpen = useRef(0)
  const onGameFinishedRef = useRef(onGameFinished)
  const empty = messages.length === 0 && !isTyping
  const showController = controllerPhase === 'open' || controllerPhase === 'connecting' || controllerPhase === 'error'

  useEffect(() => {
    onGameFinishedRef.current = onGameFinished
  }, [onGameFinished])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const closeGame = useCallback(() => {
    setActiveGameUrl(null)
    setIframeReady(false)
    requestAnimationFrame(() => composerRef.current?.focus())
  }, [])

  function openGame(url: string) {
    finishedKey.current = null
    hallTickAtOpen.current = controllerHallTick
    setIframeReady(false)
    setActiveGameUrl(url)
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const frame = iframeRef.current?.contentWindow
      if (!frame || event.source !== frame) return
      const parsed = parseGameWindowMessage(event.data)
      if (!parsed) return
      if (parsed.action === 'finish') {
        const key = gameResultKey(parsed.result)
        if (finishedKey.current !== key) {
          finishedKey.current = key
          onGameFinishedRef.current?.(parsed.result)
        }
      }
      closeGame()
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [closeGame])

  useEffect(() => {
    if (!activeGameUrl || !iframeReady || controllerHall === null) return
    if (controllerHallTick <= hallTickAtOpen.current) return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'HALL_CHANGE', event: 'hall_change', state: controllerHall },
      window.location.origin,
    )
  }, [activeGameUrl, controllerHall, controllerHallTick, iframeReady])

  function submit() {
    if (!draft.trim()) {
      setEmptyHint(true)
      return
    }
    onSend(draft)
    setDraft('')
  }

  function startRoutine() {
    onSend(START_ROUTINE_CMD)
  }

  const env = ENVIRONMENTS[environment]
  const due = status.notMeasured.map((id) => INDICATORS[id].name.toLowerCase())

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      <header className="flex items-center justify-between border-b border-[#222226] px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-medium tracking-tight text-zinc-100">Health Chat</h1>
            {showController && (
              <ControllerStatus
                compact
                phase={controllerPhase}
                hall={controllerHall}
                heartRate={controllerHeartRate}
                portLabel={controllerPort}
              />
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {demoActive
              ? 'Guided tour · nothing is recorded'
              : `${env.label} · ${env.gravity} · comms ${env.commsDelay.toLowerCase()}${
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

      {!demoActive && <StatusStrip status={status} onOpen={onOpenStatus} />}

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
              title="How are you today?"
              description={
                due.length > 0
                  ? `Due today: ${due.join(', ')}. Run the daily check-in, or start your workout.`
                  : 'All six indicators are logged for today. Start your workout when you are ready.'
              }
              actions={
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {due.length > 0 && (
                    <Button
                      type="button"
                      size="lg"
                      className="bg-emerald-500 px-5 text-emerald-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
                      disabled={isTyping}
                      onClick={() => onSend(DAILY_CHECKIN_CMD)}
                    >
                      <ClipboardCheck data-icon="inline-start" />
                      Daily check-in
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="lg"
                    variant={due.length > 0 ? 'outline' : 'default'}
                    className={
                      due.length > 0
                        ? 'border-[#222226] bg-[#0A0A0B] px-5 text-zinc-200 hover:bg-zinc-900'
                        : 'bg-emerald-500 px-5 text-emerald-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400'
                    }
                    disabled={isTyping}
                    onClick={startRoutine}
                  >
                    <Zap data-icon="inline-start" />
                    Start workout
                  </Button>
                </div>
              }
            />
          ) : (
            messages.map((m, idx) => {
              const label = commandLabel(m.content)
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
                        onSubmitReading={
                          demoActive ? undefined : (kind, value) => onSend(readingMessage(kind, value))
                        }
                        onLaunchStrengthGame={() => openGame(STRENGTH_GAME_URL)}
                        onExerciseDone={
                          isLatest && !isTyping && !demoActive ? () => onSend('Done') : undefined
                        }
                        onChoose={isLatest && !isTyping && !demoActive ? onSend : undefined}
                        sensorLive={controllerPhase === 'open'}
                        sensorHeartRate={controllerHeartRate}
                        onOpenControllerSettings={
                          demoActive ? undefined : onOpenControllerSettings
                        }
                      />
                    ) : (
                      <RichText
                        text={label ?? m.content}
                        className={
                          m.role === 'user' ? 'text-emerald-950 [&_strong]:text-emerald-950' : undefined
                        }
                      />
                    )}

                    {m.gameAction && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openGame(m.gameAction!.url)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openGame(m.gameAction!.url)
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
                              {m.gameAction.badge || 'FITNESS GAME'}
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
                            openGame(m.gameAction!.url)
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
        {emptyHint && !draft.trim() && (
          <p role="alert" className="mx-auto mb-2 max-w-2xl text-xs text-amber-300">
            Type a message first, for example “My heart rate is 72 bpm” or “I slept 7 hours”.
          </p>
        )}
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setEmptyHint(false)
            }}
            disabled={demoActive}
            placeholder={
              demoActive
                ? 'Tour in progress…'
                : 'Tell me a reading or how you feel, e.g. “BP 118/76” or “I slept 6 hours”'
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
            disabled={isTyping || demoActive}
            onClick={submit}
            aria-label="Send message"
          >
            <SendHorizontal />
          </Button>
        </div>
        <Disclaimer className="mx-auto mt-2 max-w-2xl" />
      </div>

      {activeGameUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#050914] md:absolute"
          role="dialog"
          aria-modal="true"
          aria-label="Asteroid Run and Shield Charge"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#222226] bg-[#0b132b]/95 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/15 text-sky-400">
                <Rocket className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-wide text-zinc-100">
                  Asteroid Run &amp; Shield Charge
                </h2>
                <p className="truncate font-mono text-[11px] text-sky-400/80">
                  GRIP FITNESS GAME · NOT A MEDICAL TEST
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showController && (
                <ControllerStatus
                  compact
                  phase={controllerPhase}
                  hall={controllerHall}
                  heartRate={controllerHeartRate}
                  portLabel={controllerPort}
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-sky-500/40 bg-[#111c3d] font-mono text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25 hover:text-white"
                onClick={closeGame}
              >
                <ArrowLeft className="mr-1.5 size-3.5" />
                Return to Chat
              </Button>
            </div>
          </div>
          <div className="relative size-full flex-1 bg-[#03060f]">
            <iframe
              ref={iframeRef}
              src={activeGameUrl}
              title="Asteroid Run & Shield Charge"
              className="size-full border-none"
              allow="autoplay"
              tabIndex={0}
              onLoad={() => {
                setIframeReady(true)
                iframeRef.current?.focus()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
