'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoTooltipProps {
  tooltip: string
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function InfoTooltip({ tooltip, className, align = 'center' }: InfoTooltipProps) {
  return (
    <span className={cn('relative group inline-flex items-center', className)}>
      <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-pointer hover:text-muted-foreground transition-colors" />
      <span
        className={cn(
          'absolute bottom-full mb-1.5 hidden group-hover:block z-[9999] w-48 p-1.5 text-[10px] font-normal leading-normal text-white bg-slate-950 border border-slate-800 rounded shadow-lg pointer-events-none whitespace-normal normal-case',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'left' && 'left-0 translate-x-0',
          align === 'right' && 'right-0 translate-x-0'
        )}
      >
        {tooltip}
      </span>
    </span>
  )
}
