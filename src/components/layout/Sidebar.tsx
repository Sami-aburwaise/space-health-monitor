import {
  Activity,
  HeartPulse,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppView } from '@/types/health'

const NAV: { id: AppView; label: string; shortLabel: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'vitals', label: 'Vitals History', shortLabel: 'Vitals', icon: HeartPulse },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
]

const ACTIVE_ITEM =
  'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300'

interface SidebarProps {
  view: AppView
  onNavigate: (view: AppView) => void
  crewName: string
  variant?: 'desktop' | 'mobile'
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function Sidebar({
  view,
  onNavigate,
  crewName,
  variant = 'desktop',
  collapsed = false,
  onToggleCollapsed,
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
                  active && ACTIVE_ITEM,
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

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-[#222226] bg-[#111113] text-zinc-50 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 border-b border-[#222226] py-4',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20">
          <Activity className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-50">
              Space Health
            </p>
            <p className="truncate text-xs text-zinc-500">
              {crewName.trim() || 'Local session'}
            </p>
          </div>
        )}
      </div>

      <nav className={cn('flex flex-1 flex-col gap-1 p-2', collapsed && 'items-center')}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id

          if (collapsed) {
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label={label}
                    className={cn(
                      'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50',
                      active && ACTIVE_ITEM,
                    )}
                    onClick={() => onNavigate(id)}
                  >
                    <Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              className={cn(
                'h-9 w-full justify-start gap-2 px-3 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50',
                active && ACTIVE_ITEM,
              )}
              onClick={() => onNavigate(id)}
            >
              <Icon className={cn('size-4', active ? 'text-emerald-400' : 'opacity-80')} />
              {label}
            </Button>
          )
        })}
      </nav>

      <div
        className={cn(
          'flex items-center gap-2 border-t border-[#222226] p-2',
          collapsed && 'justify-center',
        )}
      >
        {!collapsed && (
          <p className="min-w-0 flex-1 px-2 text-[11px] leading-relaxed text-zinc-600">
            Local-first · data stays in this browser
          </p>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="shrink-0 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-50"
              onClick={onToggleCollapsed}
            >
              <ToggleIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
