import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Disclaimer } from '@/components/shared/Disclaimer'
import { INDICATOR_ORDER, INDICATORS } from '@/lib/health/indicators'
import {
  HAZARDS,
  HAZARDS_URL,
  HRP_RISKS,
  HRP_RISKS_URL,
  LIBRARIES,
  REFERENCES,
  type HazardId,
} from '@/lib/health/sources'

const HAZARD_ORDER: HazardId[] = ['radiation', 'isolation', 'distance', 'gravity', 'environment']

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#222226] bg-[#111113]">
      <h2 className="border-b border-[#222226] px-4 py-2.5 text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

export function SourcesView() {
  const usedRisks = [...new Set(INDICATOR_ORDER.flatMap((id) => INDICATORS[id].risks))]

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      <header className="border-b border-[#222226] px-4 py-3 md:px-6">
        <h1 className="text-base font-medium tracking-tight text-zinc-100">About & Sources</h1>
        <p className="text-xs text-zinc-500">Where the guidance and thresholds come from</p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
          <Card title="About this app">
            <div className="space-y-2 text-sm leading-relaxed text-zinc-300">
              <p>
                Space Health Monitor helps a crew member with no medical training check six
                health indicators, see whether each is normal, on watch or an alert, and know what
                to do next, including when to contact the flight surgeon.
              </p>
              <p>
                Readings are entered in chat and evaluated on this device. They are stored only in
                this browser. If a Claude API key is set, messages that are not readings are
                answered by Anthropic’s Claude, which receives the last few chat messages and
                your latest reading. Status, alerts and emergency steps are always computed on
                this device and never depend on that connection.
              </p>
              <Disclaimer />
            </div>
          </Card>

          <Card title="Indicators and thresholds">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="text-[11px] tracking-wide text-zinc-500 uppercase">
                    <th className="py-1.5 pr-3 font-medium">Indicator</th>
                    <th className="py-1.5 pr-3 font-medium text-emerald-300">Normal</th>
                    <th className="py-1.5 pr-3 font-medium text-amber-300">Watch</th>
                    <th className="py-1.5 font-medium text-red-300">Alert</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {INDICATOR_ORDER.map((id) => {
                    const ind = INDICATORS[id]
                    return (
                      <tr key={id} className="border-t border-[#222226] align-top">
                        <td className="py-2 pr-3 text-zinc-100">
                          {ind.name}
                          {!ind.core && <span className="text-zinc-500"> (extra)</span>}
                        </td>
                        <td className="py-2 pr-3">{ind.bands.normal}</td>
                        <td className="py-2 pr-3">{ind.bands.watch}</td>
                        <td className="py-2">{ind.bands.alert}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400">
              <li>Overall status is the worst level among today’s readings.</li>
              <li>The same indicator on watch 3 days in a row becomes an alert.</li>
              <li>Two or more indicators on watch on the same day adds a note to mention them to the flight surgeon.</li>
              <li>Impossible values (for example a heart rate of 400) are refused with a reason and never stored.</li>
            </ul>
          </Card>

          <Card title="NASA Human Research Program — 5 hazards">
            <ul className="space-y-2 text-sm">
              {HAZARD_ORDER.map((h) => (
                <li key={h}>
                  <p className="text-zinc-100">{HAZARDS[h].name}</p>
                  <p className="text-xs text-zinc-400">{HAZARDS[h].summary}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              <Link href={HAZARDS_URL}>nasa.gov/hrp/hazards</Link>
            </p>
          </Card>

          <Card title="NASA HRP risks covered">
            <ul className="space-y-1.5 text-xs text-zinc-300">
              {usedRisks.map((r) => (
                <li key={r}>{HRP_RISKS[r]}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              <Link href={HRP_RISKS_URL}>Human Research Roadmap — Risks</Link>
            </p>
          </Card>

          <Card title="References">
            <ul className="space-y-3 text-sm">
              {REFERENCES.map((r) => (
                <li key={r.url}>
                  <Link href={r.url}>{r.title}</Link>
                  <p className="text-xs text-zinc-500">{r.publisher}</p>
                  <p className="text-xs text-zinc-400">Used for: {r.usedFor}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Software and services">
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {LIBRARIES.map((l) => (
                <li key={l.name}>
                  <Link href={l.url}>{l.name}</Link>
                  <p className="text-xs text-zinc-500">{l.usedFor}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
