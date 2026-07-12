'use client'

import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangeRow } from '@/components/date-range-row'

/** The standard filter panel: a grid of filter controls (children) + a date range
 *  row + Clear/Apply footer (with the unapplied-changes dot) + an inline loading bar.
 *  `children` is the page-specific filter grid (MultiSelects, etc.). */
export function FilterCard({
  from,
  to,
  onDateChange,
  onApply,
  onClear,
  hasUnapplied,
  loading,
  applyLabel = 'Apply Filters',
  dateLabel,
  children,
}: {
  from: string
  to: string
  onDateChange: (from: string, to: string) => void
  onApply: () => void
  onClear: () => void
  hasUnapplied: boolean
  loading?: boolean
  applyLabel?: string
  dateLabel?: string
  children?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        {children}
        <div className={children ? 'mt-4 border-t border-border pt-4' : ''}>
          <DateRangeRow from={from} to={to} onChange={onDateChange} label={dateLabel} />
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
          <Button size="sm" onClick={onApply} className="relative">
            {applyLabel}
            {hasUnapplied && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
          </Button>
        </div>
        {loading && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
      </CardContent>
    </Card>
  )
}
