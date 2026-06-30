'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { DollarSign, FileText, AlertTriangle, TrendingUp, Loader2, Search, Wallet, Clock, User, Briefcase, FileSpreadsheet } from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { DateRangeRow } from '@/components/date-range-row'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'

interface PaymentRequestRow {
  payreqId: string
  poId: string
  projectName: string
  invoiceNumber: string
  amount: number
  paidAmount: number
  outstanding: number
  dueDate: string
  daysOverdue: number
  statusLabel: string
  remarks: string
  file: string | null
  createdBy: string
}

interface ReimbursementRow {
  reimburseId: string
  date: string
  projectName: string
  description: string
  amount: number
  category: string
  statusLabel: string
  remarks: string
  employeeName: string
  image: string | null
}

interface Option { value: string; label: string }

interface FinanceAPData {
  kpis: {
    totalOutstandingAP: number
    totalCashOutflow: number
    pendingApprovalCount: number
    pettyCashBalance: number
    totalReimburseIn: number
    totalReimburseOut: number
  }
  trend: { name: string; Payments: number; Reimburse: number; Total: number }[]
  aging: { name: string; value: number }[]
  categoryBreakdown: { name: string; value: number }[]
  projectExpenses: { projectId: string; projectName: string; amount: number }[]
  topEmployees: { name: string; amount: number; count: number }[]
  paymentRequestsList: PaymentRequestRow[]
  reimbursementsList: ReimbursementRow[]
  filterOptions: {
    employeeList: Option[]
    projectList: Option[]
    statusList: Option[]
  }
}

