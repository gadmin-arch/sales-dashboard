'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { InfoTooltip } from '@/components/info-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Users, CreditCard, Clock, FileText } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'

interface Option { value: string; label: string }
interface CustomerSummaryRow {
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
}
interface InvoicesData {
  customerSummary: CustomerSummaryRow[]
  filterOptions: { customerList: Option[]; statusList: Option[]; projectStatusList: Option[]; projectFlagList: Option[] }
}

export default function CustomerScorecardPage() {
  const firstLoad = useRef(true)
  const [data, setData] = useState<InvoicesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [cust, setCust] = useState<string[]>([]), [st, setSt] = useState<string[]>([]), [prjSt, setPrjSt] = useState<string[]>([]), [prjFlag, setPrjFlag] = useState<string[]>([])
  const [dateType, setDateType] = useState('invoice')

  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lCust, setLCust] = useState<string[]>([]), [lSt, setLSt] = useState<string[]>([]), [lPrjSt, setLPrjSt] = useState<string[]>([]), [lPrjFlag, setLPrjFlag] = useState<string[]>([])
  const [lDateType, setLDateType] = useState('invoice')

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (params: any) => {
    try {
      setLoading(true)
      const query = buildQuery(params)
      const res = await fetch(`/api/invoices?${query}`)
      if (!res.ok) throw new Error('Failed to load scorecard data')
      const body = await res.json()
      setData(body)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({
      dateFrom, dateTo, dateType,
      customer: cust, status: st, projectStatus: prjSt, projectFlag: prjFlag,
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, dateType, cust, st, prjSt, prjFlag])

  const onApply = () => {
    setDateFrom(lFrom); setDateTo(lTo); setCust(lCust); setSt(lSt); setPrjSt(lPrjSt); setPrjFlag(lPrjFlag); setDateType(lDateType)
  }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLCust([]); setLSt([]); setLPrjSt([]); setLPrjFlag([]); setLDateType('invoice')
    setDateFrom(d.from); setDateTo(d.to); setCust([]); setSt([]); setPrjSt([]); setPrjFlag([]); setDateType('invoice')
  }

  const tableRows = useMemo(() => {
    const raw = data?.customerSummary ?? []
    if (!search) return raw
    const q = search.toLowerCase()
    return raw.filter(r => r.customer.toLowerCase().includes(q))
  }, [data, search])

  const custSort = useSort(tableRows, 'totalPo', 'desc')
  const custPage = useLoadMore(custSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lCust, cust) || !sameSet(lSt, st) || !sameSet(lPrjSt, prjSt) || !sameSet(lPrjFlag, prjFlag) || lDateType !== dateType

  // Aggregate high-level stats from scorecard
  const kpis = useMemo(() => {
    const list = data?.customerSummary ?? []
    const totalCustomers = list.length
    const totalPO = list.reduce((s, c) => s + c.totalPo, 0)
    const totalInvoiced = list.reduce((s, c) => s + c.totalInvoiced, 0)
    const totalPaid = list.reduce((s, c) => s + c.totalPaid, 0)
    const outstanding = list.reduce((s, c) => s + c.outstanding, 0)

    const payDaysList = list.map(c => c.avgInvoiceToPaymentDays).filter((v): v is number => v !== null)
    const avgInvoiceToPayment = payDaysList.length > 0 ? Math.round(payDaysList.reduce((s, v) => s + v, 0) / payDaysList.length) : 0

    const leadDaysList = list.map(c => c.avgPoToInvoiceDays).filter((v): v is number => v !== null)
    const avgPoToInvoice = leadDaysList.length > 0 ? Math.round(leadDaysList.reduce((s, v) => s + v, 0) / leadDaysList.length) : 0

    return { totalCustomers, totalPO, totalInvoiced, totalPaid, outstanding, avgInvoiceToPayment, avgPoToInvoice }
  }, [data])

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="space-y-6">
        <PageHeader title="Customer Scorecard" subtitle="PT. Multi Daya Mitra" />

        {/* Filters */}
        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Basis Tanggal</label>
              <Select value={lDateType} onValueChange={setLDateType}>
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
          </div>
        </FilterCard>

        {/* KPIs Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Total Customers" value={kpis.totalCustomers.toLocaleString('en-US')} icon={<Users className="h-4 w-4" />} description="Number of active customers" />
          <KPICard title="Total PO Value" value={fmtRp(kpis.totalPO)} icon={<FileText className="h-4 w-4 text-sky-500" />} description="Cumulative PO contract value" />
          <KPICard title="Outstanding Receivables" value={fmtRp(kpis.outstanding)} icon={<CreditCard className="h-4 w-4 text-amber-500" />} description="Remaining billing receivables" />
          <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <span className="text-xs font-medium text-muted-foreground">Avg. Performance Timeline</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1">PO to Invoice <InfoTooltip tooltip="Average time to issue an invoice after PO release" /></span>
                <span className="font-semibold">{kpis.avgPoToInvoice}d</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1">Invoice to Payment <InfoTooltip tooltip="Average time for customer to settle an invoice" /></span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{kpis.avgInvoiceToPayment}d</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Table Card */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Customer Performance Scorecard <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('en-US')})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Customer" column="customer" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} />
                  <SortHead label="Total PO" column="totalPo" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Invoiced" column="totalInvoiced" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Paid" column="totalPaid" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Outstanding" column="outstanding" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Overdue" column="overdue" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="PO to Invoice" column="avgPoToInvoiceDays" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                  <SortHead label="Invoice to Payment" column="avgInvoiceToPaymentDays" sortKey={custSort.sortKey} sortDir={custSort.sortDir} onSort={custSort.toggle} className="text-right" />
                </TableRow></TableHeader>
                <TableBody>
                  {custSort.sorted.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data found</TableCell></TableRow> : custPage.visible.map(c => (
                    <TableRow key={c.customer}>
                      <TableCell className="font-medium text-xs whitespace-normal break-words max-w-[200px]">{c.customer}</TableCell>
                      <TableCell className="text-right text-xs min-w-[160px]">
                        <div className="font-semibold text-primary">{fmtRp(c.totalPo)}</div>
                        {c.totalPo > 0 ? (
                          <div className="mt-1.5 w-full space-y-1">
                            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted">
                              <div className="bg-sky-500" style={{ width: `${(c.poMaterial / c.totalPo) * 100}%` }} title={`Material: ${((c.poMaterial / c.totalPo) * 100).toFixed(1)}%`} />
                              <div className="bg-emerald-500" style={{ width: `${(c.poService / c.totalPo) * 100}%` }} title={`Service: ${((c.poService / c.totalPo) * 100).toFixed(1)}%`} />
                            </div>
                            <div className="flex justify-between text-[9px] text-muted-foreground whitespace-nowrap gap-2">
                              <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />Mat: {((c.poMaterial / c.totalPo) * 100).toFixed(0)}% ({fmtRp(c.poMaterial)})</span>
                              <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />Svc: {((c.poService / c.totalPo) * 100).toFixed(0)}% ({fmtRp(c.poService)})</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground">—</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">{fmtRp(c.totalInvoiced)}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400 font-medium">{fmtRp(c.totalPaid)}</TableCell>
                      <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400 font-medium">{fmtRp(c.outstanding)}</TableCell>
                      <TableCell className="text-right text-xs text-rose-600 dark:text-rose-400 font-medium">{fmtRp(c.overdue)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-medium">
                        {c.avgPoToInvoiceDays !== null ? `${c.avgPoToInvoiceDays}d` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-medium">
                        {c.avgInvoiceToPaymentDays !== null ? `${c.avgInvoiceToPaymentDays}d` : '—'}
                      </TableCell>
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
