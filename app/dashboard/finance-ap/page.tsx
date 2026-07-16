'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, Layers, FileText, Banknote, Utensils, Landmark, Receipt,
} from 'lucide-react'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { DateRangeRow } from '@/components/date-range-row'
import { ExportButton } from '@/components/export-button'
import { buildQuery, getYTD } from '@/lib/sales-helpers'
import { useAuth } from '@/lib/auth-context'

import { type FA } from './components/shared'
import { OverviewTab } from './components/overview-tab'
import { PoPaymentsTab } from './components/po-payments-tab'
import { PayrollTab } from './components/payroll-tab'
import { MealTab } from './components/meal-tab'
import { LoansTab } from './components/loans-tab'
import { ReimburseTab } from './components/reimburse-tab'

const TABS = [
  { key: 'overview', label: 'Overview', icon: <Layers className="h-4 w-4" />, role: null },
  { key: 'poPayments', label: 'PO Payments', icon: <FileText className="h-4 w-4" />, role: null },
  { key: 'payroll', label: 'Payroll', icon: <Banknote className="h-4 w-4" />, role: 'payroll' },
  { key: 'meal', label: 'Meal Benefits', icon: <Utensils className="h-4 w-4" />, role: null },
  { key: 'loans', label: 'Loans', icon: <Landmark className="h-4 w-4" />, role: null },
  { key: 'reimburse', label: 'Reimburse', icon: <Receipt className="h-4 w-4" />, role: null },
] as const

type TabKey = typeof TABS[number]['key']

export default function FinanceAPPage() {
  const { user } = useAuth()
  // Tab slices load lazily (?tab=…): each response is small enough for the
  // server data cache, and tabs the user never opens are never computed.
  const [slices, setSlices] = useState<Partial<FA>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')

  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('finance-tables-section')

  const [dateFrom, setDateFrom] = useState(getYTD().from)
  const [dateTo, setDateTo] = useState(getYTD().to)
  const [lFrom, setLFrom] = useState(dateFrom)
  const [lTo, setLTo] = useState(dateTo)

  const tabs = useMemo(() => TABS.filter((t) => !t.role || (user?.roles as any)?.[t.role]), [user])
  useEffect(() => { if (!tabs.some((t) => t.key === tab)) setTab('overview') }, [tabs, tab])

  const doFetchTab = useCallback(async (tabKey: TabKey, p: Record<string, string>, reset: boolean): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/finance-ap?' + buildQuery({ ...p, tab: tabKey }))
      if (!res.ok) throw new Error('Failed to load data')
      const json = await res.json()
      setSlices((prev) => (reset ? json : { ...prev, ...json }))
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
      return false
    } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  const paramsSigRef = useRef('')
  const loadedTabsRef = useRef<Set<TabKey>>(new Set())
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    const sig = JSON.stringify([dateFrom, dateTo, chartFilter?.type ?? '', chartFilter?.value ?? ''])
    // Filter change invalidates every previously loaded tab, not just the active one.
    const reset = sig !== paramsSigRef.current
    if (reset) { paramsSigRef.current = sig; loadedTabsRef.current = new Set() }
    if (!reset && loadedTabsRef.current.has(tab)) return
    loadedTabsRef.current.add(tab)
    doFetchTab(tab, {
      dateFrom,
      dateTo,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {}),
    }, reset).then((ok) => { if (!ok) loadedTabsRef.current.delete(tab) })
  }, [doFetchTab, dateFrom, dateTo, chartFilter, tab])

  const onApply = () => { dateFrom !== lFrom || dateTo !== lTo ? (setDateFrom(lFrom), setDateTo(lTo)) : null }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setDateFrom(d.from); setDateTo(d.to); setChartFilter(null) }
  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo

  const anyLoaded = Object.keys(slices).length > 0
  const active = slices[tab]

  // Dataset params shared with the row-sliced tabs (their filter/rows/detail
  // fetches must hit the same cached dataset as the tab fetch above).
  const baseParams: Record<string, string> = {
    dateFrom, dateTo,
    ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
  }

  if (loading && !anyLoaded) return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  if (error && !anyLoaded) return <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4"><p className="text-destructive">{error}</p><Button onClick={onClear}>Retry</Button></div>
  if (!anyLoaded) return null

  const tabBody = () => {
    if (!active) {
      if (error) {
        return (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => {
              doFetchTab(tab, {
                dateFrom, dateTo,
                ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
              }, false).then((ok) => { if (ok) loadedTabsRef.current.add(tab) })
            }}>Retry</Button>
          </div>
        )
      }
      return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
    }
    switch (tab) {
      case 'overview': return <OverviewTab d={slices.overview!} setTab={setTab} />
      case 'poPayments': return <PoPaymentsTab d={slices.poPayments!} handleChartClick={handleChartClick} baseParams={baseParams} />
      case 'payroll': return <PayrollTab d={slices.payroll!} handleChartClick={handleChartClick} hideTable={true} baseParams={baseParams} />
      case 'meal': return <MealTab d={slices.meal!} handleChartClick={handleChartClick} />
      case 'loans': return <LoansTab d={slices.loans!} handleChartClick={handleChartClick} />
      case 'reimburse': return <ReimburseTab d={slices.reimburse!} handleChartClick={handleChartClick} baseParams={baseParams} />
    }
  }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Finance — Accounts Payable</h1>
              <p className="text-sm text-muted-foreground">PT. Multi Daya Mitra — Reimburse · PO Payments · Payroll · Meal Benefits · Loans</p>
            </div>
            {chartFilter && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20">
                <span className="text-muted-foreground">Filtered by:</span> {chartFilter.label}
                <button onClick={() => setChartFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5"><div className="h-4 w-4 flex items-center justify-center">✕</div></button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton data={(slices[tab] as any)?.rows || []} filename={`finance-ap-${tab}.csv`} />
            <ThemeToggle />
          </div>
        </div>

        <Card><CardContent className="pt-5">
          <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
            <Button size="sm" onClick={onApply} className="relative">Apply{hasUnapplied && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />}</Button>
          </div>
          {loading && anyLoaded && <div className="w-full h-1 bg-border overflow-hidden rounded-full mt-3"><div className="h-1/3 bg-primary rounded-full loading-bar-inner" /></div>}
        </CardContent></Card>

        <div id="finance-tables-section" className="flex flex-wrap gap-1.5 border-b border-border">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tabBody()}
      </div>
    </SalesPageShell>
  )
}
