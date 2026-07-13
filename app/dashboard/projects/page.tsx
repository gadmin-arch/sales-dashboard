'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { useSort, SortHead } from '@/components/sortable'
import { FolderOpen, Search, AlertCircle, X, CheckCircle, Lightbulb, Clock, ShoppingCart, Receipt, Utensils, Settings2, TrendingUp, Activity } from 'lucide-react'
import { DateRangeRow } from '@/components/date-range-row'
import { MultiSelect } from '@/components/multi-select'
import { buildQuery, getYTD, sameSet, fmtCurrency } from '@/lib/sales-helpers'
import { PageSpinner, PageError } from '@/components/page-states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const fmtRp = (v: number) => fmtCurrency(v, 'IDR')

interface ProjectDashboardData {
  prjId: string
  prjName: string
  budgetMaterial: number
  budgetService: number
  budgetTotal: number
  spentMaterial: number
  spentService: number
  spentMeal: number
  reimburseMaterialSpent: number
  reimburseServiceSpent: number
  
  purchasingItems: Array<{ date: string; description: string; type: string; poNumber: string; pctOfOrder: number }>
  reimburseItems: Array<{ date: string; description: string; type: string; requestor: string; amount: number }>
  mealItems: Array<{ date: string; description: string; requestor: string; amount: number }>
  overtimeItems: Array<{ date: string; workerName: string; hours: number; reason: string }>
  reportItems: Array<{ date: string; workerName: string; hours: number; remarks: string }>

  overtimeHours: number
  reportCount: number
  reportHours: number

