'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { ClipboardList, CheckCircle2, FolderOpen, AlertTriangle, Wallet, Percent, Timer, Truck } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { useServerRows } from '@/hooks/use-server-rows'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { ColumnDef } from '@tanstack/react-table'
import { fmtCurrency, buildQuery, sameSet, getYTD, fmtShortDate as fmtDate } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { ExportButton } from '@/components/export-button'

interface PRRow {
  prId: string; item: string; projectId: string; project: string; qtyReq: number; qtyPurchased: number
  estimated: number; purchased: number; variance: number; variancePct: number | null
  status: string; statusLabel: string; overdue: string; overdueLabel: string
  approval: string; approvalLabel: string; handlerId: string; handler: string
  requesterId: string; requester: string; duedate: string; createdAt: string
  leadTimePO: number | null; leadTimeReceived: number | null
  isPurchased: boolean; isOverdue: boolean
}
interface Option { value: string; label: string }
interface PRData {
  kpis: { totalPR: number; purchasedCount: number; openCount: number; overdueCount: number; completionRate: number; totalEstimated: number; totalPurchased: number; avgVariancePct: number
    leadTimePOAvg: number; leadTimePOMedian: number; leadTimePOCount: number
    leadTimeReceivedAvg: number; leadTimeReceivedMedian: number; leadTimeReceivedCount: number }
  statusBreakdown: { name: string; value: number }[]
  overdueBreakdown: { name: string; value: number }[]
  monthlyTrend: { name: string; count: number }[]
  estVsActual: { name: string; Estimated: number; Purchased: number }[]
  handlerWorkload: { name: string; value: number }[]
  topProjects: { id: string; name: string; value: number }[]
  requests: PRRow[]
  totalRows: number
  filterOptions: { statusList: Option[]; overdueList: Option[]; approvalList: Option[]; projectList: Option[]; handlerList: Option[]; requesterList: Option[] }
}
const statusClass: Record<string, string> = { pending: 'bg-amber-500/10 text-amber-600', processed: 'bg-sky-500/10 text-sky-600', open: 'bg-purple-500/10 text-purple-600', completed: 'bg-emerald-500/10 text-emerald-600', cancelled: 'bg-red-500/10 text-red-600' }
const overdueClass: Record<string, string> = { safe: 'bg-emerald-500/10 text-emerald-600', warning: 'bg-amber-500/10 text-amber-600', critical: 'bg-red-500/10 text-red-600' }

// Stable fallback while data is loading — a fresh `?? []` per render would
// retrigger useServerRows' reset effect in a loop.
const EMPTY_ROWS: PRRow[] = []

const columns: ColumnDef<PRRow>[] = [
  { accessorKey: 'prId', header: ({ column }) => <DataTableColumnHeader column={column} title="PR ID" /> },
  { accessorKey: 'item', header: ({ column }) => <DataTableColumnHeader column={column} title="Item" /> },
  { accessorKey: 'project', header: ({ column }) => <DataTableColumnHeader column={column} title="Project" /> },
  { accessorKey: 'createdAt', header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />, cell: ({ row }) => fmtDate(row.original.createdAt) },
  { accessorKey: 'duedate', header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />, cell: ({ row }) => fmtDate(row.original.duedate) },
  { accessorKey: 'statusLabel', header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />, cell: ({ row }) => { const l = row.original.statusLabel; const c = statusClass[row.original.status] || 'bg-muted'; return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c}`}>{l}</span> } },
  { accessorKey: 'overdueLabel', header: ({ column }) => <DataTableColumnHeader column={column} title="Overdue" />, cell: ({ row }) => { const l = row.original.overdueLabel; const c = overdueClass[row.original.overdue] || 'bg-muted'; return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c}`}>{l}</span> } },
  { accessorKey: 'handler', header: ({ column }) => <DataTableColumnHeader column={column} title="Handler" /> },
  { accessorKey: 'requester', header: ({ column }) => <DataTableColumnHeader column={column} title="Requester" /> },
]

