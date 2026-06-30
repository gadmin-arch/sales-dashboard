'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { ShoppingCart, FileText, Wallet, Store, Receipt, Loader2, Search, CheckCircle2 } from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { DateRangeRow } from '@/components/date-range-row'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD, fmtShortDate as fmtDate, truncLabel as truncTick } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'

interface PORow {
  poNumber: string; poDate: string; vendorId: string; vendor: string; userId: string; user: string; projects: string
  projectIds: string[]; itemTypeIds: string[]
  gross: number; discount: number; net: number; ppn: number; pph: number; amount: number
  paymentType: string; paymentTypeLabel: string; dpPercent: number; paymentProgress: number
  deliveryDate: string; status: string; statusLabel: string
}
interface Option { value: string; label: string }
interface Pct { name: string; value: number }
interface POData {
  kpis: { totalSpend: number; poCount: number; lineCount: number; avgPO: number; vendorCount: number; totalNet: number; totalPpn: number; totalPph: number; approvedCount: number; waitingCount: number }
  spendTrend: Pct[]
  spendByVendor: Pct[]
  spendByProject: { id: string; name: string; value: number }[]
  spendByItemType: Pct[]
  paymentTypeMix: Pct[]
  statusMix: Pct[]
  netByUser: Pct[]
  poByUser: Pct[]
  lineByUser: Pct[]
  orders: PORow[]
  totalRows: number
  filterOptions: { vendorList: Option[]; projectList: Option[]; paymentTypeList: Option[]; statusList: Option[]; itemTypeList: Option[]; userList: Option[] }
}