  pePicName: string
  peTeamName: string
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

export default function ProjectsDashboardPage() {
  const [data, setData] = useState<ProjectDashboardData[]>([])
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<ProjectDashboardData | null>(null)
  const [activeTab, setActiveTab] = useState<'purchasing' | 'reimburse' | 'overtime' | 'report'>('purchasing')

  // Workforce Pricing Calculator States
  const [overtimeRate, setOvertimeRate] = useState<number>(0)
  const [hoursRate, setHoursRate] = useState<number>(0)
  const [reportRate, setReportRate] = useState<number>(0)
  const [calcMethod, setCalcMethod] = useState<'hours' | 'report'>('hours')

  // Filters State
  const dYTD = getYTD()
  const [dateFrom, setDateFrom] = useState(dYTD.from)
  const [dateTo, setDateTo] = useState(dYTD.to)
  const [su, setSu] = useState<string[]>([])
  const [ot, setOt] = useState<string[]>([])
  const [ps, setPs] = useState<string[]>([])
  const [inv, setInv] = useState<string[]>([])
  const [prjFlag, setPrjFlag] = useState<string[]>([])
  const [pePic, setPePic] = useState<string[]>([])
  const [peTeam, setPeTeam] = useState<string[]>([])

  // Local draft states
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lSu, setLSu] = useState<string[]>([]), [lOt, setLOt] = useState<string[]>([])
  const [lPs, setLPs] = useState<string[]>([]), [lInv, setLInv] = useState<string[]>([])
  const [lPrjFlag, setLPrjFlag] = useState<string[]>([])
  const [lPePic, setLPePic] = useState<string[]>([])
  const [lPeTeam, setLPeTeam] = useState<string[]>([])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/projects?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to fetch data')
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
        projectFlagList: json.projectFlagList || []
      })
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false;
    doFetch({
      dateFrom, dateTo, salesUser: su, orderType: ot, projectStatus: ps, invoiceStatus: inv, projectFlag: prjFlag,
      pePic, peTeam,
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, su, ot, ps, inv, prjFlag, pePic, peTeam])

  const onApply = () => { 
    setDateFrom(lFrom); setDateTo(lTo); setSu(lSu); setOt(lOt); setPs(lPs); setInv(lInv); setPrjFlag(lPrjFlag); setPePic(lPePic); setPeTeam(lPeTeam) 
  }
  const onClear = () => { 
    const d = getYTD(); 
    setLFrom(d.from); setLTo(d.to); setLSu([]); setLOt([]); setLPs([]); setLInv([]); setLPrjFlag([]); setLPePic([]); setLPeTeam([]);
    setDateFrom(d.from); setDateTo(d.to); setSu([]); setOt([]); setPs([]); setInv([]); setPrjFlag([]); setPePic([]); setPeTeam([]) 
  }

  // Dynamically calculate workforce cost additions
  const calculatedRows = useMemo(() => {
    return data.map((d) => {
      const overtimeCost = d.overtimeHours * overtimeRate
      const reportCost = calcMethod === 'hours' ? d.reportHours * hoursRate : d.reportCount * reportRate
      const calculatedWorkforceCost = overtimeCost + reportCost

      const spentServiceAdjusted = (d.spentService || 0) + calculatedWorkforceCost
      const spentTotal = (d.spentMaterial || 0) + spentServiceAdjusted

      const matPct = d.budgetMaterial > 0 ? ((d.spentMaterial || 0) / d.budgetMaterial) * 100 : 0
      const svcPct = d.budgetService > 0 ? (spentServiceAdjusted / d.budgetService) * 100 : 0
      const totalPct = d.budgetTotal > 0 ? (spentTotal / d.budgetTotal) * 100 : (spentTotal > 0 ? 100 : 0)

      return {
        ...d,
        spentTotal,
        overtimeCost,
        reportCost,
        calculatedWorkforceCost,
        matPct,
        svcPct,
        totalPct
      }
    })
  }, [data, overtimeRate, hoursRate, reportRate, calcMethod])

  const filtered = useMemo(() => {
    return calculatedRows.filter((d) => {
      const matchSearch = (d.prjName || '').toLowerCase().includes(search.toLowerCase()) || 
                          (d.prjId || '').toLowerCase().includes(search.toLowerCase()) ||
                          (d.pePicName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (d.peTeamName || '').toLowerCase().includes(search.toLowerCase())
      
      return matchSearch
    })
  }, [calculatedRows, search])

  // Recalculate selected project reference when data changes
  const selectedCalculatedProject = useMemo(() => {
    if (!selectedProject) return null
    return filtered.find((p) => p.prjId === selectedProject.prjId) || null
  }, [selectedProject, filtered])

  // Computed columns
  const tableRows = useMemo(() => filtered.map((d) => ({
    ...d,
    totalItems: d.reimburseItems.length + d.mealItems.length,
  })), [filtered])
  const sort = useSort(tableRows, 'totalPct', 'desc')

  const insights = useMemo(() => {
    if (calculatedRows.length === 0) return []
    const totalReports = calculatedRows.reduce((sum, d) => sum + d.reportCount, 0)
    const totalOvertime = calculatedRows.reduce((sum, d) => sum + d.overtimeHours, 0)
    
    const validProjects = calculatedRows.filter(d => d.budgetTotal > 0)
    const avgUtil = validProjects.length > 0
      ? validProjects.reduce((sum, d) => sum + d.totalPct, 0) / validProjects.length
      : 0
    
    return [
      `Average budget utilization across filtered projects: ${avgUtil.toFixed(1)}%`,
      `Total worker activity: ${totalReports} reports submitted, with ${totalOvertime.toFixed(1)} overtime hours.`
    ]
  }, [calculatedRows])

  const salesUserOpts: Option[] = (metadata?.salesUserList || []).map(u => ({ value: u.id, label: u.name }))
  const pePicOpts: Option[] = (metadata?.pePicList || []).map(u => ({ value: u.id, label: u.name }))
  const peTeamOpts: Option[] = (metadata?.peTeamList || []).map(u => ({ value: u.id, label: u.name }))
  const typeOpts: Option[] = (metadata?.orderTypeList || []).map(t => ({ value: t.otId, label: t.otDescription }))
  const psOpts: Option[] = (metadata?.projectStatusList || []).map(t => ({ value: t.pesId, label: t.pesDescription }))
  const invOpts: Option[] = (metadata?.invoiceStatusList || []).map(t => ({ value: t.fsId, label: t.fsDescription }))
  const flagOpts: Option[] = (metadata?.projectFlagList || []).map(t => ({ value: t.flagId, label: t.flagDescription }))

  if (error && !data.length) return <PageError error={error} onRetry={onClear} />

  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo || !sameSet(lSu, su) || !sameSet(lOt, ot) || !sameSet(lPs, ps) || !sameSet(lInv, inv) || !sameSet(lPrjFlag, prjFlag) || !sameSet(lPePic, pePic) || !sameSet(lPeTeam, peTeam)

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track project operations, resource utilization, and expense items without exposing financial amounts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Filter Card (Col span 2) */}
        <div className="lg:col-span-2 bg-card border rounded-lg p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap gap-3">
            <MultiSelect allLabel="Sales User" options={salesUserOpts} selected={lSu} onChange={setLSu} />
            <MultiSelect allLabel="Project Executor PIC" options={pePicOpts} selected={lPePic} onChange={setLPePic} />
            <MultiSelect allLabel="Project Executor Team" options={peTeamOpts} selected={lPeTeam} onChange={setLPeTeam} />
            <MultiSelect allLabel="Order Type" options={typeOpts} selected={lOt} onChange={setLOt} />
            <MultiSelect allLabel="Project Status" options={psOpts} selected={lPs} onChange={setLPs} />
            <MultiSelect allLabel="Invoice Status" options={invOpts} selected={lInv} onChange={setLInv} />
            <MultiSelect allLabel="Project Flag" options={flagOpts} selected={lPrjFlag} onChange={setLPrjFlag} />
          </div>
          <div className="border-t border-border pt-4">
            <DateRangeRow
              from={lFrom}
              to={lTo}
              onChange={(f, t) => { setLFrom(f); setLTo(t) }}
              label="PO / Project Date"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">
              Apply Filters
              {hasUnapplied && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
            </Button>
          </div>
        </div>

        {/* Right Side: Pricing Calculator Card (Col span 1) */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Workforce Pricing Calculator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Overtime Rate / hr</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    className="pl-7 h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. 20000"
                    value={overtimeRate || ''}
                    onChange={(e) => setOvertimeRate(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Report Basis</label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={calcMethod}
                  onChange={(e) => setCalcMethod(e.target.value as 'hours' | 'report')}
                >
                  <option value="hours">Hours Worked</option>
                  <option value="report">Report Count</option>
                </select>
              </div>
            </div>

            {calcMethod === 'hours' ? (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Report Hours Rate / hr</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    className="pl-7 h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. 50000"
                    value={hoursRate || ''}
                    onChange={(e) => setHoursRate(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Flat Rate / report</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    className="pl-7 h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. 250000"
                    value={reportRate || ''}
                    onChange={(e) => setReportRate(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {insights.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-4">
            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Automated Insights</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {insights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && data.length === 0 ? (
        <PageSpinner />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                className="pl-9 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <SortHead label="Project" column="prjName" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="w-[160px] max-w-[180px]" />
                    <SortHead label="PE PIC" column="pePicName" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="w-[110px]" />
                    <SortHead label="PE Team" column="peTeamName" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="w-[80px]" />
                    <SortHead label="Reports" column="reportCount" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[90px]" />
                    <SortHead label="Overtime" column="overtimeHours" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[90px]" />
                    <SortHead label="Material Util %" column="matPct" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Service Util %" column="svcPct" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[110px]" />
                    <SortHead label="Total Util %" column="totalPct" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} className="text-right w-[130px] bg-muted/20 font-bold" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sort.sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No projects found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sort.sorted.map((row) => {
                      return (
                        <TableRow 
                          key={row.prjId} 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedProject(row)}
                        >
                          <TableCell className="max-w-[180px]">
                            <div className="font-semibold truncate text-xs text-foreground" title={row.prjName}>{row.prjName}</div>
                            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">{row.prjId}</div>
                          </TableCell>
                          <TableCell className="max-w-[110px] truncate text-xs font-medium">
                            {row.pePicName || '-'}
                          </TableCell>
                          <TableCell className="max-w-[80px] truncate text-xs text-muted-foreground">
                            {row.peTeamName || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium text-xs text-foreground">{row.reportCount}</div>
                            <div className="text-[9px] text-muted-foreground">{row.reportHours.toFixed(1)} hrs</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium text-xs text-amber-600 dark:text-amber-400">{row.overtimeHours.toFixed(1)}h</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {row.matPct > 0 ? `${row.matPct.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {row.svcPct > 0 ? `${row.svcPct.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right bg-muted/10 font-bold">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden max-w-[50px] hidden sm:block">
                                <div 
                                  className={`h-full ${row.totalPct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                  style={{ width: `${Math.min(row.totalPct, 100)}%` }} 
                                />
                              </div>
                              <span className={`font-mono text-xs ${row.totalPct > 100 ? 'text-red-600 font-bold' : 'text-foreground'}`}>
                                {row.totalPct.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Modal Overlay Dialog for Project Details (Full lists of POs, Reimbursements, Overtimes, Reports) */}
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
                    <span className="font-bold text-foreground">Overall Budget Utilization</span>
                    <span className={`font-mono font-bold ${selectedCalculatedProject.totalPct > 100 ? 'text-destructive' : 'text-emerald-500'}`}>
                      {selectedCalculatedProject.totalPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div 
                      className="h-full rounded-full transition-all" 
                      style={{ 
                        width: `${Math.min(selectedCalculatedProject.totalPct, 100)}%`, 
                        background: selectedCalculatedProject.totalPct > 100 ? 'var(--destructive)' : 'var(--primary)' 
                      }} 
                    />
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
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-muted/20 border p-2 rounded">
                        <span className="text-muted-foreground block text-[9px] uppercase">Purchasing</span>
                        <span className="font-bold text-foreground">%-Only</span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.purchasingItems.filter(i => i.type === 'Material').length} PO(s)</span>
                      </div>
                      <div className="bg-muted/20 border p-2 rounded">
                        <span className="text-muted-foreground block text-[9px] uppercase">Reimburse</span>
                        <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.reimburseMaterialSpent)}</span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.reimburseItems.filter(i => i.type === 'Material').length} request(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-emerald-500 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Service & Ops Expenses</span>
                      <span className="font-mono">{selectedCalculatedProject.svcPct.toFixed(0)}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="bg-muted/20 border p-2 rounded">
                        <span className="text-muted-foreground block text-[8px] uppercase">Purchasing</span>
                        <span className="font-bold text-foreground">%-Only</span>
                        <span className="text-[8px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.purchasingItems.filter(i => i.type === 'Service').length} PO(s)</span>
                      </div>
                      <div className="bg-muted/20 border p-2 rounded">
                        <span className="text-muted-foreground block text-[8px] uppercase">Reimburse</span>
                        <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.reimburseServiceSpent)}</span>
                        <span className="text-[8px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.reimburseItems.filter(i => i.type === 'Service').length} req(s)</span>
                      </div>
                      <div className="bg-muted/20 border p-2 rounded">
                        <span className="text-muted-foreground block text-[8px] uppercase">Meal benefits</span>
                        <span className="font-bold text-foreground">{fmtRp(selectedCalculatedProject.spentMeal)}</span>
                        <span className="text-[8px] text-muted-foreground block mt-0.5">{selectedCalculatedProject.mealItems.length} req(s)</span>
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
                  {(['purchasing', 'reimburse', 'overtime', 'report'] as const).map((tab) => {
                    const label = 
                      tab === 'purchasing' ? `Purchases (${selectedCalculatedProject.purchasingItems.length})` :
                      tab === 'reimburse' ? `Reimbursements (${selectedCalculatedProject.reimburseItems.length})` :
                      tab === 'overtime' ? `Overtimes (${selectedCalculatedProject.overtimeItems.length})` :
                      `Daily Reports (${selectedCalculatedProject.reportItems.length})`
                    
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 px-1 font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Tab Contents */}
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {activeTab === 'purchasing' && (
                    selectedCalculatedProject.purchasingItems.length > 0 ? (
                      selectedCalculatedProject.purchasingItems.map((item, idx) => (
                        <div key={idx} className="bg-card border rounded p-3 text-xs flex flex-col gap-1 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-foreground">{item.poNumber}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px]">{item.type}</Badge>
                              <span className="font-bold text-muted-foreground font-mono">
                                {item.pctOfOrder > 0 ? `${item.pctOfOrder.toFixed(2)}% of PO` : '-'}
                              </span>
                            </div>
                          </div>
                          <span className="text-muted-foreground">{item.description || 'No description provided.'}</span>
                          <span className="text-[10px] text-muted-foreground/75">{item.date}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-xs">No purchasing records found.</div>
                    )
                  )}

                  {activeTab === 'reimburse' && (
                    selectedCalculatedProject.reimburseItems.length > 0 ? (
                      selectedCalculatedProject.reimburseItems.map((item, idx) => (
                        <div key={idx} className="bg-card border rounded p-3 text-xs flex flex-col gap-1 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-foreground">{item.requestor}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px]">{item.type}</Badge>
                              <span className="font-bold text-foreground font-mono">{fmtRp(item.amount)}</span>
                            </div>
                          </div>
                          <span className="text-muted-foreground">{item.description || 'No description provided.'}</span>
                          <span className="text-[10px] text-muted-foreground/75">{item.date}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-xs">No reimburse records found.</div>
                    )
                  )}

                  {activeTab === 'overtime' && (
                    selectedCalculatedProject.overtimeItems && selectedCalculatedProject.overtimeItems.length > 0 ? (
                      selectedCalculatedProject.overtimeItems.map((item, idx) => (
                        <div key={idx} className="bg-card border rounded p-3 text-xs flex flex-col gap-1 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-foreground">{item.workerName}</span>
                            <span className="font-bold text-amber-600 font-mono">{item.hours} hrs</span>
                          </div>
                          <span className="text-muted-foreground">{item.reason || 'Overtime work'}</span>
                          <span className="text-[10px] text-muted-foreground/75">{item.date}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-xs">No overtime records found.</div>
                    )
                  )}

                  {activeTab === 'report' && (
                    selectedCalculatedProject.reportItems && selectedCalculatedProject.reportItems.length > 0 ? (
                      selectedCalculatedProject.reportItems.map((item, idx) => (
                        <div key={idx} className="bg-card border rounded p-3 text-xs flex flex-col gap-1 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-foreground">{item.workerName}</span>
                            <span className="font-bold text-foreground font-mono">{item.hours} hrs</span>
                          </div>
                          <span className="text-muted-foreground">{item.remarks || 'No remarks provided.'}</span>
                          <span className="text-[10px] text-muted-foreground/75">{item.date}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-xs">No daily report logs found.</div>
                    )
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
