'use client'

import { Button } from '@/components/ui/button'
import { QUICK_RANGES, getQuickDateRange } from '@/lib/sales-helpers'

interface DateRangeRowProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  label?: string
}

/**
 * Full-width date range filter row: From/To inputs plus quick-range presets.
 * Designed to sit on its own row below the other filters so it can stretch wide.
 */
export function DateRangeRow({ from, to, onChange, label = 'Date Range' }: DateRangeRowProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => onChange(e.target.value, to)}
            className="w-[140px] rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onChange(from, e.target.value)}
            className="w-[140px] rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_RANGES.map((r) => (
            <Button
              key={r.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const d = getQuickDateRange(r.key)
                onChange(d.from, d.to)
              }}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
