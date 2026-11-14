import { useEffect, useState } from 'react'
import { Activity, Check, Dumbbell, HeartPulse, Play, Siren, Thermometer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { exerciseFrames, exerciseImageSrc } from '@/lib/api/exercise'
import { RichText } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { MeasureKind, MessageBlock } from '@/types/health'

interface MessageBlocksProps {
  blocks: MessageBlock[]
  onSubmitReading?: (kind: MeasureKind, value: number) => void
  onLaunchStrengthGame?: () => void
  /** Only passed for the newest message, so older exercise cards stay read-only. */
  onExerciseDone?: () => void
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
}: MessageBlocksProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return (
            <p key={i} className="text-sm leading-relaxed text-zinc-100">
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

        if (block.type === 'nutrition') {
          const f = block.food
          return (
            <div
              key={i}
              className="rounded-xl border border-[#222226] bg-[#0A0A0B] p-3 font-mono text-xs"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-sans font-medium text-zinc-100">{f.name}</p>
                <Badge className="border-0 bg-amber-500/15 text-[10px] text-amber-300">
                  Estimate
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <Macro label="kcal" value={f.calories100g} />
                <Macro label="P" value={f.protein100g} />
                <Macro label="C" value={f.carbs100g} />
                <Macro label="F" value={f.fat100g} />
              </div>
              {f.note && <p className="mt-1 text-[10px] text-zinc-500">{f.note}</p>}
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
                  <p className="text-sm font-medium text-red-200">{p.title} procedure</p>
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

        if (block.type === 'measure_prompt') {
          return (
            <MeasureInputCard
              key={i}
              kind={block.prompt.kind}
              title={block.prompt.title}
              hint={block.prompt.hint}
              unit={block.prompt.unit}
              demoFill={block.prompt.demoFill}
              onSubmitReading={onSubmitReading}
              onLaunchStrengthGame={onLaunchStrengthGame}
            />
          )
        }

        return null
      })}
    </div>
  )
}

function MeasureInputCard({
  kind,
  title,
  hint,
  unit,
  demoFill,
  onSubmitReading,
  onLaunchStrengthGame,
}: {
  kind: MeasureKind
  title: string
  hint: string
  unit?: string
  demoFill?: number
  onSubmitReading?: (kind: MeasureKind, value: number) => void
  onLaunchStrengthGame?: () => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (demoFill == null) return
    const target = String(demoFill)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setValue(target.slice(0, i))
      if (i >= target.length) window.clearInterval(id)
    }, 140)
    return () => window.clearInterval(id)
  }, [demoFill])
  const resolvedUnit =
    unit ?? (kind === 'heart_rate' ? 'bpm' : kind === 'temperature' ? '°C' : 'reps')

  const styles =
    kind === 'heart_rate'
      ? {
          border: 'border-rose-500/30 bg-rose-500/5',
          icon: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
          btn: 'bg-rose-500 text-rose-950 hover:bg-rose-400',
          Icon: HeartPulse,
        }
      : kind === 'temperature'
        ? {
            border: 'border-amber-500/30 bg-amber-500/5',
            icon: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
            btn: 'bg-amber-500 text-amber-950 hover:bg-amber-400',
            Icon: Thermometer,
          }
        : {
            border: 'border-sky-500/30 bg-sky-500/5',
            icon: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
            btn: 'bg-sky-500 text-sky-950 hover:bg-sky-400',
            Icon: Activity,
          }

  const Icon = styles.Icon
  const num = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(num) && num > 0

  function submit() {
    if (!valid) return
    onSubmitReading?.(kind, num)
    setValue('')
  }

  return (
    <div className={cn('rounded-xl border p-3', styles.border)}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
            styles.icon,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-zinc-100">{title}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                step={kind === 'temperature' ? '0.1' : '1'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={kind === 'temperature' ? '36.8' : kind === 'heart_rate' ? '72' : '30'}
                aria-label={title}
                data-measure-kind={kind}
                data-measure-source="manual"
                className="h-9 border-[#222226] bg-[#0A0A0B] font-mono tabular-nums text-zinc-50 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submit()
                  }
                }}
              />
              <span className="shrink-0 font-mono text-xs text-zinc-500">{resolvedUnit}</span>
            </div>
            <Button
              type="button"
              size="sm"
              className={cn('h-9 text-xs', styles.btn)}
              disabled={!valid}
              onClick={submit}
            >
              Submit
            </Button>
          </div>

          {kind === 'strength' && onLaunchStrengthGame && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full border-sky-500/30 bg-sky-500/10 text-xs text-sky-200 hover:bg-sky-500/20"
              onClick={onLaunchStrengthGame}
            >
              <Play data-icon="inline-start" />
              Open grip strength game
            </Button>
          )}

          <p className="text-[10px] text-zinc-600">
            Source: manual · Arduino serial ready later
          </p>
        </div>
      </div>
    </div>
  )
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#222226] bg-[#111113] px-1 py-1.5">
      <div className="tabular-nums text-zinc-100">{Number(value).toFixed(1)}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  )
}