export default function PurchaseRequestsPage() {
  const [data, setData] = useState<PRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('pr-table-section', undefined, false)

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [st, setSt] = useState<string[]>([]), [ov, setOv] = useState<string[]>([]), [ap, setAp] = useState<string[]>([])
  const [prj, setPrj] = useState<string[]>([]), [hdl, setHdl] = useState<string[]>([]), [req, setReq] = useState<string[]>([])
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lSt, setLSt] = useState<string[]>([]), [lOv, setLOv] = useState<string[]>([]), [lAp, setLAp] = useState<string[]>([])
  const [lPrj, setLPrj] = useState<string[]>([]), [lHdl, setLHdl] = useState<string[]>([]), [lReq, setLReq] = useState<string[]>([])

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/purchasing/requests?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({
      dateFrom, dateTo, status: st, overdue: ov, approval: ap, project: prj, handler: hdl, requester: req,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {}),
    })
  }, [doFetch, dateFrom, dateTo, st, ov, ap, prj, hdl, req, chartFilter])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setSt(lSt); setOv(lOv); setAp(lAp); setPrj(lPrj); setHdl(lHdl); setReq(lReq) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLSt([]); setLOv([]); setLAp([]); setLPrj([]); setLHdl([]); setLReq([])
    setDateFrom(d.from); setDateTo(d.to); setSt([]); setOv([]); setAp([]); setPrj([]); setHdl([]); setReq([]); setChartFilter(null)
  }

  // Server-backed table: main payload carries only the first page; sorting,
  // searching, and load-more request slices from the route's cached row view.
  const pr = useServerRows<PRRow>({
    endpoint: '/api/purchasing/requests',
    baseParams: {
      dateFrom, dateTo, status: st, overdue: ov, approval: ap, project: prj, handler: hdl, requester: req,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
    },
    initialRows: data?.requests ?? EMPTY_ROWS,
    totalRows: data?.totalRows ?? 0,
    initialSortKey: 'createdAt',
  })

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lSt, st) || !sameSet(lOv, ov) || !sameSet(lAp, ap) || !sameSet(lPrj, prj) || !sameSet(lHdl, hdl) || !sameSet(lReq, req)

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
  const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Purchase Requests" subtitle="PT. Multi Daya Mitra — Procurement Pipeline" breadcrumbs={[{ label: 'Purchasing' }, { label: 'Purchase Requests' }]} chartFilter={chartFilter} onClearFilter={() => setChartFilter(null)} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Status</label>
              <MultiSelect allLabel="All Statuses" selected={lSt} onChange={setLSt} options={data.filterOptions.statusList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Overdue</label>
              <MultiSelect allLabel="All Overdue" selected={lOv} onChange={setLOv} options={data.filterOptions.overdueList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Approval</label>
              <MultiSelect allLabel="All Approvals" selected={lAp} onChange={setLAp} options={data.filterOptions.approvalList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project</label>
              <MultiSelect allLabel="All Projects" selected={lPrj} onChange={setLPrj} options={data.filterOptions.projectList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Handler</label>
              <MultiSelect allLabel="All Handlers" selected={lHdl} onChange={setLHdl} options={data.filterOptions.handlerList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Requester</label>
              <MultiSelect allLabel="All Requesters" selected={lReq} onChange={setLReq} options={data.filterOptions.requesterList} /></div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total PR" value={data.kpis.totalPR.toLocaleString('en-US')} icon={<ClipboardList className="h-4 w-4" />} />
          <KPICard title="Purchased" value={data.kpis.purchasedCount.toLocaleString('en-US')} icon={<CheckCircle2 className="h-4 w-4" />} trend={{ value: `${data.kpis.completionRate}%`, label: 'completion', positive: data.kpis.completionRate >= 50 }} />
          <KPICard title="Open PRs" value={data.kpis.openCount.toLocaleString('en-US')} icon={<FolderOpen className="h-4 w-4" />} />
          <KPICard title="Overdue" value={data.kpis.overdueCount.toLocaleString('en-US')} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: data.kpis.overdueCount, label: 'PRs late', positive: false }} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Estimated" value={fmtRp(data.kpis.totalEstimated)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Total Purchased" value={fmtRp(data.kpis.totalPurchased)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Avg Saving" value={`${data.kpis.avgVariancePct}%`} icon={<Percent className="h-4 w-4" />} trend={{ value: `${data.kpis.avgVariancePct}%`, label: 'vs estimate', positive: data.kpis.avgVariancePct >= 0 }} />
          <KPICard title="Purchased Items" value={data.kpis.purchasedCount.toLocaleString('en-US')} icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>

        {/* Lead time KPIs (date-only, days; negatives clamped to 0) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KPICard
            title="Lead Time (PR → PO)"
            value={`${data.kpis.leadTimePOAvg} days`}
            icon={<Timer className="h-4 w-4" />}
            trend={{ value: `${data.kpis.leadTimePOMedian} days`, label: `median · ${data.kpis.leadTimePOCount.toLocaleString('en-US')} PR`, positive: true }}
          />
          <KPICard
            title="Lead Time Goods Received"
            value={`${data.kpis.leadTimeReceivedAvg} days`}
            icon={<Truck className="h-4 w-4" />}
            trend={{ value: `${data.kpis.leadTimeReceivedMedian} days`, label: `median · ${data.kpis.leadTimeReceivedCount.toLocaleString('en-US')} PR`, positive: true }}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle></CardHeader><CardContent><DonutChart data={data.statusBreakdown} height={260} onSliceClick={(name) => handleChartClick('status', name, `Status = ${name}`)} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Overdue Breakdown</CardTitle></CardHeader><CardContent><DonutChart data={data.overdueBreakdown} height={260} onSliceClick={(name) => handleChartClick('overdue', name, `Overdue = ${name}`)} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Handler Workload</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[260px] w-full">
              <BarChart data={data.handlerWorkload} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} width={110} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} onClick={(d) => handleChartClick('handler', String(d.name ?? ''), `Handler = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* Estimated vs Purchased */}
        <Card><CardHeader><CardTitle className="text-sm font-semibold">Estimated vs Purchased (Monthly)</CardTitle></CardHeader><CardContent>
          <ChartContainer config={{ Estimated: { label: 'Estimated', color: 'var(--chart-3)' }, Purchased: { label: 'Purchased', color: 'var(--chart-1)' } }} className="h-[260px] w-full">
            <BarChart data={data.estVsActual} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
              <Tooltip formatter={(v: any) => fmtRp(Number(v))} {...tip} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="Estimated" fill="var(--color-Estimated)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Purchased" fill="var(--color-Purchased)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent></Card>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">PR Volume (Monthly)</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[240px] w-full">
              <BarChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" {...axis} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis {...axis} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} onClick={(d) => handleChartClick('prMonth', String(d.name ?? ''), `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Top Projects by Purchased Value</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[240px] w-full">
              <BarChart data={data.topProjects} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
                <YAxis type="category" dataKey="id" {...axis} width={70} axisLine={false} />
                <Tooltip formatter={(v: any) => fmtRp(Number(v))} labelFormatter={(id: any) => data.topProjects.find(p => p.id === id)?.name || id} cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-4)" radius={[0, 4, 4, 0]} onClick={(d: any) => handleChartClick('project', String(d.id ?? ''), `Project = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* Requests table */}
        <Card className="overflow-hidden" id="pr-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Purchase Requests <span className="font-normal text-muted-foreground">({pr.total.toLocaleString('en-US')}{pr.total !== data.totalRows ? ` of ${data.totalRows.toLocaleString('en-US')}` : ''})</span></CardTitle>
            <SearchInput value={pr.search} onChange={pr.setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <DataTable 
              columns={columns} 
              data={pr.rows} 
              manualPagination={true}
              pageCount={pr.pageCount}
              pagination={pr.pagination}
              onPaginationChange={pr.onPaginationChange}
              manualSorting={true}
              sorting={pr.sorting}
              onSortingChange={pr.onSortingChange}
            />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
