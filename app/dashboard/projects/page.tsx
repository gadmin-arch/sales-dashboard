'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FolderOpen, Search, AlertCircle, X, CheckCircle, Lightbulb, Clock, ShoppingCart, Receipt, Utensils } from 'lucide-react'
import { DateRangeRow } from '@/components/date-range-row'
import { MultiSelect } from '@/components/multi-select'
import { buildQuery, getYTD, sameSet } from '@/lib/sales-helpers'
import { PageSpinner, PageError } from '@/components/page-states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ProjectDashboardData {
  prjId: string
  prjName: string
  budgetTotal: number
  spentTotal: number
  utilizationPct: number
  
  purchasingItems: Array<{ date: string; description: string; type: string; poNumber: string }>
  reimburseItems: Array<{ date: string; description: string; type: string; requestor: string }>
  mealItems: Array<{ date: string; description: string; requestor: string }>

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

export default function ProjectsDashboardPage() {
  const [data, setData] = useState<ProjectDashboardData[]>([])
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'safe' | 'overbudget'>('all')
  const [selectedProject, setSelectedProject] = useState<ProjectDashboardData | null>(null)

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
      const res = await fetch('/api/projects?' + buildQuery(p))
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

      const isOver = d.utilizationPct > 100
      
      if (filterType === 'safe' && isOver) return false
      if (filterType === 'overbudget' && !isOver) return false

      return true
    })
  }, [data, search, filterType])

  const insights = useMemo(() => {
    if (data.length === 0) return []
    const overbudgetProjects = data.filter(d => d.utilizationPct > 100)
    const items = []
    if (overbudgetProjects.length > 0) {
      items.push(`${overbudgetProjects.length} project(s) have exceeded their budget allocation.`)
    } else {
      items.push(`All projects are safely within their allocated budgets.`)
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
        <h1 className="text-3xl font-bold tracking-tight">Project Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track project operations, resource utilization, and expense items without exposing financial amounts.
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
            <div className="flex bg-muted/50 p-1 rounded-md border">
              <button
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${filterType === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${filterType === 'safe' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterType('safe')}
              >
                Safe Status
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${filterType === 'overbudget' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterType('overbudget')}
              >
                Overbudget
              </button>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[300px]">Project</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Worker Reports</TableHead>
                  <TableHead className="text-right">Overtime Hrs</TableHead>
                  <TableHead className="text-right">Items Purchased</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No projects found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const isOver = row.utilizationPct > 100
                    const totalItems = row.purchasingItems.length + row.reimburseItems.length + row.mealItems.length
                    return (
                      <TableRow 
                        key={row.prjId} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedProject(row)}
                      >
                        <TableCell>
                          <div className="font-medium truncate">{row.prjName}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{row.prjId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden max-w-[100px]">
                              <div 
                                className={`h-full ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${Math.min(row.utilizationPct, 100)}%` }} 
                              />
                            </div>
                            <span className={`text-xs font-medium ${isOver ? 'text-red-600' : ''}`}>
                              {row.utilizationPct.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isOver ? (
                            <Badge variant="destructive" className="flex w-fit items-center gap-1 text-[10px]">
                              <AlertCircle className="h-3 w-3" />
                              Overbudget
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex w-fit items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" />
                              Safe
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{row.reportCount}</div>
                          <div className="text-[10px] text-muted-foreground">{row.reportHours.toFixed(1)} hrs</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-amber-600">{row.overtimeHours.toFixed(1)}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{totalItems}</div>
                          <div className="text-[10px] text-muted-foreground">expenses</div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Slide-over Detail View */}
      {selectedProject && (
        <>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSelectedProject(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[600px] bg-background border-l shadow-2xl p-6 overflow-y-auto transform transition-transform duration-300 ease-in-out">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{selectedProject.prjName}</h2>
                <p className="text-sm text-muted-foreground mt-1 tracking-widest">{selectedProject.prjId}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-8">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Budget Utilization</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${selectedProject.utilizationPct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(selectedProject.utilizationPct, 100)}%` }} 
                      />
                    </div>
                    <span className={`font-bold ${selectedProject.utilizationPct > 100 ? 'text-red-500' : ''}`}>
                      {selectedProject.utilizationPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Workforce Summary</h3>
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">{selectedProject.reportCount}</span> reports, <span className="font-bold">{selectedProject.reportHours.toFixed(1)}</span> total hrs
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="text-amber-600 font-medium">{selectedProject.overtimeHours.toFixed(1)}</span> overtime hours
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchasing POs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-lg border-b pb-1 flex-1">Purchasing Details ({selectedProject.purchasingItems.length})</h3>
                </div>
                {selectedProject.purchasingItems.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProject.purchasingItems.map((item, idx) => (
                      <div key={idx} className="bg-card border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold">{item.poNumber}</span>
                          <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
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
                  <h3 className="font-semibold text-lg border-b pb-1 flex-1">Reimburse Requests ({selectedProject.reimburseItems.length})</h3>
                </div>
                {selectedProject.reimburseItems.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProject.reimburseItems.map((item, idx) => (
                      <div key={idx} className="bg-card border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold">{item.requestor}</span>
                          <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
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
                  <h3 className="font-semibold text-lg border-b pb-1 flex-1">Meal Requests ({selectedProject.mealItems.length})</h3>
                </div>
                {selectedProject.mealItems.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProject.mealItems.map((item, idx) => (
                      <div key={idx} className="bg-card border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="font-semibold">{item.requestor}</div>
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
