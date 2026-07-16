'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { InfoTooltip } from '@/components/info-tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Wallet, Clock } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  daysOverdue: number; refName: string; remarks: string; completedDate: string; paymentDate: string
  estPaymentDays: number | null; actualPaymentDays: number | null; dueDateToPaymentDays: number | null
}
interface Option { value: string; label: string }
interface InvoiceData {
  kpis: {
    totalInvoiced: number; totalPaid: number; totalOutstanding: number; overdueCount: number; overdueAmount: number;
    collectionRate: number; invoiceCount: number; avgLeadTime: number; avgEstPaymentDays: number; avgActualPaymentDays: number; avgDueToPayDays: number
  }
  statusBreakdown: { name: string; value: number }[]
  trend: { name: string; Invoice: number; Payment: number }[]
  trendByInvoiceDate: { name: string; Invoice: number; Payment: number; PaymentPct: number }[]
  trendByRelatedPaymentDate: { name: string; Invoice: number; Payment: number }[]
  aging: { name: string; value: number }[]
  leadTimeDistribution: { name: string; value: number }[]
  estPaymentDaysDistribution: { name: string; value: number }[]
  actualPaymentDaysDistribution: { name: string; value: number }[]
  dueDateToPaymentDaysDistribution: { name: string; value: number }[]
  estPaymentSchedule: { name: string; outstanding: number }[]
  customerSummary: {
    customer: string
    customerId: string
    totalInvoiced: number
    totalPaid: number
    outstanding: number
    overdue: number
    avgInvoiceToPaymentDays: number | null
    avgPoToInvoiceDays: number | null
    totalPo: number
    poMaterial: number
    poService: number
  }[]
  invoices: InvoiceRow[]
  totalRows: number
  filterOptions: { customerList: Option[]; statusList: Option[]; projectStatusList: Option[]; projectFlagList: Option[] }
}

const trendConfig = { Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }
const AGING_COLORS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const statusClass: Record<string, string> = {
  overdue_ongoing: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
  on_time: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  unpaid: 'bg-muted text-muted-foreground',
}


