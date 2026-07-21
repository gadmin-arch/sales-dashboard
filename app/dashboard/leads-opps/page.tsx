'use client'

import { ExportButton } from '@/components/export-button'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DonutChart } from '@/components/donut-chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { fmtCurrency, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'
import { MultiSelect } from '@/components/multi-select'
import { DateRangeRow } from '@/components/date-range-row'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { DollarSign, TrendingUp, Users, Target } from 'lucide-react'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { PageHeader } from '@/components/page-header'
import { SearchInput } from '@/components/search-input'
import { DataTable } from '@/components/ui/data-table'
import { leadColumns, oppColumns, LeadRow, OppRow } from './columns'

interface LeadData {
  kpis: { totalLeads: number; totalOpportunities: number; totalOppValue: number; conversionRate: number }
  byLeadStatus: { name: string; value: number }[]
  byOppStage: { name: string; value: number }[]
  byOppStatus: { name: string; value: number }[]
  leadTrend: { name: string; [key: string]: any }[]
  oppValueTrend: { name: string; value: number }[]
  topOpps: { oId: string; name: string; company: string; value: number; stage: string; status: string; assignedName: string }[]
  leads: LeadRow[]
  opportunities: OppRow[]
  salesUserList: { id: string; name: string }[]
  filterOptions: { leadStatuses: string[]; oppStages: string[]; oppStatuses: string[]; sources: string[] }
}

function fmtRp(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + 'M'
  if (v >= 1_000) return Math.round(v / 1_000).toFixed(0) + 'K'
  return v.toLocaleString('en-US')
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

  const filteredLeads = useMemo(() => {
    if (!data) return []
    let rows = data.leads
    if (tabSearch) { const q = tabSearch.toLowerCase(); rows = rows.filter(r => [r.name, r.company, r.assignedName].some(s => s?.toLowerCase().includes(q))) }
    return rows
  }, [data, tabSearch])

  const filteredOpps = useMemo(() => {
    if (!data) return []
    let rows = data.opportunities
    // We let DataTable handle search internally via `search={tabSearch}`
    return rows
  }, [data])

  if (loading && !data) return <DashboardSkeleton />
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
        <PageHeader
          title="Leads & Opportunities"
          subtitle="PT. Multi Daya Mitra"
          breadcrumbs={[{ label: 'Sales' }, { label: 'Leads & Opportunities' }]}
          chartFilter={chartFilter}
          onClearFilter={() => setChartFilter(null)}
          actions={
            <div className="flex items-center gap-2">
              <ExportButton data={tab === 'leads' ? filteredLeads : filteredOpps} filename="leads-opps.csv" />
            </div>
          }
        />

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
            {tab === 'leads' ? (
              <DataTable columns={leadColumns} data={filteredLeads} search={tabSearch} />
            ) : (
              <DataTable columns={oppColumns} data={filteredOpps} search={tabSearch} />
            )}
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
