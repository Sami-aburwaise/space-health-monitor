import { useState, type ReactNode } from 'react'
import { ExternalLink, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LEVEL_STYLES, levelKey } from '@/components/health/statusStyles'
import { TrendChart } from '@/components/vitals/TrendChart'
import { ENVIRONMENTS } from '@/lib/health/environment'
import { INDICATORS, LEVEL_LABEL, type IndicatorId, type StatusLevel } from '@/lib/health/indicators'
import { HAZARDS, HRP_RISKS, HRP_RISKS_URL, HAZARDS_URL } from '@/lib/health/sources'
import type { IndicatorStatus } from '@/lib/health/status'
import { cn } from '@/lib/utils'
import type { MissionEnvironment, VitalReading } from '@/types/health'

const RANGES = [7, 14, 30] as const
const LEVELS: StatusLevel[] = ['normal', 'watch', 'alert']

interface IndicatorGuideProps {
  id: IndicatorId
  status: IndicatorStatus
  readings: VitalReading[]
  environment: MissionEnvironment
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">{title}</h3>
      <div className="text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  )
}

export function IndicatorGuide({ id, status, readings, environment }: IndicatorGuideProps) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)
  const ind = INDICATORS[id]
  const key = levelKey(status.level)
  const style = LEVEL_STYLES[key]
  const env = ENVIRONMENTS[environment]

  return (
    <article className="overflow-hidden rounded-lg border border-[#222226] bg-[#111113]">
      <header className="flex flex-wrap items-center gap-2 border-b border-[#222226] px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-100">{ind.name}</h2>
        <Badge className={cn('border-0', style.badge)}>
          {status.level ? LEVEL_LABEL[status.level] : 'Not measured today'}
        </Badge>
        {status.escalated && (
          <Badge className="border-0 bg-red-500/15 text-red-300">3 days on watch</Badge>
        )}
        <span className="ml-auto font-mono text-sm text-zinc-100 tabular-nums">
          {status.display ?? '—'}
        </span>
      </header>

      <div className="space-y-5 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
              Trend
            </h3>
            <div className="flex gap-1" role="group" aria-label="Chart range">
              {RANGES.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={days === d}
                  className={cn(
                    'h-7 px-2 font-mono text-[11px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                    days === d && 'bg-emerald-500/15 text-emerald-300',
                  )}
                  onClick={() => setDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
          <TrendChart indicator={ind} readings={readings} days={days} />
        </div>

        <Section title="What it is">{ind.whatItIs}</Section>
        <Section title="How to measure in space">
          {ind.howToMeasure}
          <p className="mt-1 text-xs text-zinc-500">When: {ind.schedule}</p>
        </Section>
        <Section title="Why it matters in space">
          <p>{ind.whySpace}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ind.hazards.map((h) => (
              <a
                key={h}
                href={HAZARDS_URL}
                target="_blank"
                rel="noreferrer"
                title={HAZARDS[h].summary}
                className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300 hover:bg-sky-500/20"
              >
                Hazard: {HAZARDS[h].name}
              </a>
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {ind.risks.map((r) => (
              <li key={r} className="text-xs text-zinc-400">
                <a
                  href={HRP_RISKS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1 hover:text-zinc-200"
                >
                  <span>
                    <span className="text-zinc-500">NASA HRP: </span>
                    {HRP_RISKS[r]}
                  </span>
                  <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="What to do">
          <div className="divide-y divide-[#222226] overflow-hidden rounded-md border border-[#222226]">
            {LEVELS.map((level) => {
              const current = status.level === level
              return (
                <div
                  key={level}
                  className={cn(
                    'grid gap-1 px-3 py-2 sm:grid-cols-[7rem_1fr]',
                    current && LEVEL_STYLES[level].panel,
                  )}
                >
                  <div>
                    <p className={cn('text-xs font-medium', LEVEL_STYLES[level].text)}>
                      {LEVEL_LABEL[level]}
                      {current && <span className="text-zinc-400"> · you</span>}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500">{ind.bands[level]}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-300">{ind.actions[level]}</p>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="When to contact ground">
          <p>{ind.contactGround}</p>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-zinc-400">
            <Radio className="mt-0.5 size-3.5 shrink-0 text-sky-400" aria-hidden />
            <span>
              {env.label} ({env.commsDelay}): {env.contactGround}
            </span>
          </p>
        </Section>

        <Section title="How to prevent problems">{ind.prevent}</Section>
      </div>
    </article>
  )
}
