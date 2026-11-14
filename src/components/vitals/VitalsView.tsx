import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/shared/EmptyState'
import { Sparkline } from '@/components/vitals/Sparkline'
import { formatExtractedMetrics } from '@/lib/extractVitals'
import type { VitalReading } from '@/types/health'

interface VitalsViewProps {
  vitals: VitalReading[]
}

function series(
  vitals: VitalReading[],
  pick: (v: VitalReading) => number | undefined,
): number[] {
  return [...vitals]
    .reverse()
    .map(pick)
    .filter((n): n is number => n != null)
}

function latestValue(
  vitals: VitalReading[],
  pick: (v: VitalReading) => number | undefined,
): number | null {
  for (const v of vitals) {
    const n = pick(v)
    if (n != null) return n
  }
  return null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function VitalsView({ vitals }: VitalsViewProps) {
  const isEmpty = vitals.length === 0

  const hrSeries = series(vitals, (v) => v.heartRate)
  const sysSeries = series(vitals, (v) => v.systolic)
  const spo2Series = series(vitals, (v) => v.spo2)
  const tempSeries = series(vitals, (v) => v.temperatureC)

  const hr = latestValue(vitals, (v) => v.heartRate)
  const sys = latestValue(vitals, (v) => v.systolic)
  const dia = latestValue(vitals, (v) => v.diastolic)
  const spo2 = latestValue(vitals, (v) => v.spo2)
  const temp = latestValue(vitals, (v) => v.temperatureC)
  const weight = latestValue(vitals, (v) => v.weightKg)

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0A0B]">
      <header className="border-b border-[#222226] px-4 py-3 md:px-6">
        <h1 className="text-base font-medium tracking-tight text-zinc-100">Vitals History</h1>
        <p className="text-xs text-zinc-500">
          Read-only metrics extracted from chat · localStorage only
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 md:p-6">
          {isEmpty ? (
            <EmptyState
              className="border-[#222226] bg-[#111113]"
              title="No health metrics recorded via chat yet"
              description="Mention readings in conversation — e.g. “My heart rate is 78 bpm” or “BP is 120/80”."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#222226] bg-[#222226] md:grid-cols-3 lg:grid-cols-5">
                <MetricCell label="HR" value={hr != null ? String(hr) : '—'} unit="bpm" series={hrSeries} />
                <MetricCell
                  label="BP"
                  value={sys != null && dia != null ? `${sys}/${dia}` : '—'}
                  unit="mmHg"
                  series={sysSeries}
                />
                <MetricCell label="SpO₂" value={spo2 != null ? String(spo2) : '—'} unit="%" series={spo2Series} />
                <MetricCell
                  label="Temp"
                  value={temp != null ? temp.toFixed(1) : '—'}
                  unit="°C"
                  series={tempSeries}
                />
                <MetricCell
                  label="Weight"
                  value={weight != null ? weight.toFixed(1) : '—'}
                  unit="kg"
                  series={series(vitals, (v) => v.weightKg)}
                />
              </div>

              <section className="overflow-hidden rounded-lg border border-[#222226] bg-[#111113]">
                <div className="border-b border-[#222226] px-4 py-2.5">
                  <h2 className="text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
                    Chronological log
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#222226] text-[11px] tracking-wide text-zinc-500 uppercase">
                        <th className="px-4 py-2 font-medium">Time</th>
                        <th className="px-4 py-2 font-medium">HR</th>
                        <th className="px-4 py-2 font-medium">BP</th>
                        <th className="px-4 py-2 font-medium">SpO₂</th>
                        <th className="px-4 py-2 font-medium">Temp</th>
                        <th className="px-4 py-2 font-medium">Wt</th>
                        <th className="px-4 py-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitals.map((v) => (
                        <tr key={v.id} className="border-b border-[#222226] last:border-0">
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-400">
                            {formatTime(v.recordedAt)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-100">
                            {v.heartRate ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-100">
                            {v.systolic != null && v.diastolic != null
                              ? `${v.systolic}/${v.diastolic}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-100">
                            {v.spo2 ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-100">
                            {v.temperatureC != null ? v.temperatureC.toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-100">
                            {v.weightKg != null ? v.weightKg.toFixed(1) : '—'}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-zinc-500" title={v.rawExcerpt}>
                            {formatExtractedMetrics(v) || 'chat'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function MetricCell({
  label,
  value,
  unit,
  series: values,
}: {
  label: string
  value: string
  unit: string
  series: number[]
}) {
  return (
    <div className="flex flex-col gap-2 bg-[#111113] px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] tracking-[0.1em] text-zinc-500 uppercase">{label}</span>
        <span className="text-[10px] text-zinc-600">{unit}</span>
      </div>
      <p className="font-mono text-xl tracking-tight text-zinc-50 tabular-nums">{value}</p>
      <Sparkline values={values} className="text-emerald-500/70" />
    </div>
  )
}
