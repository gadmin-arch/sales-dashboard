'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { KPICard } from '@/components/kpi-card'
import { ChartPeriodToggle } from '@/components/chart-period-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
} from '@/components/ui/chart'
import { DonutChart } from '@/components/donut-chart'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Activity, CheckCircle2, Clock, AlertTriangle, Loader2, Search, ListTodo, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { type SelectRootChangeEventDetails } from '@base-ui/react/select'

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
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const p = new Date(d); return isNaN(p.getTime()) ? d : p.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function onSel(setter: (v: string) => void) { return (v: string | null, _d: SelectRootChangeEventDetails) => { setter(v ?? 'all') } }

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
  const [view, setView] = useState<ViewMode>('calendar')
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() } })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [weekStart, setWeekStart] = useState(() => { const n = new Date(); return new Date(n.setDate(n.getDate() - n.getDay())) })

  const getYTD = () => { const n = new Date(); return { from: new Date(n.getFullYear(), 0, 1).toLocaleDateString('en-CA'), to: new Date(n.getFullYear(), n.getMonth(), n.getDate()).toLocaleDateString('en-CA') } }
  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [su, setSu] = useState('all'), [at, setAt] = useState('all'), [lv, setLv] = useState('all'), [st, setSt] = useState('all')
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo), [lSu, setLSu] = useState(su), [lAt, setLAt] = useState(at), [lLv, setLLv] = useState(lv), [lSt, setLSt] = useState(st)

  const doFetch = useCallback(async (p: Record<string, string>) => {
    setLoading(true); setError(null)
    try {
      const q = new URLSearchParams()
      for (const [k, v] of Object.entries(p)) { if (v && v !== 'all') q.set(k, v) }
      const res = await globalThis.fetch('/api/sales/activities?' + q.toString())
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { doFetch({ dateFrom, dateTo, salesUser: su, activityType: at, level: lv, status: st, period: chartPeriod }) }, [doFetch, dateFrom, dateTo, su, at, lv, st, chartPeriod])
  const onPeriod = (p: 'monthly' | 'weekly') => { setChartPeriod(p); doFetch({ dateFrom, dateTo, salesUser: su, activityType: at, level: lv, status: st, period: p }) }
  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setSu(lSu); setAt(lAt); setLv(lLv); setSt(lSt) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLSu('all'); setLAt('all'); setLLv('all'); setLSt('all'); setDateFrom(d.from); setDateTo(d.to); setSu('all'); setAt('all'); setLv('all'); setSt('all') }
  const setQuick = (r: 'thisMonth' | 'last30' | '6month' | '1year' | 'lastYear' | 'YTD') => {
    const t = new Date(); let f = ''; let to = t.toLocaleDateString('en-CA')
    if (r === 'YTD') f = `${t.getFullYear()}-01-01`
    else if (r === 'thisMonth') f = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
    else if (r === 'last30') { const p = new Date(); p.setDate(t.getDate() - 30); f = p.toLocaleDateString('en-CA') }
    else if (r === '6month') { const p = new Date(); p.setMonth(t.getMonth() - 6); f = p.toLocaleDateString('en-CA') }
    else if (r === '1year') { const p = new Date(); p.setFullYear(t.getFullYear() - 1); f = p.toLocaleDateString('en-CA') }
    else if (r === 'lastYear') { const ly = t.getFullYear() - 1; f = `${ly}-01-01`; to = `${ly}-12-31` }
    setLFrom(f); setLTo(to)
  }

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

  if (loading && !data) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !data) return <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4"><p className="text-destructive">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!data) return null

  const trendConfig = { activities: { label: 'Activities', color: 'var(--primary)' } }
  const byTypeConfig = Object.fromEntries(['Call', 'Visit', 'Online Meeting', 'Offline Meeting', 'Office', 'Others'].map((label, i) => [`t${i}`, { label, color: PIE_COLORS[i % 5] }]))
  const byStatusConfig = Object.fromEntries(['Done', 'To Do', 'Hold', 'Cancel'].map((label, i) => [`s${i}`, { label, color: PIE_COLORS[i % 5] }]))
  const byLevelConfig = Object.fromEntries(['High', 'Medium', 'Low'].map((label, i) => [`l${i}`, { label, color: PIE_COLORS[i % 5] }]))

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Sales Activities</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p></div>
          <ThemeToggle />
        </div>

        {/* Filters */}
        <Card><CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5 items-start">
            <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Date Range</label>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <input type="date" value={lFrom} onChange={e => setLFrom(e.target.value)} className="w-[120px] rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                <span className="text-xs text-muted-foreground">—</span>
                <input type="date" value={lTo} onChange={e => setLTo(e.target.value)} className="w-[120px] rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex flex-wrap gap-1">
                {(['thisMonth', 'last30', '6month', '1year', 'lastYear', 'YTD'] as const).map(r => <Button key={r} variant="outline" size="xs" onClick={() => setQuick(r)}>{r === 'last30' ? '30d' : r === '6month' ? '6mo' : r === '1year' ? '1yr' : r === 'lastYear' ? 'LY' : r === 'thisMonth' ? 'MTD' : 'YTD'}</Button>)}
              </div>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sales Person</label>
              <Select value={lSu} onValueChange={onSel(setLSu)}>
                <SelectTrigger><SelectValue>{lSu === 'all' ? 'All Sales Persons' : data.salesUserList.find(u => u.id === lSu)?.name ?? lSu}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="all">All Sales Persons</SelectItem>{data.salesUserList.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Activity Type</label>
              <Select value={lAt} onValueChange={onSel(setLAt)}>
                <SelectTrigger><SelectValue>{lAt === 'all' ? 'All Types' : data.filterOptions.types.find(t => t.label === lAt)?.label ?? lAt}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="all">All Types</SelectItem>{data.filterOptions.types.map(t => <SelectItem key={t.id} value={t.label}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Level & Status</label>
              <div className="flex gap-2">
                <Select value={lLv} onValueChange={onSel(setLLv)}>
                  <SelectTrigger className="flex-1"><SelectValue>{lLv === 'all' ? 'All Levels' : data.filterOptions.levels.find(l => l.label === lLv)?.label ?? lLv}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Levels</SelectItem>{data.filterOptions.levels.map(l => <SelectItem key={l.id} value={l.label}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={lSt} onValueChange={onSel(setLSt)}>
                  <SelectTrigger className="flex-1"><SelectValue>{lSt === 'all' ? 'All Statuses' : data.filterOptions.statuses.find(s => s.label === lSt)?.label ?? lSt}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Statuses</SelectItem>{data.filterOptions.statuses.map(s => <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">
              Apply Filters
              {(lFrom !== dateFrom || lTo !== dateTo || lSu !== su || lAt !== at || lLv !== lv || lSt !== st) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
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
                  <Area type="monotone" dataKey="value" stroke="var(--color-activities)" fillOpacity={1} fill="url(#gAct)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">By Type</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.byType} height={260} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">By Status</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.byStatus} height={260} />
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
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Count" />
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Activities {search && <span className="text-sm font-normal text-muted-foreground">({filtered.length} results)</span>}</h2>
          <div className="flex items-center gap-2">
            <div className="relative w-48"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><input type="text" placeholder="Search activities..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" /></div>
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
              <TableHeader><TableRow><TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead><TableHead className="text-xs font-medium text-muted-foreground">Description</TableHead><TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead><TableHead className="text-xs font-medium text-muted-foreground">Level</TableHead><TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead><TableHead className="text-xs font-medium text-muted-foreground">Sales Person</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No activities found</TableCell></TableRow> : filtered.map(a => (
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
          </CardContent></Card>
        )}
      </div>
    </SalesPageShell>
  )
}
