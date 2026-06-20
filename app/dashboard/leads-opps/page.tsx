'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DonutChart } from '@/components/donut-chart'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { fmtCurrency } from '@/lib/sales-helpers'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { DollarSign, TrendingUp, Users, Target, Loader2, Search } from 'lucide-react'

interface LeadData {
  kpis: { totalLeads: number; totalOpportunities: number; totalOppValue: number; conversionRate: number }
  byLeadStatus: { name: string; value: number }[]
  byOppStage: { name: string; value: number }[]
  byOppStatus: { name: string; value: number }[]
  leadTrend: { name: string; value: number }[]
  oppValueTrend: { name: string; value: number }[]
  topOpps: { oId: string; name: string; company: string; value: number; stage: string; status: string; assignedName: string }[]
  leads: { leadId: string; name: string; company: string; contactPerson: string; phone: string; email: string; status: string; source: string; assignedName: string; createdAt: string }[]
  opportunities: { oId: string; leadId: string; name: string; description: string; company: string; value: number; stage: string; probability: number; closeDate: string; status: string; assignedName: string; createdAt: string }[]
  salesUserList: { id: string; name: string }[]
  filterOptions: { leadStatuses: string[]; oppStages: string[]; oppStatuses: string[]; sources: string[] }
}

function onSel(setter: (v: string) => void) {
  return (v: string | null) => { setter(v ?? 'all') }
}

function fmtRp(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + 'M'
  if (v >= 1_000) return Math.round(v / 1_000).toFixed(0) + 'K'
  return v.toLocaleString('id-ID')
}

