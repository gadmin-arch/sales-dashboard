'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Store, Wallet, Crown, Users } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { ColumnDef } from '@tanstack/react-table'
import { fmtCurrency, buildQuery, sameSet, getYTD, fmtShortDate as fmtDate, truncLabel as truncTick } from '@/lib/sales-helpers'
import { ExportButton } from '@/components/export-button'

interface VendorRow {
  vendorId: string; vendor: string; poCount: number; totalSpend: number; avgPO: number
  sharePct: number; lastPoDate: string; paymentTypes: string; quotesCount: number; quotedValue: number
}
interface Option { value: string; label: string }
interface VendorData {
  kpis: { activeVendors: number; totalSpend: number; topVendorShare: number; avgPerVendor: number }
  topVendors: { name: string; value: number }[]
  pareto: { name: string; spend: number; cumulativePct: number }[]
  vendors: VendorRow[]
  totalRows: number
  filterOptions: { paymentTypeList: Option[] }
}

export default function VendorScorecardPage() {
  const [data, setData] = useState<VendorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [pt, setPt] = useState<string[]>([]), [minSpend, setMinSpend] = useState('')
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lPt, setLPt] = useState<string[]>([]), [lMin, setLMin] = useState('')

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/purchasing/vendors?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({ dateFrom, dateTo, paymentType: pt, minSpend, ...(fresh ? { fresh: '1' } : {}) })
  }, [doFetch, dateFrom, dateTo, pt, minSpend])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setPt(lPt); setMinSpend(lMin) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLPt([]); setLMin('')
    setDateFrom(d.from); setDateTo(d.to); setPt([]); setMinSpend('')
  }

  const tableRows = useMemo(() => {
    if (!data) return []
    if (!search) return data.vendors
    const q = search.toLowerCase()
    return data.vendors.filter(r => [r.vendor, r.vendorId, r.paymentTypes].some(s => s?.toLowerCase().includes(q)))
  }, [data, search])

  const onBarClick = (name: string) => {
    setSearch(name)
  }

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lPt, pt) || lMin !== minSpend

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
  const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'vendor', header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />, cell: ({ row }) => <div className="max-w-[240px] truncate font-medium" title={row.original.vendor}>{row.original.vendor}</div> },
    { accessorKey: 'poCount', header: ({ column }) => <DataTableColumnHeader column={column} title="POs" className="justify-end" />, cell: ({ row }) => <div className="text-right text-muted-foreground">{row.original.poCount.toLocaleString('en-US')}</div> },
    { accessorKey: 'totalSpend', header: ({ column }) => <DataTableColumnHeader column={column} title="Total Spend" className="justify-end" />, cell: ({ row }) => <div className="text-right font-medium">{fmtRp(row.original.totalSpend)}</div> },
    { accessorKey: 'avgPO', header: ({ column }) => <DataTableColumnHeader column={column} title="Avg PO" className="justify-end" />, cell: ({ row }) => <div className="text-right">{fmtRp(row.original.avgPO)}</div> },
    { accessorKey: 'sharePct', header: ({ column }) => <DataTableColumnHeader column={column} title="Share" className="justify-end" />, cell: ({ row }) => <div className="text-right text-muted-foreground">{row.original.sharePct}%</div> },
    { accessorKey: 'quotesCount', header: ({ column }) => <DataTableColumnHeader column={column} title="Quotes" className="justify-end" />, cell: ({ row }) => <div className="text-right text-muted-foreground">{row.original.quotesCount.toLocaleString('en-US')}</div> },
    { accessorKey: 'paymentTypes', header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />, cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.paymentTypes || '-'}</span> },
    { accessorKey: 'lastPoDate', header: ({ column }) => <DataTableColumnHeader column={column} title="Last PO" />, cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(row.original.lastPoDate)}</span> },
  ]

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Vendor Scorecard" subtitle="PT. Multi Daya Mitra — Supplier Spend" breadcrumbs={[{ label: 'Purchasing' }, { label: 'Vendor Scorecard' }]}  actions={<ExportButton data={tableRows} filename="purchasing-vendors.csv" />} />

        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Payment Type</label>
              <MultiSelect allLabel="All Payment Types" selected={lPt} onChange={setLPt} options={data.filterOptions.paymentTypeList} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Min Spend (IDR)</label>
              <input type="number" value={lMin} onChange={e => setLMin(e.target.value)} placeholder="0" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" /></div>
          </div>
        </FilterCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard title="Active Vendors" value={data.kpis.activeVendors.toLocaleString('en-US')} icon={<Users className="h-4 w-4" />} />
          <KPICard title="Total Spend" value={fmtRp(data.kpis.totalSpend)} icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Top Vendor Share" value={`${data.kpis.topVendorShare}%`} icon={<Crown className="h-4 w-4" />} />
          <KPICard title="Avg / Vendor" value={fmtRp(data.kpis.avgPerVendor)} icon={<Store className="h-4 w-4" />} />
        </div>

        {/* Top vendors */}
        <Card><CardHeader><CardTitle className="text-sm font-semibold">Top Vendors by Spend</CardTitle><p className="text-xs text-muted-foreground">Click a bar to filter the table</p></CardHeader><CardContent>
          <ChartContainer config={{}} className="h-[340px] w-full">
            <ComposedChart data={data.topVendors} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
              <YAxis type="category" dataKey="name" {...axis} width={160} tickFormatter={(v: string) => truncTick(v)} axisLine={false} />
              <Tooltip formatter={(v: any) => fmtRp(Number(v))} cursor={{ fill: 'var(--muted)' }} {...tip} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} onClick={(d) => onBarClick(String(d.name ?? ''))} style={{ cursor: 'pointer' }} />
            </ComposedChart>
          </ChartContainer>
        </CardContent></Card>

        {/* Pareto */}
        <Card><CardHeader><CardTitle className="text-sm font-semibold">Spend Concentration (Pareto)</CardTitle><p className="text-xs text-muted-foreground">Cumulative share across the top 15 vendors</p></CardHeader><CardContent>
          <ChartContainer config={{ spend: { label: 'Spend', color: 'var(--chart-2)' }, cumulativePct: { label: 'Cumulative %', color: 'var(--chart-4)' } }} className="h-[360px] w-full">
            <ComposedChart data={data.pareto} margin={{ top: 10, right: 16, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} tickFormatter={(v: string) => truncTick(v)} axisLine={{ stroke: 'var(--border)' }} angle={-35} textAnchor="end" interval={0} height={110} />
              <YAxis yAxisId="left" {...axis} tickFormatter={(v) => fmtRp(v)} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" {...axis} tickFormatter={(v) => `${v}%`} domain={[0, 100]} axisLine={false} />
              <Tooltip formatter={(v: any, n: any) => n === 'cumulativePct' ? `${v}%` : fmtRp(Number(v))} labelFormatter={(label: any) => label} {...tip} />
              <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
              <Bar yAxisId="left" dataKey="spend" fill="var(--color-spend)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke="var(--color-cumulativePct)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ChartContainer>
        </CardContent></Card>

        {/* Vendor table */}
        <Card className="overflow-hidden" id="vendor-table-section">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold">Vendors <span className="font-normal text-muted-foreground">({tableRows.length.toLocaleString('en-US')}{tableRows.length !== data.totalRows ? ` of ${data.totalRows.toLocaleString('en-US')}` : ''})</span></CardTitle>
            <SearchInput value={search} onChange={setSearch} />
          </CardHeader>
          <CardContent className="p-0">
            <DataTable columns={columns} data={tableRows} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
