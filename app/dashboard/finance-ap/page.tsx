'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import {
  Loader2, Search, Wallet, FileText, Clock, Users, DollarSign, Receipt, X,
  Utensils, Landmark, Banknote, AlertTriangle, TrendingDown, CheckCircle2, Layers, Timer, Gauge, CalendarClock,
} from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { DateRangeRow } from '@/components/date-range-row'
import { MultiSelect } from '@/components/multi-select'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, getYTD, fmtShortDate as fmtDate } from '@/lib/sales-helpers'
import { useAuth } from '@/lib/auth-context'

// ── formatting ──
const rp = (v: number) => 'Rp' + Math.round(v || 0).toLocaleString('id-ID')
const rpC = (v: number) => fmtCurrency(v || 0, 'IDR')
const days = (v: number) => `${v} hr`
const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }
const CHART = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

type KV = { name: string; value: number }
type Money = Record<string, number>
interface FA {
  overview: { kpis: Money; composition: { stream: string; outflow: number; pctOutflow: number; outstanding: number; records: number }[]; outstandingByStream: KV[]; monthly: any[] }
  poPayments: { kpis: Money; aging: { name: string; value: number; count: number }[]; byStatus: KV[]; topByPo: KV[]; monthlyOutflow: KV[]; timelinessBreakdown: KV[]; rows: any[] }
  payroll: { kpis: Money; statusBreakdown: KV[]; topAdditions: KV[]; topReductions: KV[]; monthly: any[]; distribution: KV[]; rows: any[] }
  meal: { kpis: Money; byType: KV[]; topProjects: KV[]; approvedByMonth: KV[]; rows: any[] }
  loans: { kpis: Money; topBorrowers: KV[]; monthly: any[]; forecast: KV[]; rows: any[] }
  reimburse: { kpis: Money; categoryBreakdown: KV[]; topProjects: KV[]; topEmployees: KV[]; monthly: any[]; rows: any[] }
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: <Layers className="h-4 w-4" />, role: null },
  { key: 'poPayments', label: 'PO Payments', icon: <FileText className="h-4 w-4" />, role: null },
  { key: 'payroll', label: 'Payroll', icon: <Banknote className="h-4 w-4" />, role: 'payroll' },
  { key: 'meal', label: 'Meal Benefits', icon: <Utensils className="h-4 w-4" />, role: null },
  { key: 'loans', label: 'Loans', icon: <Landmark className="h-4 w-4" />, role: null },
  { key: 'reimburse', label: 'Reimburse', icon: <Receipt className="h-4 w-4" />, role: null },
] as const
type TabKey = typeof TABS[number]['key']

// active cross-filter from a chart click
type CF = { label: string; test: (r: any) => boolean } | null

