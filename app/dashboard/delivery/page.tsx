'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { FolderKanban, CheckCircle2, AlarmClock, AlertTriangle, Hourglass } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { DonutChart } from '@/components/donut-chart'
import { ChartContainer } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { buildQuery, sameSet, getYTD, fmtShortDate } from '@/lib/sales-helpers'

interface Option { value: string; label: string }
interface ProjectRow {
  prjId: string; project: string; type: string; owner: string; statusLabel: string
  benchmarkStart: string; benchmarkEnd: string; actualStart: string; actualEnd: string; bastSubmit: string
  startVariance: number | null; endVariance: number | null; durationDays: number | null
  delivery: string; deliveryLabel: string; overduePending: boolean; daysOverdue?: number | null
}
interface DeliveryData {
  kpis: { totalProjects: number; onTime: number; overtime: number; pending: number; onTimeRate: number; overduePending: number; medianDuration: number; medianEndVariance: number; withActualEnd: number; newProjectsCount: number }
  deliveryBreakdown: { name: string; value: number }[]
  statusBreakdown: { name: string; value: number }[]
  latenessDist: { name: string; value: number }[]
  newProjectsTrend: { name: string; value: number }[]
  projects: ProjectRow[]
  atRisk: ProjectRow[]
  dateType: string
  filterOptions: { statusList: Option[]; ownerList: Option[]; typeList: Option[]; deliveryList: Option[] }
}

const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
const DATE_LABELS: Record<string, string> = { due: 'Due Date', start: 'Start Date', end: 'Actual End Date', created: 'Created Date' }

