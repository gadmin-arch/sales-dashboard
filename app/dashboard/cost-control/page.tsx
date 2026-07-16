'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KPICard } from '@/components/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Wallet, ShoppingCart, AlertCircle, CheckCircle2, X, Lightbulb, TrendingUp, Activity, Clock, Settings2, Receipt, Users, Utensils } from 'lucide-react'
import { SalesPageShell } from '@/components/theme-toggle'
import Link from 'next/link'
import { MultiSelect } from '@/components/multi-select'
import { PageHeader } from '@/components/page-header'
import { FilterCard } from '@/components/filter-card'
import { PageSpinner, PageError } from '@/components/page-states'
import { SearchInput } from '@/components/search-input'
import { LoadMore, useLoadMore } from '@/components/load-more'
import { useSort, SortHead } from '@/components/sortable'
import { fmtCurrency, buildQuery, sameSet, getYTD } from '@/lib/sales-helpers'
import { ExportButton } from '@/components/export-button'

interface CostControlRow {
  prjId: string
  prjName: string
  budgetMaterial: number
  budgetService: number
  spentMaterial: number
  spentService: number
  spentMeal: number

  // Detailed Breakdown
  spentMaterialPurchasing: number
  spentMaterialReimburse: number
  countMaterialPurchasing: number
  countMaterialReimburse: number

  spentServicePurchasing: number
  spentServiceReimburse: number
  countServicePurchasing: number
  countServiceReimburse: number
  countMeal: number

  overtimeHours: number
  reportCount: number
  reportHours: number

  pePicName: string
  peTeamName: string
}

// Per-project transaction lists — fetched lazily via ?detail=<prjId> when the
// modal opens (they are no longer embedded in the list response).
interface ProjectDetailItems {
  prjId: string
  purchasingItems: Array<{ date: string; description: string; type: 'Material' | 'Service'; poNumber: string; vendor: string; amount: number }>
  reimburseItems: Array<{ date: string; description: string; type: 'Material' | 'Service'; requestor: string; amount: number }>
  overtimeItems: Array<{ date: string; hours: number; workerName: string; reason: string }>
  reportItems: Array<{ date: string; hours: number; workerName: string; remarks: string }>
  mealItems: Array<{ date: string; amount: number; approved: number; userId: string; userName: string; notes: string; type: string }>
}

interface Option { value: string; label: string }
interface FilterMetadata {
  salesUserList: { id: string; name: string }[]
  pePicList: { id: string; name: string }[]
  peTeamList: { id: string; name: string }[]
  orderTypeList: { otId: string; otDescription: string }[]
  projectStatusList: { pesId: string; pesDescription: string }[]
  invoiceStatusList: { fsId: string; fsDescription: string }[]
  projectFlagList: { flagId: string; flagDescription: string }[]
}