// ── building blocks ──
function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function BarCard({ title, subtitle, data, bars, vertical, categoryKey = 'name', height = 260, stacked, onBarClick, className }: {
  title: string; subtitle?: string; data: any[]; bars: { key: string; color: string; label?: string }[]
  vertical?: boolean; categoryKey?: string; height?: number; stacked?: boolean; onBarClick?: (name: string) => void; className?: string
}) {
  const config = Object.fromEntries(bars.map((b) => [b.key, { label: b.label || b.key, color: b.color }]))
  const click = onBarClick ? (d: any) => onBarClick(String(d?.[categoryKey] ?? d?.payload?.[categoryKey] ?? '')) : undefined
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ChartContainer config={config} className="w-full" style={{ height }}>
        <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: vertical ? 8 : 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={!vertical} vertical={vertical} />
          {vertical ? (
            <>
              <XAxis type="number" {...axis} tickFormatter={rpC} axisLine={false} />
              <YAxis type="category" dataKey={categoryKey} {...axis} width={120} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={categoryKey} {...axis} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis {...axis} tickFormatter={rpC} axisLine={false} />
            </>
          )}
          <Tooltip formatter={(v: any) => rp(Number(v))} cursor={{ fill: 'var(--muted)' }} {...tip} />
          {bars.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} stackId={stacked ? 's' : undefined} fill={b.color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} onClick={click} style={{ cursor: onBarClick ? 'pointer' : undefined }} />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

// ── per-tab client-side filters ──
type FilterSpec = { field: string; label: string }
function useRowFilters(rows: any[], specs: FilterSpec[]) {
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
function FilterBar({ specs, sel, setSel, options, active, onClear }: {
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

// per-tab filter specs (fields must exist on that tab's rows)
const PO_FILTERS: FilterSpec[] = [{ field: 'statusLabel', label: 'Status' }, { field: 'timeliness', label: 'Timeliness' }, { field: 'createdBy', label: 'Requester' }]
const PAYROLL_FILTERS: FilterSpec[] = [{ field: 'statusLabel', label: 'Status' }, { field: 'payStatus', label: 'Payment' }, { field: 'periodType', label: 'Cycle' }, { field: 'employee', label: 'Employee' }]
const MEAL_FILTERS: FilterSpec[] = [{ field: 'typeLabel', label: 'Type' }, { field: 'projectId', label: 'Project' }]
const LOAN_FILTERS: FilterSpec[] = [{ field: 'statusLabel', label: 'Status' }, { field: 'borrower', label: 'Borrower' }]
const REIMBURSE_FILTERS: FilterSpec[] = [{ field: 'category', label: 'Category' }, { field: 'employeeName', label: 'Employee' }]

interface Col { key: string; label: string; align?: 'right' | 'center'; render: (r: any) => ReactNode }
function DataTable({ title, subtitle, rows, cols, searchKeys, initialSort, cf, onClearCf, prefilter }: {
  title: string; subtitle?: string; rows: any[]; cols: Col[]; searchKeys: string[]; initialSort: string; cf?: CF; onClearCf?: () => void; prefilter?: (r: any) => boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    let rs = prefilter ? rows.filter(prefilter) : rows
    if (cf) rs = rs.filter(cf.test)
    if (search) { const q = search.toLowerCase(); rs = rs.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q))) }
    return rs
  }, [rows, search, searchKeys, cf, prefilter])
  const sort = useSort(filtered, initialSort)
  const page = useLoadMore(sort.sorted)
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({filtered.length.toLocaleString('id-ID')}{filtered.length !== rows.length ? ` of ${rows.length.toLocaleString('id-ID')}` : ''})</span></CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {cf && (
            <button onClick={onClearCf} className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary border border-primary/20">
              {cf.label}<X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              {cols.map((c) => (
                <SortHead key={c.key} label={c.label} column={c.key} sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} />
              ))}
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-8">No records found</TableCell></TableRow>
              ) : page.visible.map((r, i) => (
                <TableRow key={r.id ?? r.payreqId ?? r.loanId ?? r.mbId ?? r.reimburseId ?? i}>
                  {cols.map((c) => (
                    <TableCell key={c.key} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>{c.render(r)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <LoadMore hasMore={page.hasMore} shown={page.shown} total={page.total} onClick={page.loadMore} onLoadAll={page.loadAll} onCollapse={page.collapse} />
      </CardContent>
    </Card>
  )
}

const TONE: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  muted: 'bg-muted text-muted-foreground',
}
const badge = (label: string, tone: keyof typeof TONE | string) =>
  <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${TONE[tone] || TONE.muted}`}>{label}</span>
const timelinessTone = (k: string) => k === 'On Time' ? 'green' : k === 'On Track' ? 'sky' : k === 'Overdue (ongoing)' ? 'red' : k === 'Overdue (late)' ? 'amber' : 'muted'

export default function FinanceAPPage() {
  const { user } = useAuth()
  const [data, setData] = useState<FA | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')

  const [dateFrom, setDateFrom] = useState(getYTD().from)
  const [dateTo, setDateTo] = useState(getYTD().to)
  const [lFrom, setLFrom] = useState(dateFrom)
  const [lTo, setLTo] = useState(dateTo)

  const tabs = useMemo(() => TABS.filter((t) => !t.role || (user?.roles as any)?.[t.role]), [user])
  useEffect(() => { if (!tabs.some((t) => t.key === tab)) setTab('overview') }, [tabs, tab])

  const doFetch = useCallback(async (p: Record<string, string>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/finance-ap?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({ dateFrom, dateTo, ...(fresh ? { fresh: '1' } : {}) })
  }, [doFetch, dateFrom, dateTo])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setDateFrom(d.from); setDateTo(d.to) }
  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo

  if (loading && !data) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !data) return <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4"><p className="text-destructive">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance — Accounts Payable</h1>
            <p className="text-sm text-muted-foreground">PT. Multi Daya Mitra — Reimburse · PO Payments · Payroll · Meal Benefits · Loans</p>
          </div>
          <ThemeToggle />
        </div>

        <Card><CardContent className="pt-5">
          <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">Apply{hasUnapplied && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}</Button>
          </div>
          {loading && data && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        <div className="flex flex-wrap gap-1.5 border-b border-border">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab d={data.overview} />}
        {tab === 'poPayments' && <PoPaymentsTab d={data.poPayments} />}
        {tab === 'payroll' && <PayrollTab d={data.payroll} />}
        {tab === 'meal' && <MealTab d={data.meal} />}
        {tab === 'loans' && <LoansTab d={data.loans} />}
        {tab === 'reimburse' && <ReimburseTab d={data.reimburse} />}
      </div>
    </SalesPageShell>
  )
}

// ════════ tabs ════════
function OverviewTab({ d }: { d: FA['overview'] }) {
  const k = d.kpis
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Total Cash Outflow" value={rpC(k.totalOutflow)} icon={<TrendingDown className="h-4 w-4" />} />
        <KPICard title="Total Outstanding" value={rpC(k.totalOutstanding)} icon={<AlertTriangle className="h-4 w-4" />} />
        <KPICard title="Payroll Disbursed" value={rpC(k.payrollDisbursed)} icon={<Banknote className="h-4 w-4" />} />
        <KPICard title="Petty Cash Balance" value={rpC(k.pettyCashBalance)} icon={<Wallet className="h-4 w-4" />} trend={{ value: k.pendingAp, label: 'AP pending', positive: k.pettyCashBalance >= 0 }} />
      </div>
      <BarCard title="Monthly Cash Outflow by Stream" subtitle="Stacked — PO Payments · Payroll · Reimburse · Loans · Meal" data={d.monthly} stacked height={300}
        bars={[
          { key: 'PO Payments', color: CHART[0] }, { key: 'Payroll', color: CHART[1] }, { key: 'Reimburse', color: CHART[2] },
          { key: 'Loans', color: CHART[3] }, { key: 'Meal', color: CHART[4] },
        ]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Outflow Composition by Stream" subtitle={`Total ${rp(k.totalOutflow)} period-to-date`}>
          <DonutChart data={d.composition.map((c) => ({ name: c.stream, value: c.outflow }))} height={280} />
        </ChartCard>
        <BarCard title="Outstanding Exposure by Stream" data={d.outstandingByStream} bars={[{ key: 'value', color: 'var(--chart-3)', label: 'Outstanding' }]} vertical height={280} />
      </div>
      <DataTable title="Streams Summary" rows={d.composition.map((c) => ({ ...c, id: c.stream }))} searchKeys={['stream']} initialSort="outflow"
        cols={[
          { key: 'stream', label: 'Stream', render: (r) => <span className="font-medium">{r.stream}</span> },
          { key: 'outflow', label: 'Cash Outflow', align: 'right', render: (r) => <span className="font-medium">{rp(r.outflow)}</span> },
          { key: 'pctOutflow', label: '% of Total', align: 'right', render: (r) => `${r.pctOutflow}%` },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'records', label: 'Records', align: 'right', render: (r) => r.records.toLocaleString('id-ID') },
        ]} />
    </div>
  )
}

function PoPaymentsTab({ d }: { d: FA['poPayments'] }) {
  const k = d.kpis
  const [cf, setCf] = useState<CF>(null)
  const f = useRowFilters(d.rows, PO_FILTERS)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Outstanding AP" value={rpC(k.totalOutstanding)} icon={<FileText className="h-4 w-4" />} trend={{ value: `${k.pctOverdue}%`, label: 'overdue', positive: k.pctOverdue < 10 }} />
        <KPICard title="Overdue" value={rpC(k.overdue)} icon={<AlertTriangle className="h-4 w-4" />} />
        <KPICard title="Total Paid" value={rpC(k.totalPaid)} icon={<DollarSign className="h-4 w-4" />} />
        <KPICard title="Requests" value={k.totalRequests.toLocaleString('id-ID')} icon={<Clock className="h-4 w-4" />} trend={{ value: k.openCount, label: `open · ${k.pendingApproval} pending`, positive: false }} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Lead Time → Approval" value={days(k.avgLeadToApproval)} icon={<Timer className="h-4 w-4" />} trend={{ value: `${k.leadToApprovalCount}`, label: 'notify→Approval Needed', positive: true }} />
        <KPICard title="Lead Time → Paid" value={days(k.avgLeadToPaid)} icon={<Timer className="h-4 w-4" />} trend={{ value: `${k.leadToPaidCount}`, label: 'notify→paid', positive: true }} />
        <KPICard title="Avg Request Duration" value={days(k.avgRequestDuration)} icon={<CalendarClock className="h-4 w-4" />} trend={{ value: 'created→due', label: 'requested term', positive: true }} />
        <KPICard title="On-Time Rate" value={`${k.onTimeRate}%`} icon={<Gauge className="h-4 w-4" />} trend={{ value: `${k.tempoCount}`, label: 'tempo requests', positive: k.onTimeRate >= 75 }} />
      </div>
      {k.largestExposure > 0 && <Card><CardContent className="pt-4 flex items-center gap-3 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-muted-foreground">Largest single exposure:</span><span className="font-semibold">{rp(k.largestExposure)}</span><span className="text-muted-foreground">— {k.largestExposurePo}</span></CardContent></Card>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="AP Aging" data={d.aging} bars={[{ key: 'value', color: 'var(--chart-3)', label: 'Outstanding' }]} />
        <BarCard title="Monthly Cash Outflow" data={d.monthlyOutflow} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Paid' }]} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Payment Timeliness" subtitle="Click a slice to filter the table">
          <DonutChart data={d.timelinessBreakdown} height={260} onSliceClick={(name) => setCf({ label: `Timeliness: ${name}`, test: (r) => r.timeliness === name })} />
        </ChartCard>
        <ChartCard title="Outstanding by Status">
          <DonutChart data={d.byStatus} height={260} onSliceClick={(name) => setCf({ label: `Status: ${name}`, test: (r) => r.statusLabel === name })} />
        </ChartCard>
      </div>
      <FilterBar specs={PO_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <DataTable title="All Payment Requests" subtitle="Every request — paid & outstanding. Lead times in days; tempo = deferred-term payment." rows={d.rows} cf={cf} onClearCf={() => setCf(null)} prefilter={f.predicate}
        searchKeys={['payreqId', 'poId', 'invoiceNumber', 'statusLabel', 'timeliness', 'createdBy']} initialSort="createdAt"
        cols={[
          { key: 'payreqId', label: 'Request', render: (r) => <span className="text-xs font-semibold text-primary whitespace-nowrap">{r.payreqId}{r.isTempo && <span className="ml-1 rounded bg-violet-500/10 px-1 text-[9px] text-violet-600 dark:text-violet-400">TEMPO</span>}</span> },
          { key: 'poId', label: 'PO', render: (r) => <span className="text-xs text-muted-foreground">{r.poId}</span> },
          { key: 'dueDate', label: 'Due', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.dueDate)}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => rp(r.amount) },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'leadToPaid', label: 'Lead→Paid', align: 'right', render: (r) => r.leadToPaid != null ? days(r.leadToPaid) : <span className="text-muted-foreground">—</span> },
          { key: 'timeliness', label: 'Timeliness', render: (r) => badge(r.timeliness, timelinessTone(r.timeliness)) },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Paid' ? 'green' : r.statusLabel === 'Cancel' ? 'red' : 'sky') },
        ]} />
    </div>
  )
}

function PayrollTab({ d }: { d: FA['payroll'] }) {
  const k = d.kpis
  const [cf, setCf] = useState<CF>(null)
  const f = useRowFilters(d.rows, PAYROLL_FILTERS)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Total Receipt" value={rpC(k.totalReceipts)} icon={<Receipt className="h-4 w-4" />} />
        <KPICard title="Take-Home Pay" value={rpC(k.totalThp)} icon={<Banknote className="h-4 w-4" />} trend={{ value: rpC(k.medianThp), label: 'median/slip', positive: true }} />
        <KPICard title="Transferred" value={rpC(k.totalDisbursed)} icon={<DollarSign className="h-4 w-4" />} trend={{ value: `${k.disbursementCoverage}%`, label: 'of released', positive: k.disbursementCoverage >= 99 }} />
        <KPICard title="Shortfall (Kurang)" value={rpC(k.shortfall)} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: k.releasedUnpaidCount, label: 'slips unpaid', positive: false }} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Released but Unpaid" value={rpC(k.releasedUnpaid)} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: k.releasedUnpaidCount, label: 'slips', positive: false }} />
        <KPICard title="Payslips" value={k.payslips.toLocaleString('id-ID')} icon={<Users className="h-4 w-4" />} trend={{ value: k.employees, label: 'employees', positive: true }} />
        <KPICard title="Total Additions" value={rpC(k.totalAdditions)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KPICard title="Total Reductions" value={rpC(k.totalReductions)} icon={<TrendingDown className="h-4 w-4" />} />
      </div>
      <BarCard title="Monthly THP vs Released vs Disbursed" data={d.monthly} bars={[
        { key: 'THP', color: CHART[2], label: 'THP' }, { key: 'Released', color: CHART[1], label: 'Released' }, { key: 'Disbursed', color: CHART[0], label: 'Disbursed' },
      ]} height={280} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Payslip Status" subtitle="Click to filter">
          <DonutChart data={d.statusBreakdown} height={260} onSliceClick={(name) => setCf({ label: `Status: ${name}`, test: (r) => r.statusLabel === name })} />
        </ChartCard>
        <BarCard title="Top Earnings Additions" data={d.topAdditions} bars={[{ key: 'value', color: 'var(--chart-1)' }]} vertical />
        <BarCard title="Top Reductions" data={d.topReductions} bars={[{ key: 'value', color: 'var(--chart-5)' }]} vertical />
      </div>
      <FilterBar specs={PAYROLL_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <DataTable title="Payslips" rows={d.rows} cf={cf} onClearCf={() => setCf(null)} prefilter={f.predicate} searchKeys={['employee', 'period', 'statusLabel', 'payStatus', 'periodType']} initialSort="startDate"
        cols={[
          { key: 'employee', label: 'Employee', render: (r) => <span className="text-xs font-semibold text-primary">{r.employee}</span> },
          { key: 'startDate', label: 'Start Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.startDate)}</span> },
          { key: 'endDate', label: 'End Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.endDate)}</span> },
          { key: 'periodType', label: 'Cycle', render: (r) => badge(r.periodType, r.periodType === 'Weekly' ? 'sky' : 'muted') },
          { key: 'takeHomePay', label: 'THP', align: 'right', render: (r) => <span className="font-medium">{rp(r.takeHomePay)}</span> },
          { key: 'released', label: 'Released', align: 'right', render: (r) => rp(r.released) },
          { key: 'disbursed', label: 'Disbursed', align: 'right', render: (r) => rp(r.disbursed) },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Release' ? 'green' : r.statusLabel === 'Lock' ? 'red' : 'muted') },
          { key: 'payStatus', label: 'Payment', render: (r) => r.payStatus === '-' ? <span className="text-muted-foreground">—</span> : badge(r.payStatus, r.payStatus === 'Paid' ? 'green' : r.payStatus === 'Unpaid' ? 'red' : 'amber') },
        ]} />
    </div>
  )
}

function MealTab({ d }: { d: FA['meal'] }) {
  const k = d.kpis
  const [cf, setCf] = useState<CF>(null)
  const f = useRowFilters(d.rows, MEAL_FILTERS)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Approved Benefit" value={rpC(k.totalApproved)} icon={<Utensils className="h-4 w-4" />} trend={{ value: `${k.approvalRate}%`, label: 'approval rate', positive: true }} />
        <KPICard title="Net Released" value={rpC(k.netReleased)} icon={<DollarSign className="h-4 w-4" />} trend={{ value: `${k.releaseRate}%`, label: 'release rate', positive: k.releaseRate >= 80 }} />
        <KPICard title="Outstanding" value={rpC(k.outstanding)} icon={<AlertTriangle className="h-4 w-4" />} />
        <KPICard title="Requests" value={k.approvedRequests.toLocaleString('id-ID')} icon={<Receipt className="h-4 w-4" />} trend={{ value: rpC(k.avgPerRequest), label: 'avg/request', positive: true }} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="Approved Meal Benefit by Month" data={d.approvedByMonth} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Approved' }]} />
        <ChartCard title="Spend by Meal Type" subtitle="Click to filter">
          <DonutChart data={d.byType} height={260} onSliceClick={(name) => setCf({ label: `Type: ${name}`, test: (r) => r.typeLabel === name })} />
        </ChartCard>
      </div>
      <BarCard title="Top Projects by Approved Spend" data={d.topProjects} bars={[{ key: 'value', color: 'var(--chart-4)' }]} vertical height={300} />
      <FilterBar specs={MEAL_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <DataTable title="Meal Benefit Requests" rows={d.rows} cf={cf} onClearCf={() => setCf(null)} prefilter={f.predicate} searchKeys={['mbId', 'typeLabel', 'projectId', 'zone', 'requestedBy']} initialSort="date"
        cols={[
          { key: 'mbId', label: 'ID', render: (r) => <span className="text-xs font-semibold text-primary">{r.mbId}</span> },
          { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span> },
          { key: 'typeLabel', label: 'Type', render: (r) => <span className="text-xs">{r.typeLabel}</span> },
          { key: 'projectId', label: 'Project', render: (r) => <span className="text-xs text-muted-foreground">{r.projectId}</span> },
          { key: 'users', label: 'Users', align: 'right', render: (r) => r.users },
          { key: 'approvedAmount', label: 'Approved', align: 'right', render: (r) => <span className="font-medium">{rp(r.approvedAmount)}</span> },
          { key: 'released', label: 'Released', align: 'right', render: (r) => rp(r.released) },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
        ]} />
    </div>
  )
}

function LoansTab({ d }: { d: FA['loans'] }) {
  const k = d.kpis
  const [cf, setCf] = useState<CF>(null)
  const f = useRowFilters(d.rows, LOAN_FILTERS)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Outstanding" value={rpC(k.outstanding)} icon={<Landmark className="h-4 w-4" />} trend={{ value: `${k.repaymentProgress}%`, label: 'repaid', positive: k.repaymentProgress >= 50 }} />
        <KPICard title="Total Disbursed" value={rpC(k.totalDisbursed)} icon={<DollarSign className="h-4 w-4" />} />
        <KPICard title="Expected / Month" value={rpC(k.expectedMonthly)} icon={<CalendarClock className="h-4 w-4" />} trend={{ value: `${k.monthsToClear}mo`, label: 'to clear book', positive: true }} />
        <KPICard title="Active Loans" value={k.activeLoans.toLocaleString('id-ID')} icon={<Users className="h-4 w-4" />} trend={{ value: `${k.borrowers} borrowers`, label: `median ${k.medianTenor}mo`, positive: true }} />
      </div>
      <BarCard title="Repayment Forecast (next 12 months)" subtitle="Projected payroll-deduction inflow at each loan's installment rate" data={d.forecast} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Expected' }]} height={280} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="Disbursement vs Repayment by Month" data={d.monthly} bars={[{ key: 'Disbursed', color: CHART[3], label: 'Disbursed' }, { key: 'Repaid', color: CHART[0], label: 'Repaid' }]} />
        <BarCard title="Top Borrowers by Outstanding" data={d.topBorrowers} bars={[{ key: 'value', color: 'var(--chart-3)' }]} vertical onBarClick={(name) => setCf({ label: `Borrower: ${name}`, test: (r) => r.borrower === name })} />
      </div>
      <FilterBar specs={LOAN_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <DataTable title="Loans" subtitle="Full loan book — outstanding is point-in-time, so this tab isn't scoped by the date filter." rows={d.rows} cf={cf} onClearCf={() => setCf(null)} prefilter={f.predicate} searchKeys={['loanId', 'borrower', 'remarks', 'statusLabel']} initialSort="outstanding"
        cols={[
          { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span> },
          { key: 'borrower', label: 'Borrower', render: (r) => <span className="text-xs font-medium">{r.borrower}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-medium">{rp(r.amount)}</span> },
          { key: 'tenor', label: 'Tenor', align: 'right', render: (r) => `${r.tenor}mo` },
          { key: 'repaid', label: 'Repaid', align: 'right', render: (r) => rp(r.repaid) },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'progress', label: 'Progress', align: 'right', render: (r) => `${r.progress}%` },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Settled' ? 'green' : 'sky') },
        ]} />
    </div>
  )
}

function ReimburseTab({ d }: { d: FA['reimburse'] }) {
  const k = d.kpis
  const [cf, setCf] = useState<CF>(null)
  const f = useRowFilters(d.rows, REIMBURSE_FILTERS)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Petty Cash Balance" value={rpC(k.balance)} icon={<Wallet className="h-4 w-4" />} trend={{ value: k.pending, label: 'pending', positive: k.balance >= 0 }} />
        <KPICard title="Cash In (Approved)" value={rpC(k.totalIn)} icon={<DollarSign className="h-4 w-4" />} />
        <KPICard title="Cash Out (Approved)" value={rpC(k.totalOut)} icon={<TrendingDown className="h-4 w-4" />} />
        <KPICard title="Claims" value={k.approvedClaims.toLocaleString('id-ID')} icon={<Receipt className="h-4 w-4" />} trend={{ value: rpC(k.avgTicket), label: 'avg ticket', positive: true }} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarCard title="Monthly In / Out + Balance" data={d.monthly} bars={[{ key: 'CashIn', color: CHART[0], label: 'In' }, { key: 'CashOut', color: CHART[1], label: 'Out' }]} className="lg:col-span-2" height={280} />
        <ChartCard title="Spend by Category" subtitle="Click to filter">
          <DonutChart data={d.categoryBreakdown} height={280} onSliceClick={(name) => setCf({ label: `Category: ${name}`, test: (r) => r.category === name })} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="Top Projects by Spend" data={d.topProjects} bars={[{ key: 'value', color: 'var(--chart-4)' }]} vertical onBarClick={(name) => setCf({ label: `Project: ${name}`, test: (r) => r.projectName === name })} />
        <BarCard title="Top Employees by Cash-Out" data={d.topEmployees} bars={[{ key: 'value', color: 'var(--chart-2)' }]} vertical onBarClick={(name) => setCf({ label: `Employee: ${name}`, test: (r) => r.employeeName === name })} />
      </div>
      <FilterBar specs={REIMBURSE_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <DataTable title="Reimbursement Claims (Approved)" rows={d.rows} cf={cf} onClearCf={() => setCf(null)} prefilter={f.predicate} searchKeys={['reimburseId', 'projectName', 'description', 'employeeName', 'category']} initialSort="date"
        cols={[
          { key: 'reimburseId', label: 'ID', render: (r) => <span className="text-xs font-semibold text-primary">{r.reimburseId}</span> },
          { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span> },
          { key: 'employeeName', label: 'Employee', render: (r) => <span className="text-xs">{r.employeeName}</span> },
          { key: 'category', label: 'Category', render: (r) => <span className="text-xs text-muted-foreground">{r.category}</span> },
          { key: 'description', label: 'Description', render: (r) => <span className="max-w-[220px] truncate inline-block" title={r.description}>{r.description}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-medium">{rp(r.amount)}</span> },
        ]} />
    </div>
  )
}
