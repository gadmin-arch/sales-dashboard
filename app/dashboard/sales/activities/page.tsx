'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { ChartPeriodToggle } from '@/components/chart-period-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
} from '@/components/ui/chart'
import { DonutChart } from '@/components/donut-chart'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Activity, CheckCircle2, Clock, AlertTriangle, ListTodo, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { ExportButton } from '@/components/export-button'
import { DateRangeRow } from '@/components/date-range-row'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { buildQuery, sameSet, getYTD, fmtCurrency } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'

interface ActivityData {
  kpis: { totalActivities: number; completionRate: number; activitiesThisWeek: number; highPriorityCount: number; doneCount: number; todoCount: number; holdCount: number; cancelCount: number }
  byType: { name: string; value: number }[]
  byStatus: { name: string; value: number }[]
  byLevel: { name: string; value: number }[]
  trend: { name: string; value: number }[]
  byUser: { name: string; userId: string; total: number; done: number; todo: number; hold: number; cancel: number; completionRate: number }[]
  funnel: { name: string; value: number }[]
  allActivities: { saId: string; description: string; type: string; level: string; status: string; userId: string; userName: string; date: string; hasLinkage: boolean }[]
  filterOptions: { types: { id: string; label: string }[]; levels: { id: string; label: string }[]; statuses: { id: string; label: string }[] }
  salesUserList: { id: string; name: string }[]
}

