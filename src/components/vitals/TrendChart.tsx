import { useState } from 'react'
import { LEVEL_STYLES } from '@/components/health/statusStyles'
import type { Indicator } from '@/lib/health/indicators'
import type { VitalReading } from '@/types/health'

interface TrendChartProps {
  indicator: Indicator
  readings: VitalReading[]
  days: number
}

const W = 560
const H = 200
const PAD = { left: 44, right: 14, top: 26, bottom: 30 }
const DAY_MS = 24 * 60 * 60 * 1000
const DIASTOLIC_NORMAL: [number, number] = [60, 80]

interface Point {
  t: number
  v: number
  v2?: number
  color: string
}

function niceTicks(min: number, max: number, step: number): number[] {
  const ticks: number[] = []
  const start = Math.ceil(min / step) * step
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10)
  return ticks
}

function shortDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Line chart with y-axis units, date axis, and the normal range shaded. */
export function TrendChart({ indicator, readings, days }: TrendChartProps) {
  const [mountedAt] = useState(() => Date.now())
  const newest = readings.reduce((t, r) => Math.max(t, new Date(r.recordedAt).getTime()), 0)
  const now = Math.max(mountedAt, newest)
  const from = now - days * DAY_MS
  const isBp = indicator.id === 'blood_pressure'

  const points: Point[] = readings
    .filter((r) => new Date(r.recordedAt).getTime() >= from)
    .flatMap((r): Point[] => {
      const v = indicator.value(r)
      const assessment = indicator.assess(r)
      if (v == null || !assessment) return []
      return [
        {
          t: new Date(r.recordedAt).getTime(),
          v,
          v2: isBp ? r.diastolic : undefined,
          color: LEVEL_STYLES[assessment.level].hex,
        },
      ]
    })
    .sort((a, b) => a.t - b.t)

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[#222226] text-xs text-zinc-500">
        Not measured in the last {days} days
      </div>
    )
  }

  const values = points.flatMap((p) => (p.v2 != null ? [p.v, p.v2] : [p.v]))
  const { step } = indicator.chart
  const yMin = Math.min(indicator.chart.min, Math.floor(Math.min(...values) / step) * step)
  const yMax = Math.max(indicator.chart.max, Math.ceil(Math.max(...values) / step) * step)

  const x = (t: number) => PAD.left + ((t - from) / (now - from)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  const bands: [number, number][] = isBp
    ? [indicator.chart.normal, DIASTOLIC_NORMAL]
    : [indicator.chart.normal]
  const yTicks = niceTicks(yMin, yMax, step)
  const xTicks = Array.from({ length: 4 }, (_, i) => from + (i / 3) * (now - from))

  const line = (pick: (p: Point) => number | undefined) =>
    points
      .filter((p) => pick(p) != null)
      .map((p) => `${x(p.t).toFixed(1)},${y(pick(p)!).toFixed(1)}`)
      .join(' ')

  const latest = points[points.length - 1]
  const label = `${indicator.name} over the last ${days} days: ${points.length} reading${
    points.length === 1 ? '' : 's'
  }, latest ${isBp ? `${latest.v}/${latest.v2}` : latest.v} ${indicator.unit}. Normal range ${indicator.bands.normal}.`

  return (
    <figure className="space-y-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
      >
        {bands.map(([lo, hi]) => (
          <rect
            key={`${lo}-${hi}`}
            x={PAD.left}
            width={W - PAD.left - PAD.right}
            y={y(hi)}
            height={Math.max(0, y(lo) - y(hi))}
            fill="#10b981"
            opacity={0.1}
          />
        ))}

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#222226"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-zinc-500 font-mono text-[10px]"
            >
              {v}
            </text>
          </g>
        ))}

        <text x={PAD.left - 6} y={10} textAnchor="end" className="fill-zinc-500 font-mono text-[10px]">
          {indicator.unit}
        </text>

        {xTicks.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={H - 10}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            className="fill-zinc-500 font-mono text-[10px]"
          >
            {shortDate(t)}
          </text>
        ))}

        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={H - PAD.bottom}
          stroke="#3f3f46"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="#3f3f46"
          strokeWidth={1}
        />

        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="#a1a1aa"
            strokeWidth={1.5}
            strokeLinejoin="round"
            points={line((p) => p.v)}
          />
        )}
        {isBp && points.length > 1 && (
          <polyline
            fill="none"
            stroke="#71717a"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinejoin="round"
            points={line((p) => p.v2)}
          />
        )}

        {points.map((p) => (
          <g key={p.t}>
            <circle cx={x(p.t)} cy={y(p.v)} r={4} fill={p.color} stroke="#0A0A0B" strokeWidth={1.5}>
              <title>{`${shortDate(p.t)}: ${p.v}${p.v2 != null ? `/${p.v2}` : ''} ${indicator.unit}`}</title>
            </circle>
            {p.v2 != null && (
              <circle cx={x(p.t)} cy={y(p.v2)} r={3} fill={p.color} opacity={0.7} />
            )}
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-emerald-500/20" aria-hidden />
          Normal range{isBp ? 's (top and bottom number)' : ''}
        </span>
        {isBp && <span>Solid line: top number · dashed: bottom number</span>}
        {points.length === 1 && <span>1 reading so far. Log more to see a trend.</span>}
      </figcaption>
    </figure>
  )
}
