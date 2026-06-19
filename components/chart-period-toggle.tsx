'use client'

import { cn } from '@/lib/utils'

interface ChartPeriodToggleProps {
  period: 'monthly' | 'weekly'
  onPeriodChange: (period: 'monthly' | 'weekly') => void
}

export function ChartPeriodToggle({ period, onPeriodChange }: ChartPeriodToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
      {(['monthly', 'weekly'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onPeriodChange(p)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            period === p
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {p === 'monthly' ? 'Monthly' : 'Weekly'}
        </button>
      ))}
    </div>
  )
}
