'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { ClipboardList, CheckCircle2, FolderOpen, AlertTriangle, Wallet, Percent, Timer, Truck } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD, fmtShortDate as fmtDate } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'

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

const statusClass: Record<string, string> = {
  P: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  S: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  H: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  NS: 'bg-muted text-muted-foreground',
  Hold: 'bg-red-500/10 text-red-600 dark:text-red-400',
}
const overdueClass: Record<string, string> = {
  active: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  onTime: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  dueToday: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
  overdueOngoing: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  unhandledOverdue: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

export default function PurchaseRequestsPage() {
  const [data, setData] = useState<PRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
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

  const tableRows = useMemo(() => {
    if (!data) return []
    if (!search) return data.requests
    const q = search.toLowerCase()
    return data.requests.filter(r => [r.prId, r.item, r.project, r.handler, r.requester, r.statusLabel].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])
  const prSort = useSort(tableRows, 'createdAt', 'desc')
  const prPage = useLoadMore(prSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lSt, st) || !sameSet(lOv, ov) || !sameSet(lAp, ap) || !sameSet(lPrj, prj) || !sameSet(lHdl, hdl) || !sameSet(lReq, req)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
  const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Purchase Requests" subtitle="PT. Multi Daya Mitra — Procurement Pipeline" chartFilter={chartFilter} onClearFilter={() => setChartFilter(null)} />

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
          <KPICard title="Total PR" value={data.kpis.totalPR.toLocaleString('id-ID')} icon={<ClipboardList className="h-4 w-4" />} />
          <KPICard title="Purchased" value={data.kpis.purchasedCount.toLocaleString('id-ID')} icon={<CheckCircle2 className="h-4 w-4" />} trend={{ value: `${data.kpis.completionRate}%`, label: 'completion', positive: data.kpis.completionRate >= 50 }} />
          <KPICard title="Open PRs" value={data.kpis.openCount.toLocaleString('id-ID')} icon={<FolderOpen className="h-4 w-4" />} />
          <KPICard title="Overdue" value={data.kpis.overdueCount.toLocaleString('id-ID')} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: data.kpis.overdueCount, label: 'PRs late', positive: false }} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Estimated" value={fmtRp(data.kpis.totalEstimated)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Total Purchased" value={fmtRp(data.kpis.totalPurchased)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Avg Saving" value={`${data.kpis.avgVariancePct}%`} icon={<Percent className="h-4 w-4" />} trend={{ value: `${data.kpis.avgVariancePct}%`, label: 'vs estimate', positive: data.kpis.avgVariancePct >= 0 }} />
          <KPICard title="Purchased Items" value={data.kpis.purchasedCount.toLocaleString('id-ID')} icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>

        {/* Lead time KPIs (date-only, days; negatives clamped to 0) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KPICard
            title="Lead Time (PR → PO)"
            value={`${data.kpis.leadTimePOAvg} hari`}
            icon={<Timer className="h-4 w-4" />}
            trend={{ value: `${data.kpis.leadTimePOMedian} hari`, label: `median · ${data.kpis.leadTimePOCount.toLocaleString('id-ID')} PR`, positive: true }}
          />
          <KPICard
            title="Lead Time Barang Diterima"
            value={`${data.kpis.leadTimeReceivedAvg} hari`}
            icon={<Truck className="h-4 w-4" />}
            trend={{ value: `${data.kpis.leadTimeReceivedMedian} hari`, label: `median · ${data.kpis.leadTimeReceivedCount.toLocaleString('id-ID')} PR`, positive: true }}
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
            <CardTitle className="text-sm font-semibold">Purchase Requests <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('id-ID')}{tableRows.length !== data.totalRows ? ` of ${data.totalRows.toLocaleString('id-ID')}` : ''})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="PR #" column="prId" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Item" column="item" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Project" column="project" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Qty" column="qtyReq" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} className="text-right" />
                  <SortHead label="Estimated" column="estimated" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} className="text-right" />
                  <SortHead label="Purchased" column="purchased" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} className="text-right" />
                  <SortHead label="Variance" column="variance" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} className="text-right" />
                  <SortHead label="Status" column="status" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Overdue" column="overdue" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Handler" column="handler" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Due" column="duedate" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} />
                  <SortHead label="Lead Time" column="leadTimePO" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} className="text-right" />
                  <SortHead label="Diterima" column="leadTimeReceived" sortKey={prSort.sortKey} sortDir={prSort.sortDir} onSort={prSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">No purchase requests found</TableCell></TableRow> : prPage.visible.map(r => (
                    <TableRow key={r.prId}>
                      <TableCell className="text-xs font-semibold text-primary whitespace-nowrap">{r.prId}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={r.item}>{r.item}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.project}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.qtyPurchased.toLocaleString('id-ID')}/{r.qtyReq.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(r.estimated)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(r.purchased)}</TableCell>
                      <TableCell className={`text-right font-medium ${r.variance > 0 ? 'text-emerald-600 dark:text-emerald-400' : r.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{fmtRp(r.variance)}</TableCell>
                      <TableCell><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${statusClass[r.status] || 'bg-muted text-muted-foreground'}`}>{r.statusLabel}</span></TableCell>
                      <TableCell><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${overdueClass[r.overdue] || 'bg-muted text-muted-foreground'}`}>{r.overdueLabel}</span></TableCell>
                      <TableCell className="text-xs">{r.handler}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(r.duedate)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{r.leadTimePO != null ? `${r.leadTimePO.toLocaleString('id-ID')} hari` : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{r.leadTimeReceived != null ? `${r.leadTimeReceived.toLocaleString('id-ID')} hari` : <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={prPage.hasMore} shown={prPage.shown} total={prPage.total} onClick={prPage.loadMore} onLoadAll={prPage.loadAll} onCollapse={prPage.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