export default function LeadsOppsPage() {
  const [data, setData] = useState<LeadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'leads' | 'opportunities'>('leads')
  const [search, setSearch] = useState('')

  const getYTD = () => { const n = new Date(); return { from: new Date(n.getFullYear(), 0, 1).toLocaleDateString('en-CA'), to: new Date(n.getFullYear(), n.getMonth(), n.getDate()).toLocaleDateString('en-CA') } }
  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [status, setStatus] = useState('all'), [assignedTo, setAssignedTo] = useState('all'), [source, setSource] = useState('all'), [stage, setStage] = useState('all')

  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo), [lStatus, setLStatus] = useState(status), [lAssigned, setLAssigned] = useState(assignedTo), [lSource, setLSource] = useState(source), [lStage, setLStage] = useState(stage)

  const doFetch = useCallback(async (p: Record<string, string>) => {
    setLoading(true); setError(null)
    try {
      const q = new URLSearchParams()
      Object.entries(p).forEach(([k, v]) => { if (v && v !== 'all') q.set(k, v) })
      const res = await fetch('/api/leads-opps?' + q.toString())
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  useEffect(() => { doFetch({ dateFrom, dateTo, status, assignedTo, source, stage }) }, [doFetch, dateFrom, dateTo, status, assignedTo, source, stage])
  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setStatus(lStatus); setAssignedTo(lAssigned); setSource(lSource); setStage(lStage) }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLStatus('all'); setLAssigned('all'); setLSource('all'); setLStage('all')
    setDateFrom(d.from); setDateTo(d.to); setStatus('all'); setAssignedTo('all'); setSource('all'); setStage('all')
  }

  const filteredLeads = useMemo(() => {
    if (!data) return []
    let items = data.leads
    if (search) { const q = search.toLowerCase(); items = items.filter(l => [l.name, l.company, l.contactPerson, l.email, l.assignedName].some(s => s?.toLowerCase().includes(q))) }
    return items
  }, [data, search])

  const filteredOpps = useMemo(() => {
    if (!data) return []
    let items = data.opportunities
    if (search) { const q = search.toLowerCase(); items = items.filter(o => [o.name, o.company, o.description, o.assignedName, o.stage].some(s => s?.toLowerCase().includes(q))) }
    return items
  }, [data, search])

  if (loading && !data) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !data) return <div className="flex flex-col items-center justify-center min-h-[80vh]"><p className="text-destructive mb-4">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!data) return null

  const kpiCards = [
    { title: 'Total Leads', value: data.kpis.totalLeads.toString(), icon: <Users className="h-4 w-4" /> },
    { title: 'Total Opportunities', value: data.kpis.totalOpportunities.toString(), icon: <Target className="h-4 w-4" /> },
    { title: 'Opp. Value', value: fmtCurrency(data.kpis.totalOppValue), icon: <DollarSign className="h-4 w-4" /> },
    { title: 'Conversion Rate', value: data.kpis.conversionRate + '%', icon: <TrendingUp className="h-4 w-4" /> },
  ]

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Leads & Opportunities</h1><p className="text-sm text-muted-foreground">PT. Multi Daya Mitra</p></div>
          <ThemeToggle />
        </div>

        {/* Filters */}
        <Card><CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Date Range</label>
              <div className="flex items-center gap-1">
                <input type="date" value={lFrom} onChange={e => setLFrom(e.target.value)} className="w-[110px] rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary" />
                <span className="text-xs">—</span>
                <input type="date" value={lTo} onChange={e => setLTo(e.target.value)} className="w-[110px] rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary" />
              </div>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={lStatus} onValueChange={onSel(setLStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{data.filterOptions.leadStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sales Person</label>
              <Select value={lAssigned} onValueChange={onSel(setLAssigned)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{data.salesUserList.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Source</label>
              <Select value={lSource} onValueChange={onSel(setLSource)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Sources</SelectItem>{data.filterOptions.sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Stage</label>
              <Select value={lStage} onValueChange={onSel(setLStage)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Stages</SelectItem>{data.filterOptions.oppStages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3"><Button variant="outline" size="sm" onClick={onClear}>Clear</Button><Button size="sm" onClick={onApply}>Apply Filters</Button></div>
          {loading && data && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((c, i) => <KPICard key={i} title={c.title} value={c.value} icon={c.icon} />)}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Leads by Status</CardTitle></CardHeader><CardContent><DonutChart data={data.byLeadStatus} height={260} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Opportunities by Stage</CardTitle></CardHeader><CardContent><DonutChart data={data.byOppStage} height={260} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Opportunities by Status</CardTitle></CardHeader><CardContent><DonutChart data={data.byOppStatus} height={260} /></CardContent></Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Lead Trend</CardTitle></CardHeader><CardContent>
            <AreaChart data={data.leadTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} height={260}>
              <defs><linearGradient id="gLead" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} className="text-xs" /><YAxis stroke="var(--muted-foreground)" tickLine={false} allowDecimals={false} className="text-xs" /><Tooltip /><Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#gLead)" />
            </AreaChart>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-semibold">Opportunity Value Trend</CardTitle></CardHeader><CardContent>
            <BarChart data={data.oppValueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} height={260}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} className="text-xs" /><YAxis stroke="var(--muted-foreground)" tickFormatter={v => fmtRp(Number(v))} tickLine={false} className="text-xs" /><Tooltip formatter={(v: any) => [fmtRp(Number(v)), 'Value']} /><Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} name="Value" />
            </BarChart>
          </CardContent></Card>
        </div>

        {/* Top Opportunities */}
        <Card><CardHeader><CardTitle className="text-sm font-semibold">Top Opportunities by Value</CardTitle></CardHeader><CardContent>
          <BarChart data={data.topOpps} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }} height={300}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" stroke="var(--muted-foreground)" tickFormatter={v => fmtRp(Number(v))} tickLine={false} className="text-xs" /><YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" tickLine={false} className="text-xs" width={140} /><Tooltip formatter={(v: any) => [fmtRp(Number(v)), 'Value']} /><Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} name="Value" />
          </BarChart>
        </CardContent></Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              {(['leads', 'opportunities'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setSearch('') }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{t === 'leads' ? 'Leads' : 'Opportunities'}</button>
              ))}
            </div>
            <div className="relative w-56"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" /></div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              {tab === 'leads' ? (
                <>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs font-medium text-muted-foreground">Lead ID</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Source</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Assigned To</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredLeads.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No leads found</TableCell></TableRow> : filteredLeads.map(l => (
                      <TableRow key={l.leadId}>
                        <TableCell className="text-xs font-semibold text-primary">{l.leadId}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{l.name}</TableCell>
                        <TableCell className="text-xs">{l.company}</TableCell>
                        <TableCell className="text-xs">{l.contactPerson}<br /><span className="text-muted-foreground">{l.phone}</span></TableCell>
                        <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">{l.status || '-'}</span></TableCell>
                        <TableCell className="text-xs">{l.source}</TableCell>
                        <TableCell className="text-xs">{l.assignedName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs font-medium text-muted-foreground">Opp ID</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-right">Value</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Stage</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Assigned To</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredOpps.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No opportunities found</TableCell></TableRow> : filteredOpps.map(o => (
                      <TableRow key={o.oId}>
                        <TableCell className="text-xs font-semibold text-primary">{o.oId}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{o.name}</TableCell>
                        <TableCell className="text-xs">{o.company}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmtCurrency(o.value)}</TableCell>
                        <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">{o.stage || '-'}</span></TableCell>
                        <TableCell><span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">{o.status || '-'}</span></TableCell>
                        <TableCell className="text-xs">{o.assignedName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>
    </SalesPageShell>
  )
}
