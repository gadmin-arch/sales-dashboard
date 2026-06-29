'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Loader2, Search, Wallet } from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { DateRangeRow } from '@/components/date-range-row'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'

interface InvoiceRow {
  invId: string; invNumber: string; prj: string; leadTime: number | null; customerId: string; customer: string; invoiceDate: string; dueDate: string
  amount: number; paid: number; outstanding: number; status: string; statusLabel: string
  daysOverdue: number; refName: string; remarks: string
}
interface Option { value: string; label: string }
interface InvoiceData {
  kpis: { totalInvoiced: number; totalPaid: number; totalOutstanding: number; overdueCount: number; overdueAmount: number; collectionRate: number; invoiceCount: number; avgLeadTime: number }
  statusBreakdown: { name: string; value: number }[]
  trend: { name: string; Invoice: number; Payment: number }[]
  aging: { name: string; value: number }[]
  leadTimeDistribution: { name: string; value: number }[]
  customerSummary: { customer: string; totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }[]
  invoices: InvoiceRow[]
  totalRows: number
  filterOptions: { customerList: Option[]; statusList: Option[] }
}

const trendConfig = { Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }
const AGING_COLORS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const statusClass: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  unpaid: 'bg-muted text-muted-foreground',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

function fmtDate(d: string): string {
  if (!d) return '-'
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const date = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(d)
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function InvoicesPage() {
  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [cust, setCust] = useState<string[]>([]), [st, setSt] = useState<string[]>([])
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lCust, setLCust] = useState<string[]>([]), [lSt, setLSt] = useState<string[]>([])

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/invoices?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => { const fresh = firstLoad.current; firstLoad.current = false; doFetch({ dateFrom, dateTo, customer: cust, status: st, ...(fresh ? { fresh: '1' } : {}) }) }, [doFetch, dateFrom, dateTo, cust, st])
  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setCust(lCust); setSt(lSt) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLCust([]); setLSt([]); setDateFrom(d.from); setDateTo(d.to); setCust([]); setSt([]) }

  const tableRows = useMemo(() => {
    if (!data) return []
    if (!search) return data.invoices
    const q = search.toLowerCase()
    return data.invoices.filter(r => [r.invNumber, r.prj, r.customer, r.refName, r.statusLabel].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])
  const invSort = useSort(tableRows, 'invoiceDate', 'desc')
  const invPage = useLoadMore(invSort.sorted)
  const custSort = useSort(data?.customerSummary ?? [], 'outstanding', 'desc')
  const custPage = useLoadMore(custSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lCust, cust) || !sameSet(lSt, st)

  if (loading && !data) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !data) return <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4"><p className="text-destructive">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Invoice Dashboard</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p></div>
          <ThemeToggle />
        </div>

        {/* Filters */}
        <Card><CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Customer</label>
              <MultiSelect allLabel="All Customers" selected={lCust} onChange={setLCust}
                options={data.filterOptions.customerList} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Payment Status</label>
              <MultiSelect allLabel="All Statuses" selected={lSt} onChange={setLSt}
                options={data.filterOptions.statusList} />
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">
              Apply Filters
              {hasUnapplied && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
            </Button>
          </div>
          {loading && data && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KPICard title="Total Invoiced" value={fmtRp(data.kpis.totalInvoiced)} icon={<FileText className="h-4 w-4" />} />
          <KPICard title="Total Paid" value={fmtRp(data.kpis.totalPaid)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Outstanding" value={fmtRp(data.kpis.totalOutstanding)} icon={<DollarSign className="h-4 w-4" />} />
          <KPICard title="Overdue" value={`${data.kpis.overdueCount}`} icon={<AlertTriangle className="h-4 w-4" />} />
          <KPICard title="Collection Rate" value={`${data.kpis.collectionRate}%`} icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Invoice vs Payment Trend</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="h-[280px] w-full">
                <LineChart data={data.trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={fmtRp} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any, n: any) => [fmtRp(Number(v)), n]} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="Invoice" stroke="var(--color-Invoice)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Payment" stroke="var(--color-Payment)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={data.statusBreakdown} height={280} total={data.kpis.invoiceCount}
                formatValue={(v) => `${v} invoices`} />
            </CardContent>
          </Card>
        </div>

        {/* Aging + Lead Time */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Aging Receivables (Outstanding)</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[240px] w-full">
                <BarChart data={data.aging} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={fmtRp} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => fmtRp(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Lead Time Distribution</CardTitle>
              <span className="text-xs text-muted-foreground">avg {data.kpis.avgLeadTime}d (completion → invoice)</span>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[240px] w-full">
                <BarChart data={data.leadTimeDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => [`${v} invoices`, 'Count']} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Invoice table */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Invoices <span className="font-normal text-muted-foreground">({data.totalRows.toLocaleString('id-ID')})</span></CardTitle>
            <div className="relative w-48"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" /></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Invoice #" column="invNumber" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Order #" column="prj" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Customer" column="customer" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Date" column="invoiceDate" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Due Date" column="dueDate" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Lead Time" column="leadTime" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Amount" column="amount" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Outstanding" column="outstanding" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Status" column="status" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Overdue (days)" column="daysOverdue" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow> : invPage.visible.map(r => (
                    <TableRow key={r.invId}>
                      <TableCell className="text-xs font-semibold text-primary">{r.invNumber}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.prj}</TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(r.invoiceDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(r.dueDate)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.leadTime === null ? '-' : `${r.leadTime}d`}</TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(r.amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(r.outstanding)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${statusClass[r.status] || 'bg-muted text-muted-foreground'}`}>{r.statusLabel}</span>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${r.daysOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{r.daysOverdue > 0 ? `${r.daysOverdue}d` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={invPage.hasMore} shown={invPage.shown} total={invPage.total} onClick={invPage.loadMore} onLoadAll={invPage.loadAll} onCollapse={invPage.collapse} />
          </CardContent>
        </Card>

        {/* Customer summary */}
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="text-sm font-semibold">Customer Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Customer" column="customer" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} />
                  <SortHead label="Invoiced" column="totalInvoiced" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Paid" column="totalPaid" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Outstanding" column="outstanding" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Overdue" column="overdue" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {custSort.sorted.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> : custPage.visible.map(c => (
                    <TableRow key={c.customer}>
                      <TableCell className="font-medium">{c.customer}</TableCell>
                      <TableCell className="text-right">{fmtRp(c.totalInvoiced)}</TableCell>
                      <TableCell className="text-right chart-2">{fmtRp(c.totalPaid)}</TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400 font-medium">{fmtRp(c.outstanding)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">{fmtRp(c.overdue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={custPage.hasMore} shown={custPage.shown} total={custPage.total} onClick={custPage.loadMore} onLoadAll={custPage.loadAll} onCollapse={custPage.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
