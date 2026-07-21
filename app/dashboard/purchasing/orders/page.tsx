'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DonutChart } from '@/components/donut-chart'
import { ShoppingCart, FileText, Wallet, Store, Receipt, CheckCircle2 } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { useServerRows } from '@/hooks/use-server-rows'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { ColumnDef } from '@tanstack/react-table'
import { fmtCurrency, buildQuery, sameSet, getYTD, fmtShortDate as fmtDate, truncLabel as truncTick } from '@/lib/sales-helpers'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { ExportButton } from '@/components/export-button'

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

// Stable fallback while data is loading — a fresh `?? []` per render would
// retrigger useServerRows' reset effect in a loop.
const EMPTY_ROWS: PORow[] = []

const columns: ColumnDef<PORow>[] = [
  { accessorKey: 'poNumber', header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />, cell: ({ row }) => <span className="font-medium text-foreground">{row.original.poNumber}</span> },
  { accessorKey: 'poDate', header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />, cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.poDate)}</span> },
  { accessorKey: 'vendor', header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />, cell: ({ row }) => <span className="truncate max-w-[150px] inline-block">{row.original.vendor}</span> },
  { accessorKey: 'projects', header: ({ column }) => <DataTableColumnHeader column={column} title="Project(s)" />, cell: ({ row }) => <span className="truncate max-w-[150px] inline-block text-muted-foreground">{row.original.projects || '-'}</span> },
  { accessorKey: 'user', header: ({ column }) => <DataTableColumnHeader column={column} title="Requester" />, cell: ({ row }) => <span className="truncate max-w-[120px] inline-block text-muted-foreground">{row.original.user || '-'}</span> },
  { accessorKey: 'amount', header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />, cell: ({ row }) => <span className="font-semibold text-foreground">{fmtCurrency(row.original.amount, 'IDR')}</span> },
  { accessorKey: 'statusLabel', header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />, cell: ({ row }) => <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass[row.original.status] || 'bg-muted text-muted-foreground'}`}>{row.original.statusLabel}</span> },
]

export default function PurchaseOrdersPage() {
  const [data, setData] = useState<POData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  // Server-backed table: main payload carries only the first page; sorting,
  // searching, and load-more request slices from the route's cached row view.
  const po = useServerRows<PORow>({
    endpoint: '/api/purchasing/orders',
    baseParams: {
      dateFrom, dateTo, vendor: ven, project: prj, paymentType: pt, status: st, itemType: it, user: usr,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
    },
    initialRows: data?.orders ?? EMPTY_ROWS,
    totalRows: data?.totalRows ?? 0,
    initialSortKey: 'poDate',
  })

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lVen, ven) || !sameSet(lPrj, prj) || !sameSet(lPt, pt) || !sameSet(lSt, st) || !sameSet(lIt, it) || !sameSet(lUsr, usr)

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
  const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Purchase Orders & Spend" subtitle="PT. Multi Daya Mitra — Procurement Spend" breadcrumbs={[{ label: 'Purchasing' }, { label: 'Purchase Orders' }]} chartFilter={chartFilter} onClearFilter={() => setChartFilter(null)} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
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
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Total Spend" value={fmtRp(data.kpis.totalSpend)} icon={<ShoppingCart className="h-4 w-4" />} />
          <KPICard title="PO Count" value={data.kpis.poCount.toLocaleString('en-US')} icon={<FileText className="h-4 w-4" />} trend={{ value: data.kpis.lineCount.toLocaleString('en-US'), label: 'line items', positive: true }} />
          <KPICard title="Avg PO Value" value={fmtRp(data.kpis.avgPO)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Vendors" value={data.kpis.vendorCount.toLocaleString('en-US')} icon={<Store className="h-4 w-4" />} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Net Spend" value={fmtRp(data.kpis.totalNet)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Total PPN" value={fmtRp(data.kpis.totalPpn)} icon={<Receipt className="h-4 w-4" />} />
          <KPICard title="Total PPH" value={fmtRp(data.kpis.totalPph)} icon={<Receipt className="h-4 w-4" />} />
          <KPICard title="Approved" value={data.kpis.approvedCount.toLocaleString('en-US')} icon={<CheckCircle2 className="h-4 w-4" />} trend={{ value: data.kpis.waitingCount, label: 'waiting', positive: false }} />
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
            <CardTitle className="text-sm font-semibold">Purchase Orders <span className="font-normal text-muted-foreground">({po.total.toLocaleString('en-US')}{po.total !== data.totalRows ? ` of ${data.totalRows.toLocaleString('en-US')}` : ''})</span></CardTitle>
            <SearchInput value={po.search} onChange={po.setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <DataTable 
              columns={columns} 
              data={po.rows} 
              manualPagination={true}
              pageCount={po.pageCount}
              pagination={po.pagination}
              onPaginationChange={po.onPaginationChange}
              manualSorting={true}
              sorting={po.sorting}
              onSortingChange={po.onSortingChange}
            />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
