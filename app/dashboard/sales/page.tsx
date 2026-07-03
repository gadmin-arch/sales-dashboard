'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { KPICard } from '@/components/kpi-card'
import { ChartPeriodToggle } from '@/components/chart-period-toggle'
import { InfoTooltip } from '@/components/info-tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { FileText, Briefcase, DollarSign, TrendingUp, ListTodo, ExternalLink } from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import {
  fmtCurrency,
  onSel,
  Progress,
  SortIcon,
  buildQuery,
  sameSet,
  getYTD
} from '@/lib/sales-helpers'
import { MultiSelect } from '@/components/multi-select'
import { DateRangeRow } from '@/components/date-range-row'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useChartFilter } from '@/hooks/use-chart-filter'

/* ── Types ── */
interface SalesData {
  kpis: { totalProjects: number; totalSales: number; totalQuotations: number; totalQuotationValue: number; totalInvoice: number; totalPayment: number }
  conversionTimeline: { name: string; PO: number; Invoice: number; Payment: number }[]
  quotStatusBreakdown: Record<string, number>
  salesByType: { name: string; value: number }[]
  revenueTrend: { name: string; value: number; material: number; service: number }[]
  priceComposition: { name: string; material: number; service: number }[]
  poComposition: { name: string; value: number }[]
  topProjects: { prjId: string; name: string; salesOwner: string; customer: string; type: string; projectStatus: string; invoiceStatus: string; currency: string; total: number; material: number; service: number; poDate: string }[]
  topSalesPersons: { name: string; totalPrice: number; projectCount: number; quotationCount: number }[]
  summary: { type: string; quotationCount: number; projectCount: number; totalPrice: number; material: number; service: number }[]
  quotationSummary: { qType: string; totalQuotation: number; totalQuotationWon: number; wonPercentage: number; totalQuotationWonFinalPrice: number; totalQuotationValue: number; totalOrderPriceFromQuotation: number; orderToWonPricePercentage: number }[]
  salesUserList: { id: string; name: string; email: string }[]
  currencyList: string[]
  orderTypeList: { otId: string; otDescription: string }[]
  projectStatusList: { pesId: string; pesDescription: string; pesLevel: number }[]
  invoiceStatusList: { fsId: string; fsDescription: string }[]
  projectFlagList: { flagId: string; flagDescription: string }[]
}

type SortKey = 'prjId' | 'name' | 'customer' | 'salesOwner' | 'type' | 'total'
type SortDir = 'asc' | 'desc'

