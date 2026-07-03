'use client'

import { useState, useMemo } from 'react'
import { KPICard } from '@/components/kpi-card'
import { DonutChart } from '@/components/donut-chart'
import { X, Clock, Timer, AlertTriangle, FileText, DollarSign, Gauge, CalendarClock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  type FA,
  type FilterSpec,
  BarCard,
  ChartCard,
  DataTable,
  FilterBar,
  useRowFilters,
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

export function PoPaymentsTab({ d, handleChartClick }: { d: FA['poPayments']; handleChartClick: (type: string, value: string, label: string) => void }) {
  const [search, setSearch] = useState('')
  const f = useRowFilters(d.rows, PO_FILTERS)

  const { k, aging, byStatus, monthlyOutflow, timelinessBreakdown, trendReqToApproval, trendReqToPaid, trendApprovalToPaid, trendReqToDue, trendOverdue, trendDueToPaid } = useMemo(() => {
    let rs = d.rows
    if (f.predicate) rs = rs.filter(f.predicate)
    if (search) {
      const q = search.toLowerCase()
      const searchKeys = ['payreqId', 'poId', 'invoiceNumber', 'statusLabel', 'timeliness', 'createdBy', 'tempoType']
      rs = rs.filter((r: any) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
    }

    const totalOutstanding = rs.reduce((acc, r) => acc + (r.outstanding || 0), 0)
    const overdue = rs.reduce((acc, r) => acc + (r.daysOverdue >= 1 ? (r.outstanding || 0) : 0), 0)
    const pctOverdue = totalOutstanding > 0 ? Math.round((overdue / totalOutstanding) * 100) : 0
    const openCount = rs.filter(r => r.outstanding > 0).length
    const pendingApproval = rs.filter(r => r.statusLabel === 'Approval Needed').length
    const totalPaid = rs.reduce((acc, r) => acc + (r.paid || 0), 0)
    const totalRequests = rs.length

    const poOutstandingAgg: Record<string, number> = {}
    for (const r of rs) {
      if (r.poId && r.poId !== '-') {
        poOutstandingAgg[r.poId] = (poOutstandingAgg[r.poId] || 0) + (r.outstanding || 0)
      }
    }
    let largestExposure = 0
    let largestExposurePo = '-'
    for (const poId in poOutstandingAgg) {
      if (poOutstandingAgg[poId] > largestExposure) {
        largestExposure = poOutstandingAgg[poId]
        largestExposurePo = poId
      }
    }

    const leadAN = rs.map(r => r.leadToAN).filter(v => v != null) as number[]
    const leadPaid = rs.map(r => r.leadToPaid).filter(v => v != null) as number[]
    const approvalToPaidList = rs.map(r => r.approvalToPaid).filter(v => v != null) as number[]
    const durations = rs.map(r => r.requestDuration).filter(v => v != null) as number[]
    const overdueDaysList = rs.map(r => r.daysOverdue).filter(v => v > 0) as number[]

    const avgReqToApproval = leadAN.length ? Math.round((leadAN.reduce((a, b) => a + b, 0) / leadAN.length) * 10) / 10 : 0
    const avgReqToPaid = leadPaid.length ? Math.round((leadPaid.reduce((a, b) => a + b, 0) / leadPaid.length) * 10) / 10 : 0
    const avgApprovalToPaid = approvalToPaidList.length ? Math.round((approvalToPaidList.reduce((a, b) => a + b, 0) / approvalToPaidList.length) * 10) / 10 : 0
    const avgReqToDue = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0
    const avgOverdue = overdueDaysList.length ? Math.round((overdueDaysList.reduce((a, b) => a + b, 0) / overdueDaysList.length) * 10) / 10 : 0

    const timelinessAgg: Record<string, number> = {}
    for (const r of rs) {
      timelinessAgg[r.timeliness] = (timelinessAgg[r.timeliness] || 0) + 1
    }
    const onTime = timelinessAgg['On Time'] || 0
    const latePaid = timelinessAgg['Overdue (late)'] || 0
    const onTimeRate = (onTime + latePaid) > 0 ? Math.round((onTime / (onTime + latePaid)) * 100) : 0
    const tempoCount = rs.filter(r => r.isTempo).length

    const dueToPaidList = rs.map(r => r.dueToPaidHours).filter(v => v != null) as number[]
    const avgDueToPaid = dueToPaidList.length ? Math.round((dueToPaidList.reduce((a, b) => a + b, 0) / dueToPaidList.length / 24) * 10) / 10 : 0

    const k = {
      totalOutstanding,
      overdue,
      pctOverdue,
      openCount,
      pendingApproval,
      totalPaid,
      totalRequests,
      largestExposure,
      largestExposurePo,
      avgReqToApproval,
      leadToApprovalCount: leadAN.length,
      avgReqToPaid,
      leadToPaidCount: leadPaid.length,
      avgApprovalToPaid,
      avgReqToDue,
      avgOverdue,
      avgDueToPaid,
      onTimeRate,
      tempoCount,
    }

    const AGING_BUCKETS = [
      { name: '0 days', min: 0, max: 0 },
      { name: '1-7 days', min: 1, max: 7 },
      { name: '8-30 days', min: 8, max: 30 },
      { name: '30+ days', min: 31, max: 999999 },
    ]
    const aging = AGING_BUCKETS.map((b) => ({ name: b.name, value: 0, count: 0 }))
    for (const r of rs) {
      if (r.outstanding <= 0) continue
      const days = r.daysOverdue || 0
      const idx = AGING_BUCKETS.findIndex((b) => days >= b.min && days <= b.max)
      if (idx >= 0) {
        aging[idx].value = Math.round((aging[idx].value + r.outstanding) * 100) / 100
        aging[idx].count++
      }
    }

    const statusAgg: Record<string, number> = {}
    for (const r of rs) {
      if (r.outstanding > 0) {
        statusAgg[r.statusLabel] = (statusAgg[r.statusLabel] || 0) + r.outstanding
      }
    }
    const byStatus = Object.entries(statusAgg).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))

    const filteredPayreqIds = new Set(rs.map(r => r.payreqId))
    const matchingPayments = (d.payments || []).filter((p: any) => filteredPayreqIds.has(p.payreqId))
    
    const outflowAgg: Record<string, number> = {}
    for (const p of matchingPayments) {
      const parts = p.date ? p.date.split(' ')[0].split('/') : []
      if (parts.length >= 3) {
        const monthYear = `${parts[2]}-${parts[0].padStart(2, '0')}` // YYYY-MM
        outflowAgg[monthYear] = (outflowAgg[monthYear] || 0) + (p.amount || 0)
      }
    }
    const monthlyOutflow = Object.entries(outflowAgg)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([my, value]) => {
        const date = new Date(`${my}-02`)
        const name = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        return { name, value: Math.round(value) }
      })

    const TIMELINESS_ORDER = ['On Time', 'On Track', 'Overdue (ongoing)', 'Overdue (late)', 'Completed', 'No Due Date']
    const timelinessBreakdown = TIMELINESS_ORDER
      .filter((key) => timelinessAgg[key])
      .map((key) => ({ name: key, value: timelinessAgg[key] }))

    const DURATION_BUCKETS = ['< 2 Hours', '2 - 12 Hours', '12 - 24 Hours', '1 - 3 Days', '> 3 Days']
    const getBucketed = (hoursList: number[]) => {
      const counts: Record<string, number> = {
        '< 2 Hours': 0,
        '2 - 12 Hours': 0,
        '12 - 24 Hours': 0,
        '1 - 3 Days': 0,
        '> 3 Days': 0,
      }
      for (const h of hoursList) {
        if (h < 2) counts['< 2 Hours']++
        else if (h < 12) counts['2 - 12 Hours']++
        else if (h < 24) counts['12 - 24 Hours']++
        else if (h < 72) counts['1 - 3 Days']++
        else counts['> 3 Days']++
      }
      return DURATION_BUCKETS.map((name) => ({ name, value: counts[name] }))
    }

    const getDueToPaidBucketed = (hoursList: number[]) => {
      const counts: Record<string, number> = {
        'On Time / Early': 0,
        '0 - 2 Days': 0,
        '2 - 7 Days': 0,
        '7 - 30 Days': 0,
        '> 30 Days': 0,
      }
      for (const h of hoursList) {
        if (h <= 0) {
          counts['On Time / Early']++
        } else {
          const dayVal = h / 24
          if (dayVal <= 2) counts['0 - 2 Days']++
          else if (dayVal <= 7) counts['2 - 7 Days']++
          else if (dayVal <= 30) counts['7 - 30 Days']++
          else counts['> 30 Days']++
        }
      }
      const BUCKETS = ['On Time / Early', '0 - 2 Days', '2 - 7 Days', '7 - 30 Days', '> 30 Days']
      return BUCKETS.map((name) => ({ name, value: counts[name] }))
    }

    const trendReqToApproval = getBucketed(rs.map(r => r.hoursToApproval).filter(v => v != null) as number[])
    const trendReqToPaid = getBucketed(rs.map(r => r.hoursToPaid).filter(v => v != null) as number[])
    const trendApprovalToPaid = getBucketed(rs.map(r => r.hoursApprovalToPaid).filter(v => v != null) as number[])
    const trendReqToDue = getBucketed(rs.map(r => r.hoursToDue).filter(v => v != null) as number[])
    const trendOverdue = getBucketed(rs.map(r => r.hoursOverdue).filter(v => v != null) as number[])
    const trendDueToPaid = getDueToPaidBucketed(rs.map(r => r.dueToPaidHours).filter(v => v != null) as number[])

    return {
      k,
      aging,
      byStatus,
      monthlyOutflow,
      timelinessBreakdown,
      trendReqToApproval,
      trendReqToPaid,
      trendApprovalToPaid,
      trendReqToDue,
      trendOverdue,
      trendDueToPaid,
    }
  }, [d.rows, d.payments, f.predicate, search])

  return (
    <div className="space-y-6">
      <FilterBar specs={PO_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
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
      <DataTable title="All Payment Requests" subtitle="Every request — paid & outstanding. Lead times in days; tempo = deferred-term payment." rows={d.rows} prefilter={f.predicate}
        search={search} onSearchChange={setSearch}
        searchKeys={['payreqId', 'poId', 'invoiceNumber', 'statusLabel', 'timeliness', 'createdBy', 'tempoType']} initialSort="createdAt"
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
