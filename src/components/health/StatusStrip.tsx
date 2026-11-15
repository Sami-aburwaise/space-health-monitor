import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LEVEL_STYLES, levelKey } from '@/components/health/statusStyles'
import { LEVEL_LABEL } from '@/lib/health/indicators'
import type { OverallStatus } from '@/lib/health/status'
import { cn } from '@/lib/utils'

interface StatusStripProps {
  status: OverallStatus
  onOpen?: () => void
}

/** One-line "how am I today" summary shown above the chat. */
export function StatusStrip({ status, onOpen }: StatusStripProps) {
  const key = levelKey(status.level)
  const style = LEVEL_STYLES[key]
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 border-b px-4 py-2 md:px-6',
        key === 'none' ? 'border-[#222226] bg-[#0A0A0B]' : style.panel,
      )}
      role="status"
    >
      <Badge className={cn('shrink-0 border-0 font-semibold', style.badge)}>
        <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
        {status.level ? LEVEL_LABEL[status.level] : 'Not measured'}
      </Badge>
      <p className="min-w-0 flex-1 truncate text-xs text-zinc-300" title={status.sentence}>
        {status.sentence}
        {status.notMeasured.length > 0 && status.level != null && (
          <span className="text-zinc-500"> · {status.notMeasured.length} not measured today</span>
        )}
      </p>
      {onOpen && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          onClick={onOpen}
        >
          Details
          <ChevronRight data-icon="inline-end" />
        </Button>
      )}
    </div>
  )
}
