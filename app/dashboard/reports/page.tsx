'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Clock, Users, Timer, Star, CalendarCheck } from 'lucide-react'
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
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { ComposedChart, Bar, Line, BarChart, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'

interface Option { value: string; label: string }
interface WorkerRow {
  userId: string; worker: string; reports: number; hours: number; overtime: number
  uniqueDays: number; avgDelayHours: number; sameDayPct: number; avgScore: number
}
interface ProjectRow {
  projectId: string; project: string; hours: number; overtime: number
  reports: number; workers: number; latestProgress: number | null
}
interface ReportsData {
  kpis: { totalReports: number; totalHours: number; totalOvertime: number; activeWorkers: number; avgDelayHours: number; medianDelayHours: number; sameDayRate: number; avgScore: number }
  scoreBreakdown: { name: string; value: number }[]
  monthlyTrend: { name: string; reports: number; hours: number }[]
  topWorkers: { name: string; value: number }[]
  workers: WorkerRow[]
  projectHours: ProjectRow[]
  filterOptions: { workerList: Option[]; projectList: Option[] }
}

const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
const fmtDelay = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)}d` : `${Math.round(h)}h`)

export default function WorkerReportsPage() {
  const firstLoad = useRef(true)
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [projSearch, setProjSearch] = useState('')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [dateType, setDateType] = useState('report')
  const [worker, setWorker] = useState<string[]>([]), [project, setProject] = useState<string[]>([])

  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lDateType, setLDateType] = useState('report')
  const [lWorker, setLWorker] = useState<string[]>([]), [lProject, setLProject] = useState<string[]>([])

  const doFetch = useCallback(async (params: any) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reports?${buildQuery(params)}`)
      if (!res.ok) throw new Error('Failed to load worker reports')
      setData(await res.json()); setError(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({ dateFrom, dateTo, dateType, worker, project, ...(fresh ? { fresh: '1' } : {}) })
  }, [doFetch, dateFrom, dateTo, dateType, worker, project])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setDateType(lDateType); setWorker(lWorker); setProject(lProject) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLDateType('report'); setLWorker([]); setLProject([])
    setDateFrom(d.from); setDateTo(d.to); setDateType('report'); setWorker([]); setProject([])
  }
  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || lDateType !== dateType || !sameSet(lWorker, worker) || !sameSet(lProject, project)

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
  const pSort = useSort(projectRows, 'hours', 'desc')
  const pPage = useLoadMore(pSort.sorted)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null
  const k = data.kpis

  return (
    <SalesPageShell>
      <div className="space-y-6">
        <PageHeader title="Worker Reports" subtitle="PT. Multi Daya Mitra — field & site daily reports" />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
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
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KPICard title="Total Reports" value={k.totalReports.toLocaleString('en-US')} icon={<FileText className="h-4 w-4" />} />
          <KPICard title="Total Hours" value={`${k.totalHours.toLocaleString('en-US')}h`} icon={<Clock className="h-4 w-4 text-sky-500" />} trend={{ value: `${k.totalOvertime.toLocaleString('en-US')}h OT`, label: 'overtime', positive: false }} />
          <KPICard title="Active Workers" value={k.activeWorkers.toLocaleString('en-US')} icon={<Users className="h-4 w-4 text-violet-500" />} />
          <KPICard title="Avg. Reporting Delay" value={fmtDelay(k.avgDelayHours)} icon={<Timer className="h-4 w-4 text-amber-500" />} tooltip="Time from end of the report day to when it was submitted. Floored at 0 (same-day = 0)." trend={{ value: `${k.sameDayRate}%`, label: 'same-day', positive: true }} />
          <KPICard title="Avg. Discipline Score" value={`${k.avgScore.toFixed(2)} / 4`} icon={<Star className="h-4 w-4 text-emerald-500" />} tooltip="From reporting delay: ≤2d=4, 2–7d=3, 7–30d=2, >30d=1." />
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
                  <Bar yAxisId="left" dataKey="hours" fill="var(--color-hours)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" dataKey="reports" stroke="var(--color-reports)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Discipline Score Mix</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.scoreBreakdown} height={280} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Top Workers by Hours</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={data.topWorkers} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} width={130} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${Number(v).toLocaleString('en-US')}h`, 'Hours']} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Worker leaderboard */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Worker Leaderboard <span className="font-normal text-muted-foreground">({workerRows.length.toLocaleString('en-US')})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Worker" column="worker" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} />
                  <SortHead label="Reports" column="reports" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Hours" column="hours" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Overtime" column="overtime" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Unique Days" column="uniqueDays" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Avg Delay" column="avgDelayHours" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Same-day %" column="sameDayPct" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                  <SortHead label="Score" column="avgScore" sortKey={wSort.sortKey} sortDir={wSort.sortDir} onSort={wSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {wSort.sorted.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data found</TableCell></TableRow> : wPage.visible.map((w) => (
                    <TableRow key={w.userId}>
                      <TableCell className="font-medium text-xs">{w.worker}<span className="text-muted-foreground ml-1">({w.userId})</span></TableCell>
                      <TableCell className="text-right text-xs">{w.reports.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right text-xs font-semibold text-primary">{w.hours.toLocaleString('en-US')}h</TableCell>
                      <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">{w.overtime.toLocaleString('en-US')}h</TableCell>
                      <TableCell className="text-right text-xs">{w.uniqueDays.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right text-xs">{fmtDelay(w.avgDelayHours)}</TableCell>
                      <TableCell className="text-right text-xs">{w.sameDayPct}%</TableCell>
                      <TableCell className="text-right text-xs font-semibold"><ScoreBadge score={w.avgScore} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={wPage.hasMore} shown={wPage.shown} total={wPage.total} onClick={wPage.loadMore} onLoadAll={wPage.loadAll} onCollapse={wPage.collapse} />
          </CardContent>
        </Card>

        {/* Hours per project (reports × orders) */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><CalendarCheck className="h-4 w-4 text-muted-foreground" /> Hours per Project <span className="font-normal text-muted-foreground">({projectRows.length.toLocaleString('en-US')})</span></CardTitle>
            <SearchInput value={projSearch} onChange={setProjSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Project" column="project" sortKey={pSort.sortKey} sortDir={pSort.sortDir} onSort={pSort.toggle} />
                  <SortHead label="Hours" column="hours" sortKey={pSort.sortKey} sortDir={pSort.sortDir} onSort={pSort.toggle} className="text-right" />
                  <SortHead label="Overtime" column="overtime" sortKey={pSort.sortKey} sortDir={pSort.sortDir} onSort={pSort.toggle} className="text-right" />
                  <SortHead label="Reports" column="reports" sortKey={pSort.sortKey} sortDir={pSort.sortDir} onSort={pSort.toggle} className="text-right" />
                  <SortHead label="Workers" column="workers" sortKey={pSort.sortKey} sortDir={pSort.sortDir} onSort={pSort.toggle} className="text-right" />
                  <SortHead label="Latest Progress" column="latestProgress" sortKey={pSort.sortKey} sortDir={pSort.sortDir} onSort={pSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {pSort.sorted.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data found</TableCell></TableRow> : pPage.visible.map((p) => (
                    <TableRow key={p.projectId}>
                      <TableCell className="font-medium text-xs whitespace-normal break-words max-w-[240px]">{p.project}<span className="text-muted-foreground ml-1">({p.projectId})</span></TableCell>
                      <TableCell className="text-right text-xs font-semibold text-primary">{p.hours.toLocaleString('en-US')}h</TableCell>
                      <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">{p.overtime.toLocaleString('en-US')}h</TableCell>
                      <TableCell className="text-right text-xs">{p.reports.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right text-xs">{p.workers.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right text-xs">{p.latestProgress != null ? `${p.latestProgress}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={pPage.hasMore} shown={pPage.shown} total={pPage.total} onClick={pPage.loadMore} onLoadAll={pPage.loadAll} onCollapse={pPage.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 3.5 ? 'text-emerald-600 dark:text-emerald-400' : score >= 2.5 ? 'text-sky-600 dark:text-sky-400' : score >= 1.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
  return <span className={tone}>{score.toFixed(2)}</span>
}
