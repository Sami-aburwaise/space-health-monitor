import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Check,
  Droplet,
  Dumbbell,
  Gauge,
  HeartPulse,
  Moon,
  Play,
  Siren,
  Smile,
  Thermometer,
  Wind,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { exerciseFrames, exerciseImageSrc } from '@/lib/api/exercise'
import { LEVEL_STYLES } from '@/components/health/statusStyles'
import { rangeError } from '@/lib/extractVitals'
import { LEVEL_LABEL, type StatusLevel } from '@/lib/health/indicators'
import { RichText } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { MeasureKind, MessageBlock } from '@/types/health'

interface MessageBlocksProps {
  blocks: MessageBlock[]
  onSubmitReading?: (kind: MeasureKind, value: string) => void
  onLaunchStrengthGame?: () => void
  /** Only passed for the newest message, so older exercise cards stay read-only. */
  onExerciseDone?: () => void
  /** Only passed for the newest message, so old reply buttons can't be tapped again. */
  onChoose?: (message: string) => void
  /** Finger sensor is connected. Heart-rate cards can use its reading or a typed value. */
  sensorLive?: boolean
  sensorHeartRate?: number | null
  onOpenControllerSettings?: () => void
}

const FRAME_MS = 900

function ExerciseFrames({ frames, alt }: { frames: string[]; alt: string }) {
  const [broken, setBroken] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const usable = frames.filter((f) => !broken.includes(f))

  useEffect(() => {
    if (usable.length < 2) return
    const id = window.setInterval(() => setIndex((n) => n + 1), FRAME_MS)
    return () => window.clearInterval(id)
  }, [usable.length])

  if (usable.length === 0) {
    return (
      <div className="flex size-full items-center justify-center text-zinc-600">
        <Dumbbell className="size-8" />
      </div>
    )
  }

  const active = index % usable.length
  return (
    <>
      {usable.map((src, n) => (
        <img
          key={src}
          src={src}
          alt={n === 0 ? alt : ''}
          aria-hidden={n !== 0}
          className={cn(
            'absolute inset-0 size-full object-contain transition-opacity duration-300',
            n === active ? 'opacity-100' : 'opacity-0',
          )}
          onError={() => setBroken((b) => [...b, src])}
        />
      ))}
    </>
  )
}