function sc(status: string): string {
  const m: Record<string, string> = {
    Done: 'var(--status-done)',
    'To Do': 'var(--status-todo)',
    Hold: 'var(--status-hold)',
    Cancel: 'var(--status-cancel)',
  }
  return m[status] || 'var(--muted-foreground)'
}
function lc(level: string): string {
  const m: Record<string, string> = { High: sc('Cancel'), Medium: sc('Hold'), Low: sc('Done') }
  return m[level] || 'var(--muted-foreground)'
}
function fmtDate(d: string) {
  if (!d) return ''
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  const p = new Date(d); return isNaN(p.getTime()) ? d : p.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

type ViewMode = 'calendar' | 'week' | 'list'
const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-[0_0_0.625rem_0.625rem] bg-secondary overflow-hidden ${className || ''}`}>
      <div className="h-full rounded-[0_0_0.625rem_0.625rem] transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color || 'var(--primary)' }} />
    </div>
  )
}

export default function SalesActivitiesPage() {
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'weekly'>('monthly')
  const [search, setSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('activities-list')
  const [view, setView] = useState<ViewMode>('calendar')
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() } })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [weekStart, setWeekStart] = useState(() => { const n = new Date(); return new Date(n.setDate(n.getDate() - n.getDay())) })

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  // Applied filters (multi-select)
  const [su, setSu] = useState<string[]>([]), [at, setAt] = useState<string[]>([]), [lv, setLv] = useState<string[]>([]), [st, setSt] = useState<string[]>([])
  // Draft (unapplied) filters
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lSu, setLSu] = useState<string[]>([]), [lAt, setLAt] = useState<string[]>([]), [lLv, setLLv] = useState<string[]>([]), [lSt, setLSt] = useState<string[]>([])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await globalThis.fetch('/api/sales/activities?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') }
    finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false;
    doFetch({
      dateFrom, dateTo, salesUser: su, activityType: at, level: lv, status: st, period: chartPeriod,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, su, at, lv, st, chartPeriod, chartFilter])
  const onPeriod = (p: 'monthly' | 'weekly') => { setChartPeriod(p) }
  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setSu(lSu); setAt(lAt); setLv(lLv); setSt(lSt) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLSu([]); setLAt([]); setLLv([]); setLSt([]); setDateFrom(d.from); setDateTo(d.to); setSu([]); setAt([]); setLv([]); setSt([]); setChartFilter(null) }

  const parseDate = (d: string): Date | null => {
    if (!d) return null
    const s = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (s) return new Date(+s[3], +s[1] - 1, +s[2])
    const p = new Date(d); return isNaN(p.getTime()) ? null : p
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let a = data.allActivities
    if (search) { const q = search.toLowerCase(); a = a.filter(x => x.description.toLowerCase().includes(q) || x.type.toLowerCase().includes(q) || x.userName.toLowerCase().includes(q) || x.status.toLowerCase().includes(q)) }
    return a
  }, [data, search])

  const actSort = useSort(filtered, 'date', 'desc')
  const actPage = useLoadMore(actSort.sorted)

  const byDate = useMemo(() => {
    const m = new Map<string, typeof filtered>()
    for (const a of filtered) {
      const d = parseDate(a.date)
      if (!d) continue
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(a)
    }
    return m
  }, [filtered])

  const toggleExpand = (key: string) => { setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }) }

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const firstDayOfWeek = (y: number, m: number) => new Date(y, m, 1).getDay()
  const prevMonth = () => setCalMonth(p => p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })
  const nextMonth = () => setCalMonth(p => p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })
  const goToday = () => { const n = new Date(); setCalMonth({ y: n.getFullYear(), m: n.getMonth() }) }
  const monthName = new Date(calMonth.y, calMonth.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalDays = daysInMonth(calMonth.y, calMonth.m)
  const startDay = firstDayOfWeek(calMonth.y, calMonth.m)
  const today = new Date()
  const isTodayDay = (day: number) => today.getFullYear() === calMonth.y && today.getMonth() === calMonth.m && today.getDate() === day

  const prevWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  const nextWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
  const thisWeek = () => { const n = new Date(); setWeekStart(new Date(n.setDate(n.getDate() - n.getDay()))) }
  const weekDays = useMemo(() => {
    const result: { date: Date; key: string; label: string; dayNum: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      result.push({ date: d, key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: String(d.getDate()) })
    }
    return result
  }, [weekStart])
  const isTodayWeekDay = (d: Date) => d.toDateString() === today.toDateString()

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const trendConfig = { activities: { label: 'Activities', color: 'var(--primary)' } }
  const byTypeConfig = Object.fromEntries(['Call', 'Visit', 'Online Meeting', 'Offline Meeting', 'Office', 'Others'].map((label, i) => [`t${i}`, { label, color: PIE_COLORS[i % 5] }]))
  const byStatusConfig = Object.fromEntries(['Done', 'To Do', 'Hold', 'Cancel'].map((label, i) => [`s${i}`, { label, color: PIE_COLORS[i % 5] }]))
  const byLevelConfig = Object.fromEntries(['High', 'Medium', 'Low'].map((label, i) => [`l${i}`, { label, color: PIE_COLORS[i % 5] }]))

  const thClass = "text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight">Sales Activities</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p></div>
            {chartFilter && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
                <span className="text-muted-foreground">Filtered by:</span> {chartFilter.label}
                <button onClick={() => setChartFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5"><div className="h-4 w-4 flex items-center justify-center">✕</div></button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton data={filtered} filename="sales-activities.csv" />
            <ThemeToggle />
          </div>
        </div>

        {/* Filters */}
        <Card><CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sales Person</label>
              <MultiSelect allLabel="All Sales Persons" selected={lSu} onChange={setLSu}
                options={data.salesUserList.map(u => ({ value: u.id, label: u.name }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Activity Type</label>
              <MultiSelect allLabel="All Types" selected={lAt} onChange={setLAt}
                options={data.filterOptions.types.map(t => ({ value: t.label, label: t.label }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Level</label>
              <MultiSelect allLabel="All Levels" selected={lLv} onChange={setLLv}
                options={data.filterOptions.levels.map(l => ({ value: l.label, label: l.label }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Status</label>
              <MultiSelect allLabel="All Statuses" selected={lSt} onChange={setLSt}
                options={data.filterOptions.statuses.map(s => ({ value: s.label, label: s.label }))} />
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">
              Apply Filters
              {(lFrom !== dateFrom || lTo !== dateTo || !sameSet(lSu, su) || !sameSet(lAt, at) || !sameSet(lLv, lv) || !sameSet(lSt, st)) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
            </Button>
          </div>
          {loading && data && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Activities" value={data.kpis.totalActivities.toString()} icon={<Activity className="h-4 w-4" />} />
          <KPICard title="Completion Rate" value={`${data.kpis.completionRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} />
          <KPICard title="This Week" value={data.kpis.activitiesThisWeek.toString()} icon={<Clock className="h-4 w-4" />} />
          <KPICard title="High Priority" value={data.kpis.highPriorityCount.toString()} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.funnel.map(f => (
            <Card key={f.name}><CardContent className="py-4"><p className="text-xs font-medium text-muted-foreground">{f.name}</p><p className="mt-1 text-xl font-bold" style={{ color: sc(f.name) }}>{f.value}</p></CardContent></Card>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-semibold">Activity Trend</CardTitle><ChartPeriodToggle period={chartPeriod} onPeriodChange={onPeriod} /></CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="h-[260px] w-full">
                <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs><linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-activities)" stopOpacity={0.25}/><stop offset="95%" stopColor="var(--color-activities)" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="value" stroke="var(--color-activities)" fillOpacity={1} fill="url(#gAct)" onClick={(d: any) => handleChartClick('actMonth', d.name, `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">By Type</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.byType} height={260} onSliceClick={(name) => handleChartClick('type', name, `Type = ${name}`)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">By Status</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.byStatus} height={260} onSliceClick={(name) => handleChartClick('status', name, `Status = ${name}`)} />
            </CardContent>
          </Card>
        </div>

        {/* Priority + Top Persons */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">By Priority Level</CardTitle></CardHeader><CardContent>
            <ChartContainer config={byLevelConfig} className="h-[240px] w-full">
              <BarChart data={data.byLevel} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" /><YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Count" onClick={(d: any) => handleChartClick('level', d.name, `Level = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-sm font-semibold">Top Sales Persons by Activity</CardTitle></CardHeader><CardContent className="space-y-3">
            {data.byUser.length === 0 ? <p className="text-center text-muted-foreground py-6">No data</p> : data.byUser.map((u, i) => {
              const maxTotal = data.byUser[0]?.total || 1, pct = (u.total / maxTotal) * 100
              return (
                <div key={u.userId} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">{u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{u.name}</p><p className="text-xs text-muted-foreground">{u.total} activities · {u.done} done · {u.completionRate}% completion</p><Progress value={pct} className="mt-1" /></div>
                  <div className="text-sm font-bold shrink-0">{u.total}</div>
                </div>
              )
            })}
          </CardContent></Card>
        </div>

        {/* View Toggle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" id="activities-list">
          <h2 className="text-lg font-semibold">Activities {search && <span className="text-sm font-normal text-muted-foreground">({filtered.length} results)</span>}</h2>
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search activities..." />
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {([['calendar', CalendarDays, 'Month'], ['week', CalendarDays, 'Week'], ['list', ListTodo, 'List']] as const).map(([mode, Icon, label]) => (
                <button key={mode} onClick={() => setView(mode)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${view === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}><Icon className="h-3.5 w-3.5" /> {label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar View */}
        {view === 'calendar' && (
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2"><Button variant="outline" size="icon-xs" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button><h3 className="text-sm font-semibold min-w-[150px] text-center">{monthName}</h3><Button variant="outline" size="icon-xs" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button></div>
            <Button variant="outline" size="xs" onClick={goToday}>Today</Button>
          </CardHeader><CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border bg-muted/5" />)}
              {Array.from({ length: totalDays }).map((_, idx) => {
                const day = idx + 1
                const dayKey = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayActs = byDate.get(dayKey) || []
                const isOpen = expanded.has(dayKey)
                const visActs = isOpen ? dayActs : dayActs.slice(0, 3)
                return (
                  <div key={day} className={`border-b border-r border-border p-1.5 flex flex-col ${isTodayDay(day) ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className={`text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full ${isTodayDay(day) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{day}</div>
                      {dayActs.length > 3 && <button onClick={() => toggleExpand(dayKey)} className="text-muted-foreground hover:text-foreground">{isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>}
                    </div>
                    <div className="space-y-0.5 flex-1 overflow-hidden">
                      {visActs.map(a => <div key={a.saId} className="text-[9px] leading-tight truncate rounded px-1 py-0.5" style={{ background: sc(a.status) + '12', color: sc(a.status), boxShadow: `inset 0 0 0 1px hsl(${sc(a.status)})` }}>{a.description}</div>)}
                      {!isOpen && dayActs.length > 3 && <button onClick={() => toggleExpand(dayKey)} className="text-[9px] text-muted-foreground font-medium px-1 hover:text-foreground">+{dayActs.length - 3} more</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent></Card>
        )}

        {/* Week View */}
        {view === 'week' && (
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2"><Button variant="outline" size="icon-xs" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button><h3 className="text-sm font-semibold min-w-[200px] text-center">{weekDays[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</h3><Button variant="outline" size="icon-xs" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button></div>
            <Button variant="outline" size="xs" onClick={thisWeek}>This Week</Button>
          </CardHeader><CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border">{weekDays.map(d => <div key={d.key} className={`py-2 text-center ${isTodayWeekDay(d.date) ? 'bg-primary/5' : ''}`}><div className="text-[10px] font-medium text-muted-foreground uppercase">{d.label}</div><div className={`text-sm font-semibold mt-0.5 ${isTodayWeekDay(d.date) ? 'text-primary' : 'text-foreground'}`}>{d.dayNum}</div></div>)}</div>
            <div className="grid grid-cols-7 min-h-[400px]">
              {weekDays.map(d => {
                const dayActs = byDate.get(d.key) || []
                return (
                  <div key={d.key} className={`border-b border-r border-border p-2 flex flex-col ${isTodayWeekDay(d.date) ? 'bg-primary/5' : ''}`}>
                    <div className="space-y-1 flex-1 overflow-y-auto">
                      {dayActs.map(a => (
                        <div key={a.saId} className="rounded-lg p-2" style={{ background: sc(a.status) + '08', boxShadow: `inset 0 0 0 1px hsl(${sc(a.status)})` }}>
                          <p className="text-[10px] font-medium leading-tight truncate">{a.description}</p>
                          <div className="flex items-center gap-1.5 mt-1"><span className="text-[9px] text-muted-foreground">{a.type}</span><span className="text-[9px] font-medium" style={{ color: sc(a.status) }}>{a.status}</span></div>
                          <div className="flex items-center gap-1 mt-1"><div className="h-3.5 w-3.5 rounded-full bg-primary/10 text-primary text-[7px] font-semibold flex items-center justify-center">{a.userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div><span className="text-[9px] text-muted-foreground truncate">{a.userName}</span></div>
                        </div>
                      ))}
                      {dayActs.length === 0 && <p className="text-[10px] text-muted-foreground/40 text-center mt-4">No activities</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent></Card>
        )}

        {/* List View */}
        {view === 'list' && (
          <Card className="overflow-hidden"><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <SortHead label="Date" column="date" sortKey={actSort.sortKey} sortDir={actSort.sortDir} onSort={actSort.toggle} />
                <SortHead label="Description" column="description" sortKey={actSort.sortKey} sortDir={actSort.sortDir} onSort={actSort.toggle} />
                <SortHead label="Type" column="type" sortKey={actSort.sortKey} sortDir={actSort.sortDir} onSort={actSort.toggle} />
                <SortHead label="Level" column="level" sortKey={actSort.sortKey} sortDir={actSort.sortDir} onSort={actSort.toggle} />
                <SortHead label="Status" column="status" sortKey={actSort.sortKey} sortDir={actSort.sortDir} onSort={actSort.toggle} />
                <SortHead label="Sales Person" column="userName" sortKey={actSort.sortKey} sortDir={actSort.sortDir} onSort={actSort.toggle} />
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No activities found</TableCell></TableRow> : actPage.visible.map(a => (
                  <TableRow key={a.saId}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">{fmtDate(a.date)}</TableCell>
                    <TableCell className="max-w-[250px] truncate" title={a.description}><span className="flex items-center gap-1.5">{a.description}{a.hasLinkage && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}</span></TableCell>
                    <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium border border-border bg-muted text-muted-foreground">{a.type}</span></TableCell>
                    <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium border" style={{ color: lc(a.level), borderColor: lc(a.level) + '40', background: lc(a.level) + '12' }}>{a.level}</span></TableCell>
                    <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium border" style={{ color: sc(a.status), borderColor: sc(a.status) + '40', background: sc(a.status) + '12' }}>{a.status}</span></TableCell>
                    <TableCell><div className="flex items-center gap-2"><div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[8px] font-semibold flex items-center justify-center">{a.userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div><span className="truncate">{a.userName}</span></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <LoadMore hasMore={actPage.hasMore} shown={actPage.shown} total={actPage.total} onClick={actPage.loadMore} onLoadAll={actPage.loadAll} onCollapse={actPage.collapse} />
          </CardContent></Card>
        )}
      </div>
    </SalesPageShell>
  )
}
