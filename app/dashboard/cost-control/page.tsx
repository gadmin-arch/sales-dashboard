'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Activity, Search, AlertCircle, X, CheckCircle, Lightbulb, TrendingUp } from 'lucide-react'
import { DateRangeRow } from '@/components/date-range-row'
import { MultiSelect } from '@/components/multi-select'
import { buildQuery, getYTD, sameSet } from '@/lib/sales-helpers'
import { PageSpinner, PageError } from '@/components/page-states'
import { Button } from '@/components/ui/button'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

interface CostControlData {
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
}

interface Option { value: string; label: string }
interface FilterMetadata {
  salesUserList: { id: string; name: string }[]
  orderTypeList: { otId: string; otDescription: string }[]
  projectStatusList: { pesId: string; pesDescription: string }[]
  invoiceStatusList: { fsId: string; fsDescription: string }[]
  projectFlagList: { flagId: string; flagDescription: string }[]
}

export default function CostControlPage() {
  const [data, setData] = useState<CostControlData[]>([])
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'safe' | 'overbudget'>('all')
  const [selectedProject, setSelectedProject] = useState<CostControlData | null>(null)

  // Filters State
  const dYTD = getYTD()
  const [dateFrom, setDateFrom] = useState(dYTD.from)
  const [dateTo, setDateTo] = useState(dYTD.to)
  const [su, setSu] = useState<string[]>([])
  const [ot, setOt] = useState<string[]>([])
  const [ps, setPs] = useState<string[]>([])
  const [inv, setInv] = useState<string[]>([])
  const [prjFlag, setPrjFlag] = useState<string[]>([])

  // Local draft states
  const [lFrom, setLFrom] = useState(dateFrom), [lTo, setLTo] = useState(dateTo)
  const [lSu, setLSu] = useState<string[]>([]), [lOt, setLOt] = useState<string[]>([])
  const [lPs, setLPs] = useState<string[]>([]), [lInv, setLInv] = useState<string[]>([])
  const [lPrjFlag, setLPrjFlag] = useState<string[]>([])

  const doFetch = useCallback(async (p: Record<string, string | string[]>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/cost-control?' + buildQuery(p))
      if (!res.ok) throw new Error('Failed to fetch data')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.projects || [])
      setMetadata({
        salesUserList: json.salesUserList || [],
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
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, su, ot, ps, inv, prjFlag])

  const onApply = () => { setDateFrom(lFrom); setDateTo(lTo); setSu(lSu); setOt(lOt); setPs(lPs); setInv(lInv); setPrjFlag(lPrjFlag) }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setLSu([]); setLOt([]); setLPs([]); setLInv([]); setLPrjFlag([]); setDateFrom(d.from); setDateTo(d.to); setSu([]); setOt([]); setPs([]); setInv([]); setPrjFlag([]) }

  const filtered = useMemo(() => {
    return data.filter((d) => {
      const matchSearch = (d.prjName || '').toLowerCase().includes(search.toLowerCase()) || 
                          (d.prjId || '').toLowerCase().includes(search.toLowerCase())
      
      if (!matchSearch) return false

      const isOver = (d.spentMaterial > d.budgetMaterial && d.budgetMaterial > 0) || 
                     (d.spentService > d.budgetService && d.budgetService > 0)
      
      if (filterType === 'safe' && isOver) return false
      if (filterType === 'overbudget' && !isOver) return false

      return true
    })
  }, [data, search, filterType])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, curr) => ({
        budgetMat: acc.budgetMat + curr.budgetMaterial,
        budgetSvc: acc.budgetSvc + curr.budgetService,
        spentMat: acc.spentMat + curr.spentMaterial,
        spentSvc: acc.spentSvc + curr.spentService,
      }),
      { budgetMat: 0, budgetSvc: 0, spentMat: 0, spentSvc: 0 }
    )
  }, [filtered])

  const totalBudget = totals.budgetMat + totals.budgetSvc
  const totalSpent = totals.spentMat + totals.spentSvc
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const isOverallOverbudget = totalSpent > totalBudget

  // Generate Insights
  const insights = useMemo(() => {
    if (data.length === 0) return []
    const overbudgetProjects = data.filter(d => 
      (d.spentMaterial > d.budgetMaterial && d.budgetMaterial > 0) || 
      (d.spentService > d.budgetService && d.budgetService > 0)
    )
    const mealTotal = data.reduce((sum, d) => sum + d.spentMeal, 0)
    const totalSvc = data.reduce((sum, d) => sum + d.spentService, 0)
    
    const items = []
    if (overbudgetProjects.length > 0) {
      items.push(`${overbudgetProjects.length} project(s) are currently overbudget (either material or service).`)
    } else {
      items.push(`All projects are safely within their allocated budgets.`)
    }
    
    if (totalSvc > 0) {
      const mealPct = ((mealTotal / totalSvc) * 100).toFixed(1)
      items.push(`Meal Requests account for ${mealPct}% of total service expenses.`)
    }
    
    return items
  }, [data])

  const salesUserOpts: Option[] = (metadata?.salesUserList || []).map(u => ({ value: u.id, label: u.name }))
  const typeOpts: Option[] = (metadata?.orderTypeList || []).map(t => ({ value: t.otId, label: t.otDescription }))
  const psOpts: Option[] = (metadata?.projectStatusList || []).map(t => ({ value: t.pesId, label: t.pesDescription }))
  const invOpts: Option[] = (metadata?.invoiceStatusList || []).map(t => ({ value: t.fsId, label: t.fsDescription }))
  const flagOpts: Option[] = (metadata?.projectFlagList || []).map(t => ({ value: t.flagId, label: t.flagDescription }))

  if (error && !data.length) return <PageError error={error} onRetry={onClear} />

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cost Control</h1>
        <p className="text-muted-foreground mt-2">
          Monitor project budgets vs actual expenses with detailed breakdown capabilities.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-3">
          <MultiSelect allLabel="Sales User" options={salesUserOpts} selected={lSu} onChange={setLSu} />
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
            {(lFrom !== dateFrom || lTo !== dateTo || !sameSet(lSu, su) || !sameSet(lOt, ot) || !sameSet(lPs, ps) || !sameSet(lInv, inv) || !sameSet(lPrjFlag, prjFlag)) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}
          </Button>
        </div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            <p className="text-xs text-muted-foreground mt-1">From Sales POs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isOverallOverbudget ? 'text-red-500' : ''}`}>
              {formatCurrency(totalSpent)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Purchasing + Reimburse + Meals</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Budget Utilization</CardTitle>
            {isOverallOverbudget ? <AlertCircle className="h-4 w-4 text-red-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{overallProgress.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">
                Remaining: {formatCurrency(Math.max(0, totalBudget - totalSpent))}
              </span>
            </div>
            <progress 
              value={Math.min(overallProgress, 100)} 
              max="100"
              className={`w-full h-2 rounded ${isOverallOverbudget ? 'text-red-500' : ''}`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search projects..."
            className="pl-8 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${filterType === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilterType('safe')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${filterType === 'safe' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Safe Status
          </button>
          <button 
            onClick={() => setFilterType('overbudget')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${filterType === 'overbudget' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Overbudget
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Project</TableHead>
                  <TableHead className="text-right">Material Budget</TableHead>
                  <TableHead className="text-right">Material Spent</TableHead>
                  <TableHead className="text-right border-r">Material %</TableHead>
                  <TableHead className="text-right">Service Budget</TableHead>
                  <TableHead className="text-right">Service Spent</TableHead>
                  <TableHead className="text-right border-r">Service %</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">Loading cost control data...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">No projects found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => {
                    const matPercent = d.budgetMaterial > 0 ? (d.spentMaterial / d.budgetMaterial) * 100 : 0
                    const svcPercent = d.budgetService > 0 ? (d.spentService / d.budgetService) * 100 : 0
                    
                    return (
                      <TableRow 
                        key={d.prjId} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedProject(d)}
                      >
                        <TableCell className="font-medium">
                          <div className="truncate w-[250px]" title={d.prjName}>{d.prjName}</div>
                          <div className="text-xs text-muted-foreground">{d.prjId}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(d.budgetMaterial)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(d.spentMaterial)}</TableCell>
                        <TableCell className={`text-right border-r ${matPercent > 100 ? 'text-red-500 font-bold' : ''}`}>
                          {matPercent.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(d.budgetService)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(d.spentService)}</TableCell>
                        <TableCell className={`text-right border-r ${svcPercent > 100 ? 'text-red-500 font-bold' : ''}`}>
                          {svcPercent.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">{d.reportCount}</TableCell>
                        <TableCell className="text-right">{d.reportHours}</TableCell>
                        <TableCell className="text-right">{d.overtimeHours}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Slide-over Detail Drawer */}
      {selectedProject && (
        <>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSelectedProject(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background shadow-2xl border-l z-50 p-6 flex flex-col overflow-y-auto transform transition-transform">
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold truncate" title={selectedProject.prjName}>
                  {selectedProject.prjName}
                </h2>
                <p className="text-sm text-muted-foreground">{selectedProject.prjId}</p>
              </div>
              <button 
                onClick={() => setSelectedProject(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-8">
              {/* Material Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-lg">Material Expenses</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">From Purchasing</p>
                    <p className="font-bold">{formatCurrency(selectedProject.spentMaterialPurchasing)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedProject.countMaterialPurchasing} PO(s)</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">From Reimburse</p>
                    <p className="font-bold">{formatCurrency(selectedProject.spentMaterialReimburse)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedProject.countMaterialReimburse} request(s)</p>
                  </div>
                </div>
              </div>

              {/* Service Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-semibold text-lg">Service & Operational Expenses</h3>
                </div>
                <div className="grid gap-4">
                  <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Service Purchasing</p>
                      <p className="font-bold">{formatCurrency(selectedProject.spentServicePurchasing)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedProject.countServicePurchasing} PO(s)</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Service Reimburse</p>
                      <p className="font-bold">{formatCurrency(selectedProject.spentServiceReimburse)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedProject.countServiceReimburse} request(s)</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Meal Requests</p>
                      <p className="font-bold">{formatCurrency(selectedProject.spentMeal)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedProject.countMeal} request(s)</p>
                  </div>
                </div>
              </div>

              {/* Productivity Summary */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold text-lg">Workforce Data</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold">{selectedProject.reportCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Reports</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold">{selectedProject.reportHours}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Hours</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold text-amber-600">{selectedProject.overtimeHours}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Overtime</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}
