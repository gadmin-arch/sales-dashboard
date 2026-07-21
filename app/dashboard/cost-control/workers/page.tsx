'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Clock, Users, Timer, Star, CalendarCheck, Briefcase, X, ArrowLeft, Coins } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { DonutChart } from '@/components/donut-chart'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { ComposedChart, Bar, Line, BarChart, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { buildQuery, sameSet, getYTD, fmtCurrency } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'
import Link from 'next/link'
import { ExportButton } from '@/components/export-button'

interface Option { value: string; label: string }
interface WorkerRow {
  userId: string; worker: string; reports: number; hours: number; overtime: number
  uniqueDays: number; avgDelayHours: number; sameDayPct: number; avgScore: number
  uniqueProjectsCount: number; overdueProjectsCount: number; overdueProjectsPct: number
  totalOrderNominal: number
  projectsWorked: Array<{ 
    projectId: string; project: string; 
    plannedStart: string; plannedEnd: string;
    actualStart: string; actualEnd: string;
    overdueStatus: string; isOverdue: boolean; overdueDays: number
    orderNominal: number
  }>
}
interface ProjectRow {
  projectId: string; project: string; hours: number; overtime: number
  reports: number; workers: number; latestProgress: number | null
  plannedStart: string; plannedEnd: string
  actualStart: string; actualEnd: string
  overdueStatus: string; isOverdue: boolean; overdueDays: number
  orderNominal?: number
}
interface ReportsData {
  kpis: { 
    totalReports: number; totalHours: number; totalOvertime: number; 
    activeWorkers: number; avgDelayHours: number; medianDelayHours: number; 
    sameDayRate: number; avgScore: number; uniqueProjects: number;
    overdueProjectsPct: number; overdueProjectsCount: number;
  }
  scoreBreakdown: { name: string; value: number }[]
  monthlyTrend: { name: string; reports: number; hours: number }[]
  topWorkers: { name: string; value: number }[]
  projectStatusMix: { name: string; value: number }[]
  timeStatusSchedule: { name: string; value: number }[]
  timeStatusWorker: { name: string; value: number }[]
  workers: WorkerRow[]
  projectHours: ProjectRow[]
  filterOptions: { workerList: Option[]; projectList: Option[]; userSiteList?: Option[]; jobStatusList?: Option[]; orderTypeList?: Option[] }
}