export default function InvoicesPage() {
  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('invoices-table-section')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [cust, setCust] = useState<string[]>([]), [st, setSt] = useState<string[]>([]), [prjSt, setPrjSt] = useState<string[]>([]), [prjFlag, setPrjFlag] = useState<string[]>([])
  const [dateType, setDateType] = useState('invoice')
  const [minAmount, setMinAmount] = useState<string>('')
  const [minPayment, setMinPayment] = useState<string>('')
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lCust, setLCust] = useState<string[]>([]), [lSt, setLSt] = useState<string[]>([]), [lPrjSt, setLPrjSt] = useState<string[]>([]), [lPrjFlag, setLPrjFlag] = useState<string[]>([])
  const [lDateType, setLDateType] = useState('invoice')
  const [lMinAmount, setLMinAmount] = useState<string>('')
  const [lMinPayment, setLMinPayment] = useState<string>('')

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
      dateFrom, dateTo, dateType,
      customer: cust, status: st, projectStatus: prjSt, projectFlag: prjFlag,
      minAmount, minPayment,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, dateType, cust, st, prjSt, prjFlag, minAmount, minPayment, chartFilter])

  const onApply = () => {
    setDateFrom(lFrom); setDateTo(lTo); setCust(lCust); setSt(lSt); setPrjSt(lPrjSt); setPrjFlag(lPrjFlag); setDateType(lDateType)
    setMinAmount(lMinAmount)
    setMinPayment(lMinPayment)
  }
  const onClear = () => {
    const d = getYTD();
    setLFrom(d.from); setLTo(d.to); setLCust([]); setLSt([]); setLPrjSt([]); setLPrjFlag([]); setLMinAmount(''); setLMinPayment(''); setLDateType('invoice')
    setDateFrom(d.from); setDateTo(d.to); setCust([]); setSt([]); setPrjSt([]); setPrjFlag([]); setMinAmount(''); setMinPayment(''); setChartFilter(null); setDateType('invoice')
  }

  const tableRows = useMemo(() => {
    if (!data) return []
    let rows = data.invoices
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => [r.invNumber, r.prj, r.customer, r.refName, r.statusLabel].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])
  const invSort = useSort(tableRows, 'invoiceDate', 'desc')
  const invPage = useLoadMore(invSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lCust, cust) || !sameSet(lSt, st) || !sameSet(lPrjSt, prjSt) || !sameSet(lPrjFlag, prjFlag) || lDateType !== dateType || lMinAmount !== minAmount || lMinPayment !== minPayment

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Invoice Dashboard" subtitle="PT. Multi Daya Mitra" chartFilter={chartFilter} onClearFilter={() => setChartFilter(null)} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-7 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Basis Tanggal</label>
              <Select value={lDateType} onValueChange={(v) => setLDateType(v || '')}>
                <SelectTrigger className="w-full text-xs h-9 bg-background"><SelectValue>{lDateType === 'po' ? 'PO Date' : lDateType === 'payment' ? 'Payment Date' : 'Invoice Date'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice Date</SelectItem>
                  <SelectItem value="po">PO Date</SelectItem>
                  <SelectItem value="payment">Payment Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Customer</label>
              <MultiSelect allLabel="All Customers" selected={lCust} onChange={setLCust} options={data.filterOptions.customerList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Invoice Status</label>
              <MultiSelect allLabel="All Statuses" selected={lSt} onChange={setLSt} options={data.filterOptions.statusList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Status</label>
              <MultiSelect allLabel="All Project Statuses" selected={lPrjSt} onChange={setLPrjSt} options={data.filterOptions.projectStatusList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Flag</label>
              <MultiSelect allLabel="All Project Flags" selected={lPrjFlag} onChange={setLPrjFlag} options={data.filterOptions.projectFlagList} /></div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min Invoice Amount</label>
              <input
                type="number"
                placeholder="e.g. 10000000"
                value={lMinAmount}
                onChange={(e) => setLMinAmount(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min Paid Amount</label>
              <input
                type="number"
                placeholder="e.g. 5000000"
                value={lMinPayment}
                onChange={(e) => setLMinPayment(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Invoiced" value={fmtCurrency(data.kpis.totalInvoiced, 'IDR')} icon={<FileText className="h-4 w-4" />} tooltip="Total gross amount from all invoices issued: SUM(inv_total) within selected filters." />
          <KPICard title="Total Paid" value={fmtCurrency(data.kpis.totalPaid, 'IDR')} icon={<Wallet className="h-4 w-4" />} tooltip="Total cash funds successfully collected: SUM(payment_details.pd_total_amount) within selected filters." />
          <KPICard title="Total Outstanding" value={fmtCurrency(data.kpis.totalOutstanding, 'IDR')} icon={<DollarSign className="h-4 w-4" />} trend={{ value: `${data.kpis.collectionRate}%`, label: 'collected', positive: data.kpis.collectionRate >= 50 }} tooltip="Total unpaid invoices outstanding: SUM((1 - payment_percentage / 100) * inv_total). Trend shows collection rate: Total Paid / Total Invoiced." />
          <KPICard title="Overdue" value={fmtCurrency(data.kpis.overdueAmount, 'IDR')} icon={<Clock className="h-4 w-4" />} trend={{ value: data.kpis.overdueCount, label: 'invoices', positive: false }} tooltip="Total unpaid invoices past their estimated due date: SUM(outstanding WHERE status='Overdue'). Trend shows the number of overdue invoices." />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Status Breakdown
                <InfoTooltip tooltip="Invoice count breakdown by payment status (Paid, Unpaid, Partial, Overdue)." align="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={data.statusBreakdown} height={260} onSliceClick={(name) => handleChartClick('status', name, `Status = ${name}`)} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Invoice vs Payment Trend
                <InfoTooltip tooltip="Monthly comparison of invoice amounts issued vs cash payment received (by each transaction's month)." />
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        {/* Invoice vs Payment By Invoice Date */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Invoice vs Payment Trend (By Invoice Date)
                <InfoTooltip tooltip="Comparison of total invoices issued vs payments calculated from invoice payment percentages." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ Invoice: { label: 'Invoice', color: 'var(--chart-1)' }, Payment: { label: 'Payment', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
                <BarChart data={data.trendByInvoiceDate} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip 
                    formatter={(v: any, name: string, props: any) => {
                      if (name === 'Payment') {
                        const pct = props.payload.PaymentPct || 0;
                        return [`${fmtCurrency(Number(v), 'IDR')} (${pct}%)`, name];
                      }
                      return [fmtCurrency(Number(v), 'IDR'), name];
                    }}
                    contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} 
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="Invoice" fill="var(--color-Invoice)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('invoiceMonth', String(data.name ?? ''), `Invoice Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="Payment" fill="var(--color-Payment)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('invoiceMonth', String(data.name ?? ''), `Invoice Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Invoice vs Payment Trend (Filtered by Invoice Date, Plotted by Actual Date) */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Invoice vs Payment Trend (Filtered by Invoice Date)
                <InfoTooltip tooltip="Dynamic chart showing invoice issuance vs actual cash payment arrival for the filtered invoices." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Timeline shows invoice issuance vs actual payment arrival for the filtered invoices</p>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Aging Receivables
                <InfoTooltip tooltip="Distribution of outstanding receivables by invoice due date aging." />
              </CardTitle>
            </CardHeader>
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

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Lead Time (Project End to Invoice)
                <InfoTooltip tooltip="Average and distribution of days from project completion date to first invoice issued." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Avg: {data.kpis.avgLeadTime} days</p>
            </CardHeader>
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

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Outstanding by Due Date
                <InfoTooltip tooltip="Estimated cash receipt schedule based on due date month of unpaid invoices." align="right" />
              </CardTitle>
            </CardHeader>
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

        {/* Payment Terms & Timelines Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Payment Estimate Term
                <InfoTooltip tooltip="Average and distribution of days from invoice issue date to estimated due date." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Avg: {data.kpis.avgEstPaymentDays} days</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart data={data.estPaymentDaysDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('estPaymentDays', String(data.name ?? ''), `Est Payment Days = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Payment Real Term
                <InfoTooltip tooltip="Average and distribution of days from invoice issue date to actual payment/settlement date." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Avg: {data.kpis.avgActualPaymentDays} days</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart data={data.actualPaymentDaysDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('actualPaymentDays', String(data.name ?? ''), `Actual Payment Days = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Due Date to Payment
                <InfoTooltip tooltip="Average and distribution of days late (or early if negative) between due date and actual payment date." align="right" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Avg: {data.kpis.avgDueToPayDays} days</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart data={data.dueDateToPaymentDaysDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('dueDateToPaymentDays', String(data.name ?? ''), `Due to Payment Days = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Invoices table */}
        <Card className="overflow-hidden" id="invoices-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Invoices <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('en-US')}{tableRows.length !== data.totalRows ? ` of ${data.totalRows.toLocaleString('en-US')}` : ''})</span></CardTitle>
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
                  <SortHead label="Complete Date" column="completedDate" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Due Date" column="dueDate" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Payment Date" column="paymentDate" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Lead Time" column="leadTime" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Amount" column="amount" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Paid" column="paid" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Outstanding" column="outstanding" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                  <SortHead label="Status" column="status" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} />
                  <SortHead label="Overdue (days)" column="daysOverdue" sortKey={invSort.sortKey} sortDir={invSort.sortDir} onSort={invSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow> : invPage.visible.map(r => (
                    <TableRow key={r.invId}>
                      <TableCell className="text-xs font-semibold text-primary">{r.invNumber}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.prj}</TableCell>
                      <TableCell className="text-xs whitespace-normal break-words max-w-[280px]">{r.customer}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(r.invoiceDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.completedDate && r.completedDate !== '-' ? fmtDate(r.completedDate) : '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(r.dueDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.paymentDate && r.paymentDate !== '-' ? fmtDate(r.paymentDate) : '-'}</TableCell>
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
      </div>
    </SalesPageShell>
  )
}
