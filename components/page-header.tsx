'use client'

import { type ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'

/** Standard dashboard page header: title + subtitle, an optional "Filtered by" chip
 *  (from a chart cross-filter), optional extra actions, and the theme toggle. */
export function PageHeader({
  title,
  subtitle,
  chartFilter,
  onClearFilter,
  actions,
}: {
  title: string
  subtitle?: string
  chartFilter?: { label: string } | null
  onClearFilter?: () => void
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {chartFilter && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
            <span className="text-muted-foreground">Filtered by:</span> {chartFilter.label}
            <button onClick={onClearFilter} className="ml-1 hover:bg-primary/20 rounded-full p-0.5">
              <div className="h-4 w-4 flex items-center justify-center">✕</div>
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </div>
  )
}
