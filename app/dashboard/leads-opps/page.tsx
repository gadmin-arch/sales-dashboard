'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DonutChart } from '@/components/donut-chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { fmtCurrency, SortIcon, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'
import { MultiSelect } from '@/components/multi-select'
import { DateRangeRow } from '@/components/date-range-row'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { DollarSign, TrendingUp, Users, Target } from 'lucide-react'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'

interface LeadData {
  kpis: { totalLeads: number; totalOpportunities: number; totalOppValue: number; conversionRate: number }
  byLeadStatus: { name: string; value: number }[]
  byOppStage: { name: string; value: number }[]
  byOppStatus: { name: string; value: number }[]
  leadTrend: { name: string; [key: string]: any }[]
  oppValueTrend: { name: string; value: number }[]
  topOpps: { oId: string; name: string; company: string; value: number; stage: string; status: string; assignedName: string }[]
  leads: { leadId: string; name: string; company: string; contactPerson: string; phone: string; email: string; status: string; source: string; assignedName: string; createdAt: string; leadDate: string; notes: string }[]
  opportunities: { oId: string; leadId: string; name: string; description: string; company: string; value: number; stage: string; probability: number; closeDate: string; status: string; assignedName: string; createdAt: string; contactPerson: string; phone: string; email: string }[]
  salesUserList: { id: string; name: string }[]
  filterOptions: { leadStatuses: string[]; oppStages: string[]; oppStatuses: string[]; sources: string[] }
}

function fmtRp(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + 'M'
  if (v >= 1_000) return Math.round(v / 1_000).toFixed(0) + 'K'
  return v.toLocaleString('id-ID')
}

const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
]

function fmtMonthYear(v: string): string {
  if (!v) return ''
  const parts = v.split('-')
  if (parts.length < 2) return v
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mIdx = parseInt(parts[1], 10) - 1
  if (mIdx >= 0 && mIdx < 12) {
    return `${months[mIdx]} ${parts[0]}`
  }
  return v
}

function LeadTrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium mb-1">{fmtMonthYear(label)}</div>
      {payload.map((item: any, i: number) => {
        const color = item.payload?.fill || item.color
        const name = item.name
        const val = item.value
        return (
          <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <span className="font-mono font-medium text-foreground tabular-nums">{val}</span>
              <span className="text-muted-foreground">{name}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OppValueTrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium mb-1">{fmtMonthYear(label)}</div>
      {payload.map((item: any, i: number) => {
        const color = item.payload?.fill || item.color
        const name = item.name
        const val = fmtRp(Number(item.value))
        return (
          <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <span className="font-mono font-medium text-foreground tabular-nums">{val}</span>
              <span className="text-muted-foreground">{name}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LeadsOppsPage() {
  const [data, setData] = useState<LeadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'leads' | 'opportunities'>('leads')
  const [tabSearch, setTabSearch] = useState('')
  const { chartFilter, setChartFilter, handleChartClick: baseHandleChartClick } = useChartFilter('leads-opps-table')

  const handleChartClick = (targetTab: 'leads' | 'opportunities', type: string, value: string, label: string) => {
    setTab(targetTab)
    baseHandleChartClick(type, value, label)
  }

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  // Applied filters (multi-select)
  const [status, setStatus] = useState<string[]>([]), [assignedTo, setAssignedTo] = useState<string[]>([]), [source, setSource] = useState<string[]>([]), [stage, setStage] = useState<string[]>([])
  // Draft (unapplied) filters
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lStatus, setLStatus] = useState<string[]>([]), [lAssignedTo, setLAssignedTo] = useState<string[]>([]), [lSource, setLSource] = useState<string[]>([]), [lStage, setLStage] = useState<string[]>([])

  const [leadSortKey, setLeadSortKey] = useState<string>('leadId')
  const [leadSortDir, setLeadSortDir] = useState<'asc' | 'desc'>('asc')

  const [oppSortKey, setOppSortKey] = useState<string>('oId')
  const [oppSortDir, setOppSortDir] = useState<'asc' | 'desc'>('asc')

  const hasUnappliedFilters = useMemo(() => {
    return lFrom !== dateFrom ||
           lTo !== dateTo ||
           !sameSet(lStatus, status) ||
           !sameSet(lAssignedTo, assignedTo) ||
           !sameSet(lSource, source) ||
           !sameSet(lStage, stage);
  }, [lFrom, dateFrom, lTo, dateTo, lStatus, status, lAssignedTo, assignedTo, lSource, source, lStage, stage])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/leads-opps?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false;
    doFetch({
      dateFrom, dateTo,
      status, assignedTo, source, stage,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, status, assignedTo, source, stage, chartFilter])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setStatus(lStatus); setAssignedTo(lAssignedTo); setSource(lSource); setStage(lStage) }

  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLStatus([]); setLAssignedTo([]); setLSource([]); setLStage([])
    setDateFrom(d.from); setDateTo(d.to); setStatus([]); setAssignedTo([]); setSource([]); setStage([]); setChartFilter(null)
  }

  const handleLeadSort = (key: string) => {
    if (leadSortKey === key) {
      setLeadSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setLeadSortKey(key)
      setLeadSortDir('asc')
    }
  }

  const handleOppSort = (key: string) => {
    if (oppSortKey === key) {
      setOppSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setOppSortKey(key)
      setOppSortDir('asc')
    }
  }

  const filteredLeads = useMemo(() => {
    if (!data) return []
    let rows = data.leads
    if (tabSearch) { const q = tabSearch.toLowerCase(); rows = rows.filter(r => [r.name, r.company, r.assignedName].some(s => s?.toLowerCase().includes(q))) }
    return rows
  }, [data, tabSearch])

  const filteredOpps = useMemo(() => {
    if (!data) return []
    let rows = data.opportunities
    if (tabSearch) { const q = tabSearch.toLowerCase(); rows = rows.filter(r => [r.name, r.company, r.assignedName].some(s => s?.toLowerCase().includes(q))) }
    return rows
  }, [data, tabSearch])

  const sortedLeads = useMemo(() => {
    const items = [...filteredLeads]
    items.sort((a: any, b: any) => {
      let aVal = a[leadSortKey], bVal = b[leadSortKey]
      if (leadSortKey === 'leadDate') {
        const da = a.leadDate ? new Date(a.leadDate) : new Date(0)
        const db = b.leadDate ? new Date(b.leadDate) : new Date(0)
        return leadSortDir === 'asc' ? da.getTime() - db.getTime() : db.getTime() - da.getTime()
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return leadSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return leadSortDir === 'asc'
        ? (aVal > bVal ? 1 : -1)
        : (bVal > aVal ? 1 : -1)
    })
    return items
  }, [filteredLeads, leadSortKey, leadSortDir])

  const sortedOpps = useMemo(() => {
    const items = [...filteredOpps]
    items.sort((a: any, b: any) => {
      let aVal = a[oppSortKey], bVal = b[oppSortKey]
      if (oppSortKey === 'closeDate') {
        const da = a.closeDate ? new Date(a.closeDate) : new Date(0)
        const db = b.closeDate ? new Date(b.closeDate) : new Date(0)
        return oppSortDir === 'asc' ? da.getTime() - db.getTime() : db.getTime() - da.getTime()
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return oppSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return oppSortDir === 'asc'
        ? (aVal > bVal ? 1 : -1)
        : (bVal > aVal ? 1 : -1)
    })
    return items
  }, [filteredOpps, oppSortKey, oppSortDir])

  const leadPage = useLoadMore(sortedLeads)
  const oppPage = useLoadMore(sortedOpps)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  const kpiCards = [
    { title: 'Total Leads', value: data.kpis.totalLeads.toString(), icon: <Users className="h-4 w-4" /> },
    { title: 'Total Opportunities', value: data.kpis.totalOpportunities.toString(), icon: <Target className="h-4 w-4" /> },
    { title: 'Opp. Value', value: fmtCurrency(data.kpis.totalOppValue), icon: <DollarSign className="h-4 w-4" /> },
    { title: 'Conversion Rate', value: data.kpis.conversionRate + '%', icon: <TrendingUp className="h-4 w-4" /> },
  ]

  const thClass = "text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight">Leads & Opportunities</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p></div>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Rating</label>
              <MultiSelect allLabel="All Ratings" selected={lStatus} onChange={setLStatus}
                options={data.filterOptions.leadStatuses.map(s => ({ value: s, label: s }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sales Owner</label>
              <MultiSelect allLabel="All Sales Owners" selected={lAssignedTo} onChange={setLAssignedTo}
                options={data.salesUserList.map(u => ({ value: u.id, label: u.name }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Source</label>
              <MultiSelect allLabel="All Sources" selected={lSource} onChange={setLSource}
                options={data.filterOptions.sources.map(s => ({ value: s, label: s }))} />
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Type</label>
              <MultiSelect allLabel="All Types" selected={lStage} onChange={setLStage}
                options={data.filterOptions.oppStages.map(s => ({ value: s, label: s }))} />
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">
              Apply Filters
              {hasUnappliedFilters && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </Button>
          </div>
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((c, i) => <KPICard key={i} title={c.title} value={c.value} icon={c.icon} />)}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Leads by Rating</CardTitle></CardHeader><CardContent><DonutChart data={data.byLeadStatus} height={260} onSliceClick={(name) => handleChartClick('leads', 'leadStatus', name, `Rating = ${name}`)} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Opportunities by Type</CardTitle></CardHeader><CardContent><DonutChart data={data.byOppStage} height={260} onSliceClick={(name) => handleChartClick('opportunities', 'oppStage', name, `Type = ${name}`)} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Opportunities by Stage</CardTitle></CardHeader><CardContent><DonutChart data={data.byOppStatus} height={260} onSliceClick={(name) => handleChartClick('opportunities', 'oppStatus', name, `Stage = ${name}`)} /></CardContent></Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Lead Trend</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[260px] w-full">
              <BarChart data={data.leadTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickFormatter={fmtMonthYear} tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} className="text-xs" />
                <Tooltip content={<LeadTrendTooltip />} />
                <ChartLegend content={<ChartLegendContent />} />
                {data.filterOptions.leadStatuses.map((s, idx) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={colors[idx % colors.length]} name={s} onClick={(d: any) => handleChartClick('leads', 'leadMonth', d.name, `Lead Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
          
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Opportunity Value Trend</CardTitle></CardHeader><CardContent>
            <ChartContainer config={{}} className="h-[260px] w-full">
              <BarChart data={data.oppValueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickFormatter={fmtMonthYear} tickLine={false} axisLine={{ stroke: 'var(--border)' }} className="text-xs" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={v => fmtRp(Number(v))} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip content={<OppValueTrendTooltip />} />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} name="Price" onClick={(d: any) => handleChartClick('opportunities', 'oppMonth', d.name, `Opp Month = ${d.name}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ChartContainer>
          </CardContent></Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden" id="leads-opps-table">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                {(['leads', 'opportunities'] as const).map(t => (
                  <button key={t} onClick={() => { setTab(t); setTabSearch('') }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{t === 'leads' ? 'Leads' : 'Opportunities'}</button>
                ))}
              </div>
            </div>
            <SearchInput value={tabSearch} onChange={setTabSearch} placeholder="Search name/company..." className="w-64" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              {tab === 'leads' ? (
                <>
                  <TableHeader><TableRow>
                    <TableHead className={thClass} onClick={() => handleLeadSort('leadId')}>
                      <div className="flex items-center gap-1">Lead ID <SortIcon column="leadId" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('leadDate')}>
                      <div className="flex items-center gap-1">Date <SortIcon column="leadDate" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('company')}>
                      <div className="flex items-center gap-1">Company <SortIcon column="company" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('contactPerson')}>
                      <div className="flex items-center gap-1">Contact Person <SortIcon column="contactPerson" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('status')}>
                      <div className="flex items-center gap-1">Rating <SortIcon column="status" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('source')}>
                      <div className="flex items-center gap-1">Source <SortIcon column="source" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('notes')}>
                      <div className="flex items-center gap-1">Remarks <SortIcon column="notes" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleLeadSort('assignedName')}>
                      <div className="flex items-center gap-1">Assigned To <SortIcon column="assignedName" sortKey={leadSortKey} sortDir={leadSortDir} /></div>
                    </TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sortedLeads.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No leads found</TableCell></TableRow> : leadPage.visible.map(l => (
                      <TableRow key={l.leadId}>
                        <TableCell className="text-xs font-semibold text-primary">{l.leadId}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{l.leadDate}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">{l.company}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">{l.contactPerson || '-'}</span>
                          {(l.phone || l.email) && (
                            <div className="text-[10px] text-muted-foreground">
                              {l.phone} {l.phone && l.email && '|'} {l.email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">{l.status || '-'}</span></TableCell>
                        <TableCell className="text-xs">{l.source}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={l.notes}>{l.notes || '-'}</TableCell>
                        <TableCell className="text-xs">{l.assignedName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader><TableRow>
                    <TableHead className={thClass} onClick={() => handleOppSort('oId')}>
                      <div className="flex items-center gap-1">Opp ID <SortIcon column="oId" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('leadId')}>
                      <div className="flex items-center gap-1">Lead ID <SortIcon column="leadId" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('name')}>
                      <div className="flex items-center gap-1">Name <SortIcon column="name" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('company')}>
                      <div className="flex items-center gap-1">Company <SortIcon column="company" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('contactPerson')}>
                      <div className="flex items-center gap-1">Contact Person <SortIcon column="contactPerson" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass + " text-right"} onClick={() => handleOppSort('value')}>
                      <div className="flex items-center justify-end gap-1">Value <SortIcon column="value" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('closeDate')}>
                      <div className="flex items-center gap-1">Close Date <SortIcon column="closeDate" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('stage')}>
                      <div className="flex items-center gap-1">Type <SortIcon column="stage" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('probability')}>
                      <div className="flex items-center gap-1">Probability <SortIcon column="probability" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('status')}>
                      <div className="flex items-center gap-1">Status <SortIcon column="status" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                    <TableHead className={thClass} onClick={() => handleOppSort('assignedName')}>
                      <div className="flex items-center gap-1">Assigned To <SortIcon column="assignedName" sortKey={oppSortKey} sortDir={oppSortDir} /></div>
                    </TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sortedOpps.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No opportunities found</TableCell></TableRow> : oppPage.visible.map(o => (
                      <TableRow key={o.oId}>
                        <TableCell className="text-xs font-semibold text-primary">{o.oId}</TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">{o.leadId || '-'}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={o.name}>{o.name}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{o.company}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium">{o.contactPerson || '-'}</span>
                          {(o.phone || o.email) && (
                            <div className="text-[10px] text-muted-foreground">
                              {o.phone} {o.phone && o.email && '|'} {o.email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmtCurrency(o.value)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{o.closeDate}</TableCell>
                        <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">{o.stage || '-'}</span></TableCell>
                        <TableCell className="text-xs font-medium">{o.probability}%</TableCell>
                        <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">{o.status || '-'}</span></TableCell>
                        <TableCell className="text-xs">{o.assignedName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
            {tab === 'leads'
              ? <LoadMore hasMore={leadPage.hasMore} shown={leadPage.shown} total={leadPage.total} onClick={leadPage.loadMore} onLoadAll={leadPage.loadAll} onCollapse={leadPage.collapse} />
              : <LoadMore hasMore={oppPage.hasMore} shown={oppPage.shown} total={oppPage.total} onClick={oppPage.loadMore} onLoadAll={oppPage.loadAll} onCollapse={oppPage.collapse} />}
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
