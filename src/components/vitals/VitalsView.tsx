import { useMemo, useState } from 'react'
import { ClipboardCheck, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Disclaimer } from '@/components/shared/Disclaimer'
import { LEVEL_STYLES, levelKey } from '@/components/health/statusStyles'
import { BodyMap } from '@/components/vitals/BodyMap'
import { IndicatorGuide } from '@/components/vitals/IndicatorGuide'
import { ENVIRONMENTS } from '@/lib/health/environment'
import {
  INDICATOR_ORDER,
  INDICATORS,
  LEVEL_LABEL,
  indicatorsForRegion,
  type BodyRegion,
  type IndicatorId,
} from '@/lib/health/indicators'
import { buildDailyVitalRows, dayKey, evaluateStatus } from '@/lib/health/status'
import { cn } from '@/lib/utils'
import type { MissionEnvironment, VitalReading } from '@/types/health'

interface VitalsViewProps {
  vitals: VitalReading[]
  environment: MissionEnvironment
  onStartCheckIn?: () => void
  onLoadSampleVitals?: () => void
}

function formatDay(dayStart: number, now = Date.now()): string {
  const today = dayKey(now)
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000)
  const key = dayKey(dayStart)
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return new Date(dayStart).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const LOG_COLUMNS: { id: IndicatorId; label: string }[] = [
  { id: 'heart_rate', label: 'HR' },
  { id: 'blood_pressure', label: 'BP' },
  { id: 'glucose', label: 'Glucose' },
  { id: 'temperature', label: 'Temp' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'mood', label: 'Mood' },
  { id: 'spo2', label: 'SpO₂' },
]

