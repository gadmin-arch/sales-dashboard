'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { useSort, SortHead } from '@/components/sortable'
import { FolderOpen, Search, AlertCircle, X, CheckCircle, Lightbulb, Clock, ShoppingCart, Receipt, Utensils, Settings2, TrendingUp } from 'lucide-react'
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

      {/* Slide-over Detail View */}
      {selectedCalculatedProject && (
        <>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSelectedProject(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[600px] bg-background border-l shadow-2xl p-6 overflow-y-auto transform transition-transform duration-300 ease-in-out">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{selectedCalculatedProject.prjName}</h2>
                <p className="text-sm text-muted-foreground mt-1 tracking-widest">{selectedCalculatedProject.prjId}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-8">
              {/* Project Owner & Team */}
              <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Project Executor PIC</span>
                  <span className="font-bold text-foreground">{selectedCalculatedProject.pePicName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Project Executor Team</span>
                  <span className="font-bold text-foreground">{selectedCalculatedProject.peTeamName || '-'}</span>
                </div>
              </div>

              {/* Dynamic Cost Calculator Impact */}
              {selectedCalculatedProject.calculatedWorkforceCost > 0 && (
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-2">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Dynamic Workforce Cost Additions</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Calculated Overtime Cost ({selectedCalculatedProject.overtimeHours}h):</span>
                      <span className="font-medium text-foreground">{overtimeRate > 0 ? `Rp ${overtimeRate.toLocaleString('en-US')}/hr` : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Calculated Work Reports Cost ({calcMethod === 'hours' ? `${selectedCalculatedProject.reportHours} hrs` : `${selectedCalculatedProject.reportCount} rpts`}):</span>
                      <span className="font-medium text-foreground">
                        {calcMethod === 'hours' ? `Rp ${hoursRate.toLocaleString('en-US')}/hr` : `Rp ${reportRate.toLocaleString('en-US')}/rpt`}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-bold text-foreground">
                      <span>Total Added Cost:</span>
                      <span>{selectedCalculatedProject.calculatedWorkforceCost > 0 ? `+ ${selectedCalculatedProject.calculatedWorkforceCost.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Total Utilization</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${selectedCalculatedProject.totalPct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(selectedCalculatedProject.totalPct, 100)}%` }} 
                      />
                    </div>
                    <span className={`font-bold ${selectedCalculatedProject.totalPct > 100 ? 'text-red-500' : ''}`}>
                      {selectedCalculatedProject.totalPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Workforce Summary</h3>
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">{selectedCalculatedProject.reportCount}</span> reports, <span className="font-bold">{selectedCalculatedProject.reportHours.toFixed(1)}</span> total hrs
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="text-amber-600 font-medium">{selectedCalculatedProject.overtimeHours.toFixed(1)}</span> overtime hours
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchasing POs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-lg border-b pb-1 flex-1">Purchasing Details ({selectedCalculatedProject.purchasingItems.length})</h3>
                </div>
                {selectedCalculatedProject.purchasingItems.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCalculatedProject.purchasingItems.map((item, idx) => (
                      <div key={idx} className="bg-card border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-foreground">{item.poNumber}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                            <span className="font-bold text-muted-foreground font-mono text-xs">
                              {item.pctOfOrder > 0 ? `${item.pctOfOrder.toFixed(2)}% of PO` : '-'}
                            </span>
                          </div>
                        </div>
                        <span className="text-muted-foreground">{item.description || 'No description provided.'}</span>
                        <span className="text-xs text-muted-foreground/70">{item.date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No purchasing records found.</p>
                )}
              </div>

              {/* Reimburse Items */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-semibold text-lg border-b pb-1 flex-1">Reimburse Requests ({selectedCalculatedProject.reimburseItems.length})</h3>
                </div>
                {selectedCalculatedProject.reimburseItems.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCalculatedProject.reimburseItems.map((item, idx) => (
                      <div key={idx} className="bg-card border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-foreground">{item.requestor}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                            <span className="font-bold text-foreground font-mono text-xs">{fmtRp(item.amount)}</span>
                          </div>
                        </div>
                        <span className="text-muted-foreground">{item.description || 'No description provided.'}</span>
                        <span className="text-xs text-muted-foreground/70">{item.date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No reimburse records found.</p>
                )}
              </div>

              {/* Meal Requests */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold text-lg border-b pb-1 flex-1">Meal Requests ({selectedCalculatedProject.mealItems.length})</h3>
                </div>
                {selectedCalculatedProject.mealItems.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCalculatedProject.mealItems.map((item, idx) => (
                      <div key={idx} className="bg-card border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-foreground">{item.requestor}</span>
                          <span className="font-bold text-foreground font-mono text-xs">{fmtRp(item.amount)}</span>
                        </div>
                        <span className="text-muted-foreground">{item.description || 'Meal allowance'}</span>
                        <span className="text-xs text-muted-foreground/70">{item.date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No meal records found.</p>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}
