import { Fragment } from 'react'
import { cn } from '@/lib/utils'

/** Status words get the same green / amber / red as the vitals badges. */
const STATUS_COLOR: Record<string, string> = {
  Normal: 'text-emerald-300',
  Watch: 'text-amber-300',
  Alert: 'text-red-500',
}

/** Renders light markdown: **bold** only (enough for coach bubbles). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g)
  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {parts.map((part, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part)
        if (bold) {
          const word = bold[1]
          return (
            <strong key={i} className={cn('font-semibold', STATUS_COLOR[word] ?? 'text-zinc-50')}>
              {word}
            </strong>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </span>
  )
}
