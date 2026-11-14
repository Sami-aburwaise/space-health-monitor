import {
  Activity,
  HeartPulse,
  MessageSquare,
  NotebookPen,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppView } from '@/types/health'

const NAV: { id: AppView; label: string; shortLabel: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'vitals', label: 'Vitals History', shortLabel: 'Vitals', icon: HeartPulse },
  { id: 'symptoms', label: 'Symptom Log', shortLabel: 'Symptoms', icon: NotebookPen },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: ShieldAlert },
]

interface SidebarProps {
  view: AppView
  onNavigate: (view: AppView) => void
  crewName: string
  variant?: 'desktop' | 'mobile'
}

export function Sidebar({
  view,
  onNavigate,
  crewName,
  variant = 'desktop',
}: SidebarProps) {
  if (variant === 'mobile') {
    return (
      <header className="bg-[#111113]">
        <div className="flex items-center gap-2.5 border-b border-[#222226] px-3 py-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/20">
            <Activity className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-50">
              Space Health
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {crewName.trim() || 'Local session'}
            </p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ id, shortLabel, icon: Icon }) => {
            const active = view === id
            return (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 shrink-0 gap-1.5 px-2.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50',
                  active &&
                    'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300',
                )}
                onClick={() => onNavigate(id)}
              >
                <Icon className={cn('size-3.5', active && 'text-emerald-400')} />
                {shortLabel}
              </Button>
            )
          })}
        </nav>
      </header>
    )
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[#222226] bg-[#111113] text-zinc-50">
      <div className="flex items-center gap-2.5 border-b border-[#222226] px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20">
          <Activity className="size-4" />
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold tracking-tight text-zinc-50">
            Space Health
          </p>
          <p className="truncate text-xs text-zinc-500">
            {crewName.trim() || 'Local session'}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              className={cn(
                'h-9 w-full justify-start gap-2 px-3 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50',
                active &&
                  'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300',
              )}
              onClick={() => onNavigate(id)}
            >
              <Icon className={cn('size-4', active ? 'text-emerald-400' : 'opacity-80')} />
              {label}
            </Button>
          )
        })}
      </nav>

      <p className="border-t border-[#222226] px-4 py-3 text-[11px] leading-relaxed text-zinc-600">
        Local-first · data stays in this browser
      </p>
    </aside>
  )
}
