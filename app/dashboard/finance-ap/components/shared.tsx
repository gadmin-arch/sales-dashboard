'use client'

import { useState, useCallback, useMemo, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { KPICard } from '@/components/kpi-card'
import { InfoTooltip } from '@/components/info-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Download, Search, X } from 'lucide-react'
import { MultiSelect } from '@/components/multi-select'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { useServerRows } from '@/hooks/use-server-rows'
import { DataTable as NewDataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { ColumnDef } from '@tanstack/react-table'
import { fmtCurrency, fmtShortDate as fmtDate } from '@/lib/sales-helpers'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export { fmtDate }

export const rp = (v: number) => 'Rp' + Math.round(v || 0).toLocaleString('id-ID')
export const rpC = (v: number) => fmtCurrency(v || 0, 'IDR')
export const days = (v: number) => {
  if (v === 0) return '0d'
  if (v < 1) {
    const h = v * 24
    return `${h % 1 === 0 ? h : h.toFixed(1)}h`
  }
  return `${v % 1 === 0 ? v : v.toFixed(1)}d`
}
export const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
export const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }
export const CHART = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export type KV = { name: string; value: number }
export type Money = Record<string, number>

export type FilterOptions = Record<string, { value: string; label: string }[]>

export interface FA {
  overview: { kpis: Money; composition: { stream: string; outflow: number; pctOutflow: number; outstanding: number; records: number }[]; outstandingByStream: KV[]; monthly: any[] }
  // poPayments & reimburse are row-sliced: `rows` is only the first page and
  // the tab aggregates come pre-filtered from the server (?f… params).
  poPayments: {
    k: Money & { largestExposurePo?: string }; aging: { name: string; value: number; count: number }[]; byStatus: KV[]; monthlyOutflow: KV[]; timelinessBreakdown: KV[]
    trendReqToApproval: KV[]; trendReqToPaid: KV[]; trendApprovalToPaid: KV[]; trendReqToDue: KV[]; trendOverdue: KV[]; trendDueToPaid: KV[]
    filterOptions: FilterOptions; rows: any[]; totalRows: number
  }
  payroll: { kpis: Money; statusBreakdown: KV[]; topAdditions: KV[]; topReductions: KV[]; monthly: any[]; distribution: KV[]; rows: any[] }
  meal: { kpis: Money; byType: KV[]; topProjects: any[]; approvedByMonth: KV[]; rows: any[]; userBalances: any[] }
  loans: { kpis: Money; topBorrowers: KV[]; monthly: any[]; forecast: KV[]; rows: any[] }
  reimburse: { kpis: Money; categoryBreakdown: KV[]; topProjects: any[]; topEmployees: KV[]; userBalances: any[]; monthly: any[]; filterOptions: FilterOptions; rows: any[]; totalRows: number }
}

export interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  tooltip?: string
  align?: 'left' | 'right' | 'center'
}

