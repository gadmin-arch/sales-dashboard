'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Store, Wallet, Crown, Users } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import { MultiSelect } from '@/components/multi-select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD, fmtShortDate as fmtDate, truncLabel as truncTick } from '@/lib/sales-helpers'

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
  const vSort = useSort(tableRows, 'totalSpend', 'desc')
  const vPage = useLoadMore(vSort.sorted)

  const onBarClick = (name: string) => {
    setSearch(name)
  }

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lPt, pt) || lMin !== minSpend

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const axis = { stroke: 'var(--muted-foreground)', tickLine: false, className: 'text-xs' } as const
  const tip = { contentStyle: { background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader title="Vendor Scorecard" subtitle="PT. Multi Daya Mitra — Supplier Spend" />

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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <SortHead label="Vendor" column="vendor" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} />
                  <SortHead label="POs" column="poCount" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} className="text-right" />
                  <SortHead label="Total Spend" column="totalSpend" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} className="text-right" />
                  <SortHead label="Avg PO" column="avgPO" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} className="text-right" />
                  <SortHead label="Share" column="sharePct" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} className="text-right" />
                  <SortHead label="Quotes" column="quotesCount" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} className="text-right" />
                  <SortHead label="Payment" column="paymentTypes" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} />
                  <SortHead label="Last PO" column="lastPoDate" sortKey={vSort.sortKey} sortDir={vSort.sortDir} onSort={vSort.toggle} />
                </TableRow></TableHeader>
                <TableBody>
                  {tableRows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No vendors found</TableCell></TableRow> : vPage.visible.map(r => (
                    <TableRow key={r.vendorId}>
                      <TableCell className="max-w-[240px] truncate font-medium" title={r.vendor}>{r.vendor}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.poCount.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right font-medium">{fmtRp(r.totalSpend)}</TableCell>
                      <TableCell className="text-right">{fmtRp(r.avgPO)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.sharePct}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.quotesCount.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.paymentTypes || '-'}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(r.lastPoDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={vPage.hasMore} shown={vPage.shown} total={vPage.total} onClick={vPage.loadMore} onLoadAll={vPage.loadAll} onCollapse={vPage.collapse} />
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
