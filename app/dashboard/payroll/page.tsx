'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Banknote } from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { ThemeToggle, SalesPageShell } from '@/components/theme-toggle'
import { useChartFilter } from '@/hooks/use-chart-filter'
import { DashboardSkeleton, PageError } from '@/components/page-states'
import { PageHeader } from '@/components/page-header'
import { DateRangeRow } from '@/components/date-range-row'
import { buildQuery, getYTD } from '@/lib/sales-helpers'
import { useAuth } from '@/lib/auth-context'

import { type FA } from '../finance-ap/components/shared'
import { PayrollTab } from '../finance-ap/components/payroll-tab'

export default function PayrollPage() {
  const { user } = useAuth()
  // Only the payroll slice is fetched (?tab=payroll) — small & server-cacheable.
  const [data, setData] = useState<Pick<FA, 'payroll'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { chartFilter, setChartFilter, handleChartClick } = useChartFilter('payroll-section')

  const [dateFrom, setDateFrom] = useState(getYTD().from)
  const [dateTo, setDateTo] = useState(getYTD().to)
  const [lFrom, setLFrom] = useState(dateFrom)
  const [lTo, setLTo] = useState(dateTo)

  const doFetch = useCallback(async (p: Record<string, string>) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/finance-ap?' + buildQuery({ ...p, tab: 'payroll' }))
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') } finally { setLoading(false) }
  }, [])

  const firstLoad = useRef(true)
  useEffect(() => {
    const fresh = firstLoad.current; firstLoad.current = false
    doFetch({
      dateFrom,
      dateTo,
      ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
      ...(fresh ? { fresh: '1' } : {})
    })
  }, [doFetch, dateFrom, dateTo, chartFilter])

  const onApply = () => { dateFrom !== lFrom || dateTo !== lTo ? (setDateFrom(lFrom), setDateTo(lTo)) : null }
  const onClear = () => { const d = getYTD(); setLFrom(d.from); setLTo(d.to); setDateFrom(d.from); setDateTo(d.to); setChartFilter(null) }
  const hasUnapplied = lFrom !== dateFrom || lTo !== dateTo

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <PageError error={error} onRetry={onClear} />
  if (!data) return null

  // Ensure user has access
  if (!user || !(user.roles as any)?.['payroll']) {
    return <div className="flex items-center justify-center min-h-[80vh]"><p className="text-muted-foreground">You do not have access to Payroll & Salaries.</p></div>
  }

  return (
    <SalesPageShell>
      <div className="bg-background text-foreground min-h-screen space-y-6">
        <PageHeader
          title="Payroll & Salaries"
          subtitle="PT. Multi Daya Mitra — Employee Compensations"
          breadcrumbs={[{ label: 'Payroll' }, { label: 'Payroll & Salaries' }]}
          chartFilter={chartFilter}
          onClearFilter={() => setChartFilter(null)}
          actions={
            <>
              <ExportButton data={data?.payroll?.rows || []} filename="payroll.csv" />
              <ThemeToggle />
            </>
          }
        />

        <Card><CardContent className="pt-5">
          <DateRangeRow from={lFrom} to={lTo} onChange={(f, t) => { setLFrom(f); setLTo(t) }} />
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={onClear} className="w-[120px]">Reset Filter</Button>
            <Button onClick={onApply} disabled={!hasUnapplied} className="w-[120px]">Apply</Button>
          </div>
        </CardContent></Card>

        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden min-h-[500px] p-6">
          <PayrollTab d={data.payroll} handleChartClick={handleChartClick} hideCharts={true} baseParams={{
            dateFrom, dateTo,
            ...(chartFilter ? { cType: chartFilter.type, cVal: chartFilter.value } : {}),
          }} />
        </div>
      </div>
    </SalesPageShell>
  )
}