export function ChartCard({ title, subtitle, children, className, tooltip, align }: ChartCardProps) {
  return (
    <Card className={cn('overflow-visible', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          {title}
          {tooltip && <InfoTooltip tooltip={tooltip} align={align} />}
        </CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function BarCard({ title, subtitle, data, bars, vertical, categoryKey = 'name', height = 260, stacked, onBarClick, className, tooltip, labelFormatter, yAxisWidth = 120, valueFormatter, align }: {
  title: string; subtitle?: string; data: any[]; bars: { key: string; color: string; label?: string }[]
  vertical?: boolean; categoryKey?: string; height?: number; stacked?: boolean; onBarClick?: (name: string) => void; className?: string; tooltip?: string
  labelFormatter?: (label: any, payload: any) => React.ReactNode; yAxisWidth?: number
  valueFormatter?: (v: any) => string; align?: 'left' | 'right' | 'center'
}) {
  const config = Object.fromEntries(bars.map((b) => [b.key, { label: b.label || b.key, color: b.color }]))
  const click = onBarClick ? (d: any) => onBarClick(String(d?.payload?.[categoryKey] ?? d?.[categoryKey] ?? '')) : undefined
  return (
    <ChartCard title={title} subtitle={subtitle} className={className} tooltip={tooltip} align={align}>
      <ChartContainer config={config} className="w-full" style={{ height }}>
        <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: vertical ? 8 : 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={!vertical} vertical={vertical} />
          {vertical ? (
            <>
              <XAxis type="number" {...axis} tickFormatter={valueFormatter || rpC} axisLine={false} />
              <YAxis type="category" dataKey={categoryKey} {...axis} width={yAxisWidth} axisLine={false} interval={0} tickFormatter={(v) => {
                const str = String(v)
                return str.length > 25 ? str.substring(0, 22) + '...' : str
              }} />
            </>
          ) : (
            <>
              <XAxis dataKey={categoryKey} {...axis} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis {...axis} tickFormatter={valueFormatter || rpC} axisLine={false} />
            </>
          )}
          <Tooltip formatter={(v: any) => valueFormatter ? valueFormatter(v) : rp(Number(v))} labelFormatter={labelFormatter} cursor={{ fill: 'var(--muted)' }} {...tip} />
          {bars.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {bars.map((b, i) => {
            const isLast = i === bars.length - 1
            const r = !stacked || isLast ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : [0, 0, 0, 0]
            return <Bar key={b.key} dataKey={b.key} stackId={stacked ? 's' : undefined} fill={b.color} radius={r as any} onClick={click} style={{ cursor: onBarClick ? 'pointer' : undefined }} />
          })}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

export type FilterSpec = { field: string; label: string }

export function useRowFilters(rows: any[], specs: FilterSpec[]) {
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const options = useMemo(() => {
    const o: Record<string, { value: string; label: string }[]> = {}
    for (const s of specs) o[s.field] = [...new Set(rows.map((r) => String(r[s.field] ?? '')).filter(Boolean))].sort().map((v) => ({ value: v, label: v }))
    return o
  }, [rows, specs])
  const predicate = useCallback((r: any) => specs.every((s) => { const v = sel[s.field]; return !v?.length || v.includes(String(r[s.field] ?? '')) }), [sel, specs])
  const active = specs.some((s) => (sel[s.field]?.length ?? 0) > 0)
  return { sel, setSel, options, predicate, active, clear: () => setSel({}) }
}

export function FilterBar({ specs, sel, setSel, options, active, onClear }: {
  specs: FilterSpec[]; sel: Record<string, string[]>; setSel: Dispatch<SetStateAction<Record<string, string[]>>>
  options: Record<string, { value: string; label: string }[]>; active: boolean; onClear: () => void
}) {
  return (
    <Card><CardContent className="pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {specs.map((s) => (
          <div key={s.field} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{s.label}</label>
            <MultiSelect allLabel={`All ${s.label}`} selected={sel[s.field] || []} onChange={(v) => setSel((p) => ({ ...p, [s.field]: v }))} options={options[s.field]} />
          </div>
        ))}
      </div>
      {active && <div className="mt-3 flex justify-end border-t border-border pt-3"><Button variant="ghost" size="sm" onClick={onClear}>Clear filters</Button></div>}
    </CardContent></Card>
  )
}

export interface Col { key: string; label: string; align?: 'right' | 'center'; render: (r: any) => ReactNode }

export function DataTable({ title, subtitle, rows, cols, searchKeys, initialSort, cf, onClearCf, prefilter, onRowClick, search: externalSearch, onSearchChange }: {
  title: string; subtitle?: string; rows: any[]; cols: Col[]; searchKeys: string[]; initialSort: string; cf?: any; onClearCf?: () => void; prefilter?: (r: any) => boolean; onRowClick?: (r: any) => void;
  search?: string; onSearchChange?: (v: string) => void
}) {
  const [internalSearch, setInternalSearch] = useState('')
  const search = externalSearch !== undefined ? externalSearch : internalSearch
  const setSearch = onSearchChange || setInternalSearch
  
  const filtered = useMemo(() => {
    let rs = prefilter ? rows.filter(prefilter) : rows
    if (cf) rs = rs.filter(cf.test)
    if (search) {
      const q = search.toLowerCase()
      rs = rs.filter((r) => searchKeys.some((k) => {
        const v = r[k]
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      }))
    }
    return rs
  }, [rows, prefilter, search, searchKeys, cf])

  const mappedCols: ColumnDef<any>[] = useMemo(() => cols.map(c => ({
    accessorKey: c.key,
    header: ({ column }) => <DataTableColumnHeader column={column} title={c.label} className={c.align === 'right' ? 'justify-end' : c.align === 'center' ? 'justify-center' : ''} />,
    cell: ({ row }) => <div className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>{c.render(row.original)}</div>
  })), [cols])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({filtered.length.toLocaleString('en-US')})</span></CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {cf && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
              <span className="text-muted-foreground">Filtered by:</span> {cf.label}
              <button onClick={onClearCf} className="ml-1 hover:bg-primary/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <NewDataTable columns={mappedCols} data={filtered} onRowClick={onRowClick} />
      </CardContent>
    </Card>
  )
}

// Stable fallback while a tab slice is loading — a fresh `?? []` per render
// would retrigger useServerRows' reset effect in a loop.
export const EMPTY_ROWS: any[] = []

/**
 * Server-backed twin of DataTable for row-sliced tabs: the tab payload carries
 * only the first page of rows, and sorting / searching / load-more request
 * slices from the route's cached row view (`view=rows`). Same UI as DataTable.
 */
export function ServerDataTable({ title, subtitle, cols, endpoint, baseParams, initialRows, totalRows, initialSortKey, onRowClick }: {
  title: string; subtitle?: string; cols: Col[]
  endpoint: string; baseParams: Record<string, string | string[]>
  initialRows: any[]; totalRows: number; initialSortKey: string; onRowClick?: (r: any) => void
}) {
  const t = useServerRows<any>({ endpoint, baseParams, initialRows, totalRows, initialSortKey })

  const mappedCols: ColumnDef<any>[] = useMemo(() => cols.map(c => ({
    accessorKey: c.key,
    header: ({ column }) => <DataTableColumnHeader column={column} title={c.label} className={c.align === 'right' ? 'justify-end' : c.align === 'center' ? 'justify-center' : ''} />,
    cell: ({ row }) => <div className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>{c.render(row.original)}</div>
  })), [cols])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({t.total.toLocaleString('en-US')})</span></CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search..." value={t.search} onChange={(e) => t.setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <NewDataTable 
          columns={mappedCols} 
          data={t.rows} 
          onRowClick={onRowClick} 
          manualPagination={true}
          pageCount={t.pageCount}
          pagination={t.pagination}
          onPaginationChange={t.onPaginationChange}
          manualSorting={true}
          sorting={t.sorting}
          onSortingChange={t.onSortingChange}
        />
      </CardContent>
    </Card>
  )
}

export const TONE: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  muted: 'bg-muted text-muted-foreground',
}

export const badge = (label: string, tone: keyof typeof TONE | string) => (
  <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${TONE[tone] || TONE.muted}`}>{label}</span>
)

export const timelinessTone = (k: string) => k === 'On Time' ? 'green' : k === 'On Track' ? 'sky' : k === 'Overdue (ongoing)' ? 'red' : k === 'Overdue (late)' ? 'amber' : 'muted'
