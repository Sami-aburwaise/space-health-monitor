import type { StatusLevel } from '@/lib/health/indicators'

export type LevelOrNone = StatusLevel | 'none'

export const LEVEL_STYLES: Record<
  LevelOrNone,
  { badge: string; text: string; panel: string; dot: string; hex: string }
> = {
  normal: {
    badge: 'bg-emerald-500/15 text-emerald-300',
    text: 'text-emerald-300',
    panel: 'border-emerald-500/30 bg-emerald-500/5',
    dot: 'bg-emerald-400',
    hex: '#34d399',
  },
  watch: {
    badge: 'bg-amber-500/15 text-amber-300',
    text: 'text-amber-300',
    panel: 'border-amber-500/35 bg-amber-500/5',
    dot: 'bg-amber-400',
    hex: '#fbbf24',
  },
  alert: {
    badge: 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.55)]',
    text: 'text-red-500 font-semibold',
    panel: 'border-red-500 bg-red-600/20',
    dot: 'bg-red-500',
    hex: '#ef4444',
  },
  none: {
    badge: 'bg-zinc-800 text-zinc-400',
    text: 'text-zinc-500',
    panel: 'border-[#222226] bg-[#111113]',
    dot: 'bg-zinc-600',
    hex: '#52525b',
  },
}

export function levelKey(level: StatusLevel | null): LevelOrNone {
  return level ?? 'none'
}
