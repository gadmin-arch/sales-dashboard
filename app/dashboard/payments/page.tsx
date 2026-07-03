'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { InfoTooltip } from '@/components/info-tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DollarSign, Wallet, Hash, Calendar } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD, Progress, fmtShortDate as fmtDate } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'

interface PaymentRow { payId: string; invNumber: string; prj: string; customer: string; date: string; currency: string; amount: number; remarks: string }
interface PaymentData {
  kpis: { totalCollected: number; paymentsThisMonth: number; paymentCount: number; avgPayment: number }
  trend: { name: string; value: number }[]
  byCustomer: { customer: string; value: number }[]
  payments: PaymentRow[]
  totalRows: number
  filterOptions: { customerList: { value: string; label: string }[] }
}

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('payments-table-section')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [cust, setCust] = useState<string[]>([])
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo), [lCust, setLCust] = useState<string[]>([])

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/payments?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => { 
    const fresh = firstLoad.current; firstLoad.current = false; 
    doFetch({ 
      dateFrom, dateTo, customer: cust, 
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {}) 
    }) 
  }, [doFetch, dateFrom, dateTo, cust, chartFilter])
  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setCust(lCust) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLCust([]); setDateFrom(d.from); setDateTo(d.to); setCust([]); setChartFilter(null) }

  const tableRows = useMemo(() => {
    if (!data) return []
    let rows = data.payments
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => [r.invNumber, r.prj, r.customer, r.remarks].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])
  const paySort = useSort(tableRows, 'date', 'desc')
  const payPage = useLoadMore(paySort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lCust, cust)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const maxCust = data.byCustomer[0]?.value || 1

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Payment Dashboard" subtitle="PT. Multi Daya Mitra" chartFilter={chartFilter} onClearFilter={() => setChartFilter(null)} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Customer</label>
              <MultiSelect allLabel="All Customers" selected={lCust} onChange={setLCust} options={data.filterOptions.customerList} />
            </div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Collected" value={fmtRp(data.kpis.totalCollected)} icon={<Wallet className="h-4 w-4" />} tooltip="Cumulative payment amount received: SUM(pay_total_amount || pay_amount) within selected filters." />
          <KPICard title="Collected This Month" value={fmtRp(data.kpis.paymentsThisMonth)} icon={<Calendar className="h-4 w-4" />} tooltip="Cumulative payment amount received specifically during the current month." />
          <KPICard title="Payments" value={data.kpis.paymentCount.toLocaleString('en-US')} icon={<Hash className="h-4 w-4" />} tooltip="Number of payment transactions recorded within the selected filters." />
          <KPICard title="Avg Payment" value={fmtRp(data.kpis.avgPayment)} icon={<DollarSign className="h-4 w-4" />} tooltip="Average amount per payment transaction received: Total Collected / Number of Transactions." />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Collection Trend
                <InfoTooltip tooltip="Monthly trend of payment funds successfully collected." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[280px] w-full">
                <BarChart data={data.trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={fmtRp} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => fmtRp(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} onClick={(data) => handleChartClick('month', String(data.name ?? ''), `Month = ${data.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                Top Customers
                <InfoTooltip tooltip="Customer ranking by total cash inflow payment value deposited." align="right" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.byCustomer.length === 0 ? <p className="text-center text-muted-foreground py-8">No data</p> : data.byCustomer.slice(0, 8).map((c, i) => {
                const isActive = chartFilter?.type === 'customer' && chartFilter.value === c.customer
                return (
                <div key={c.customer} className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg -mx-2 transition-colors ${isActive ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/50'}`} onClick={() => handleChartClick('customer', c.customer, `Customer = ${c.customer}`)}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : ''}`}>{c.customer}</p>
                    <Progress value={(c.value / maxCust) * 100} className="mt-1" />
                  </div>
                  <div className="text-sm font-bold shrink-0">{fmtRp(c.value)}</div>
                </div>
              )})}
            </CardContent>
          </Card>
        </div>

        {/* Payments table */}
        <Card className="overflow-hidden" id="payments-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Payments <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('en-US')}{tableRows.length !== data.totalRows ? ` of ${data.totalRows.toLocaleString('en-US')}` : ''})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Invoice #" column="invNumber" sortKey={paySort.sortKey} sortDir={paySort.sortDir} onSort={paySort.toggle} />
                  <SortHead label="Order #" column="prj" sortKey={paySort.sortKey} sortDir={paySort.sortDir} onSort={paySort.toggle} />
                  <SortHead label="Customer" column="customer" sortKey={paySort.sortKey} sortDir={paySort.sortDir} onSort={paySort.toggle} />
                  <SortHead label="Date" column="date" sortKey={paySort.sortKey} sortDir={paySort.sortDir} onSort={paySort.toggle} />
                  <SortHead label="Currency" column="currency" sortKey={paySort.sortKey} sortDir={paySort.sortDir} onSort={paySort.toggle} />
                  <SortHead label="Amount" column="amount" sortKey={paySort.sortKey} sortDir={paySort.sortDir} onSort={paySort.toggle} className="text-right" />
                  <TableHead className="text-xs font-medium text-muted-foreground">Remarks</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payments found</TableCell></TableRow> : payPage.visible.map(r => (
                    <TableRow key={r.payId}>
                      <TableCell className="max-w-[170px] whitespace-normal break-words align-top text-xs font-semibold text-primary">{r.invNumber}</TableCell>
                      <TableCell className="max-w-[130px] whitespace-normal break-words align-top text-xs text-muted-foreground">{r.prj}</TableCell>
                      <TableCell className="max-w-[160px] whitespace-normal break-words align-top font-medium">{r.customer}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(r.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.currency}</TableCell>
                      <TableCell className="text-right font-medium chart-2">{fmtRp(r.amount)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={r.remarks}>{r.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={payPage.hasMore} shown={payPage.shown} total={payPage.total} onClick={payPage.loadMore} onLoadAll={payPage.loadAll} onCollapse={payPage.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
