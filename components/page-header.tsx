'use client'

import { type ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export interface BreadcrumbType {
  label: string
  href?: string
}

/** Standard dashboard page header: title + subtitle, an optional "Filtered by" chip
 *  (from a chart cross-filter), optional extra actions, and the theme toggle. */
export function PageHeader({
  title,
  subtitle,
  chartFilter,
  onClearFilter,
  actions,
  breadcrumbs,
}: {
  title: string
  subtitle?: string
  chartFilter?: { label: string } | null
  onClearFilter?: () => void
  actions?: ReactNode
  breadcrumbs?: BreadcrumbType[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Official Printable Report Header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">PT. MULTI DAYA MITRA &bull; SALES &amp; PROJECT DASHBOARD</div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">{title}</h1>
            {subtitle && <p className="text-xs text-slate-600 mt-0.5 italic">{subtitle}</p>}
          </div>
          <div className="text-right text-[10px] text-slate-500 font-mono leading-tight">
            <div className="font-bold text-slate-700">OFFICIAL REPORT</div>
            <div>Printed: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            {chartFilter && <div className="text-indigo-600 font-semibold mt-0.5">Filter: {chartFilter.label}</div>}
          </div>
        </div>
      </div>

      {/* Screen Header */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="print:hidden">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((bc, idx) => {
                const isLast = idx === breadcrumbs.length - 1
                return (
                  <div key={bc.label} className="inline-flex items-center gap-1.5 sm:gap-2.5">
                    <BreadcrumbItem>
                      {isLast || !bc.href ? (
                        <BreadcrumbPage>{bc.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={bc.href}>{bc.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </div>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
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
        <div className="flex items-center gap-2 print:hidden">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
