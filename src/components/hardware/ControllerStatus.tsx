import { Cable } from 'lucide-react'
import { hallCircuitLabel, type HallCircuit } from '@/lib/serial/hall'
import { cn } from '@/lib/utils'
import type { ArduinoLinkPhase } from '@/hooks/useArduinoLink'

interface ControllerStatusProps {
  phase: ArduinoLinkPhase
  hall: HallCircuit | null
  /** Latest sensor pulse. Null means the sensor is connected but sent no beat. */
  heartRate?: number | null
  portLabel?: string
  compact?: boolean
  className?: string
}

export function ControllerStatus({
  phase,
  hall,
  heartRate = null,
  portLabel,
  compact = false,
  className,
}: ControllerStatusProps) {
  const live = phase === 'open'
  const label = live ? hallCircuitLabel(hall) : phase === 'connecting' ? 'Connecting' : phase === 'error' ? 'Offline' : 'Off'
  const pulse = live ? (heartRate == null ? 'No pulse' : `${heartRate} bpm`) : ''
  const named = portLabel?.trim()
  const text = [named && (live || compact) ? named : '', label, pulse].filter(Boolean).join(' · ')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide',
        live && hall === 0 && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        live && hall === 1 && 'border-amber-500/40 bg-amber-500/15 text-amber-200',
        live && hall === null && 'border-[#222226] bg-[#0A0A0B] text-zinc-400',
        phase === 'connecting' && 'border-sky-500/30 bg-sky-500/10 text-sky-300',
        phase === 'error' && 'border-red-500/30 bg-red-500/10 text-red-300',
        phase === 'idle' && 'border-[#222226] bg-[#0A0A0B] text-zinc-500',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`Arduino controller ${text}`}
    >
      <Cable className="size-3" aria-hidden />
      <span
        className={cn(
          'size-1.5 rounded-full',
          live && hall === 0 && 'bg-emerald-400',
          live && hall === 1 && 'bg-amber-300',
          live && hall === null && 'bg-zinc-500',
          phase === 'connecting' && 'animate-pulse bg-sky-300',
          phase === 'error' && 'bg-red-400',
          phase === 'idle' && 'bg-zinc-600',
        )}
        aria-hidden
      />
      {compact ? [label, pulse].filter(Boolean).join(' · ') : text}
    </span>
  )
}