const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
const fmtDelay = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)}d` : `${Math.round(h)}h`)

export default function CostControlWorkerKPIsPage() {
  const firstLoad = useRef(true)
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [projSearch, setProjSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('worker-table-section')
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(null)

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [dateType, setDateType] = useState('report')
  const [worker, setWorker] = useState<string[]>([]), [project, setProject] = useState<string[]>([])
  const [userSite, setUserSite] = useState<string[]>([])
  const [jobStatus, setJobStatus] = useState<string[]>([])
  const [orderType, setOrderType] = useState<string[]>([])
  const [overdueMethod, setOverdueMethod] = useState<'project' | 'worker'>('project')

  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lDateType, setLDateType] = useState('report')
  const [lWorker, setLWorker] = useState<string[]>([]), [lProject, setLProject] = useState<string[]>([])
  const [lUserSite, setLUserSite] = useState<string[]>([])
  const [lJobStatus, setLJobStatus] = useState<string[]>([])
  const [lOrderType, setLOrderType] = useState<string[]>([])

  const doFetch = useCallback(async (params: any) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/cost-control/workers?${buildQuery(params)}`)
      if (!res.ok) throw new Error('Failed to load worker KPIs')
      setData(await res.json()); setError(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({
      dateFrom, dateTo, dateType, worker, project, userSite, jobStatus, orderType, overdueMethod,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {}),
    })
  }, [doFetch, dateFrom, dateTo, dateType, worker, project, userSite, jobStatus, orderType, overdueMethod, chartFilter])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setDateType(lDateType); setWorker(lWorker); setProject(lProject); setUserSite(lUserSite); setJobStatus(lJobStatus); setOrderType(lOrderType) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLDateType('report'); setLWorker([]); setLProject([]); setLUserSite([]); setLJobStatus([]); setLOrderType([])
    setDateFrom(d.from); setDateTo(d.to); setDateType('report'); setWorker([]); setProject([]); setUserSite([]); setJobStatus([]); setOrderType([]); setOverdueMethod('project'); setChartFilter(null)
  }
  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || lDateType !== dateType || !sameSet(lWorker, worker) || !sameSet(lProject, project) || !sameSet(lUserSite, userSite) || !sameSet(lJobStatus, jobStatus) || !sameSet(lOrderType, orderType)

  const workerRows = useMemo(() => {
    const raw = data?.workers ?? []
    if (!search) return raw
    const q = search.toLowerCase()
    return raw.filter((r) => r.worker.toLowerCase().includes(q) || r.userId.toLowerCase().includes(q))
  }, [data, search])
  const projectRows = useMemo(() => {
    const raw = data?.projectHours ?? []
    if (!projSearch) return raw
    const q = projSearch.toLowerCase()
    return raw.filter((r) => r.project.toLowerCase().includes(q) || r.projectId.toLowerCase().includes(q))
  }, [data, projSearch])

  const wSort = useSort(workerRows, 'hours', 'desc')
  const wPage = useLoadMore(wSort.sorted)

  const avgRow = useMemo(() => {
    const list = wSort.sorted
    if (!list.length) return null
    const len = list.length
    return {
      uniqueProjectsCount: Math.round(list.reduce((sum, w) => sum + w.uniqueProjectsCount, 0) / len * 10) / 10,
      overdueProjectsCount: Math.round(list.reduce((sum, w) => sum + w.overdueProjectsCount, 0) / len * 10) / 10,
      overdueProjectsPct: Math.round(list.reduce((sum, w) => sum + w.overdueProjectsPct, 0) / len * 10) / 10,
      reports: Math.round(list.reduce((sum, w) => sum + w.reports, 0) / len * 10) / 10,
      hours: Math.round(list.reduce((sum, w) => sum + w.hours, 0) / len * 10) / 10,
      overtime: Math.round(list.reduce((sum, w) => sum + w.overtime, 0) / len * 10) / 10,
      uniqueDays: Math.round(list.reduce((sum, w) => sum + w.uniqueDays, 0) / len * 10) / 10,
      avgDelayHours: list.reduce((sum, w) => sum + w.avgDelayHours, 0) / len,
      sameDayPct: Math.round(list.reduce((sum, w) => sum + w.sameDayPct, 0) / len * 10) / 10,
      avgScore: list.reduce((sum, w) => sum + w.avgScore, 0) / len,
      totalOrderNominal: Math.round(list.reduce((sum, w) => sum + w.totalOrderNominal, 0) / len)
    }
  }, [wSort.sorted])

  const pSort = useSort(projectRows, 'hours', 'desc')
  const pPage = useLoadMore(pSort.sorted)

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null
  const k = data.kpis

  // Summary order value metric
  const overallOrderNominalSum = data.projectHours.reduce((acc, p) => acc + (p.orderNominal || 0), 0)

  return (
    <SalesPageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/cost-control"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <PageHeader 
            title="Worker KPIs & Order Monitoring" 
            subtitle="Cost Control — Analisis kinerja worker disandingkan dengan total nominal order pekerjaan" breadcrumbs={[{ label: 'Cost Control' }, { label: 'Worker KPIs' }]} 
            chartFilter={chartFilter} 
            onClearFilter={() => setChartFilter(null)} 
          />
        </div>

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Date Basis</label>
              <Select value={lDateType} onValueChange={(v) => setLDateType(v ?? 'report')}>
                <SelectTrigger className="w-full text-xs h-9 bg-background"><SelectValue>{lDateType === 'created' ? 'Submitted Date' : 'Report Date'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="report">Report Date</SelectItem>
                  <SelectItem value="created">Submitted Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Worker</label>
              <MultiSelect allLabel="All Workers" selected={lWorker} onChange={setLWorker} options={data.filterOptions.workerList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project</label>
              <MultiSelect allLabel="All Projects" selected={lProject} onChange={setLProject} options={data.filterOptions.projectList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">User Site</label>
              <MultiSelect allLabel="All Sites" selected={lUserSite} onChange={setLUserSite} options={data.filterOptions.userSiteList || []} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Job Status</label>
              <MultiSelect allLabel="All Job Statuses" selected={lJobStatus} onChange={setLJobStatus} options={data.filterOptions.jobStatusList || []} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Type</label>
              <MultiSelect allLabel="All Project Types" selected={lOrderType} onChange={setLOrderType} options={data.filterOptions.orderTypeList || []} /></div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KPICard title="Total Reports" value={k.totalReports.toLocaleString('en-US')} icon={<FileText className="h-4 w-4" />} />
          <KPICard title="Total Hours" value={`${k.totalHours.toLocaleString('en-US')}h`} icon={<Clock className="h-4 w-4 text-sky-500" />} trend={{ value: `${k.totalOvertime.toLocaleString('en-US')}h OT`, label: 'overtime', positive: false }} />
          <KPICard title="Active Workers" value={k.activeWorkers.toLocaleString('en-US')} icon={<Users className="h-4 w-4 text-violet-500" />} />
          <KPICard title="Unique Projects" value={k.uniqueProjects.toLocaleString('en-US')} icon={<Briefcase className="h-4 w-4 text-indigo-500" />} trend={{ value: `${k.overdueProjectsPct}% Overdue`, label: `(${k.overdueProjectsCount} projs)`, positive: false }} />
          <KPICard title="Avg. Reporting Delay" value={fmtDelay(k.avgDelayHours)} icon={<Timer className="h-4 w-4 text-amber-500" />} tooltip="Time from end of the report day to when it was submitted." trend={{ value: `${k.sameDayRate}%`, label: 'same-day', positive: true }} />
          <KPICard title="Total Value Handled" value={fmtRp(overallOrderNominalSum)} icon={<Coins className="h-4 w-4 text-emerald-500" />} tooltip="Total PO Nominal values of all projects being worked on by active workers in this period." />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm font-semibold">Reports &amp; Hours per Month</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{ hours: { label: 'Hours', color: 'var(--chart-1)' }, reports: { label: 'Reports', color: 'var(--chart-2)' } }} className="h-[280px] w-full">
                <ComposedChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" {...axis} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis yAxisId="left" {...axis} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" {...axis} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar yAxisId="left" dataKey="hours" fill="var(--color-hours)" radius={[4, 4, 0, 0]} onClick={(d: any) => handleChartClick('month', String(d.name ?? ''), `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                  <Line yAxisId="right" dataKey="reports" stroke="var(--color-reports)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Discipline Score Mix</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.scoreBreakdown} height={280} onSliceClick={(name) => handleChartClick('score', name, `Score = ${name}`)} />
            </CardContent>
          </Card>
        </div>

        {/* Worker leaderboard */}
        <Card className="overflow-hidden" id="worker-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <CardTitle className="text-sm font-semibold flex flex-wrap items-center gap-2">
                Worker Cost &amp; KPI Leaderboard <span className="font-normal text-muted-foreground">({workerRows.length.toLocaleString('en-US')})</span>
              </CardTitle>
              <div className="flex bg-muted p-0.5 rounded-lg w-fit text-[10px] border">
                <button
                  onClick={() => setOverdueMethod('project')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${overdueMethod === 'project' ? 'bg-background font-semibold shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Project Schedule
                </button>
                <button
                  onClick={() => setOverdueMethod('worker')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${overdueMethod === 'worker' ? 'bg-background font-semibold shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Worker Log Dates
                </button>
              </div>
            </div>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Worker" column="worker" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} />
                  <SortHead label="Projects" column="uniqueProjectsCount" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-center w-[100px]" />
                  <SortHead label="Total PO nominal value" column="totalOrderNominal" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right w-[160px]" />
                  <SortHead label="Overdue Projs" column="overdueProjectsCount" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-center w-[100px]" />
                  <SortHead label="Overdue %" column="overdueProjectsPct" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-center w-[100px]" />
                  <SortHead label="Reports" column="reports" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Hours" column="hours" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Overtime" column="overtime" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Unique Days" column="uniqueDays" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Avg Delay" column="avgDelayHours" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Same-day %" column="sameDayPct" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Score" column="avgScore" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {wSort.sorted.length === 0 ? <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No data found</TableCell></TableRow> : wPage.visible.map((w) => (
                    <TableRow 
                      key={w.userId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedWorker(w)}
                    >
                      <TableCell className="font-medium text-xs py-2.5">
                        <div className="font-semibold text-foreground">{w.worker}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{w.userId}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/5 text-primary border border-primary/10 rounded-md text-xs font-semibold font-mono">
                          <Briefcase className="h-3 w-3 text-primary/70" />
                          {w.uniqueProjectsCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-foreground font-mono">
                        {fmtRp(w.totalOrderNominal)}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {w.overdueProjectsCount > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md text-xs">
                            {w.overdueProjectsCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {w.overdueProjectsPct > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {w.overdueProjectsPct}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{w.reports.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right text-xs font-semibold text-primary">{w.hours.toLocaleString('en-US')}h</TableCell>
                      <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">{w.overtime.toLocaleString('en-US')}h</TableCell>
                      <TableCell className="text-right text-xs">{w.uniqueDays.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right text-xs">{fmtDelay(w.avgDelayHours)}</TableCell>
                      <TableCell className="text-right text-xs">{w.sameDayPct}%</TableCell>
                      <TableCell className="text-right text-xs font-semibold"><ScoreBadge score={w.avgScore} /></TableCell>
                    </TableRow>
                  ))}
                  {wSort.sorted.length > 0 && avgRow && (
                    <TableRow className="bg-muted/40 font-semibold border-t hover:bg-muted/50 transition-colors">
                      <TableCell className="font-bold text-xs py-2.5 text-foreground">
                        Average
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/5 text-primary border border-primary/10 rounded-md text-xs font-semibold font-mono">
                          {avgRow.uniqueProjectsCount.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-foreground font-mono">
                        {fmtRp(avgRow.totalOrderNominal)}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {avgRow.overdueProjectsCount > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md text-xs">
                            {avgRow.overdueProjectsCount.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {avgRow.overdueProjectsPct > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {avgRow.overdueProjectsPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{avgRow.reports.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs font-semibold text-primary">{avgRow.hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">{avgRow.overtime.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-xs">{avgRow.uniqueDays.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtDelay(avgRow.avgDelayHours)}</TableCell>
                      <TableCell className="text-right text-xs">{avgRow.sameDayPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-xs font-semibold"><ScoreBadge score={avgRow.avgScore} /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={wPage.hasMore} shown={wPage.shown} total={wPage.total} onClick={wPage.loadMore} onLoadAll={wPage.loadAll} onCollapse={wPage.collapse} />
          </CardContent>
        </Card>

        {/* Worker Projects Modal */}
        {selectedWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border shadow-2xl rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Projects Worked by {selectedWorker.worker}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    User ID: {selectedWorker.userId} • Total Unique Projects: {selectedWorker.uniqueProjectsCount} • Total Order Value: {fmtRp(selectedWorker.totalOrderNominal)}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedWorker(null)} 
                  className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Table */}
              <div className="p-6 overflow-y-auto flex-1">
                {selectedWorker.projectsWorked && selectedWorker.projectsWorked.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden bg-card">
                    <Table className="text-xs">
                      <TableHeader className="bg-muted/40 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="py-2.5">Project Name & ID</TableHead>
                          <TableHead className="py-2.5 text-right">PO Nominal Value</TableHead>
                          <TableHead className="py-2.5">Schedule (Plan)</TableHead>
                          <TableHead className="py-2.5">Schedule (Actual/Log)</TableHead>
                          <TableHead className="py-2.5 text-right">Schedule Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedWorker.projectsWorked.map((pw) => (
                          <TableRow key={pw.projectId} className="hover:bg-muted/30">
                            <TableCell className="py-2.5 font-medium whitespace-normal break-words max-w-[240px]">
                              <div className="font-semibold text-foreground">{pw.project}</div>
                              <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">{pw.projectId}</div>
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-foreground font-mono">
                              {fmtRp(pw.orderNominal)}
                            </TableCell>
                            <TableCell className="py-2.5 text-left whitespace-nowrap">
                              {pw.plannedStart || pw.plannedEnd ? (
                                <div className="flex flex-col text-[10px] leading-tight">
                                  <span className="text-muted-foreground">{pw.plannedStart || '-'}</span>
                                  <span className="font-semibold text-foreground mt-0.5">{pw.plannedEnd || '-'}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-left whitespace-nowrap">
                              {pw.actualStart || pw.actualEnd ? (
                                <div className="flex flex-col text-[10px] leading-tight">
                                  <span className="text-muted-foreground">{pw.actualStart || '-'}</span>
                                  <span className="font-semibold text-foreground mt-0.5">{pw.actualEnd || '-'}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
                                pw.overdueStatus.startsWith('Overdue') 
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                                  : pw.overdueStatus === 'On Time' || pw.overdueStatus === 'On Track'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {pw.overdueStatus} {pw.isOverdue && pw.overdueDays > 0 ? `(${pw.overdueDays}d)` : ''}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl bg-muted/10 text-sm">
                    No projects found for this worker
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t bg-muted/20 flex justify-end">
                <button
                  onClick={() => setSelectedWorker(null)}
                  className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-xs font-semibold transition-colors"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SalesPageShell>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 3.5 ? 'text-emerald-600 dark:text-emerald-400' : score >= 2.5 ? 'text-sky-600 dark:text-sky-400' : score >= 1.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
  return <span className={tone}>{score.toFixed(2)}</span>
}
