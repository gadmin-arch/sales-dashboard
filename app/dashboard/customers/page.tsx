'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { InfoTooltip } from '@/components/info-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CreditCard, Clock, FileText } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { fmtCurrency, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'
import { ExportButton } from '@/components/export-button'
import { DataTable } from '@/components/ui/data-table'
import { columns, CustomerSummaryRow } from './columns'

interface Option { value: string; label: string }
// Types moved to columns.tsx
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

  const tableRows = data?.customerSummary ?? []

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

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="space-y-6">
        <PageHeader title="Customer Scorecard" subtitle="PT. Multi Daya Mitra" breadcrumbs={[{ label: 'Sales' }, { label: 'Customer Scorecard' }]}  actions={<ExportButton data={tableRows} filename="customers.csv" />} />

        {/* Filters */}
        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-start">
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
          </div>
        </FilterCard>

        {/* KPIs Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Total Customers" value={kpis.totalCustomers.toLocaleString('en-US')} icon={<Users className="h-4 w-4" />} tooltip="Number of active customers" />
          <KPICard title="Total PO Value" value={fmtRp(kpis.totalPO)} icon={<FileText className="h-4 w-4 text-sky-500" />} tooltip="Cumulative PO contract value" />
          <KPICard title="Outstanding Receivables" value={fmtRp(kpis.outstanding)} icon={<CreditCard className="h-4 w-4 text-amber-500" />} tooltip="Remaining billing receivables" />
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
            <DataTable columns={columns} data={tableRows} search={search} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