function Variance({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>
  if (v === 0) return <span className="text-muted-foreground">0</span>
  return v > 0
    ? <span className="text-rose-600 dark:text-rose-400">+{v}d</span>
    : <span className="text-emerald-600 dark:text-emerald-400">{v}d</span>
}
function DeliveryBadge({ delivery, label }: { delivery: string; label: string }) {
  const tone = delivery === 'onTime' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : delivery === 'overtime' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      : 'bg-muted text-muted-foreground'
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
}

export default function ProjectDeliveryPage() {
  const firstLoad = useRef(true)
  const [data, setData] = useState<DeliveryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [dateType, setDateType] = useState('due')
  const [status, setStatus] = useState<string[]>([]), [owner, setOwner] = useState<string[]>([]), [type, setType] = useState<string[]>([]), [delivery, setDelivery] = useState<string[]>([])

  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lDateType, setLDateType] = useState('due')
  const [lStatus, setLStatus] = useState<string[]>([]), [lOwner, setLOwner] = useState<string[]>([]), [lType, setLType] = useState<string[]>([]), [lDelivery, setLDelivery] = useState<string[]>([])

  const doFetch = useCallback(async (params: any) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/delivery?${buildQuery(params)}`)
      if (!res.ok) throw new Error('Failed to load delivery data')
      setData(await res.json()); setError(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({ dateFrom, dateTo, dateType, status, owner, type, delivery, ...(fresh ? { fresh: '1' } : {}) })
  }, [doFetch, dateFrom, dateTo, dateType, status, owner, type, delivery])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setDateType(lDateType); setStatus(lStatus); setOwner(lOwner); setType(lType); setDelivery(lDelivery) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLDateType('due'); setLStatus([]); setLOwner([]); setLType([]); setLDelivery([])
    setDateFrom(d.from); setDateTo(d.to); setDateType('due'); setStatus([]); setOwner([]); setType([]); setDelivery([])
  }
  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || lDateType !== dateType || !sameSet(lStatus, status) || !sameSet(lOwner, owner) || !sameSet(lType, type) || !sameSet(lDelivery, delivery)

  const rows = useMemo(() => {
    const raw = data?.projects ?? []
    if (!search) return raw
    const q = search.toLowerCase()
    return raw.filter((r) => r.project.toLowerCase().includes(q) || r.prjId.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q))
  }, [data, search])

  const sort = useSort(rows, 'endVariance', 'desc')
  const page = useLoadMore(sort.sorted)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null
  const k = data.kpis

  return (
    <SalesPageShell>
      <div className="space-y-6">
        <PageHeader title="Project Delivery" subtitle={`PT. Multi Daya Mitra — plan vs actual & BAST timeliness (filtered by ${DATE_LABELS[data.dateType] || 'Due Date'})`} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Date Basis</label>
              <Select value={lDateType} onValueChange={(v) => setLDateType(v ?? 'due')}>
                <SelectTrigger className="w-full text-xs h-9 bg-background"><SelectValue>{DATE_LABELS[lDateType]}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">Due Date</SelectItem>
                  <SelectItem value="start">Start Date</SelectItem>
                  <SelectItem value="end">Actual End Date</SelectItem>
                  <SelectItem value="created">Created Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Delivery</label>
              <MultiSelect allLabel="All Delivery" selected={lDelivery} onChange={setLDelivery} options={data.filterOptions.deliveryList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Status</label>
              <MultiSelect allLabel="All Statuses" selected={lStatus} onChange={setLStatus} options={data.filterOptions.statusList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Owner</label>
              <MultiSelect allLabel="All Owners" selected={lOwner} onChange={setLOwner} options={data.filterOptions.ownerList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Type</label>
              <MultiSelect allLabel="All Types" selected={lType} onChange={setLType} options={data.filterOptions.typeList} /></div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KPICard title="Projects (in scope)" value={k.totalProjects.toLocaleString('en-US')} icon={<FolderKanban className="h-4 w-4" />} />
          <KPICard title="On-Time Delivery" value={`${k.onTimeRate}%`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} tooltip="BAST submit date on/before due date, among delivered projects." trend={{ value: `${k.onTime.toLocaleString('en-US')} / ${(k.onTime + k.overtime).toLocaleString('en-US')}`, label: 'on time', positive: true }} />
          <KPICard title="Overtime Deliveries" value={k.overtime.toLocaleString('en-US')} icon={<AlarmClock className="h-4 w-4 text-rose-500" />} tooltip="BAST submitted after the due date." />
          <KPICard title="Overdue, No BAST" value={k.overduePending.toLocaleString('en-US')} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} tooltip="Due date passed and no BAST submitted yet (silent / at risk)." />
          <KPICard title="Median Duration" value={k.medianDuration > 0 ? `${k.medianDuration}d` : '—'} icon={<Hourglass className="h-4 w-4 text-violet-500" />} tooltip={`Actual start → actual end. Based on ${k.withActualEnd.toLocaleString('en-US')} projects with resolvable actual dates.`} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Delivery Timeliness (BAST vs Due)</CardTitle></CardHeader>
            <CardContent><DonutChart data={data.deliveryBreakdown} height={260} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Project Status <span className="font-normal text-muted-foreground">(by {DATE_LABELS[data.dateType]})</span></CardTitle></CardHeader>
            <CardContent><DonutChart data={data.statusBreakdown} height={260} /></CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">New Projects per Month <span className="font-normal text-muted-foreground">(by created date)</span></CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[260px] w-full">
                <LineChart data={data.newProjectsTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" {...axis} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Line dataKey="value" name="New projects" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Delivery Lateness Distribution</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[260px] w-full">
                <BarChart data={data.latenessDist} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" {...axis} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* At-risk projects */}
        {data.atRisk.length > 0 && (
          <Card className="overflow-hidden border-amber-500/30">
            <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-500" /> At Risk — Overdue &amp; No BAST <span className="font-normal text-muted-foreground">({data.atRisk.length.toLocaleString('en-US')})</span></CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableCell className="text-xs font-medium text-muted-foreground">Project</TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">Status</TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground text-right">Due Date</TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground text-right">Days Overdue</TableCell>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.atRisk.slice(0, 30).map((r) => (
                      <TableRow key={r.prjId}>
                        <TableCell className="text-xs font-medium whitespace-normal break-words max-w-[280px]">{r.project}<span className="text-muted-foreground ml-1">({r.prjId})</span></TableCell>
                        <TableCell className="text-xs">{r.statusLabel}</TableCell>
                        <TableCell className="text-xs text-right">{fmtShortDate(r.benchmarkEnd)}</TableCell>
                        <TableCell className="text-xs text-right font-semibold text-rose-600 dark:text-rose-400">{r.daysOverdue != null ? `${r.daysOverdue}d` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery detail */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Project Delivery Detail <span className="font-normal text-muted-foreground">({rows.length.toLocaleString('en-US')})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Project" column="project" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortHead label="Status" column="statusLabel" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortHead label="Bench. Start" column="benchmarkStart" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="Actual Start" column="actualStart" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="Δ Start" column="startVariance" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="Bench. Due" column="benchmarkEnd" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="Actual End" column="actualEnd" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="BAST Submit" column="bastSubmit" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="Δ End" column="endVariance" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right" />
                  <SortHead label="Delivery" column="delivery" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                </TableRow></TableHeader>
                <TableBody>
                  {sort.sorted.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No data found</TableCell></TableRow> : page.visible.map((r) => (
                    <TableRow key={r.prjId}>
                      <TableCell className="font-medium text-xs whitespace-normal break-words max-w-[220px]">{r.project}<span className="text-muted-foreground ml-1">({r.prjId})</span></TableCell>
                      <TableCell className="text-xs">{r.statusLabel}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{fmtShortDate(r.benchmarkStart)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtShortDate(r.actualStart)}</TableCell>
                      <TableCell className="text-right text-xs"><Variance v={r.startVariance} /></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{fmtShortDate(r.benchmarkEnd)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtShortDate(r.actualEnd)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtShortDate(r.bastSubmit)}</TableCell>
                      <TableCell className="text-right text-xs"><Variance v={r.endVariance} /></TableCell>
                      <TableCell className="text-xs"><DeliveryBadge delivery={r.delivery} label={r.deliveryLabel} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={page.hasMore} shown={page.shown} total={page.total} onClick={page.loadMore} onLoadAll={page.loadAll} onCollapse={page.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