export default function CostControlPage() {
  const [data, setData] = useState<CostControlRow[] | null>(null)
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'overbudget'>('all')
  const [selectedProject, setSelectedProject] = useState<CostControlRow | null>(null)
  const [detailTab, setDetailTab] = useState<'purchasing' | 'reimburse' | 'meal' | 'overtime' | 'report'>('purchasing')
  const [detailItems, setDetailItems] = useState<ProjectDetailItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Workforce Pricing Calculator States
  const [overtimeRate, setOvertimeRate] = useState<number>(0)
  const [hoursRate, setHoursRate] = useState<number>(0)
  const [reportRate, setReportRate] = useState<number>(0)
  const [calcMethod, setCalcMethod] = useState<'hours' | 'report'>('hours')

  const [dateFrom, setDateFrom] = useState(getYTD().from), [dateTo, setDateTo] = useState(getYTD().to)
  const [su, setSu] = useState<string[]>([]), [ot, setOt] = useState<string[]>([])
  const [ps, setPs] = useState<string[]>([]), [inv, setInv] = useState<string[]>([])
  const [prjFlag, setPrjFlag] = useState<string[]>([])
  const [pePic, setPePic] = useState<string[]>([]), [peTeam, setPeTeam] = useState<string[]>([])
  
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lSu, setLSu] = useState<string[]>([]), [lOt, setLOt] = useState<string[]>([])
  const [lPs, setLPs] = useState<string[]>([]), [lInv, setLInv] = useState<string[]>([])
  const [lPrjFlag, setLPrjFlag] = useState<string[]>([])
  const [lPePic, setLPePic] = useState<string[]>([]), [lPeTeam, setLPeTeam] = useState<string[]>([])

  const fmtRp = useCallback((v: number) => fmtCurrency(v, 'IDR'), [])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/cost-control?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to load data')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.projects || [])
      setMetadata({
        salesUserList: json.salesUserList || [],
        pePicList: json.pePicList || [],
        peTeamList: json.peTeamList || [],
        orderTypeList: json.orderTypeList || [],
        projectStatusList: json.projectStatusList || [],
        invoiceStatusList: json.invoiceStatusList || [],
        projectFlagList: json.projectFlagList || [],
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({
      dateFrom, dateTo, salesUser: su, orderType: ot, projectStatus: ps, invoiceStatus: inv, projectFlag: prjFlag,
      pePic, peTeam,
      ...(fresh ? { fresh: '1' } : {}),
    })
  }, [doFetch, dateFrom, dateTo, su, ot, ps, inv, prjFlag, pePic, peTeam])

  const onApply = () => { 
    setDateFrom(lFrom); setDateTo(lTo); setSu(lSu); setOt(lOt); setPs(lPs); setInv(lInv); setPrjFlag(lPrjFlag); setPePic(lPePic); setPeTeam(lPeTeam) 
  }
  const onClear = () => {
    const d = getYTD()
    setLFrom(d.from); setLTo(d.to); setLSu([]); setLOt([]); setLPs([]); setLInv([]); setLPrjFlag([]); setLPePic([]); setLPeTeam([])
    setDateFrom(d.from); setDateTo(d.to); setSu([]); setOt([]); setPs([]); setInv([]); setPrjFlag([]); setPePic([]); setPeTeam([])
  }

  // Calculate dynamic rows with Workforce Cost additions
  const calculatedRows = useMemo(() => {
    return (data || []).map((d) => {
      const overtimeCost = d.overtimeHours * overtimeRate
      const reportCost = calcMethod === 'hours' ? d.reportHours * hoursRate : d.reportCount * reportRate
      const calculatedWorkforceCost = overtimeCost + reportCost

      const spentService = d.spentService + calculatedWorkforceCost
      const spentTotal = d.spentMaterial + spentService
      const budgetTotal = d.budgetMaterial + d.budgetService

      const isProjectOverbudget =
        (d.budgetMaterial > 0 && d.spentMaterial > d.budgetMaterial) ||
        (d.budgetService > 0 && spentService > d.budgetService)

      const matPct = d.budgetMaterial > 0 ? (d.spentMaterial / d.budgetMaterial) * 100 : (d.spentMaterial > 0 ? 100 : 0)
      const svcPct = d.budgetService > 0 ? (spentService / d.budgetService) * 100 : (spentService > 0 ? 100 : 0)
      const totalPct = budgetTotal > 0 ? (spentTotal / budgetTotal) * 100 : (spentTotal > 0 ? 100 : 0)

      return {
        ...d,
        spentService,
        spentTotal,
        budgetTotal,
        overtimeCost,
        reportCost,
        calculatedWorkforceCost,
        isOverbudget: isProjectOverbudget,
        matPct,
        svcPct,
        totalPct
      }
    })
  }, [data, overtimeRate, hoursRate, reportRate, calcMethod])

  const filtered = useMemo(() => {
    return calculatedRows.filter((d) => {
      const matchSearch =
        d.prjName.toLowerCase().includes(search.toLowerCase()) ||
        d.prjId.toLowerCase().includes(search.toLowerCase()) ||
        (d.pePicName || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.peTeamName || '').toLowerCase().includes(search.toLowerCase())

      if (!matchSearch) return false

      if (statusFilter === 'safe' && d.isOverbudget) return false
      if (statusFilter === 'overbudget' && !d.isOverbudget) return false

      return true
    })
  }, [calculatedRows, search, statusFilter])

  // Fetch the per-project transaction lists when the modal opens.
  useEffect(() => {
    if (!selectedProject) { setDetailItems(null); return }
    let cancelled = false
    setDetailLoading(true); setDetailItems(null)
    fetch('/api/cost-control?' + buildQuery({
      dateFrom, dateTo, salesUser: su, orderType: ot, projectStatus: ps, invoiceStatus: inv, projectFlag: prjFlag,
      pePic, peTeam, detail: selectedProject.prjId,
    }))
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setDetailItems(j.detail || null) })
      .catch(() => { if (!cancelled) setDetailItems(null) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedProject, dateFrom, dateTo, su, ot, ps, inv, prjFlag, pePic, peTeam])

  // Get selected project with updated calculations + lazily fetched detail lists
  const selectedCalculatedProject = useMemo(() => {
    if (!selectedProject) return null
    const base = calculatedRows.find((p) => p.prjId === selectedProject.prjId)
    if (!base) return null
    return {
      ...base,
      purchasingItems: detailItems?.purchasingItems ?? [],
      reimburseItems: detailItems?.reimburseItems ?? [],
      overtimeItems: detailItems?.overtimeItems ?? [],
      reportItems: detailItems?.reportItems ?? [],
      mealItems: detailItems?.mealItems ?? [],
    }
  }, [selectedProject, calculatedRows, detailItems])

  const sort = useSort(filtered, 'totalPct', 'desc')
  const page = useLoadMore(sort.sorted)

  const totals = useMemo(() => filtered.reduce(
    (acc, curr) => {
      const budget = curr.budgetMaterial + curr.budgetService
      const spent = curr.spentMaterial + curr.spentService
      return {
        budget: acc.budget + budget,
        spent: acc.spent + spent,
        over: acc.over + (curr.isOverbudget ? 1 : 0),
        materialBudget: acc.materialBudget + curr.budgetMaterial,
        materialSpent: acc.materialSpent + curr.spentMaterial,
        serviceBudget: acc.serviceBudget + curr.budgetService,
        serviceSpent: acc.serviceSpent + curr.spentService,
        overtimeHours: acc.overtimeHours + curr.overtimeHours,
        reportCount: acc.reportCount + curr.reportCount,
        reportHours: acc.reportHours + curr.reportHours,
        overtimeCost: acc.overtimeCost + curr.overtimeCost,
        reportCost: acc.reportCost + curr.reportCost,
        workforceCost: acc.workforceCost + curr.calculatedWorkforceCost,
      }
    },
    { budget: 0, spent: 0, over: 0, materialBudget: 0, materialSpent: 0, serviceBudget: 0, serviceSpent: 0, overtimeHours: 0, reportCount: 0, reportHours: 0, overtimeCost: 0, reportCost: 0, workforceCost: 0 }
  ), [filtered])

  const overallProgress = totals.budget > 0 ? (totals.spent / totals.budget) * 100 : 0
  const isOverallOverbudget = overallProgress > 100

  const insights = useMemo(() => {
    if (calculatedRows.length === 0) return []
    const overCount = calculatedRows.filter(r => r.isOverbudget).length
    const mealTotal = calculatedRows.reduce((sum, d) => sum + d.spentMeal, 0)
    const totalSvc = calculatedRows.reduce((sum, d) => sum + d.spentService, 0)
    const items = []
    items.push(overCount > 0
      ? `${overCount} project(s) are currently overbudget (either material or service).`
      : 'All projects are safely within their allocated budgets.')
    if (totalSvc > 0) items.push(`Meal Requests account for ${((mealTotal / totalSvc) * 100).toFixed(1)}% of total service expenses.`)
    return items
  }, [calculatedRows])

  const salesUserOpts: Option[] = (metadata?.salesUserList || []).map((u) => ({ value: u.id, label: u.name }))
  const pePicOpts: Option[] = (metadata?.pePicList || []).map((u) => ({ value: u.id, label: u.name }))
  const peTeamOpts: Option[] = (metadata?.peTeamList || []).map((u) => ({ value: u.id, label: u.name }))
  const typeOpts: Option[] = (metadata?.orderTypeList || []).map((t) => ({ value: t.otId, label: t.otDescription }))
  const psOpts: Option[] = (metadata?.projectStatusList || []).map((t) => ({ value: t.pesId, label: t.pesDescription }))
  const invOpts: Option[] = (metadata?.invoiceStatusList || []).map((t) => ({ value: t.fsId, label: t.fsDescription }))
  const flagOpts: Option[] = (metadata?.projectFlagList || []).map((t) => ({ value: t.flagId, label: t.flagDescription }))

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lSu, su) || !sameSet(lOt, ot) || !sameSet(lPs, ps) || !sameSet(lInv, inv) || !sameSet(lPrjFlag, prjFlag) || !sameSet(lPePic, pePic) || !sameSet(lPeTeam, peTeam)

  if (loading && !data) return <PageSpinner />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader 
          title="Cost Control" 
          subtitle="PT. Multi Daya Mitra — Project Budget vs Actual Spend" 
          actions={
            <Link
              href="/dashboard/cost-control/workers"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/95 hover:shadow cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              Worker KPIs
            </Link>
          }
        />

        {/* Filter Card */}
        <FilterCard from={lFrom} to={lTo} onDateChange={(f, t) => { setLFrom(f); setLTo(t) }} onApply={onApply} onClear={onClear} hasUnapplied={hasUnapplied} loading={loading && !!data} dateLabel="PO / Project Date">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sales User</label>
              <MultiSelect allLabel="All Sales Users" selected={lSu} onChange={setLSu} options={salesUserOpts} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Executor PIC</label>
              <MultiSelect allLabel="All PE PICs" selected={lPePic} onChange={setLPePic} options={pePicOpts} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Executor Team</label>
              <MultiSelect allLabel="All PE Teams" selected={lPeTeam} onChange={setLPeTeam} options={peTeamOpts} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Type</label>
              <MultiSelect allLabel="All Project Types" selected={lOt} onChange={setLOt} options={typeOpts} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Status</label>
              <MultiSelect allLabel="All Project Statuses" selected={lPs} onChange={setLPs} options={psOpts} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Invoice Status</label>
              <MultiSelect allLabel="All Invoice Statuses" selected={lInv} onChange={setLInv} options={invOpts} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Project Flag</label>
              <MultiSelect allLabel="All Project Flags" selected={lPrjFlag} onChange={setLPrjFlag} options={flagOpts} /></div>
          </div>
        </FilterCard>

        {/* Top Section: Dashboard Summary & Pricing Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Portfolio summary (Cols span 8) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <KPICard title="Total Budget" value={fmtRp(totals.budget)} icon={<Wallet className="h-4 w-4" />} tooltip="Material + service budget from customer POs" />
              <KPICard title="Total Spent (Adjusted)" value={fmtRp(totals.spent)} icon={<ShoppingCart className="h-4 w-4" />} trend={{ value: totals.over, label: 'projects overbudget', positive: totals.over === 0 }} tooltip="Material spent + service spent (including dynamic calculator additions)" />
            </div>
            
            <Card className="border shadow-sm">
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Progress & Sub-Expenses</CardTitle>
                <span className={`text-sm font-bold ${isOverallOverbudget ? 'text-destructive' : 'text-emerald-500'}`}>{overallProgress.toFixed(1)}% utilized</span>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(overallProgress, 100)}%`, background: isOverallOverbudget ? 'var(--destructive)' : 'var(--primary)' }} />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-sky-500">Material Cost Progress</span>
                      <span className="text-muted-foreground">{fmtRp(totals.materialSpent)} / {fmtRp(totals.materialBudget)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 transition-all" style={{ width: `${totals.materialBudget > 0 ? Math.min((totals.materialSpent / totals.materialBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-emerald-500">Service Cost Progress (Calculated)</span>
                      <span className="text-muted-foreground">{fmtRp(totals.serviceSpent)} / {fmtRp(totals.serviceBudget)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${totals.serviceBudget > 0 ? Math.min((totals.serviceSpent / totals.serviceBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calculator Card (Cols span 4) */}
          <div className="lg:col-span-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-2.5 pt-4 flex flex-row items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Workforce Pricing Calculator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Overtime Rate (/hr)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">Rp</span>
                      <input
                        type="number"
                        className="pl-7 h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="20k"
                        value={overtimeRate || ''}
                        onChange={(e) => setOvertimeRate(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Cost Basis</label>
                    <select
                      className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-[11px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={calcMethod}
                      onChange={(e) => setCalcMethod(e.target.value as 'hours' | 'report')}
                    >
                      <option value="hours">Hours Worked</option>
                      <option value="report">Report Count</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {calcMethod === 'hours' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Report Hours Rate (/hr)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">Rp</span>
                        <input
                          type="number"
                          className="pl-7 h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="50k"
                          value={hoursRate || ''}
                          onChange={(e) => setHoursRate(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Report Flat Rate (/rport)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">Rp</span>
                        <input
                          type="number"
                          className="pl-7 h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="250k"
                          value={reportRate || ''}
                          onChange={(e) => setReportRate(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {(overtimeRate > 0 || hoursRate > 0 || reportRate > 0) && (
                  <div className="bg-primary/5 px-2.5 py-1.5 rounded border border-primary/15 text-[10px] text-muted-foreground flex flex-col gap-0.5">
                    <span className="font-semibold text-primary mb-0.5">Workforce Additions: {fmtRp(totals.workforceCost)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {insights.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 flex items-start gap-4">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="font-semibold text-sm">Automated Insights</h4>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {insights.map((insight, idx) => <li key={idx}>{insight}</li>)}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Screen / Full-Width Project Table */}
        <Card className="overflow-hidden border shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
            <CardTitle className="text-sm font-semibold">
              Project Cost Control Spreadsheet <span className="font-normal text-muted-foreground">({filtered.length.toLocaleString('en-US')} projects filtered)</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-muted p-1 rounded-lg">
                {([['all', 'All'], ['safe', 'Safe'], ['overbudget', 'Overbudget']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${statusFilter === key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search projects..." />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <SortHead label="Project Name & ID" column="prjName" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="min-w-[200px]" />
                    <SortHead label="OT Hours" column="overtimeHours" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-center w-[80px]" />
                    <SortHead label="Rpt Count" column="reportCount" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-center w-[80px]" />
                    <SortHead label="Rpt Hours" column="reportHours" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-center w-[80px]" />
                    
                    <SortHead label="Material Budget" column="budgetMaterial" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Material Spent" column="spentMaterial" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Mat %" column="matPct" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[70px]" />

                    <SortHead label="Service Budget" column="budgetService" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Service Spent" column="spentService" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Svc %" column="svcPct" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[70px]" />
                    <SortHead label="Meal Spent" column="spentMeal" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />

                    <SortHead label="Total Budget" column="budgetTotal" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Total Spent" column="spentTotal" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Util. %" column="totalPct" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sort.sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">No projects found</TableCell>
                    </TableRow>
                  ) : (
                    page.visible.map((d) => {
                      return (
                        <TableRow 
                          key={d.prjId} 
                          className="cursor-pointer hover:bg-muted/50 transition-colors" 
                          onClick={() => setSelectedProject(d)}
                        >
                          {/* Project info */}
                          <TableCell className="font-medium py-2.5">
                            <div className="max-w-[200px] truncate font-semibold text-foreground" title={d.prjName}>{d.prjName}</div>
                            <div className="text-[9px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <span className="uppercase">{d.prjId}</span>
                              <span>•</span>
                              <span title="Project Executor PIC">PIC: {d.pePicName || '-'}</span>
                              <span>•</span>
                              <span title="Project Executor Team">Team: {d.peTeamName || '-'}</span>
                            </div>
                          </TableCell>

                          {/* Report metrics */}
                          <TableCell className="text-center text-muted-foreground font-mono">{d.overtimeHours || '-'}</TableCell>
                          <TableCell className="text-center text-muted-foreground font-mono">{d.reportCount || '-'}</TableCell>
                          <TableCell className="text-center text-muted-foreground font-mono">{d.reportHours || '-'}</TableCell>

                          {/* Material */}
                          <TableCell className="text-right font-mono text-muted-foreground">{d.budgetMaterial > 0 ? fmtRp(d.budgetMaterial) : '-'}</TableCell>
                          <TableCell className="text-right font-mono font-medium text-foreground">{d.spentMaterial > 0 ? fmtRp(d.spentMaterial) : '-'}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono font-semibold ${d.matPct > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {d.matPct > 0 ? `${d.matPct.toFixed(0)}%` : '-'}
                            </span>
                          </TableCell>

                          {/* Service */}
                          <TableCell className="text-right font-mono text-muted-foreground">{d.budgetService > 0 ? fmtRp(d.budgetService) : '-'}</TableCell>
                          <TableCell className="text-right font-mono font-medium text-foreground">{d.spentService > 0 ? fmtRp(d.spentService) : '-'}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono font-semibold ${d.svcPct > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {d.svcPct > 0 ? `${d.svcPct.toFixed(0)}%` : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-foreground">{d.spentMeal > 0 ? fmtRp(d.spentMeal) : '-'}</TableCell>

                          {/* Total */}
                          <TableCell className="text-right font-mono text-muted-foreground bg-muted/10 font-semibold">{fmtRp(d.budgetTotal)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground bg-muted/10">{fmtRp(d.spentTotal)}</TableCell>
                          <TableCell className="text-right bg-muted/10">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`font-mono font-bold ${d.isOverbudget ? 'text-destructive' : 'text-emerald-500'}`}>
                                {d.totalPct.toFixed(0)}%
                              </span>
                              <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary/80">
                                <div 
                                  className="h-full rounded-full transition-all" 
                                  style={{ 
                                    width: `${Math.min(d.totalPct, 100)}%`, 
                                    background: d.isOverbudget ? 'var(--destructive)' : 'var(--primary)' 
                                  }} 
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <LoadMore hasMore={page.hasMore} shown={page.shown} total={page.total} onClick={page.loadMore} onLoadAll={page.loadAll} onCollapse={page.collapse} />
          </CardContent>
        </Card>

        {/* Modal Overlay Dialog for Project Details (Full lists of POs and Reimbursements) */}
        {selectedCalculatedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border shadow-2xl rounded-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-base font-bold text-foreground truncate max-w-[500px]" title={selectedCalculatedProject.prjName}>
                    {selectedCalculatedProject.prjName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono bg-muted text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold text-primary">{selectedCalculatedProject.prjId}</span>
                    <span>•</span>
                    <span>Executor PIC: <strong className="text-foreground">{selectedCalculatedProject.pePicName || '-'}</strong></span>
                    <span>•</span>
                    <span>Executor Team: <strong className="text-foreground">{selectedCalculatedProject.peTeamName || '-'}</strong></span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProject(null)} 
                  className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Summary & Workforce Cards (Cols span 5) */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Budget Progress Summary */}
                  <div className="bg-muted/30 border p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-foreground">Overall Progress</span>
                      <span className={`font-mono font-bold ${selectedCalculatedProject.isOverbudget ? 'text-destructive' : 'text-emerald-500'}`}>
                        {selectedCalculatedProject.totalPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ 
                          width: `${Math.min(selectedCalculatedProject.totalPct, 100)}%`, 
                          background: selectedCalculatedProject.isOverbudget ? 'var(--destructive)' : 'var(--primary)' 
                        }} 
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-dashed">
                      <span>Spent: <strong>{fmtRp(selectedCalculatedProject.spentTotal)}</strong></span>
                      <span>Budget: <strong>{fmtRp(selectedCalculatedProject.budgetTotal)}</strong></span>
                    </div>
                  </div>

                  {/* Pricing Calculator Impact */}
                  {selectedCalculatedProject.calculatedWorkforceCost > 0 && (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-2">
                      <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">Dynamic Workforce Cost Additions</h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Overtime ({selectedCalculatedProject.overtimeHours} hours):</span>
                          <span className="font-medium text-foreground">{fmtRp(selectedCalculatedProject.overtimeCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reports ({selectedCalculatedProject.reportCount} reports):</span>
                          <span className="font-medium text-foreground">{fmtRp(selectedCalculatedProject.reportCost)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1.5 font-bold text-foreground">
                          <span>Total Workforce Cost:</span>
                          <span>{fmtRp(selectedCalculatedProject.calculatedWorkforceCost)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Material & Service Breakdown */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-sky-500 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Material Expenses</span>
                        <span className="font-mono">{selectedCalculatedProject.matPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${Math.min(selectedCalculatedProject.matPct, 100)}%` }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                        <div className="bg-muted/20 border p-2 rounded">
                          <span className="text-muted-foreground block text-[9px] uppercase">Purchasing</span>
                          <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.spentMaterialPurchasing)}</span>
                          <span className="text-[9px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.countMaterialPurchasing} PO(s)</span>
                        </div>
                        <div className="bg-muted/20 border p-2 rounded">
                          <span className="text-muted-foreground block text-[9px] uppercase">Reimburse</span>
                          <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.spentMaterialReimburse)}</span>
                          <span className="text-[9px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.countMaterialReimburse} request(s)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-emerald-500 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Service & Ops Expenses</span>
                        <span className="font-mono">{selectedCalculatedProject.svcPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(selectedCalculatedProject.svcPct, 100)}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] mt-2">
                        <div className="bg-muted/20 border p-2 rounded">
                          <span className="text-muted-foreground block text-[8px] uppercase">Purchasing</span>
                          <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.spentServicePurchasing)}</span>
                          <span className="text-[8px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.countServicePurchasing} PO(s)</span>
                        </div>
                        <div className="bg-muted/20 border p-2 rounded">
                          <span className="text-muted-foreground block text-[8px] uppercase">Reimburse</span>
                          <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.spentServiceReimburse)}</span>
                          <span className="text-[8px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.countServiceReimburse} req(s)</span>
                        </div>
                        <div className="bg-muted/20 border p-2 rounded">
                          <span className="text-muted-foreground block text-[8px] uppercase">Meal benefits</span>
                          <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.spentMeal)}</span>
                          <span className="text-[8px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.countMeal} req(s)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Workforce Data */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> Site Workforce Summary</h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 border rounded bg-muted/10">
                        <div className="font-bold text-foreground">{selectedCalculatedProject.reportCount}</div>
                        <div className="text-[9px] text-muted-foreground">Reports</div>
                      </div>
                      <div className="p-2 border rounded bg-muted/10">
                        <div className="font-bold text-foreground">{selectedCalculatedProject.reportHours}</div>
                        <div className="text-[9px] text-muted-foreground">Total Hours</div>
                      </div>
                      <div className="p-2 border rounded bg-muted/10">
                        <div className="font-bold text-amber-600">{selectedCalculatedProject.overtimeHours}</div>
                        <div className="text-[9px] text-muted-foreground">Overtime</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Detailed lists in tabs (Cols span 7) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Tabs Header */}
                  <div className="flex border-b border-border gap-2 text-xs overflow-x-auto pb-1">
                    {(['purchasing', 'reimburse', 'meal', 'overtime', 'report'] as const).map((tab) => {
                      const n = (arr: unknown[]) => detailLoading ? '…' : arr.length
                      const label =
                        tab === 'purchasing' ? `Purchases (${n(selectedCalculatedProject.purchasingItems)})` :
                        tab === 'reimburse' ? `Reimbursements (${n(selectedCalculatedProject.reimburseItems)})` :
                        tab === 'meal' ? `Meal Benefits (${n(selectedCalculatedProject.mealItems)})` :
                        tab === 'overtime' ? `Overtimes (${n(selectedCalculatedProject.overtimeItems)})` :
                        `Daily Reports (${n(selectedCalculatedProject.reportItems)})`
                      const active = detailTab === tab
                      return (
                        <button
                          key={tab}
                          onClick={() => setDetailTab(tab)}
                          className={`pb-2 px-3 font-semibold transition-colors border-b-2 whitespace-nowrap -mb-px ${active ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {detailLoading && (
                    <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">Loading transaction details…</div>
                  )}

                  {/* Tab Contents: Purchases */}
                  {!detailLoading && detailTab === 'purchasing' && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <ShoppingCart className="h-4 w-4 text-sky-500" />
                        Detail Pembelian (Purchase Orders)
                      </h3>
                      {selectedCalculatedProject.purchasingItems && selectedCalculatedProject.purchasingItems.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto border rounded-xl shadow-inner bg-card">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-muted/40 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="py-2.5">PO / Date</TableHead>
                                <TableHead className="py-2.5">Item Description</TableHead>
                                <TableHead className="py-2.5">Vendor Name</TableHead>
                                <TableHead className="py-2.5 text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCalculatedProject.purchasingItems.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30">
                                  <TableCell className="py-2 whitespace-nowrap">
                                    <div className="font-semibold text-primary">{item.poNumber}</div>
                                    <div className="text-[9px] text-muted-foreground">{item.date}</div>
                                  </TableCell>
                                  <TableCell className="py-2 max-w-[220px] truncate" title={item.description}>{item.description}</TableCell>
                                  <TableCell className="py-2 max-w-[155px] truncate text-muted-foreground" title={item.vendor}>{item.vendor || '-'}</TableCell>
                                  <TableCell className="py-2 text-right font-mono font-medium text-foreground">{fmtRp(item.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl bg-muted/10 text-xs">No PO transactions found</div>
                      )}
                    </div>
                  )}

                  {/* Tab Contents: Reimbursements */}
                  {!detailLoading && detailTab === 'reimburse' && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <Receipt className="h-4 w-4 text-purple-500" />
                        Detail Reimburse (Cash Out)
                      </h3>
                      {selectedCalculatedProject.reimburseItems && selectedCalculatedProject.reimburseItems.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto border rounded-xl shadow-inner bg-card">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-muted/40 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="py-2.5">Date</TableHead>
                                <TableHead className="py-2.5">Description</TableHead>
                                <TableHead className="py-2.5">Requester</TableHead>
                                <TableHead className="py-2.5 text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCalculatedProject.reimburseItems.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30">
                                  <TableCell className="py-2 whitespace-nowrap text-muted-foreground">{item.date}</TableCell>
                                  <TableCell className="py-2 max-w-[220px] truncate" title={item.description}>{item.description}</TableCell>
                                  <TableCell className="py-2 max-w-[155px] truncate font-medium text-foreground" title={item.requestor}>{item.requestor}</TableCell>
                                  <TableCell className="py-2 text-right font-mono font-medium text-foreground">{fmtRp(item.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl bg-muted/10 text-xs">No reimbursement transactions found</div>
                      )}
                    </div>
                  )}

                  {/* Tab Contents: Meal Benefits */}
                  {!detailLoading && detailTab === 'meal' && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <Utensils className="h-4 w-4 text-orange-500" />
                        Detail Meal Benefits
                      </h3>
                      {selectedCalculatedProject.mealItems && selectedCalculatedProject.mealItems.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto border rounded-xl shadow-inner bg-card">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-muted/40 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="py-2.5">Date</TableHead>
                                <TableHead className="py-2.5">User</TableHead>
                                <TableHead className="py-2.5">Notes / Type</TableHead>
                                <TableHead className="py-2.5 text-right">Request Amount</TableHead>
                                <TableHead className="py-2.5 text-right">Real Price (Approved)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCalculatedProject.mealItems.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30">
                                  <TableCell className="py-2 whitespace-nowrap text-muted-foreground">{item.date}</TableCell>
                                  <TableCell className="py-2 font-medium text-foreground">
                                    {item.userName || item.userId || '-'}
                                  </TableCell>
                                  <TableCell className="py-2 max-w-[220px] truncate text-muted-foreground" title={item.notes}>
                                    <div className="font-semibold text-[10px]">{item.type || 'Meal'}</div>
                                    <div className="text-[9px] truncate">{item.notes || '-'}</div>
                                  </TableCell>
                                  <TableCell className="py-2 text-right font-mono text-muted-foreground">{fmtRp(item.amount)}</TableCell>
                                  <TableCell className="py-2 text-right font-mono font-semibold text-foreground">{fmtRp(item.approved)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl bg-muted/10 text-xs">No meal benefit records found</div>
                      )}
                    </div>
                  )}

                  {/* Tab Contents: Overtimes */}
                  {!detailLoading && detailTab === 'overtime' && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Detail Overtime (Lembur Kerja)
                      </h3>
                      {selectedCalculatedProject.overtimeItems && selectedCalculatedProject.overtimeItems.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto border rounded-xl shadow-inner bg-card">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-muted/40 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="py-2.5">Date</TableHead>
                                <TableHead className="py-2.5">Worker Name</TableHead>
                                <TableHead className="py-2.5">Activity / Reason</TableHead>
                                <TableHead className="py-2.5 text-right">Hours</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCalculatedProject.overtimeItems.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30">
                                  <TableCell className="py-2 whitespace-nowrap text-muted-foreground">{item.date}</TableCell>
                                  <TableCell className="py-2 font-medium text-foreground">{item.workerName}</TableCell>
                                  <TableCell className="py-2 max-w-[220px] truncate text-muted-foreground" title={item.reason}>{item.reason || '-'}</TableCell>
                                  <TableCell className="py-2 text-right font-mono font-semibold text-foreground">{item.hours} hrs</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl bg-muted/10 text-xs">No overtime records found</div>
                      )}
                    </div>
                  )}

                  {/* Tab Contents: Daily Reports */}
                  {!detailLoading && detailTab === 'report' && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <Clock className="h-4 w-4 text-emerald-500" />
                        Detail Daily Reports (Laporan Kerja)
                      </h3>
                      {selectedCalculatedProject.reportItems && selectedCalculatedProject.reportItems.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto border rounded-xl shadow-inner bg-card">
                          <Table className="text-[11px]">
                            <TableHeader className="bg-muted/40 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="py-2.5">Date</TableHead>
                                <TableHead className="py-2.5">Worker Name</TableHead>
                                <TableHead className="py-2.5">Activity / Remarks</TableHead>
                                <TableHead className="py-2.5 text-right">Hours</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCalculatedProject.reportItems.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30">
                                  <TableCell className="py-2 whitespace-nowrap text-muted-foreground">{item.date}</TableCell>
                                  <TableCell className="py-2 font-medium text-foreground">{item.workerName}</TableCell>
                                  <TableCell className="py-2 max-w-[220px] truncate text-muted-foreground" title={item.remarks}>{item.remarks || '-'}</TableCell>
                                  <TableCell className="py-2 text-right font-mono font-semibold text-foreground">{item.hours} hrs</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl bg-muted/10 text-xs">No daily reports found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t bg-muted/20 flex justify-end">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-xs font-semibold transition-colors"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </SalesPageShell>
  )
}