export function VitalsView({
  vitals,
  environment,
  onStartCheckIn,
  onLoadSampleVitals,
}: VitalsViewProps) {
  const status = useMemo(() => evaluateStatus(vitals), [vitals])
  const dailyRows = useMemo(() => buildDailyVitalRows(vitals), [vitals])
  const firstFlagged =
    INDICATOR_ORDER.find((id) => status.indicators[id].level === 'alert') ??
    INDICATOR_ORDER.find((id) => status.indicators[id].level === 'watch') ??
    'heart_rate'
  const [picked, setPicked] = useState<IndicatorId | null>(null)
  const selected = picked ?? firstFlagged
  const selectedRegion = INDICATORS[selected].region

  const key = levelKey(status.level)
  const style = LEVEL_STYLES[key]
  const env = ENVIRONMENTS[environment]

  function selectRegion(region: BodyRegion) {
    const ids = indicatorsForRegion(region)
    const at = ids.indexOf(selected)
    setPicked(at === -1 ? ids[0] : ids[(at + 1) % ids.length])
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      <header className="border-b border-[#222226] px-4 py-3 md:px-6">
        <h1 className="text-base font-medium tracking-tight text-zinc-100">Health Status</h1>
        <p className="text-xs text-zinc-500">
          Measured in chat · stored only in this browser · {env.label}
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
          <section className={cn('rounded-lg border p-4', style.panel)} aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] tracking-[0.08em] text-zinc-500 uppercase">
                Today
              </span>
              <Badge className={cn('border-0 text-sm', style.badge)}>
                <span className={cn('size-2 rounded-full', style.dot)} aria-hidden />
                {status.level ? LEVEL_LABEL[status.level] : 'Not measured'}
              </Badge>
              {status.streakDays > 0 && (
                <span className="ml-auto flex items-center gap-1 text-xs text-amber-300">
                  <Flame className="size-3.5" aria-hidden />
                  {status.streakDays}-day check-in streak
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-100">{status.sentence}</p>
            {status.notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {status.notes.map((n) => (
                  <li key={n} className="text-xs text-zinc-400">
                    {n}
                  </li>
                ))}
              </ul>
            )}
            {status.notMeasured.length > 0 && onStartCheckIn && (
              <Button
                type="button"
                size="sm"
                className="mt-3 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                onClick={onStartCheckIn}
              >
                <ClipboardCheck data-icon="inline-start" />
                Daily check-in
              </Button>
            )}
            <Disclaimer className="mt-3" />
          </section>

          <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
            <section className="rounded-lg border border-[#222226] bg-[#111113] p-3">
              <h2 className="mb-1 text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
                Body map
              </h2>
              <BodyMap status={status} selected={selectedRegion} onSelect={selectRegion} />
              <p className="mt-1 text-center text-[11px] text-zinc-500">
                Tap a region to see its indicators
              </p>
            </section>

            <section
              className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border border-[#222226] bg-[#222226] lg:grid-cols-3"
              aria-label="Indicators"
            >
              {INDICATOR_ORDER.map((id) => {
                const s = status.indicators[id]
                const ind = INDICATORS[id]
                const st = LEVEL_STYLES[levelKey(s.level)]
                const active = id === selected
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPicked(id)}
                    className={cn(
                      'flex flex-col gap-1.5 px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400',
                      s.level === 'alert'
                        ? 'bg-red-950/70 hover:bg-red-950'
                        : s.level === 'watch'
                          ? 'bg-amber-950/40 hover:bg-amber-950/55'
                          : 'bg-[#111113] hover:bg-zinc-900',
                      active &&
                        (s.level === 'alert'
                          ? 'shadow-[inset_0_-2px_0_0_#ef4444]'
                          : s.level === 'watch'
                            ? 'shadow-[inset_0_-2px_0_0_#fbbf24]'
                            : 'shadow-[inset_0_-2px_0_0_#34d399]'),
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] tracking-[0.1em] text-zinc-500 uppercase">
                        {ind.name}
                        {!ind.core && ' · extra'}
                      </span>
                      <span className={cn('size-2 rounded-full', st.dot)} aria-hidden />
                    </div>
                    {s.display ? (
                      <p
                        className={cn(
                          'font-mono text-lg tracking-tight tabular-nums',
                          s.level === 'alert'
                            ? 'text-red-500'
                            : s.level === 'watch'
                              ? 'text-amber-300'
                              : 'text-zinc-50',
                        )}
                      >
                        {s.display}
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-500">Not measured today</p>
                    )}
                    <span className={cn('text-[11px]', st.text)}>
                      {s.level
                        ? `${LEVEL_LABEL[s.level]}${s.assessment ? ` · ${s.assessment.label}` : ''}`
                        : `Normal: ${ind.bands.normal}`}
                    </span>
                  </button>
                )
              })}
            </section>
          </div>

          <IndicatorGuide
            key={selected}
            id={selected}
            status={status.indicators[selected]}
            readings={vitals}
            environment={environment}
          />

          <section className="overflow-hidden rounded-lg border border-[#222226] bg-[#111113]">
            <div className="border-b border-[#222226] px-4 py-2.5">
              <h2 className="text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
                Daily log
              </h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Latest reading for each vital that day
              </p>
            </div>
            {dailyRows.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-500">
                No health metrics recorded via chat yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#222226] text-[11px] tracking-wide text-zinc-500 uppercase">
                      <th className="px-4 py-2 font-medium">Day</th>
                      {LOG_COLUMNS.map((c) => (
                        <th key={c.id} className="px-3 py-2 font-medium">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((row) => (
                      <tr key={row.key} className="border-b border-[#222226] last:border-0">
                        <td className="px-4 py-2.5 text-xs text-zinc-300">
                          {formatDay(row.dayStart)}
                        </td>
                        {LOG_COLUMNS.map((c) => {
                          const reading = row.values[c.id]
                          const ind = INDICATORS[c.id]
                          const a = reading ? ind.assess(reading) : null
                          return (
                            <td
                              key={c.id}
                              className={cn(
                                'px-3 py-2.5 font-mono text-xs tabular-nums',
                                a ? LEVEL_STYLES[a.level].text : 'text-zinc-700',
                              )}
                            >
                              {reading ? (ind.format(reading) ?? '·') : '·'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {onLoadSampleVitals && (
            <div className="flex justify-center pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#222226] bg-[#111113] text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                onClick={onLoadSampleVitals}
              >
                Add dummy vitals
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
