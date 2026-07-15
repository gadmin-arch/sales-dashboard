'use client'

import { useState, useEffect } from 'react'
import { KPICard } from '@/components/kpi-card'
import { DonutChart } from '@/components/donut-chart'
import { Clock, Timer, AlertTriangle, FileText, DollarSign, Gauge, CalendarClock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { buildQuery } from '@/lib/sales-helpers'
import {
  type FA,
  type FilterSpec,
  BarCard,
  ChartCard,
  ServerDataTable,
  FilterBar,
  EMPTY_ROWS,
  badge,
  timelinessTone,
  rp,
  rpC,
  days,
  fmtDate,
} from './shared'

const PO_FILTERS: FilterSpec[] = [
  { field: 'statusLabel', label: 'Status' },
  { field: 'timeliness', label: 'Timeliness' },
  { field: 'createdBy', label: 'Requester' },
  { field: 'tempoType', label: 'Payment Type' },
]

export function PoPaymentsTab({ d, handleChartClick, baseParams }: {
  d: FA['poPayments']
  handleChartClick: (type: string, value: string, label: string) => void
  baseParams: Record<string, string>
}) {
  // Dropdown filters are server params now: the tab payload carries only the
  // first page of rows, so the KPI/chart aggregates over filtered rows are
  // computed server-side. Table search only filters the table (view=rows).
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const active = PO_FILTERS.some((s) => (sel[s.field]?.length ?? 0) > 0)
  const [agg, setAgg] = useState<FA['poPayments'] | null>(null)

  const filterParams = {
    fStatus: sel.statusLabel ?? [],
    fTimeliness: sel.timeliness ?? [],
    fRequester: sel.createdBy ?? [],
    fTempo: sel.tempoType ?? [],
  }
  const filterSig = JSON.stringify(filterParams)
  const baseSig = buildQuery(baseParams)

  useEffect(() => {
    if (!active) { setAgg(null); return }
    let dead = false
    fetch('/api/finance-ap?' + buildQuery({ ...Object.fromEntries(new URLSearchParams(baseSig)), tab: 'poPayments', ...JSON.parse(filterSig) }))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((json) => { if (!dead) setAgg(json.poPayments) })
      .catch(() => {})
    return () => { dead = true }
  }, [active, filterSig, baseSig, d])

  const a = agg ?? d
  const { k, aging, byStatus, monthlyOutflow, timelinessBreakdown, trendReqToApproval, trendReqToPaid, trendApprovalToPaid, trendReqToDue, trendOverdue, trendDueToPaid } = a

  return (
    <div className="space-y-6">
      <FilterBar specs={PO_FILTERS} sel={sel} setSel={setSel} options={d.filterOptions} active={active} onClear={() => setSel({})} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard title="Outstanding AP" value={rpC(k.totalOutstanding)} icon={<FileText className="h-4 w-4" />} trend={{ value: `${k.pctOverdue}%`, label: 'overdue', positive: k.pctOverdue < 10 }} tooltip="Total outstanding payment requests from vendors: SUM(payreq_amount - payreq_pay_amount) for active requests. Trend displays the percentage of overdue." />
        <KPICard title="Overdue" value={rpC(k.overdue)} icon={<AlertTriangle className="h-4 w-4" />} tooltip="Total outstanding payment requests that have passed their due date." />
        <KPICard title="Total Paid" value={rpC(k.totalPaid)} icon={<DollarSign className="h-4 w-4" />} tooltip="Total cash outflow paid to vendors: SUM(payments.p_amount) period-to-date." />
        <KPICard title="On-Time Rate" value={`${k.onTimeRate}%`} icon={<Gauge className="h-4 w-4" />} trend={{ value: `${k.tempoCount}`, label: 'tempo requests', positive: k.onTimeRate >= 75 }} tooltip="Percentage of payments completed on time or early: OnTime / (OnTime + Overdue Late)." />
        <KPICard title="Requests" value={k.totalRequests.toLocaleString('en-US')} icon={<Clock className="h-4 w-4" />} trend={{ value: k.openCount, label: `open · ${k.pendingApproval} pending`, positive: false }} tooltip="Count of filtered vendor payment requests." />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard title="Req → Approval" value={days(k.avgReqToApproval)} icon={<Timer className="h-4 w-4" />} trend={{ value: `${k.leadToApprovalCount}`, label: 'requests approved', positive: true }} tooltip="Average days from creation (created_at) to approval (status log 'AN')." />
        <KPICard title="Approval → Paid" value={days(k.avgApprovalToPaid)} icon={<Timer className="h-4 w-4" />} trend={{ value: 'approved→paid', label: 'fulfillment time', positive: true }} tooltip="Average days from approval (AN) to first payment log." />
        <KPICard title="Req → Paid" value={days(k.avgReqToPaid)} icon={<Timer className="h-4 w-4" />} trend={{ value: `${k.leadToPaidCount}`, label: 'requests paid', positive: true }} tooltip="Average days from creation (created_at) to first payment log." />
        <KPICard title="Req → Due (Term)" value={days(k.avgReqToDue)} icon={<CalendarClock className="h-4 w-4" />} trend={{ value: 'created→due', label: 'requested term', positive: true }} tooltip="Average requested term (days from created_at to duedate)." />
        <KPICard title="Avg Overdue" value={days(k.avgOverdue)} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: 'days late', label: 'average delay', positive: false }} tooltip="Average days delayed for overdue transactions." />
      </div>
      {k.largestExposure > 0 && <Card><CardContent className="pt-4 flex items-center gap-3 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-muted-foreground">Largest single exposure:</span><span className="font-semibold">{rp(k.largestExposure)}</span><span className="text-muted-foreground">— {k.largestExposurePo}</span></CardContent></Card>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="AP Aging" data={aging} bars={[{ key: 'value', color: 'var(--chart-3)', label: 'Outstanding' }]}
          onBarClick={(name) => handleChartClick('aging', name, `Aging = ${name}`)}
          tooltip="Outstanding liabilities grouped by delay duration from the due date (aging bucket)." />
        <BarCard title="Monthly Cash Outflow" data={monthlyOutflow} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Paid' }]}
          onBarClick={(monthStr) => handleChartClick('poMonth', monthStr, `Month = ${monthStr}`)}
          tooltip="Monthly trend of actual cash transfers to vendors/suppliers." />
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 px-1">
          <Timer className="h-4 w-4 text-muted-foreground" /> Processing Time Distributions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BarCard title="Req → Approval Dist" subtitle={`Avg: ${k.avgReqToApproval} days`} data={trendReqToApproval} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Requests' }]}
            height={200} valueFormatter={(v) => `${v}`} yAxisWidth={40}
            tooltip="Distribution of requests by duration from notification (notify date) to approval (AN)." />
          <BarCard title="Approval → Paid Dist" subtitle={`Avg: ${k.avgApprovalToPaid} days`} data={trendApprovalToPaid} bars={[{ key: 'value', color: 'var(--chart-3)', label: 'Requests' }]}
            height={200} valueFormatter={(v) => `${v}`} yAxisWidth={40}
            tooltip="Distribution of requests by duration from approval (AN) to first payment." />
          <BarCard title="Req → Paid Dist" subtitle={`Avg: ${k.avgReqToPaid} days`} data={trendReqToPaid} bars={[{ key: 'value', color: 'var(--chart-2)', label: 'Requests' }]}
            height={200} valueFormatter={(v) => `${v}`} yAxisWidth={40}
            tooltip="Distribution of requests by duration from notification (notify date) to first payment." />
          <BarCard title="Req → Due (Term) Dist" subtitle={`Avg: ${k.avgReqToDue} days`} data={trendReqToDue} bars={[{ key: 'value', color: 'var(--chart-4)', label: 'Requests' }]}
            height={200} valueFormatter={(v) => `${v}`} yAxisWidth={40}
            tooltip="Distribution of requests by the requested payment term (notify date to due date)." />
          <BarCard title="Due → Paid Dist" subtitle={`Avg: ${k.avgDueToPaid} days`} data={trendDueToPaid} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Requests' }]}
            height={200} valueFormatter={(v) => `${v}`} yAxisWidth={40}
            tooltip="Distribution of requests by payment delay duration since the due date." />
          <BarCard title="Avg Overdue Dist" subtitle={`Avg: ${k.avgOverdue} days`} data={trendOverdue} bars={[{ key: 'value', color: 'var(--chart-5)', label: 'Requests' }]}
            height={200} valueFormatter={(v) => `${v}`} yAxisWidth={40}
            tooltip="Distribution of requests by delay duration for overdue transactions." />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Payment Timeliness" subtitle="Click a slice to filter" tooltip="Analysis of vendor payment timeliness (Paid On-Time, Paid Late, Overdue Open, Unpaid On-Time, etc.)." align="right">
          <DonutChart data={timelinessBreakdown} height={260} onSliceClick={(name) => handleChartClick('timeliness', name, `Timeliness = ${name}`)} />
        </ChartCard>
        <ChartCard title="Outstanding by Status" tooltip="Outstanding vendor liabilities grouped by their current request status." align="right">
          <DonutChart data={byStatus} height={260} onSliceClick={(name) => handleChartClick('status', name, `Status = ${name}`)} />
        </ChartCard>
      </div>
      <ServerDataTable title="All Payment Requests" subtitle="Every request — paid & outstanding. Lead times in days; tempo = deferred-term payment."
        endpoint="/api/finance-ap"
        baseParams={{ ...baseParams, tab: 'poPayments', ...filterParams }}
        initialRows={a.rows ?? EMPTY_ROWS} totalRows={a.totalRows ?? 0} initialSortKey="createdAt"
        cols={[
          { key: 'payreqId', label: 'Request', render: (r) => <span className="text-xs font-semibold text-primary whitespace-nowrap">{r.payreqId}{r.isTempo && <span className="ml-1 rounded bg-violet-500/10 px-1 text-[9px] text-violet-600 dark:text-violet-400">TEMPO</span>}</span> },
          { key: 'poId', label: 'PO', render: (r) => <span className="text-xs text-muted-foreground">{r.poId}</span> },
          { key: 'createdBy', label: 'Requester', render: (r) => <span className="text-xs text-foreground font-medium whitespace-nowrap">{r.createdBy}</span> },
          { key: 'requestDate', label: 'Req Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap text-xs">{fmtDate(r.requestDate)}</span> },
          { key: 'dueDate', label: 'Due Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap text-xs">{fmtDate(r.dueDate)}</span> },
          { key: 'paymentDate', label: 'Paid Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap text-xs">{r.paymentDate ? fmtDate(r.paymentDate) : <span className="text-muted-foreground/40">—</span>}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => rp(r.amount) },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'hoursToPaid', label: 'Lead→Paid', align: 'right', render: (r) => r.hoursToPaid != null ? days(r.hoursToPaid / 24) : <span className="text-muted-foreground">—</span> },
          { key: 'timeliness', label: 'Timeliness', render: (r) => badge(r.timeliness, timelinessTone(r.timeliness)) },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Paid' ? 'green' : r.statusLabel === 'Cancel' ? 'red' : 'sky') },
        ]} />
    </div>
  )
}
