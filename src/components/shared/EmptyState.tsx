import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function EmptyState({
  title = 'No health metrics recorded via chat yet',
  description = 'Mention readings in conversation to build your local history.',
  icon,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('border-[#222226] bg-[#111113] shadow-none', className)}>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        {icon}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-100">{title}</p>
          <p className="max-w-sm text-xs leading-relaxed text-zinc-500">{description}</p>
        </div>
        {actions}
      </CardContent>
    </Card>
  )
}