function fmtDate(d: string): string {
  if (!d) return '-'
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const date = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(d)
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function FinanceAPPage() {
  const [data, setData] = useState<FinanceAPData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchRequests, setSearchRequests] = useState('')
  const [searchReimbursements, setSearchReimbursements] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('finance-tables-section')

  const [dateFrom, setDateFrom] = useState(getYTD().from)
  const [dateTo, setDateTo] = useState(getYTD().to)
  const [emp, setEmp] = useState<string[]>([])
  const [project, setProject] = useState<string[]>([])
  const [st, setSt] = useState<string[]>([])

  const [lFrom, setLFrom] = useState(dateFrom)
  const [lTo, setLTo] = useState(dateTo)
  const [lEmp, setLEmp] = useState<string[]>([])
  const [lProject, setLProject] = useState<string[]>([])
  const [lSt, setLSt] = useState<string[]>([])

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/finance-ap?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current
    firstLoad.current = false
    doFetch({
      dateFrom,
      dateTo,
      employee: emp,
      project,
      status: st,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, emp, project, st, chartFilter])

  const onApply = () => {
    setDateFrom(lFrom)
    setDateTo(lTo)
    setEmp(lEmp)
    setProject(lProject)
    setSt(lSt)
  }

  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from)
    setLTo(d.to)
    setLEmp([])
    setLProject([])
    setLSt([])
    setDateFrom(d.from)
    setDateTo(d.to)
    setEmp([])
    setProject([])
    setSt([])
    setChartFilter(null)
  }

  const filteredRequests = useMemo(() => {
    if (!data) return []
    let rows = data.paymentRequestsList
    if (!searchRequests) return rows
    const q = searchRequests.toLowerCase()
    return rows.filter(r => [r.payreqId, r.poId, r.projectName, r.invoiceNumber, r.createdBy, r.statusLabel, r.remarks].some(s => s?.toLowerCase().includes(q)))
  }, [data, searchRequests])

  const filteredReimbursements = useMemo(() => {
    if (!data) return []
    let rows = data.reimbursementsList
    if (!searchReimbursements) return rows
    const q = searchReimbursements.toLowerCase()
    return rows.filter(r => [r.reimburseId, r.projectName, r.description, r.employeeName, r.category, r.statusLabel, r.remarks].some(s => s?.toLowerCase().includes(q)))
  }, [data, searchReimbursements])

  const requestsSort = useSort(filteredRequests, 'payreqId', 'desc')
  const requestsPage = useLoadMore(requestsSort.sorted)

  const reimbursementsSort = useSort(filteredReimbursements, 'date', 'desc')
  const reimbursementsPage = useLoadMore(reimbursementsSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lEmp, emp) || !sameSet(lProject, project) || !sameSet(lSt, st)

  if (loading && !data) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !data) return <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4"><p className="text-destructive">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Finance AP & Reimbursement</h1>
              <p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p>
            </div>
            {chartFilter && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
                <span className="text-muted-foreground">Filtered by:</span> {chartFilter.label}
                <button onClick={() => setChartFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5">
                  <div className="h-4 w-4 flex items-center justify-center">✕</div>
                </button>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Employee / Requester</label>
                <MultiSelect allLabel="All Employees" selected={lEmp} onChange={l => setLEmp(l)} options={data.filterOptions.employeeList} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Project PO</label>
                <MultiSelect allLabel="All Projects" selected={lProject} onChange={l => setLProject(l)} options={data.filterOptions.projectList} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Request Status</label>
                <MultiSelect allLabel="All Statuses" selected={lSt} onChange={l => setLSt(l)} options={data.filterOptions.statusList} />
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
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Outstanding AP" value={fmtRp(data.kpis.totalOutstandingAP)} icon={<FileText className="h-4 w-4" />} />
          <KPICard title="Cash Outflow (Actual)" value={fmtRp(data.kpis.totalCashOutflow)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Petty Cash Balance" value={fmtRp(data.kpis.pettyCashBalance)} icon={<DollarSign className="h-4 w-4" />} trend={{ value: `${Math.round((data.kpis.totalReimburseOut / Math.max(1, data.kpis.totalReimburseIn)) * 100)}%`, label: 'spent', positive: data.kpis.pettyCashBalance > 0 }} />
          <KPICard title="Pending Request" value={data.kpis.pendingApprovalCount.toString()} icon={<Clock className="h-4 w-4" />} />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Cash Outflow Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ Payments: { label: 'Payments', color: 'var(--chart-1)' }, Reimburse: { label: 'Reimbursements', color: 'var(--chart-2)' } }} className="h-[280px] w-full">
                <BarChart data={data.trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="Payments" fill="var(--color-Payments)" radius={[4, 4, 0, 0]} onClick={(d) => handleChartClick('month', String(d.name ?? ''), `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="Reimburse" fill="var(--color-Reimburse)" radius={[4, 4, 0, 0]} onClick={(d) => handleChartClick('month', String(d.name ?? ''), `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Petty Cash Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={data.categoryBreakdown} height={280} onSliceClick={(name) => handleChartClick('opExpense', name, `Category = ${name}`)} />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Aging Payables</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[240px] w-full">
                <BarChart data={data.aging} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                  <YAxis stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip formatter={(v: any) => fmtCurrency(Number(v), 'IDR')} cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} onClick={(d) => handleChartClick('aging', String(d.name ?? ''), `Aging = ${d.name}`)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Top Project Operational Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[240px] w-full">
                <BarChart layout="vertical" data={data.projectExpenses} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" tickFormatter={(v) => fmtCurrency(v, 'IDR')} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis type="category" dataKey="projectId" stroke="var(--muted-foreground)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" width={80} />
                  <Tooltip formatter={(v: any) => fmtRp(Number(v))} cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="amount" fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Section: Tables */}
        <div id="finance-tables-section" className="space-y-6">
          {/* Table: Payment Requests */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Payment Requests</CardTitle>
                <p className="text-xs text-muted-foreground">List of outstanding or processed payments for vendor invoices and site operations</p>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search requests..." value={searchRequests} onChange={e => setSearchRequests(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead label="Request ID" column="payreqId" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} />
                      <SortHead label="PO ID" column="poId" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} />
                      <SortHead label="Project" column="projectName" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} />
                      <SortHead label="Requester" column="createdBy" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} />
                      <SortHead label="Due Date" column="dueDate" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} />
                      <SortHead label="Amount" column="amount" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} className="text-right" />
                      <SortHead label="Outstanding" column="outstanding" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} className="text-right" />
                      <SortHead label="Status" column="statusLabel" sortKey={requestsSort.sortKey} sortDir={requestsSort.sortDir} onSort={requestsSort.toggle} />
                      <TableHead className="text-center">Doc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payment requests found</TableCell></TableRow>
                    ) : (
                      requestsPage.visible.map(r => (
                        <TableRow key={r.payreqId}>
                          <TableCell className="text-xs font-semibold text-primary">{r.payreqId}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.poId}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{r.projectName}</TableCell>
                          <TableCell className="text-xs">{r.createdBy}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(r.dueDate)}</TableCell>
                          <TableCell className="text-right font-medium">{fmtRp(r.amount)}</TableCell>
                          <TableCell className="text-right font-medium text-amber-600 dark:text-amber-400">{fmtRp(r.outstanding)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${
                              r.statusLabel === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                              r.statusLabel === 'Requested' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                              r.statusLabel === 'Cancel' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>{r.statusLabel}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {r.file ? (
                              <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(r.file)}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <LoadMore hasMore={requestsPage.hasMore} shown={requestsPage.shown} total={requestsPage.total} onClick={requestsPage.loadMore} onLoadAll={requestsPage.loadAll} onCollapse={requestsPage.collapse} />
            </CardContent>
          </Card>

          {/* Table: Reimbursement Claims */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Petty Cash Reimbursements</CardTitle>
                <p className="text-xs text-muted-foreground">List of employee reimbursement claims and daily office/site expenses</p>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search reimburse..." value={searchReimbursements} onChange={e => setSearchReimbursements(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead label="Reimburse ID" column="reimburseId" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <SortHead label="Date" column="date" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <SortHead label="Employee" column="employeeName" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <SortHead label="Category" column="category" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <SortHead label="Description" column="description" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <SortHead label="Project" column="projectName" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <SortHead label="Amount" column="amount" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} className="text-right" />
                      <SortHead label="Status" column="statusLabel" sortKey={reimbursementsSort.sortKey} sortDir={reimbursementsSort.sortDir} onSort={reimbursementsSort.toggle} />
                      <TableHead className="text-center">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReimbursements.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No reimbursement claims found</TableCell></TableRow>
                    ) : (
                      reimbursementsPage.visible.map(r => (
                        <TableRow key={r.reimburseId}>
                          <TableCell className="text-xs font-semibold text-primary">{r.reimburseId}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(r.date)}</TableCell>
                          <TableCell className="text-xs">{r.employeeName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.category}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.description}>{r.description}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground">{r.projectName}</TableCell>
                          <TableCell className="text-right font-medium">{fmtRp(r.amount)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${
                              r.statusLabel === 'Approve' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                              r.statusLabel === 'Rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>{r.statusLabel}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {r.image ? (
                              <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(r.image)}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <LoadMore hasMore={reimbursementsPage.hasMore} shown={reimbursementsPage.shown} total={reimbursementsPage.total} onClick={reimbursementsPage.loadMore} onLoadAll={reimbursementsPage.loadAll} onCollapse={reimbursementsPage.collapse} />
            </CardContent>
          </Card>
        </div>
      </div>
    </SalesPageShell>
  )
}
