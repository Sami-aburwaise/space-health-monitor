import { Fragment } from 'react'
import { cn } from '@/lib/utils'

/** Renders light markdown: **bold** only (enough for coach bubbles). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g)
  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {parts.map((part, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part)
        if (bold) {
          return (
            <strong key={i} className="font-semibold text-zinc-50">
              {bold[1]}
            </strong>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </span>
  )
}