export function MessageBlocks({
  blocks,
  onSubmitReading,
  onLaunchStrengthGame,
  onExerciseDone,
  onChoose,
  sensorLive = false,
  sensorHeartRate = null,
  onOpenControllerSettings,
}: MessageBlocksProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return (
            <p key={i} className="text-sm leading-relaxed whitespace-pre-line text-zinc-100">
              <RichText text={block.text} />
            </p>
          )
        }

        if (block.type === 'exercise') {
          const ex = block.exercise
          return (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-emerald-500/25 bg-[#0A0A0B]"
            >
              <div className="relative aspect-[9/14] max-h-56 w-full bg-black sm:aspect-video sm:max-h-44">
                {ex.videoUrl ? (
                  <video
                    key={ex.videoUrl}
                    src={ex.videoUrl}
                    poster={exerciseImageSrc(ex.imageUrl)}
                    className="size-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <ExerciseFrames frames={exerciseFrames(ex)} alt={ex.name} />
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-medium text-zinc-100">{ex.name}</h3>
                  {ex.equipment && (
                    <Badge className="border-0 bg-emerald-500/15 text-[10px] text-emerald-300">
                      {ex.equipment}
                    </Badge>
                  )}
                </div>
                {ex.exerciseTips[0] && (
                  <p className="text-[11px] text-emerald-200/90">Tip: {ex.exerciseTips[0]}</p>
                )}
                {onExerciseDone && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-1 h-9 w-full bg-emerald-500 text-xs text-emerald-950 hover:bg-emerald-400"
                    onClick={onExerciseDone}
                  >
                    <Check data-icon="inline-start" />
                    Done
                  </Button>
                )}
              </div>
            </div>
          )
        }

        if (block.type === 'procedure') {
          const p = block.procedure
          return (
            <div key={i} className="rounded-xl border border-red-500/40 bg-red-500/5 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 text-red-300">
                  <Siren className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-200">{p.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.readings.map((r) => (
                      <Badge
                        key={r}
                        className="border-0 bg-red-500/15 font-mono text-[10px] tabular-nums text-red-300"
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {p.steps.map((step, n) => (
                  <li key={n} className="flex gap-2 text-xs leading-relaxed text-zinc-200">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-red-500/20 font-mono text-[10px] text-red-300 tabular-nums">
                      {n + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )
        }

        if (block.type === 'choices') {
          if (!onChoose) return null
          return (
            <div key={i} className="flex flex-wrap gap-1.5">
              {block.choices.map((c) => (
                <Button
                  key={c.message}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-500/15"
                  onClick={() => onChoose(c.message)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          )
        }

        if (block.type === 'overall_status') {
          const style = LEVEL_STYLES[block.level]
          return (
            <div
              key={i}
              className={cn('space-y-1.5 rounded-xl border px-3 py-2.5', style.panel)}
              role="status"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] tracking-[0.08em] text-zinc-500 uppercase">Today</span>
                <Badge className={cn('border-0', style.badge)}>
                  <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
                  {LEVEL_LABEL[block.level]}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-zinc-100">{block.sentence}</p>
              {block.notes.length > 0 && (
                <ul className="space-y-1">
                  {block.notes.map((n) => (
                    <li key={n} className="text-xs text-zinc-400">
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        }

        if (block.type === 'status_key') {
          return (
            <ul key={i} className="space-y-1.5 rounded-xl border border-[#222226] bg-[#0A0A0B] p-3">
              {STATUS_KEY.map(({ level, label, meaning }) => (
                <li key={level} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', LEVEL_STYLES[level].dot)} />
                  <span className="text-zinc-300">
                    <span className={cn('font-medium', LEVEL_STYLES[level].text)}>{label}</span>{' '}
                    {meaning}
                  </span>
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'measure_prompt') {
          return (
            <MeasureInputCard
              key={i}
              kind={block.prompt.kind}
              title={block.prompt.title}
              hint={block.prompt.hint}
              unit={block.prompt.unit}
              onSubmitReading={onSubmitReading}
              onLaunchStrengthGame={onLaunchStrengthGame}
              sensorLive={sensorLive}
              sensorHeartRate={sensorHeartRate}
              onOpenControllerSettings={onOpenControllerSettings}
            />
          )
        }

        return null
      })}
    </div>
  )
}

const KIND_STYLE: Record<
  MeasureKind,
  { border: string; icon: string; btn: string; Icon: typeof HeartPulse; placeholder: string; unit: string }
> = {
  heart_rate: {
    border: 'border-rose-500/30 bg-rose-500/5',
    icon: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
    btn: 'bg-rose-500 text-rose-950 hover:bg-rose-400',
    Icon: HeartPulse,
    placeholder: '72',
    unit: 'bpm',
  },
  temperature: {
    border: 'border-amber-500/30 bg-amber-500/5',
    icon: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    btn: 'bg-amber-500 text-amber-950 hover:bg-amber-400',
    Icon: Thermometer,
    placeholder: '36.8',
    unit: '°C',
  },
  blood_pressure: {
    border: 'border-red-500/30 bg-red-500/5',
    icon: 'border-red-500/30 bg-red-500/15 text-red-300',
    btn: 'bg-red-500 text-red-950 hover:bg-red-400',
    Icon: Gauge,
    placeholder: '118/76',
    unit: 'mmHg',
  },
  glucose: {
    border: 'border-violet-500/30 bg-violet-500/5',
    icon: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
    btn: 'bg-violet-500 text-violet-950 hover:bg-violet-400',
    Icon: Droplet,
    placeholder: '90',
    unit: 'mg/dL',
  },
  sleep: {
    border: 'border-indigo-500/30 bg-indigo-500/5',
    icon: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300',
    btn: 'bg-indigo-500 text-indigo-950 hover:bg-indigo-400',
    Icon: Moon,
    placeholder: '7.5',
    unit: 'hours',
  },
  mood: {
    border: 'border-teal-500/30 bg-teal-500/5',
    icon: 'border-teal-500/30 bg-teal-500/15 text-teal-300',
    btn: 'bg-teal-500 text-teal-950 hover:bg-teal-400',
    Icon: Smile,
    placeholder: '4',
    unit: '/ 5',
  },
  spo2: {
    border: 'border-cyan-500/30 bg-cyan-500/5',
    icon: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
    btn: 'bg-cyan-500 text-cyan-950 hover:bg-cyan-400',
    Icon: Wind,
    placeholder: '98',
    unit: '%',
  },
  strength: {
    border: 'border-sky-500/30 bg-sky-500/5',
    icon: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    btn: 'bg-sky-500 text-sky-950 hover:bg-sky-400',
    Icon: Activity,
    placeholder: '30',
    unit: 'reps',
  },
}

const MOOD_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Very good']

const STATUS_KEY: { level: StatusLevel; label: string; meaning: string }[] = [
  { level: 'normal', label: 'Normal', meaning: 'is in the healthy range. Nothing to do.' },
  { level: 'watch', label: 'Watch', meaning: 'is a little off. Follow the tip and re-check later.' },
  { level: 'alert', label: 'Alert', meaning: 'needs attention. I show you the steps and when to contact the flight surgeon.' },
]

/** Why the typed value can't be submitted, or null when it is fine. */
function validate(kind: MeasureKind, raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Enter a value first.'

  if (kind === 'blood_pressure') {
    const m = value.match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
    if (!m) return 'Enter top and bottom numbers like 118/76.'
    const s = Number(m[1])
    const d = Number(m[2])
    const err = rangeError('systolic', s) ?? rangeError('diastolic', d)
    if (err) return err
    if (d >= s) return 'The top number should be higher than the bottom number.'
    return null
  }

  const num = Number(value)
  if (!Number.isFinite(num)) return 'Enter a number.'
  switch (kind) {
    case 'heart_rate':
      return rangeError('heart_rate', num)
    case 'temperature':
      return rangeError('temperature', num)
    case 'glucose':
      return rangeError('glucose', num)
    case 'sleep':
      return rangeError('sleep', num)
    case 'spo2':
      return rangeError('spo2', num)
    case 'mood':
      return Number.isInteger(num) ? rangeError('mood', num) : 'Pick a whole number from 1 to 5.'
    default:
      return num > 0 && Number.isInteger(num) ? null : 'Enter a whole number of reps.'
  }
}

function MeasureInputCard({
  kind,
  title,
  hint,
  unit,
  onSubmitReading,
  onLaunchStrengthGame,
  sensorLive = false,
  sensorHeartRate = null,
  onOpenControllerSettings,
}: {
  kind: MeasureKind
  title: string
  hint: string
  unit?: string
  onSubmitReading?: (kind: MeasureKind, value: string) => void
  onLaunchStrengthGame?: () => void
  sensorLive?: boolean
  sensorHeartRate?: number | null
  onOpenControllerSettings?: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const typedRef = useRef(false)

  const style = KIND_STYLE[kind]
  const Icon = style.Icon
  const showHeartSensor = kind === 'heart_rate'

  useEffect(() => {
    if (!showHeartSensor || !sensorLive || sensorHeartRate == null || typedRef.current) return
    setValue(String(sensorHeartRate))
    setError(null)
  }, [showHeartSensor, sensorLive, sensorHeartRate])

  function submit(raw = value) {
    const err = validate(kind, raw)
    setError(err)
    if (err) return
    onSubmitReading?.(kind, raw.trim().replace(/\s+/g, ''))
    setValue('')
    typedRef.current = false
  }

  return (
    <div className={cn('rounded-xl border p-3', style.border)}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
            style.icon,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-zinc-100">{title}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {showHeartSensor
                ? sensorLive
                  ? 'Live finger sensor below. Tap Use reading, or type a pulse if you measured another way.'
                  : 'Connect the Arduino finger sensor in Settings, or type your pulse below.'
                : hint}
            </p>
          </div>

          {showHeartSensor && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#222226] bg-[#0A0A0B] px-2.5 py-2">
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-wide text-zinc-500">
                  {sensorLive ? 'SENSOR' : 'SENSOR OFFLINE'}
                </p>
                <p className="font-mono text-sm tabular-nums text-zinc-100">
                  {!sensorLive
                    ? 'Not connected'
                    : sensorHeartRate == null
                      ? 'Waiting for pulse…'
                      : `${sensorHeartRate} bpm`}
                </p>
              </div>
              {sensorLive ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn('h-8 shrink-0 text-xs', style.btn)}
                  disabled={!onSubmitReading || sensorHeartRate == null}
                  onClick={() => {
                    if (sensorHeartRate == null) return
                    typedRef.current = false
                    submit(String(sensorHeartRate))
                  }}
                >
                  Use reading
                </Button>
              ) : (
                onOpenControllerSettings && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 border-[#222226] bg-transparent text-xs text-zinc-300 hover:bg-zinc-900"
                    onClick={onOpenControllerSettings}
                  >
                    Open Settings
                  </Button>
                )
              )}
            </div>
          )}

          {kind === 'mood' ? (
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={title}>
              {MOOD_LABELS.map((label, n) => (
                <Button
                  key={label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col gap-0.5 border-[#222226] bg-[#0A0A0B] py-1.5 text-zinc-200 hover:border-teal-500/50 hover:bg-teal-500/10"
                  disabled={!onSubmitReading}
                  onClick={() => submit(String(n + 1))}
                >
                  <span className="font-mono text-sm tabular-nums">{n + 1}</span>
                  <span className="text-[9px] text-zinc-500">{label}</span>
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {showHeartSensor && (
                <p className="w-full text-[11px] text-zinc-500">
                  {sensorLive ? 'Or type a reading' : 'Type a reading'}
                </p>
              )}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <Input
                  type={kind === 'blood_pressure' ? 'text' : 'number'}
                  inputMode={kind === 'blood_pressure' ? 'numeric' : 'decimal'}
                  step={kind === 'temperature' || kind === 'sleep' ? '0.1' : '1'}
                  value={value}
                  onChange={(e) => {
                    typedRef.current = true
                    setValue(e.target.value)
                    setError(null)
                  }}
                  placeholder={style.placeholder}
                  disabled={!onSubmitReading}
                  aria-label={title}
                  aria-invalid={error != null}
                  data-measure-kind={kind}
                  className="h-9 border-[#222226] bg-[#0A0A0B] font-mono tabular-nums text-zinc-50 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submit()
                    }
                  }}
                />
                <span className="shrink-0 font-mono text-xs text-zinc-500">
                  {unit ?? style.unit}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                className={cn('h-9 text-xs', style.btn)}
                disabled={!onSubmitReading}
                onClick={() => submit()}
              >
                Submit
              </Button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-[11px] leading-snug text-red-300">
              {error}
            </p>
          )}

          {kind === 'strength' && onLaunchStrengthGame && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full border-sky-500/30 bg-sky-500/10 text-xs text-sky-200 hover:bg-sky-500/20"
              onClick={onLaunchStrengthGame}
            >
              <Play data-icon="inline-start" />
              Open grip fitness game
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
