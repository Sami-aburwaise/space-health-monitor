import { useEffect, useRef, useState, type Ref } from 'react'
import { LEVEL_STYLES, levelKey } from '@/components/health/statusStyles'
import {
  INDICATORS,
  LEVEL_LABEL,
  LEVEL_RANK,
  REGION_LABEL,
  indicatorsForRegion,
  type BodyRegion,
  type StatusLevel,
} from '@/lib/health/indicators'
import type { OverallStatus } from '@/lib/health/status'
import type { CrewFigure, FigureState, RegionPoints } from '@/lib/bodymap/crewFigure'
import { cn } from '@/lib/utils'

interface BodyMapProps {
  status: OverallStatus
  selected: BodyRegion | null
  onSelect: (region: BodyRegion) => void
}

/** Labels sit beside the figure; each side is ordered top to bottom. */
const LABELS: { region: BodyRegion; side: 'left' | 'right' }[] = [
  { region: 'brain', side: 'left' },
  { region: 'fingertip', side: 'left' },
  { region: 'heart', side: 'right' },
  { region: 'core', side: 'right' },
]

const LABEL_WIDTH = 90
const LABEL_HEIGHT = 34

function regionLevel(status: OverallStatus, region: BodyRegion): StatusLevel | null {
  let worst: StatusLevel | null = null
  for (const id of indicatorsForRegion(region)) {
    const level = status.indicators[id].level
    if (level && (worst == null || LEVEL_RANK[level] > LEVEL_RANK[worst])) worst = level
  }
  return worst
}

/** Voxel crew member with clickable regions glowing in today's status colors. */
export function BodyMap({ status, selected, onSelect }: BodyMapProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<CrewFigure | null>(null)
  const labelRefs = useRef<Partial<Record<BodyRegion, HTMLButtonElement>>>({})
  const lineRefs = useRef<Partial<Record<BodyRegion, SVGLineElement>>>({})
  const dotRefs = useRef<Partial<Record<BodyRegion, SVGCircleElement>>>({})
  const onSelectRef = useRef(onSelect)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const levels: Record<BodyRegion, StatusLevel | null> = {
    brain: regionLevel(status, 'brain'),
    heart: regionLevel(status, 'heart'),
    core: regionLevel(status, 'core'),
    fingertip: regionLevel(status, 'fingertip'),
  }
  const mood = status.indicators.mood.level
  const stateRef = useRef<FigureState>({ levels, selected, mood })

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let disposed = false
    let figure: CrewFigure | null = null

    function layout(points: RegionPoints) {
      const width = stage!.clientWidth
      const height = stage!.clientHeight
      for (const { region, side } of LABELS) {
        const p = points[region]
        const label = labelRefs.current[region]
        const line = lineRefs.current[region]
        const dot = dotRefs.current[region]
        if (!label || !line || !dot) continue
        const top = Math.min(Math.max(p.y - LABEL_HEIGHT / 2, 0), height - LABEL_HEIGHT)
        label.style.transform = `translateY(${top}px)`
        const x1 = side === 'left' ? LABEL_WIDTH : width - LABEL_WIDTH
        line.setAttribute('x1', String(x1))
        line.setAttribute('y1', String(top + LABEL_HEIGHT / 2))
        line.setAttribute('x2', String(p.x))
        line.setAttribute('y2', String(p.y))
        dot.setAttribute('cx', String(p.x))
        dot.setAttribute('cy', String(p.y))
      }
    }

    import('@/lib/bodymap/crewFigure')
      .then(({ CrewFigure }) => {
        if (disposed) return
        figure = new CrewFigure(stage, (r) => onSelectRef.current(r), layout)
        figure.setState(stateRef.current)
        figureRef.current = figure
      })
      .catch(() => setFailed(true))

    return () => {
      disposed = true
      figure?.dispose()
      figureRef.current = null
    }
  }, [])

  const { brain, heart, core, fingertip } = levels
  useEffect(() => {
    stateRef.current = { levels: { brain, heart, core, fingertip }, selected, mood }
    figureRef.current?.setState(stateRef.current)
  }, [brain, heart, core, fingertip, selected, mood])

  if (failed) {
    return (
      <div className="grid grid-cols-2 gap-2" aria-label="Body map">
        {LABELS.map(({ region }) => (
          <RegionButton
            key={region}
            region={region}
            level={levels[region]}
            selected={selected === region}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="relative mx-auto h-[360px] w-full max-w-[340px]" aria-label="Body map">
      <div ref={stageRef} className="absolute inset-0" />
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {LABELS.map(({ region }) => {
          const hex = LEVEL_STYLES[levelKey(levels[region])].hex
          const active = selected === region
          return (
            <g key={region}>
              <line
                ref={(el) => {
                  if (el) lineRefs.current[region] = el
                }}
                stroke={active ? '#fafafa' : hex}
                strokeOpacity={active ? 0.8 : 0.45}
                strokeWidth={1}
                strokeDasharray={active ? undefined : '3 3'}
              />
              <circle
                ref={(el) => {
                  if (el) dotRefs.current[region] = el
                }}
                r={2.5}
                fill={active ? '#fafafa' : hex}
              />
            </g>
          )
        })}
      </svg>
      {LABELS.map(({ region, side }) => (
        <RegionButton
          key={region}
          ref={(el) => {
            if (el) labelRefs.current[region] = el
          }}
          region={region}
          level={levels[region]}
          selected={selected === region}
          onSelect={onSelect}
          className={cn('absolute top-0', side === 'left' ? 'left-0' : 'right-0 text-right')}
        />
      ))}
    </div>
  )
}

interface RegionButtonProps {
  region: BodyRegion
  level: StatusLevel | null
  selected: boolean
  onSelect: (region: BodyRegion) => void
  className?: string
  ref?: Ref<HTMLButtonElement>
}

function RegionButton({ region, level, selected, onSelect, className, ref }: RegionButtonProps) {
  const style = LEVEL_STYLES[levelKey(level)]
  const names = indicatorsForRegion(region)
    .map((id) => INDICATORS[id].name)
    .join(', ')
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      aria-label={`${REGION_LABEL[region]}: ${names}. ${level ? LEVEL_LABEL[level] : 'Not measured today'}`}
      onClick={() => onSelect(region)}
      style={{ width: LABEL_WIDTH, height: LABEL_HEIGHT }}
      className={cn(
        'rounded-md border px-2 py-0.5 leading-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60',
        selected
          ? 'border-zinc-500 bg-zinc-800/90'
          : 'border-[#222226] bg-[#0A0A0B]/80 hover:border-zinc-600',
        className,
      )}
    >
      <span className="block text-[12px] font-medium text-zinc-200">{REGION_LABEL[region]}</span>
      <span className={cn('block text-[11px] whitespace-nowrap', level ? style.text : 'text-zinc-500')}>
        {level ? LEVEL_LABEL[level] : 'Not measured'}
      </span>
    </button>
  )
}
