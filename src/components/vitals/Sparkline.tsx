interface SparklineProps {
  values: number[]
  className?: string
}

/** Minimal SVG sparkline — no axes, no decoration. */
export function Sparkline({ values, className }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div className={className}>
        <span className="font-mono text-[10px] tracking-wide text-zinc-600">insufficient series</span>
      </div>
    )
  }

  const width = 120
  const height = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      width={width}
      height={height}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  )
}
