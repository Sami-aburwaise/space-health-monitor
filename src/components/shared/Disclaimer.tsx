import { Info } from 'lucide-react'
import { DISCLAIMER } from '@/lib/health/sources'
import { cn } from '@/lib/utils'

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-[11px] leading-snug text-zinc-500', className)}>
      <Info className="mt-px size-3 shrink-0" aria-hidden />
      <span>{DISCLAIMER}</span>
    </p>
  )
}
