'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Wallet, Clock } from 'lucide-react'
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
  trendByInvoiceDate: { name: string; Invoice: number; Payment: number }[]
  trendByRelatedPaymentDate: { name: string; Invoice: number; Payment: number }[]
  aging: { name: string; value: number }[]
  leadTimeDistribution: { name: string; value: number }[]
  estPaymentSchedule: { name: string; outstanding: number }[]
  customerSummary: { customer: string; totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }[]
  invoices: InvoiceRow[]
  totalRows: number
  filterOptions: { customerList: Option[]; statusList: Option[]; projectStatusList: Option[] }
}

const trendConfig = { Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }
const AGING_COLORS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const statusClass: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  unpaid: 'bg-muted text-muted-foreground',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
}


export default function InvoicesPage() {
  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('invoices-table-section')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [cust, setCust] = useState<string[]>([]), [st, setSt] = useState<string[]>([]), [prjSt, setPrjSt] = useState<string[]>([])
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lCust, setLCust] = useState<string[]>([]), [lSt, setLSt] = useState<string[]>([]), [lPrjSt, setLPrjSt] = useState<string[]>([])

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
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false;
    doFetch({
      dateFrom, dateTo,
      customer: cust, status: st, projectStatus: prjSt,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, cust, st, prjSt, chartFilter])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setCust(lCust); setSt(lSt); setPrjSt(lPrjSt) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLCust([]); setLSt([]); setLPrjSt([]); setDateFrom(d.from); setDateTo(d.to); setCust([]); setSt([]); setPrjSt([]); setChartFilter(null) }

  const tableRows = useMemo(() => {
    if (!data) return []
    let rows = data.invoices
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => [r.invNumber, r.prj, r.customer, r.refName, r.statusLabel].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])
  const invSort = useSort(tableRows, 'invoiceDate', 'desc')
  const invPage = useLoadMore(invSort.sorted)
  const custSort = useSort(data?.customerSummary ?? [], 'outstanding', 'desc')
  const custPage = useLoadMore(custSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lCust, cust) || !sameSet(lSt, st) || !sameSet(lPrjSt, prjSt)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Invoice Dashboard" subtitle="PT. Multi Daya Mitra" chartFilter={chartFilter} onClearFilter={() => setChartFilter(null)} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Customer</label>
              <MultiSelect allLabel="All Customers" selected={lCust} onChange={setLCust} options={data.filterOptions.customerList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Invoice Status</label>
              <MultiSelect allLabel="All Statuses" selected={lSt} onChange={setLSt} options={data.filterOptions.statusList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Status</label>
              <MultiSelect allLabel="All Project Statuses" selected={lPrjSt} onChange={setLPrjSt} options={data.filterOptions.projectStatusList} /></div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Invoiced" value={fmtCurrency(data.kpis.totalInvoiced, 'IDR')} icon={<FileText className="h-4 w-4" />} />
          <KPICard title="Total Paid" value={fmtCurrency(data.kpis.totalPaid, 'IDR')} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Total Outstanding" value={fmtCurrency(data.kpis.totalOutstanding, 'IDR')} icon={<DollarSign className="h-4 w-4" />} trend={{ value: `${data.kpis.collectionRate}%`, label: 'collected', positive: data.kpis.collectionRate >= 50 }} />
          <KPICard title="Overdue" value={fmtCurrency(data.kpis.overdueAmount, 'IDR')} icon={<Clock className="h-4 w-4" />} trend={{ value: data.kpis.overdueCount, label: 'invoices', positive: false }} />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle></CardHeader><CardContent><DonutChart data={data.statusBreakdown} height={260} onSliceClick={(name) => handleChartClick('status', name, `Status = ${name}`)} /></CardContent></Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-sm font-semibold">Invoice vs Payment Trend</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{ Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
              <BarChart data={data.trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="Invoice" fill="var(--color-Invoice)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('invoiceMonth', String(data.name ?? ''), `Invoice Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="Payment" fill="var(--color-Payment)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('paymentMonth', String(data.name ?? ''), `Paid = ${data.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* Invoice vs Payment By Invoice Date */}
        <div className="grid grid-cols-1 gap-6">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Invoice vs Payment Trend (By Invoice Date)</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{ Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
              <BarChart data={data.trendByInvoiceDate} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="Invoice" fill="var(--color-Invoice)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('invoiceMonth', String(data.name ?? ''), `Invoice Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="Payment" fill="var(--color-Payment)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('invoiceMonth', String(data.name ?? ''), `Invoice Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* Invoice vs Payment Trend (Filtered by Invoice Date, Plotted by Actual Date) */}
        <div className="grid grid-cols-1 gap-6">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Invoice vs Payment Trend (Filtered by Invoice Date)</CardTitle><p className="text-xs text-muted-foreground">Timeline shows invoice issuance vs actual payment arrival for the filtered invoices</p></CardHeader><CardContent>
            <ChartContainer config={{ Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
              <BarChart data={data.trendByRelatedPaymentDate} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="Invoice" fill="var(--color-Invoice)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('invoiceMonth', String(data.name ?? ''), `Invoice Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="Payment" fill="var(--color-Payment)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('paymentMonth', String(data.name ?? ''), `Paid = ${data.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Aging Receivables</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart data={data.aging} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('aging', String(data.name ?? ''), `Aging = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-sm font-semibold">Lead Time (Project End to Invoice)</CardTitle><p className="text-xs text-muted-foreground">Avg: {data.kpis.avgLeadTime} days</p></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart data={data.leadTimeDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-4)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('leadTime', String(data.name ?? ''), `Lead Time = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-sm font-semibold">Outstanding by Due Date</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart data={data.estPaymentSchedule} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="outstanding" fill="var(--chart-5)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('dueMonth', String(data.name ?? ''), `Due Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Invoices table */}
        <Card className="overflow-hidden" id="invoices-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Invoices <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('id-ID')}{tableRows.length !== data.totalRows ? ` of ${data.totalRows.toLocaleString('id-ID')}` : ''})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
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
                  <SortHead label="Paid" column="paid" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
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
                      <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">{fmtRp(r.paid)}</TableCell>
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
