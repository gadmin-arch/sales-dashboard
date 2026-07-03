'use client'

import { KPICard } from '@/components/kpi-card'
import { DonutChart } from '@/components/donut-chart'
import { TrendingDown, AlertTriangle, Banknote, Wallet } from 'lucide-react'
import {
  type FA,
  BarCard,
  CHART,
  ChartCard,
  DataTable,
  rp,
  rpC,
} from './shared'

const STREAM_TO_TAB: Record<string, string> = {
  'PO Payments': 'poPayments',
  'Payroll': 'payroll',
  'Reimburse': 'reimburse',
  'Loans': 'loans',
  'Meal': 'meal',
}

export function OverviewTab({ d, setTab }: { d: FA['overview']; setTab: (t: any) => void }) {
  const k = d.kpis
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Total Cash Outflow" value={rpC(k.totalOutflow)} icon={<TrendingDown className="h-4 w-4" />} tooltip="Total realized cash outflow across all streams (PO Payments + Payroll + Petty Cash Out + Loans + Meal Benefit) period-to-date." />
        <KPICard title="Total Outstanding" value={rpC(k.totalOutstanding)} icon={<AlertTriangle className="h-4 w-4" />} tooltip="Total outstanding liabilities/debts due (AP Outstanding + Loans Outstanding + Payroll Unpaid)." />
        <KPICard title="Payroll Disbursed" value={rpC(k.payrollDisbursed)} icon={<Banknote className="h-4 w-4" />} tooltip="Total realized employee salary disbursements transferred from corporate accounts." />
        <KPICard title="Petty Cash Balance" value={rpC(k.pettyCashBalance)} icon={<Wallet className="h-4 w-4" />} trend={{ value: k.pendingAp, label: 'AP pending', positive: k.pettyCashBalance >= 0 }} tooltip="Current petty cash balance: Total Refill (Cash In) minus Total Claims (Cash Out)." />
      </div>
      <BarCard title="Monthly Cash Outflow by Stream" subtitle="Stacked — PO Payments · Payroll · Reimburse · Loans · Meal" data={d.monthly} stacked height={300}
        tooltip="Monthly trend of cumulative cash outflow split by fund allocation stream."
        bars={[
          { key: 'PO Payments', color: CHART[0] }, { key: 'Payroll', color: CHART[1] }, { key: 'Reimburse', color: CHART[2] },
          { key: 'Loans', color: CHART[3] }, { key: 'Meal', color: CHART[4] },
        ]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Outflow Composition by Stream" subtitle={`Total ${rp(k.totalOutflow)} period-to-date`} tooltip="Percentage contribution of each stream to total cash outflow for the current period.">
          <DonutChart data={d.composition.map((c) => ({ name: c.stream, value: c.outflow }))} height={280} onSliceClick={(name) => {
            const tabKey = STREAM_TO_TAB[name]
            if (tabKey) setTab(tabKey)
          }} />
        </ChartCard>
        <BarCard title="Outstanding Exposure by Stream" data={d.outstandingByStream} bars={[{ key: 'value', color: 'var(--chart-3)', label: 'Outstanding' }]} vertical height={280}
          onBarClick={(name) => {
            const tabKey = STREAM_TO_TAB[name]
            if (tabKey) setTab(tabKey)
          }}
          tooltip="Distribution of outstanding liabilities/unpaid debt balance across streams." />
      </div>
      <DataTable title="Streams Summary" rows={d.composition.map((c) => ({ ...c, id: c.stream }))} searchKeys={['stream']} initialSort="outflow"
        cols={[
          { key: 'stream', label: 'Stream', render: (r) => <span className="font-medium">{r.stream}</span> },
          { key: 'outflow', label: 'Cash Outflow', align: 'right', render: (r) => <span className="font-medium">{rp(r.outflow)}</span> },
          { key: 'pctOutflow', label: '% of Total', align: 'right', render: (r) => `${r.pctOutflow}%` },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'records', label: 'Records', align: 'right', render: (r) => r.records.toLocaleString('en-US') },
        ]} />
    </div>
  )
}