/* ── Chart configs ── */
const revenueConfig = { material: { label: 'PO Material', color: 'var(--chart-1)' }, service: { label: 'PO Service', color: 'var(--chart-2)' } }
const priceConfig = { material: { label: 'Material %', color: 'var(--chart-1)' }, service: { label: 'Service %', color: 'var(--chart-2)' } }
const PIE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/* ═══════════════════════════════════════ */
export default function SalesPage() {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'weekly'>('monthly')
  const [tableSearch, setTableSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('sales-projects-table')
  const [tCust, setTCust] = useState('all'), [tOwner, setTOwner] = useState('all'), [tType, setTType] = useState('all')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  // Applied filters (currency stays single — it drives money formatting; the rest are multi-select)
  const [cur, setCur] = useState('all')
  const [su, setSu] = useState<string[]>([]), [ot, setOt] = useState<string[]>([]), [ps, setPs] = useState<string[]>([]), [inv, setInv] = useState<string[]>([]), [prjFlag, setPrjFlag] = useState<string[]>([])
  // Draft (unapplied) filters
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo), [lCur, setLCur] = useState(cur)
  const [lSu, setLSu] = useState<string[]>([]), [lOt, setLOt] = useState<string[]>([]), [lPs, setLPs] = useState<string[]>([]), [lInv, setLInv] = useState<string[]>([]), [lPrjFlag, setLPrjFlag] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('total'), [sortDir, setSortDir] = useState<SortDir>('desc')

   const fmtRp = useCallback((v: number) => fmtCurrency(v, cur === 'all' ? 'IDR' : cur), [cur])

  /* ── Price Composition Tooltip ── */
  function PriceTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="font-medium mb-1">{label}</div>
        {payload.map((item: any, i: number) => {
          const color = item.payload?.fill || item.color
          const name = item.name
          return (
            <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
                <span className="font-mono font-medium text-foreground tabular-nums">{item.value}%</span>
                <span className="text-muted-foreground">{name}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  function RevenueTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="font-medium mb-1">{label}</div>
        {payload.map((item: any, i: number) => {
          const color = item.payload?.fill || item.color
          const name = item.name
          const val = fmtRp(Number(item.value))
          return (
            <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
                <span className="font-mono font-medium text-foreground tabular-nums">{val}</span>
                <span className="text-muted-foreground">{name}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/sales/overview?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed'); setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false;
    doFetch({
      dateFrom, dateTo, salesUser: su, currency: cur, orderType: ot, projectStatus: ps, invoiceStatus: inv, projectFlag: prjFlag, period: chartPeriod,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, su, cur, ot, ps, inv, prjFlag, chartPeriod, chartFilter])

  const onPeriod = (p: 'monthly' | 'weekly') => { setChartPeriod(p) }
  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setSu(lSu); setCur(lCur); setOt(lOt); setPs(lPs); setInv(lInv); setPrjFlag(lPrjFlag) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLSu([]); setLCur('all'); setLOt([]); setLPs([]); setLInv([]); setLPrjFlag([]); setDateFrom(d.from); setDateTo(d.to); setSu([]); setCur('all'); setOt([]); setPs([]); setInv([]); setPrjFlag([]); setChartFilter(null) }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let p = data.topProjects
    if (tableSearch) { const q = tableSearch.toLowerCase(); p = p.filter(x => [x.name, x.customer, x.salesOwner, x.prjId, x.type].some(s => s.toLowerCase().includes(q))) }
    if (tCust !== 'all') p = p.filter(x => x.customer === tCust)
    if (tOwner !== 'all') p = p.filter(x => x.salesOwner === tOwner)
    if (tType !== 'all') p = p.filter(x => x.type === tType)
    p = [...p].sort((a, b) => {
      const aVal = a[sortKey], bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1)
    })
    return p
  }, [data, tableSearch, tCust, tOwner, tType, sortKey, sortDir])
  const projPage = useLoadMore(filtered)

  const custs = useMemo(() => !data ? [] : [...new Set(data.topProjects.map(p => p.customer).filter(Boolean))].sort(), [data])
  const owners = useMemo(() => !data ? [] : [...new Set(data.topProjects.map(p => p.salesOwner).filter(Boolean))].sort(), [data])
  const types = useMemo(() => !data ? [] : [...new Set(data.topProjects.map(p => p.type).filter(Boolean))].sort(), [data])
  const revTotal = useMemo(() => data?.revenueTrend?.reduce((s, x) => s + x.value, 0) || 0, [data])
  const sByTypeTotal = useMemo(() => data?.salesByType?.reduce((s, x) => s + x.value, 0) || 0, [data])
  const poTotal = useMemo(() => data?.poComposition?.reduce((s, x) => s + x.value, 0) || 0, [data])
  const revTooltipFormatter = (v: any, n: any) => { const pct = revTotal > 0 ? ((Number(v) / revTotal) * 100).toFixed(1) : '0.0'; return [`${fmtRp(Number(v))} (${pct}%)`, n] as [string, string] }
  const priceTotal = useMemo(() => data?.priceComposition?.reduce((s, x) => s + x.material + x.service, 0) || 0, [data])

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const thClass = "text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors [&_svg]:inline [&_svg]:ml-1 [&_svg]:align-middle"

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight">Sales Performance Dashboard</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p></div>
            {chartFilter && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
                <span className="text-muted-foreground">Filtered by:</span> {chartFilter.label}
                <button onClick={() => setChartFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5"><div className="h-4 w-4 flex items-center justify-center">✕</div></button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/dashboard/sales/activities" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"><ListTodo className="h-4 w-4" /> Sales Activities <ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>


        {/* Filters */}
        <Card><CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sales Owner</label>
              <MultiSelect allLabel="All Sales Owners" selected={lSu} onChange={setLSu}
                options={data.salesUserList.map(u => ({ value: u.id, label: u.name }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Currency</label>
              <Select value={lCur} onValueChange={onSel(setLCur)}>
                <SelectTrigger className="w-full"><SelectValue>{lCur === 'all' ? 'All Currencies' : lCur}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="all">All Currencies</SelectItem>{data.currencyList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Order Type</label>
              <MultiSelect allLabel="All Order Types" selected={lOt} onChange={setLOt}
                options={data.orderTypeList.map(o => ({ value: o.otId, label: o.otDescription }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Status</label>
              <MultiSelect allLabel="All Project Statuses" selected={lPs} onChange={setLPs}
                options={data.projectStatusList.map(p => ({ value: p.pesId, label: p.pesDescription }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Invoice Status</label>
              <MultiSelect allLabel="All Invoice Statuses" selected={lInv} onChange={setLInv}
                options={data.invoiceStatusList.map(f => ({ value: f.fsId, label: f.fsDescription }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Flag</label>
              <MultiSelect allLabel="All Project Flags" selected={lPrjFlag} onChange={setLPrjFlag}
                options={data.projectFlagList.map(f => ({ value: f.flagId, label: f.flagDescription }))} />
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">
              Apply Filters
              {(lFrom !== dateFrom || lTo !== dateTo || lCur !== cur || !sameSet(lSu, su) || !sameSet(lOt, ot) || !sameSet(lPs, ps) || !sameSet(lInv, inv) || !sameSet(lPrjFlag, prjFlag)) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
            </Button>
          </div>
          {loading && data && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <KPICard title="Total Projects" value={data.kpis.totalProjects.toString()} icon={<Briefcase className="h-4 w-4" />} tooltip="Number of active projects (Project type) within the selected filters." />
          <KPICard title="Total Sales" value={fmtRp(data.kpis.totalSales)} icon={<DollarSign className="h-4 w-4" />} tooltip="Cumulative project Purchase Order (PO) value: SUM(prj_po_total) from all filtered projects." />
          <KPICard title="Total Invoice" value={fmtRp(data.kpis.totalInvoice)} icon={<FileText className="h-4 w-4" />} trend={{ value: fmtRp(data.kpis.totalPayment), label: 'paid', positive: true }} tooltip="Total invoices issued: SUM(inv_amount) from project-linked invoices. Sub-row shows total payments received: SUM(pd_total_amount)." />
          <KPICard title="Total Quotations" value={data.kpis.totalQuotations.toString()} icon={<FileText className="h-4 w-4" />} tooltip="Number of active quotations within the selected filters." />
          <KPICard title="Quotation Value" value={fmtRp(data.kpis.totalQuotationValue)} icon={<TrendingUp className="h-4 w-4" />} tooltip="Total final quotation value: SUM(q_final_price) from all filtered quotations." />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <Card className="lg:col-span-2 overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Sales Revenue Trends
                <InfoTooltip tooltip="Trend of total PO contract value received, broken down into material and service components." />
              </CardTitle>
              <ChartPeriodToggle period={chartPeriod} onPeriodChange={onPeriod} />
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueConfig} className="h-[280px] w-full">
                <BarChart data={data.revenueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={fmtRp} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip content={<RevenueTooltip />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="material" stackId="a" fill="var(--color-material)" name="Material" onClick={(d: any) => handleChartClick('revenueMonth', d.name, `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="service" stackId="a" fill="var(--color-service)" name="Service" radius={[4, 4, 0, 0]} onClick={(d: any) => handleChartClick('revenueMonth', d.name, `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Sales by Type
                <InfoTooltip tooltip="Total PO contract value breakdown by sales type (project, material, service, etc.)." align="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={data.salesByType}
                height={280}
                total={sByTypeTotal}
                currency={cur === 'all' ? 'IDR' : cur}
                formatValue={(v, n) => { const pct = sByTypeTotal > 0 ? (v / sByTypeTotal * 100).toFixed(1) : '0.0'; return `${fmtRp(v)} (${pct}%)` }}
                onSliceClick={(name) => handleChartClick('salesType', name, `Type = ${name}`)}
              />
            </CardContent>
          </Card>
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                PO Composition
                <InfoTooltip tooltip="Purchase Order (PO) value split ratio between Material vs Service procurement." align="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={data.poComposition}
                height={280}
                total={poTotal}
                currency={cur === 'all' ? 'IDR' : cur}
                formatValue={(v, n) => { const pct = poTotal > 0 ? (v / poTotal * 100).toFixed(1) : '0.0'; return `${fmtRp(v)} (${pct}%)` }}
                onSliceClick={(name) => handleChartClick('poType', name, `PO Type = ${name}`)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Price Composition (%)
                <InfoTooltip tooltip="Monthly percentage contribution of material vs service to total PO value." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={priceConfig} className="h-[260px] w-full">
                <BarChart data={data.priceComposition} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip content={<PriceTooltip />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="material" stackId="a" fill="var(--color-material)" radius={[0, 0, 4, 4]} name="Material" onClick={(d: any) => handleChartClick('priceCompMonth', d.name, `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="service" stackId="a" fill="var(--color-service)" radius={[4, 4, 0, 0]} name="Service" onClick={(d: any) => handleChartClick('priceCompMonth', d.name, `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Quotation Status
                <InfoTooltip tooltip="Count of quotation documents grouped by their current approval status." align="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={Object.entries(data.quotStatusBreakdown).map(([name, value]) => ({ name, value }))}
                height={260}
                donut={false}
                onSliceClick={(name) => handleChartClick('quotStatus', name, `Quotation Status = ${name}`)}
              />
            </CardContent>
          </Card>
        </div>

        {/* PO → Invoice → Payment timeline */}
        <Card className="overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                PO → Invoice → Payment Timeline
                <InfoTooltip tooltip="Monthly trend of incoming PO value compared to invoices issued and payments received (clamped to PO month)." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Projects selected by PO date; invoice/payment clamped to the PO month (backfill never runs backwards). Click a bar to filter by PO month.</p>
            </div>
            <ChartPeriodToggle period={chartPeriod} onPeriodChange={onPeriod} />
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ PO: { label: 'PO Value', color: 'var(--chart-1)' }, Invoice: { label: 'Invoice', color: 'var(--chart-2)' }, Payment: { label: 'Payment', color: 'var(--chart-3)' } }} className="h-[300px] w-full">
              <BarChart data={data.conversionTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={fmtRp} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v: any) => fmtRp(Number(v))} cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="PO" fill="var(--color-PO)" name="PO Value" radius={[4, 4, 0, 0]} onClick={(d: any) => handleChartClick('revenueMonth', d.name, `PO Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="Invoice" fill="var(--color-Invoice)" name="Invoice" radius={[4, 4, 0, 0]} onClick={(d: any) => handleChartClick('invoiceMonth', d.name, `Invoiced = ${d.name}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="Payment" fill="var(--color-Payment)" name="Payment" radius={[4, 4, 0, 0]} onClick={(d: any) => handleChartClick('paymentMonth', d.name, `Paid = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Projects + Top Sales Persons */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden" id="sales-projects-table">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <CardTitle className="text-sm font-semibold">Top Projects</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={tableSearch} onChange={setTableSearch} className="w-40" />
                <Select value={tCust} onValueChange={onSel(setTCust)}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue>{tCust === 'all' ? 'All Customers' : tCust}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Customers</SelectItem>{custs.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={tOwner} onValueChange={onSel(setTOwner)}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue>{tOwner === 'all' ? 'All Owners' : tOwner}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Owners</SelectItem>{owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={tType} onValueChange={onSel(setTType)}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue>{tType === 'all' ? 'All Types' : tType}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Types</SelectItem>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass} onClick={() => handleSort('prjId')}>Project ID <SortIcon column="prjId" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                  <TableHead className={thClass} onClick={() => handleSort('name')}>Name <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                  <TableHead className={thClass} onClick={() => handleSort('customer')}>Customer <SortIcon column="customer" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                  <TableHead className={thClass} onClick={() => handleSort('salesOwner')}>Owner <SortIcon column="salesOwner" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                  <TableHead className={thClass} onClick={() => handleSort('type')}>Type <SortIcon column="type" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                  <TableHead className={thClass} onClick={() => handleSort('total')}>Total <SortIcon column="total" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No projects found</TableCell></TableRow> : projPage.visible.map(p => (
                    <TableRow key={p.prjId}>
                      <TableCell className="text-xs font-semibold text-primary">{p.prjId}</TableCell>
                      <TableCell className="max-w-[140px] truncate" title={p.name}>{p.name}</TableCell>
                      <TableCell>{p.customer}</TableCell>
                      <TableCell>{p.salesOwner}</TableCell>
                      <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium border" style={{ color: `hsl(var(--type-${p.type.toLowerCase()}))` || 'var(--foreground)', borderColor: `hsl(var(--type-${p.type.toLowerCase()}))` + '40' || 'var(--border)', background: `hsl(var(--type-${p.type.toLowerCase()}))` + '10' || 'var(--muted)' }}>{p.type}</span></TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <LoadMore hasMore={projPage.hasMore} shown={projPage.shown} total={projPage.total} onClick={projPage.loadMore} onLoadAll={projPage.loadAll} onCollapse={projPage.collapse} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Top Sales Persons</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.topSalesPersons.length === 0 ? <p className="text-center text-muted-foreground py-8">No data</p> : data.topSalesPersons.map((sp, i) => {
                const max = data.topSalesPersons[0]?.totalPrice || 1, pct = (sp.totalPrice / max) * 100
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{sp.name}</p>
                      <p className="text-xs text-muted-foreground">{sp.projectCount} projects · {sp.quotationCount} quotations</p>
                      <Progress value={pct} className="mt-1" />
                    </div>
                    <div className="text-sm font-bold shrink-0">{fmtRp(sp.totalPrice)}</div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Sales Summary */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Sales Summary by Type</CardTitle>
            <span className="inline-flex rounded-md px-2.5 py-1 text-[10px] font-medium bg-muted text-muted-foreground border border-border">Orders Only</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Projects</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Material</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Service</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Total Price</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.summary.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> : data.summary.map((r, i) => (
                  <TableRow key={i}><TableCell className="font-medium">{r.type}</TableCell><TableCell className="text-right">{r.projectCount}</TableCell><TableCell className="text-right chart-1">{fmtRp(r.material)}</TableCell><TableCell className="text-right chart-2">{fmtRp(r.service)}</TableCell><TableCell className="text-right font-bold">{fmtRp(r.totalPrice)}</TableCell></TableRow>
                ))}
              </TableBody>
              {data.summary.length > 0 && (
                <TableFooter><TableRow><TableCell className="font-bold">Total</TableCell><TableCell className="text-right">{data.summary.reduce((a, r) => a + r.projectCount, 0)}</TableCell><TableCell className="text-right chart-1 font-bold">{fmtRp(data.summary.reduce((a, r) => a + r.material, 0))}</TableCell><TableCell className="text-right chart-2 font-bold">{fmtRp(data.summary.reduce((a, r) => a + r.service, 0))}</TableCell><TableCell className="text-right font-bold">{fmtRp(data.summary.reduce((a, r) => a + r.totalPrice, 0))}</TableCell></TableRow></TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>

        {/* Quotation Summary */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Quotation Summary by Type</CardTitle>
            <span className="inline-flex rounded-md px-2.5 py-1 text-[10px] font-medium bg-muted text-muted-foreground border border-border">Quotations & Conversion</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
<TableHeader><TableRow><TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Total</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Total Value</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Won</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Win %</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Won Price</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Order Price</TableHead><TableHead className="text-xs font-medium text-muted-foreground text-right">Order/Won %</TableHead></TableRow></TableHeader>
               <TableBody>
                 {!data.quotationSummary?.length ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> : data.quotationSummary.map((r, i) => (
                   <TableRow key={i}>
                    <TableCell className="font-medium">{r.qType}</TableCell>
                    <TableCell className="text-right">{r.totalQuotation}</TableCell>
                    <TableCell className="text-right font-medium">{fmtRp(r.totalQuotationValue)}</TableCell>
                    <TableCell className="text-right chart-2">{r.totalQuotationWon}</TableCell>
                    <TableCell className="text-right font-medium chart-1">{r.wonPercentage}%</TableCell>
                    <TableCell className="text-right font-medium">{fmtRp(r.totalQuotationWonFinalPrice)}</TableCell>
                    <TableCell className="text-right font-medium chart-2" title={`From ${r.totalQuotationWon} won quotations`}>{fmtRp(r.totalOrderPriceFromQuotation)}</TableCell>
                    <TableCell className="text-right font-bold chart-1" title={`Order Price / Won Price × 100`}>{r.orderToWonPricePercentage}%</TableCell>
                  </TableRow>
                 ))}
</TableBody>
              {data.quotationSummary.length > 0 && (() => {
                const totOrder = data.quotationSummary.reduce((a, r) => a + r.totalOrderPriceFromQuotation, 0)
                const totWonPrice = data.quotationSummary.reduce((a, r) => a + r.totalQuotationWonFinalPrice, 0)
                const totPct = totWonPrice > 0 ? Math.round((totOrder / totWonPrice) * 1000) / 10 : 0
                return (
                <TableFooter><TableRow><TableCell className="font-bold">Total</TableCell><TableCell className="text-right font-bold">{data.quotationSummary.reduce((a, r) => a + r.totalQuotation, 0)}</TableCell><TableCell className="text-right font-bold">{fmtRp(data.quotationSummary.reduce((a, r) => a + r.totalQuotationValue, 0))}</TableCell><TableCell className="text-right font-bold">{data.quotationSummary.reduce((a, r) => a + r.totalQuotationWon, 0)}</TableCell><TableCell className="text-right font-bold chart-1">{Math.round(data.quotationSummary.reduce((a, r) => a + r.wonPercentage * r.totalQuotation, 0) / data.quotationSummary.reduce((a, r) => a + r.totalQuotation, 0) || 0)}%</TableCell><TableCell className="text-right font-bold">{fmtRp(totWonPrice)}</TableCell><TableCell className="text-right font-bold chart-2">{fmtRp(totOrder)}</TableCell><TableCell className="text-right font-bold chart-1">{totPct}%</TableCell></TableRow></TableFooter>
                )
              })()}
            </Table>
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