const statusClass: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  W: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  R: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function PurchaseOrdersPage() {
  const [data, setData] = useState<POData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('po-table-section', undefined, false)

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [ven, setVen] = useState<string[]>([]), [prj, setPrj] = useState<string[]>([]), [pt, setPt] = useState<string[]>([])
  const [st, setSt] = useState<string[]>([]), [it, setIt] = useState<string[]>([]), [usr, setUsr] = useState<string[]>([])
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lVen, setLVen] = useState<string[]>([]), [lPrj, setLPrj] = useState<string[]>([]), [lPt, setLPt] = useState<string[]>([])
  const [lSt, setLSt] = useState<string[]>([]), [lIt, setLIt] = useState<string[]>([]), [lUsr, setLUsr] = useState<string[]>([])

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/purchasing/orders?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({
      dateFrom, dateTo, vendor: ven, project: prj, paymentType: pt, status: st, itemType: it, user: usr,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {}),
    })
  }, [doFetch, dateFrom, dateTo, ven, prj, pt, st, it, usr, chartFilter])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setVen(lVen); setPrj(lPrj); setPt(lPt); setSt(lSt); setIt(lIt); setUsr(lUsr) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLVen([]); setLPrj([]); setLPt([]); setLSt([]); setLIt([]); setLUsr([])
    setDateFrom(d.from); setDateTo(d.to); setVen([]); setPrj([]); setPt([]); setSt([]); setIt([]); setUsr([]); setChartFilter(null)
  }

  const tableRows = useMemo(() => {
    if (!data) return []
    if (!search) return data.orders
    const q = search.toLowerCase()
    return data.orders.filter(r => [r.poNumber, r.vendor, r.user, r.projects, r.statusLabel, r.paymentTypeLabel].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])
  const poSort = useSort(tableRows, 'poDate', 'desc')
  const poPage = useLoadMore(poSort.sorted)

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lVen, ven) || !sameSet(lPrj, prj) || !sameSet(lPt, pt) || !sameSet(lSt, st) || !sameSet(lIt, it) || !sameSet(lUsr, usr)

  if (loading && !data) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !data) return <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4"><p className="text-destructive">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!data) return null

  const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
  const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight">Purchase Orders & Spend</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra — Procurement Spend</p></div>
            {chartFilter && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
                <span className="text-muted-foreground">Filtered by:</span> {chartFilter.label}
                <button onClick={() => setChartFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5"><div className="h-4 w-4 flex items-center justify-center">✕</div></button>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>

        {/* Filters */}
        <Card><CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Vendor</label>
              <MultiSelect allLabel="All Vendors" selected={lVen} onChange={setLVen} options={data.filterOptions.vendorList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project</label>
              <MultiSelect allLabel="All Projects" selected={lPrj} onChange={setLPrj} options={data.filterOptions.projectList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Payment Type</label>
              <MultiSelect allLabel="All Payment Types" selected={lPt} onChange={setLPt} options={data.filterOptions.paymentTypeList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">PO Status</label>
              <MultiSelect allLabel="All Statuses" selected={lSt} onChange={setLSt} options={data.filterOptions.statusList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Item Type</label>
              <MultiSelect allLabel="All Item Types" selected={lIt} onChange={setLIt} options={data.filterOptions.itemTypeList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">User</label>
              <MultiSelect allLabel="All Users" selected={lUsr} onChange={setLUsr} options={data.filterOptions.userList} /></div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">Apply Filters{hasUnapplied && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}</Button>
          </div>
          {loading && data && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Spend" value={fmtRp(data.kpis.totalSpend)} icon={<ShoppingCart className="h-4 w-4" />} />
          <KPICard title="PO Count" value={data.kpis.poCount.toLocaleString('id-ID')} icon={<FileText className="h-4 w-4" />} trend={{ value: data.kpis.lineCount.toLocaleString('id-ID'), label: 'line items', positive: true }} />
          <KPICard title="Avg PO Value" value={fmtRp(data.kpis.avgPO)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Vendors" value={data.kpis.vendorCount.toLocaleString('id-ID')} icon={<Store className="h-4 w-4" />} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Net Spend" value={fmtRp(data.kpis.totalNet)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Total PPN" value={fmtRp(data.kpis.totalPpn)} icon={<Receipt className="h-4 w-4" />} />
          <KPICard title="Total PPH" value={fmtRp(data.kpis.totalPph)} icon={<Receipt className="h-4 w-4" />} />
          <KPICard title="Approved" value={data.kpis.approvedCount.toLocaleString('id-ID')} icon={<CheckCircle2 className="h-4 w-4" />} trend={{ value: data.kpis.waitingCount, label: 'waiting', positive: false }} />
        </div>

        {/* Spend trend */}
        <Card><CardHeader><CardTitle className="text-sm font-semibold">Spend Trend (Monthly)</CardTitle></CardHeader><CardContent>
          <ChartContainer config={{}} className="h-[280px] w-full">
            <BarChart data={data.spendTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
              <Tooltip formatter={(v: any) => fmtRp(Number(v))} cursor={{ fill: 'var(--muted)' }} {...tip} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} onClick={(d) => handleChartClick('spendMonth', String(d.name ?? ''), `Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ChartContainer>
        </CardContent></Card>

        {/* Donut row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Payment Type Mix</CardTitle></CardHeader><CardContent><DonutChart data={data.paymentTypeMix} height={260} currency="IDR" onSliceClick={(name) => handleChartClick('paymentType', name, `Payment = ${name}`)} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Spend by PO Status</CardTitle></CardHeader><CardContent><DonutChart data={data.statusMix} height={260} currency="IDR" onSliceClick={(name) => handleChartClick('status', name, `Status = ${name}`)} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Spend by Item Type</CardTitle></CardHeader><CardContent><DonutChart data={data.spendByItemType} height={260} currency="IDR" onSliceClick={(name) => handleChartClick('itemType', name, `Item Type = ${name}`)} /></CardContent></Card>
        </div>

        {/* Vendor / project bars */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Top Vendors by Spend</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={data.spendByVendor} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} width={160} tickFormatter={(v: string) => truncTick(v)} axisLine={false} />
                <Tooltip formatter={(v: any) => fmtRp(Number(v))} cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} onClick={(d) => handleChartClick('vendor', String(d.name ?? ''), `Vendor = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Top Projects by Spend</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={data.spendByProject} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
                <YAxis type="category" dataKey="id" {...axis} width={70} axisLine={false} />
                <Tooltip formatter={(v: any) => fmtRp(Number(v))} labelFormatter={(id: any) => data.spendByProject.find(p => p.id === id)?.name || id} cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-4)" radius={[0, 4, 4, 0]} onClick={(d: any) => handleChartClick('project', String(d.id ?? ''), `Project = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* By Purchaser (PO_P_User) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Net Spend by Purchaser</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={data.netByUser} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} width={120} tickFormatter={(v: string) => truncTick(v)} axisLine={false} />
                <Tooltip formatter={(v: any) => fmtRp(Number(v))} cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} onClick={(d) => handleChartClick('user', String(d.name ?? ''), `User = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">PO Count by Purchaser</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={data.poByUser} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} width={120} tickFormatter={(v: string) => truncTick(v)} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} onClick={(d) => handleChartClick('user', String(d.name ?? ''), `User = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">PO Lines by Purchaser</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={data.lineByUser} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} width={120} tickFormatter={(v: string) => truncTick(v)} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} {...tip} />
                <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} onClick={(d) => handleChartClick('user', String(d.name ?? ''), `User = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* PO table */}
        <Card className="overflow-hidden" id="po-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Purchase Orders <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('id-ID')}{tableRows.length !== data.totalRows ? ` of ${data.totalRows.toLocaleString('id-ID')}` : ''})</span></CardTitle>
            <div className="relative w-48"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" /></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="PO #" column="poNumber" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="Date" column="poDate" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="Vendor" column="vendor" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="User" column="user" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="Project" column="projects" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="Net" column="net" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} className="text-right" />
                  <SortHead label="PPN" column="ppn" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} className="text-right" />
                  <SortHead label="Amount" column="amount" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} className="text-right" />
                  <SortHead label="Payment" column="paymentTypeLabel" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="PPH" column="pph" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} className="text-right" />
                  <SortHead label="Delivery" column="deliveryDate" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                  <SortHead label="Status" column="status" sortKey={poSort.sortKey} sortDir={poSort.sortDir} onSort={poSort.toggle} />
                </TableRow></TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No purchase orders found</TableCell></TableRow> : poPage.visible.map(r => (
                    <TableRow key={r.poNumber}>
                      <TableCell className="text-xs font-semibold text-primary whitespace-nowrap">{r.poNumber}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(r.poDate)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.vendor}>{r.vendor}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs" title={r.user}>{r.user}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground" title={r.projects}>{r.projects}</TableCell>
                      <TableCell className="text-right">{fmtRp(r.net)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtRp(r.ppn)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(r.amount)}</TableCell>
                      <TableCell className="text-xs">{r.paymentTypeLabel}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtRp(r.pph)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(r.deliveryDate)}</TableCell>
                      <TableCell><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${statusClass[r.status] || 'bg-muted text-muted-foreground'}`}>{r.statusLabel}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={poPage.hasMore} shown={poPage.shown} total={poPage.total} onClick={poPage.loadMore} onLoadAll={poPage.loadAll} onCollapse={poPage.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
