'use client'

import { useState, useMemo } from 'react'
import { KPICard } from '@/components/kpi-card'
import { DonutChart } from '@/components/donut-chart'
import { X, Receipt, Banknote, DollarSign, AlertTriangle, Wallet, Landmark, Users, CalendarClock, Timer } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildQuery } from '@/lib/sales-helpers'
import {
  type FA,
  type FilterSpec,
  BarCard,
  ChartCard,
  DataTable,
  FilterBar,
  useRowFilters,
  badge,
  rp,
  rpC,
  fmtDate,
  CHART,
} from './shared'

const PAYROLL_FILTERS: FilterSpec[] = [
  { field: 'statusLabel', label: 'Status' },
  { field: 'payStatus', label: 'Payment' },
  { field: 'periodType', label: 'Cycle' },
  { field: 'employee', label: 'Employee' },
]

// Merge per-slip detail arrays into one payslip view (used for the yearly
// grouping) — same key rules the yearly table grouping used before the detail
// arrays moved out of the list payload.
function mergeSlipDetails(slips: any[]) {
  const earnings = new Map<string, any>()
  const reductions = new Map<string, any>()
  const reimburse = new Map<string, any>()
  const loans = new Map<string, any>()
  const travel = new Map<string, any>()
  const meal = new Map<string, any>()
  for (const s of slips) {
    for (const e of s.earnings || []) {
      const k = `${e.name}_${e.type}`
      if (!earnings.has(k)) earnings.set(k, { ...e })
      else { const m = earnings.get(k)!; m.receipt += e.receipt; m.thp += e.thp; m.nonThpReceipt += e.nonThpReceipt }
    }
    for (const r of s.reductionsList || []) {
      const k = `${r.name}_${r.type}`
      if (!reductions.has(k)) reductions.set(k, { ...r })
      else { const m = reductions.get(k)!; m.receipt += r.receipt; m.thp += r.thp; m.nonThp += r.nonThp }
    }
    s.reimburseList?.forEach((r: any) => reimburse.set(r.date + r.amount, r))
    s.loansList?.forEach((l: any) => loans.set(l.date + l.amount, l))
    s.travelDetails?.forEach((td: any) => travel.set(`${td.date}-${td.amount}`, td))
    s.mealDetailsList?.forEach((md: any) => meal.set(`${md.date}-${md.type}`, md))
  }
  return {
    itemsList: [],
    earnings: Array.from(earnings.values()),
    reductionsList: Array.from(reductions.values()),
    reimburseList: Array.from(reimburse.values()),
    loansList: Array.from(loans.values()),
    travelDetails: Array.from(travel.values()),
    mealDetailsList: Array.from(meal.values()),
  }
}

const SLIP_META = ['mealRate', 'employeeEmail', 'employeeNik', 'employeeOccupation', 'taxStatus', 'taxCategory'] as const

export function PayrollTab({ d, handleChartClick, hideCharts, hideTable, baseParams }: {
  d: FA['payroll']
  handleChartClick: (type: string, value: string, label: string) => void
  hideCharts?: boolean
  hideTable?: boolean
  baseParams?: Record<string, string>
}) {
  const k = d.kpis
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')

  const groupedRows = useMemo(() => {
    if (viewMode === 'monthly') return d.rows

    const map = new Map<string, any[]>()
    d.rows.forEach(r => {
      const dateStr = r.endDate || ''
      const dObj = new Date(dateStr)
      const year = !isNaN(dObj.getTime()) ? dObj.getFullYear().toString() : 'unknown'
      const key = `${r.userId}_${year}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })

    const result: any[] = []
    map.forEach((slips) => {
      slips.sort((a, b) => (new Date(a.startDate).getTime() || 0) - (new Date(b.startDate).getTime() || 0))
      const first = slips[0]
      const last = slips[slips.length - 1]

      const dateStr = first.endDate || ''
      const dObj = new Date(dateStr)
      const year = !isNaN(dObj.getTime()) ? dObj.getFullYear().toString() : 'unknown'

      let weeklyCount = 0
      let monthlyCount = 0
      for (const s of slips) {
        if (s.periodType === 'Weekly') weeklyCount++
        else if (s.periodType === 'Monthly') monthlyCount++
      }
      const dominantCycle = weeklyCount >= monthlyCount ? 'Weekly' : 'Monthly'

      // Detail arrays + slip meta are no longer in the list payload; the
      // drawer merges them from the on-demand slipUser fetch.
      result.push({
        idPayroll: `GY-${first.userId}-${year}`,
        employee: first.employee,
        userId: first.userId,
        period: `Tahunan: ${year}`,
        periodType: dominantCycle,
        isGroupedYearly: true,
        startDate: first.startDate,
        endDate: last.endDate,
        statusLabel: 'Release',
        payStatus: slips.some(s => s.payStatus === 'Unpaid') ? 'Unpaid' : 'Paid',
        receipts: slips.reduce((acc, s) => acc + s.receipts, 0),
        reductions: slips.reduce((acc, s) => acc + s.reductions, 0),
        takeHomePay: slips.reduce((acc, s) => acc + s.takeHomePay, 0),
        disbursed: slips.reduce((acc, s) => acc + s.disbursed, 0),
        loanThp: slips.reduce((acc, s) => acc + s.loanThp, 0),
        repayThp: slips.reduce((acc, s) => acc + s.repayThp, 0),
        groupedSlips: slips,
      })
    })

    return result.sort((a, b) => b.startDate.localeCompare(a.startDate))
  }, [d.rows, viewMode])

  const f = useRowFilters(groupedRows, PAYROLL_FILTERS)
  const [selectedPayroll, setSelectedPayroll] = useState<any | null>(null)

  // Payslip detail arrays load on demand when the drawer opens (the list
  // payload was 2.77MB with them bundled — over the ~2MB cache-entry limit).
  const openSlip = (r: any) => {
    setSelectedPayroll(r)
    fetch('/api/finance-ap?' + buildQuery({ ...(baseParams ?? {}), tab: 'payroll', slipUser: r.userId }))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        const details: any[] = json.details ?? []
        setSelectedPayroll((prev: any) => {
          if (!prev || prev.idPayroll !== r.idPayroll) return prev
          if (prev.isGroupedYearly) {
            const ids = new Set((prev.groupedSlips ?? []).map((s: any) => s.idPayroll))
            const slips = details.filter((x) => ids.has(x.idPayroll))
            const meta = Object.fromEntries(SLIP_META.map((m) => [m, slips[0]?.[m]]))
            return { ...prev, ...mergeSlipDetails(slips), ...meta }
          }
          const detail = details.find((x) => x.idPayroll === prev.idPayroll)
          return detail ? { ...prev, ...detail } : prev
        })
      })
      .catch(() => {})
  }

  const additions = selectedPayroll ? (selectedPayroll.itemsList || []).filter((item: any) => item.positive) : []
  const reductions = selectedPayroll ? (selectedPayroll.itemsList || []).filter((item: any) => !item.positive) : []

  if (selectedPayroll) {
    if (selectedPayroll.loanThp > 0) {
      additions.push({
        id: 'loan-thp',
        category: 'Loan Disbursed (THP)',
        type: 'Loan (THP)',
        amount: selectedPayroll.loanThp,
        remarks: 'Loan principal disbursement via take-home pay',
      })
    }
    if (selectedPayroll.repayThp > 0) {
      reductions.push({
        id: 'repay-thp',
        category: 'Loan Repayment (THP)',
        type: 'Loan Repayment (THP)',
        amount: selectedPayroll.repayThp,
        remarks: 'Loan repayment installment deduction via take-home pay',
      })
    }
  }

  return (
    <div className="space-y-6">
      <FilterBar specs={PAYROLL_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      
      {!hideCharts && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Total Receipt" value={rpC(k.totalReceipts)} icon={<Receipt className="h-4 w-4" />} tooltip="Total gross earnings from all payslips period-to-date." />
        <KPICard title="Take-Home Pay" value={rpC(k.totalThp)} icon={<Banknote className="h-4 w-4" />} trend={{ value: rpC(k.medianThp), label: 'median/slip', positive: true }} tooltip="Total take-home pay (net salary) received by employees. Trend displays the median value per slip." />
        <KPICard title="Transferred" value={rpC(k.totalDisbursed)} icon={<DollarSign className="h-4 w-4" />} trend={{ value: `${k.disbursementCoverage}%`, label: 'of THP', positive: k.disbursementCoverage >= 99 }} tooltip="Total salary disbursed: SUM(payroll_payments.amount) + Loan (THP) - Repayment (THP). Trend displays the coverage percentage of THP." />
        <KPICard title="Shortfall" value={rpC(k.shortfall)} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: k.unpaidCount, label: 'slips unpaid', positive: false }} tooltip="Total cumulative transfer shortfall compared to net take-home pay." />
        <KPICard title="Total Net Salary" value={rpC(k.totalNet)} icon={<Wallet className="h-4 w-4" />} trend={{ value: `${k.payrollCount} slips`, label: 'payslips processed', positive: true }} tooltip="Total net salary (THP) due for transfer to all employees this period." />
        <KPICard title="Total Disbursed" value={rpC(k.totalDisbursed)} icon={<Banknote className="h-4 w-4" />} trend={{ value: `${k.disbursedRate}%`, label: 'payout progress', positive: k.disbursedRate >= 90 }} tooltip="Total salary funds successfully disbursed from corporate accounts to employees." />
        <KPICard title="Total Unpaid" value={rpC(k.unpaid)} icon={<AlertTriangle className="h-4 w-4" />} trend={{ value: k.unpaidSlips, label: 'slips unpaid', positive: false }} tooltip="Remaining net salary budget due for transfer." />
        <KPICard title="Active Loans (THP)" value={rpC(k.activeLoans)} icon={<Landmark className="h-4 w-4" />} trend={{ value: rpC(k.activeRepayments), label: 'repayment deduction', positive: true }} tooltip="Total new employee loans disbursed via payroll (THP) in the current period." />
      </div>
      <BarCard title="Monthly THP vs Disbursed" data={d.monthly} bars={[
        { key: 'THP', color: CHART[2], label: 'THP' }, { key: 'Disbursed', color: CHART[0], label: 'Disbursed' },
      ]} height={280}
        onBarClick={(monthStr) => handleChartClick('payrollMonth', monthStr, `Month = ${monthStr}`)}
        tooltip="Monthly comparison between net salary due (THP) and actual disbursed salary." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Payslip Status" subtitle="Click to filter" tooltip="Proportion of payslips by release status (Draft, Lock, Release, etc.)." align="right">
          <DonutChart data={d.statusBreakdown} height={260} onSliceClick={(name) => handleChartClick('payrollStatus', name, `Status = ${name}`)} />
        </ChartCard>
        <BarCard title="Top Earnings Additions" data={d.topAdditions} bars={[{ key: 'value', color: 'var(--chart-1)' }]} vertical tooltip="Ranking of the largest employee allowance/addition components this period." align="right" />
        <BarCard title="Top Reductions" data={d.topReductions} bars={[{ key: 'value', color: 'var(--chart-5)' }]} vertical tooltip="Ranking of the largest employee deduction/reduction components this period." align="right" />
      </div>
      </>
      )}

      {!hideTable && (
      <>
      <div className="flex items-center justify-end gap-3 mt-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Table By:</span>
        <div className="flex bg-muted/40 p-1 rounded-xl border border-border">
          <button onClick={() => setViewMode('monthly')} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>Bulanan</button>
          <button onClick={() => setViewMode('yearly')} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'yearly' ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>Tahunan</button>
        </div>
      </div>
      <DataTable title="Payslips" rows={groupedRows} prefilter={f.predicate} searchKeys={['idPayroll', 'employee', 'period', 'statusLabel', 'payStatus', 'periodType']} initialSort="startDate" onRowClick={openSlip}
        cols={[
          { key: 'idPayroll', label: 'ID', render: (r) => <span className="text-xs font-semibold text-primary">{r.idPayroll}</span> },
          { key: 'employee', label: 'Employee', render: (r) => <span className="text-xs font-semibold text-primary">{r.employee}</span> },
          { key: 'startDate', label: 'Start Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.startDate)}</span> },
          { key: 'endDate', label: 'End Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.endDate)}</span> },
          { key: 'periodType', label: 'Cycle', render: (r) => badge(r.periodType, r.periodType === 'Weekly' ? 'sky' : r.periodType === 'Yearly' ? 'purple' : 'muted') },
          { key: 'receipts', label: 'Receipts', align: 'right', render: (r) => rp(r.receipts) },
          { key: 'reductions', label: 'Reductions', align: 'right', render: (r) => r.reductions > 0 ? <span className="text-muted-foreground">{rp(r.reductions)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'loanThp', label: 'Loan (THP)', align: 'right', render: (r) => r.loanThp > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{rp(r.loanThp)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'repayThp', label: 'Repayment (THP)', align: 'right', render: (r) => r.repayThp > 0 ? <span className="text-rose-600 dark:text-rose-400 font-medium">-{rp(r.repayThp)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'takeHomePay', label: 'THP', align: 'right', render: (r) => <span className="font-semibold text-primary">{rp(r.takeHomePay)}</span> },
          { key: 'disbursed', label: 'Disbursed', align: 'right', render: (r) => rp(r.disbursed) },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Release' ? 'green' : r.statusLabel === 'Lock' ? 'red' : 'muted') },
          { key: 'payStatus', label: 'Payment', render: (r) => r.payStatus === '-' ? <span className="text-muted-foreground">—</span> : badge(r.payStatus, r.payStatus === 'Paid' ? 'green' : r.payStatus === 'Unpaid' ? 'red' : 'amber') },
        ]} />

      {/* Slide-over Payroll Drawer Panel */}
      {selectedPayroll && (() => {
        const renderPayslip = (p: any) => {
          const totalEarningsReceipt = (p.earnings || []).reduce((acc: number, e: any) => acc + (e.receipt || 0), 0)
          const totalEarningsThp = (p.earnings || []).reduce((acc: number, e: any) => acc + (e.thp || 0), 0)
          const totalReductionsThp = (p.reductionsList || []).reduce((acc: number, r: any) => acc + (r.thp || 0), 0)
          const totalReductionsReceipt = (p.reductionsList || []).reduce((acc: number, r: any) => acc + (r.receipt || 0), 0)
          
          const finalReceipt = totalEarningsReceipt - totalReductionsReceipt
          const finalThp = totalEarningsThp - totalReductionsThp

          return (
            <div className="space-y-6 text-foreground">
              {/* Slip Gaji Card */}
              <div className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm space-y-6 text-xs">
                {/* Logo and Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid grid-cols-3 gap-0.5 w-8 h-8 shrink-0">
                      <span className="bg-sky-500 rounded-sm"></span>
                      <span className="bg-emerald-500 rounded-sm"></span>
                      <span className="bg-amber-500 rounded-sm"></span>
                      <span className="bg-emerald-500 rounded-sm"></span>
                      <span className="bg-sky-500 rounded-sm"></span>
                      <span className="bg-rose-500 rounded-sm"></span>
                      <span className="bg-amber-500 rounded-sm"></span>
                      <span className="bg-rose-500 rounded-sm"></span>
                      <span className="bg-sky-500 rounded-sm"></span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight text-foreground uppercase">Multi Daya Mitra</h3>
                      <p className="text-[10px] text-muted-foreground">Salary Slip</p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <h2 className="text-lg font-bold tracking-wider uppercase text-primary">Pay Slip</h2>
                    <p className="text-[10px] font-mono text-muted-foreground">Ref: {p.idPayroll}</p>
                  </div>
                </div>

                {/* Metadata Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border pb-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Employee Name:</span>
                      <span className="font-semibold text-foreground">{p.employee}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-mono text-foreground">{p.employeeEmail}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">NIK (ID Card):</span>
                      <span className="font-mono text-foreground">{p.employeeNik}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Employee ID:</span>
                      <span className="font-mono font-semibold text-primary">{p.userId}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Pay Period:</span>
                      <span className="font-semibold text-foreground">{fmtDate(p.startDate)} - {fmtDate(p.endDate)}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Job Title:</span>
                      <span className="font-medium text-foreground">{p.employeeOccupation}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border/50">
                      <span className="text-muted-foreground">Tax Status:</span>
                      <span className="font-mono font-semibold text-foreground">{p.taxStatus}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Tax Bracket (PPh 21):</span>
                      <span className="font-mono font-semibold text-foreground">{p.taxCategory}</span>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="h-9 text-xs w-2/5 font-semibold text-foreground">Earnings</TableHead>
                        <TableHead className="h-9 text-xs w-1/5 font-semibold text-foreground">Type</TableHead>
                        <TableHead className="h-9 text-xs w-1/5 font-semibold text-foreground text-right">Receipt</TableHead>
                        <TableHead className="h-9 text-xs w-1/5 font-semibold text-foreground text-right">THP</TableHead>
                        <TableHead className="h-9 text-xs w-1/5 font-semibold text-foreground text-right">Non THP/Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(p.earnings || []).map((e: any, idx: number) => {
                        const hasReceipt = e.receipt > 0
                        const hasThp = e.thp > 0
                        return (
                          <TableRow key={idx} className="hover:bg-muted/5">
                            <TableCell className="font-medium text-foreground py-2.5">{e.name}</TableCell>
                            <TableCell className="text-muted-foreground py-2.5">{e.type}</TableCell>
                            <TableCell className="text-right font-mono py-2.5">{hasReceipt ? rp(e.receipt) : '0.00'}</TableCell>
                            <TableCell className="text-right font-mono py-2.5">{hasThp ? rp(e.thp) : '—'}</TableCell>
                            <TableCell className="text-right font-mono py-2.5">{e.nonThpReceipt > 0 ? rp(e.nonThpReceipt) : '—'}</TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow className="bg-muted/30 font-bold border-t border-border hover:bg-muted/30">
                        <TableCell colSpan={2} className="py-2.5 text-foreground">Total Earnings</TableCell>
                        <TableCell className="text-right font-mono py-2.5 text-emerald-600 dark:text-emerald-400">{rp(totalEarningsReceipt)}</TableCell>
                        <TableCell className="text-right font-mono py-2.5 text-emerald-600 dark:text-emerald-400">{rp(totalEarningsThp)}</TableCell>
                        <TableCell className="text-right font-mono py-2.5">—</TableCell>
                      </TableRow>

                      {/* Deductions Header */}
                      <TableRow className="bg-muted/50 border-t-2 border-border font-semibold hover:bg-muted/50">
                        <TableCell colSpan={2} className="h-9 text-xs font-semibold text-foreground py-2">Deductions</TableCell>
                        <TableCell className="h-9 text-xs font-semibold text-foreground text-right py-2">Receipt</TableCell>
                        <TableCell className="h-9 text-xs font-semibold text-foreground text-right py-2">THP</TableCell>
                        <TableCell className="h-9 text-xs font-semibold text-foreground text-right py-2">Non THP</TableCell>
                      </TableRow>

                      {(!p.reductionsList || p.reductionsList.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-3 italic">No deductions found</TableCell>
                        </TableRow>
                      ) : (
                        p.reductionsList.map((r: any, idx: number) => {
                          const hasReceipt = r.receipt > 0
                          const hasThp = r.thp > 0
                          return (
                            <TableRow key={idx} className="hover:bg-muted/5">
                              <TableCell className="font-medium text-foreground py-2.5">{r.name}</TableCell>
                              <TableCell className="text-muted-foreground py-2.5">{r.type}</TableCell>
                              <TableCell className="text-right font-mono py-2.5 text-rose-600 dark:text-rose-400">{hasReceipt ? rp(r.receipt) : '0.00'}</TableCell>
                              <TableCell className="text-right font-mono py-2.5 text-rose-600 dark:text-rose-400">{hasThp ? rp(r.thp) : '0.00'}</TableCell>
                              <TableCell className="text-right font-mono py-2.5">{r.nonThp > 0 ? rp(r.nonThp) : '—'}</TableCell>
                            </TableRow>
                          )
                        })
                      )}
                      <TableRow className="bg-muted/30 font-bold border-t border-border hover:bg-muted/30">
                        <TableCell colSpan={2} className="py-2.5 text-foreground">Total Deductions</TableCell>
                        <TableCell className="text-right font-mono py-2.5 text-rose-600 dark:text-rose-400">{rp(totalReductionsReceipt)}</TableCell>
                        <TableCell className="text-right font-mono py-2.5 text-rose-600 dark:text-rose-400">{rp(totalReductionsThp)}</TableCell>
                        <TableCell className="text-right font-mono py-2.5">—</TableCell>
                      </TableRow>

                      {/* Net Payoff */}
                      <TableRow className="bg-muted/80 font-black border-t-2 border-border text-sm hover:bg-muted/80">
                        <TableCell colSpan={2} className="py-3 text-foreground text-xs font-extrabold uppercase">Total Bersih</TableCell>
                        <TableCell className="text-right font-mono py-3 text-primary text-xs font-bold">{rp(finalReceipt)}</TableCell>
                        <TableCell className="text-right font-mono py-3 text-primary text-xs font-bold">{rp(finalThp)}</TableCell>
                        <TableCell className="text-right font-mono py-3">—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

              </div>

              {/* Reimbursements table detail */}
              {p.reimburseList && p.reimburseList.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden space-y-2 p-4">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 px-1 border-b border-border pb-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" /> Reimburses
                  </h4>
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Approved Date</TableHead>
                        <TableHead className="h-8 text-xs">Description</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.reimburseList.map((rem: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/5">
                          <TableCell className="text-xs py-2 text-muted-foreground font-mono">{fmtDate(rem.date)}</TableCell>
                          <TableCell className="text-xs py-2 font-medium text-foreground">{rem.description}</TableCell>
                          <TableCell className="text-xs py-2 text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400">{rp(rem.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/20 font-bold hover:bg-muted/20">
                        <TableCell className="text-xs py-2" colSpan={2}>Total</TableCell>
                        <TableCell className="text-xs py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {rp(p.reimburseList.reduce((acc: number, rem: any) => acc + rem.amount, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Loans Table Detail */}
              {p.loansList && p.loansList.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden space-y-2 p-4">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 px-1 border-b border-border pb-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" /> Loans & Repayments
                  </h4>
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Date</TableHead>
                        <TableHead className="h-8 text-xs">Transaction Type</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.loansList.map((loan: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/5">
                          <TableCell className="text-xs py-2 text-muted-foreground font-mono">{fmtDate(loan.date)}</TableCell>
                          <TableCell className="text-xs py-2 font-medium text-foreground">{loan.type}</TableCell>
                          <TableCell className="text-xs py-2 text-right font-semibold font-mono text-amber-600 dark:text-amber-400">{rp(loan.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {/* Footnotes for Allowances */}
              {(p.travelDetails?.length > 0 || p.mealRate > 0) && (
                <div className="bg-muted/10 border border-border/50 rounded-xl p-4 space-y-3 mt-4 text-xs">
                  <h4 className="font-semibold text-foreground border-b border-border/50 pb-1.5 mb-1.5">Additional Details:</h4>
                  {p.travelDetails?.length > 0 && (
                    <div className="flex gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground w-36">Travel Allowance:</span>
                      <div>
                        { (p.periodType === 'Weekly' && p.isGroupedWeekly) || p.isGroupedYearly
                          ? `${fmtDate(p.startDate)} - ${fmtDate(p.endDate)}` 
                          : p.travelDetails.map((td: any, i: number) => (
                              <div key={i}>{fmtDate(td.date)} ({td.days} Days)</div>
                            ))
                        }
                      </div>
                    </div>
                  )}
                  {p.mealDetailsList?.length > 0 ? (
                    <div className="flex gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground w-36">Meal Allowance:</span>
                      <div className="flex flex-col gap-1.5">
                        {p.isGroupedYearly ? (
                          <span>{fmtDate(p.startDate)} - {fmtDate(p.endDate)} <span className="text-emerald-600 dark:text-emerald-400 font-medium">({rp(p.mealDetailsList.reduce((acc: number, m: any) => acc + m.approved, 0))})</span></span>
                        ) : (
                          p.mealDetailsList.map((md: any, i: number) => (
                            <div key={i}>
                              <span className="text-foreground">{fmtDate(md.date)}</span> &nbsp;—&nbsp; {md.type} <span className="text-emerald-600 dark:text-emerald-400 font-medium">({rp(md.approved)})</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : p.mealRate > 0 && (
                    <div className="flex gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground w-36">Meal Allowance:</span>
                      <span>{fmtDate(p.startDate)} - {fmtDate(p.endDate)} (Rate: {rp(p.mealRate)} / Day)</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Combined Slips Breakdown (Weekly/Yearly Group) */}
              {(p.weeklySlips?.length > 0 || p.groupedSlips?.length > 0) && (
                <div className="mt-6 border border-border rounded-lg overflow-hidden bg-muted/10">
                  <div className="bg-muted/40 px-4 py-2 border-b border-border/50">
                    <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
                      {p.isGroupedYearly ? 'Yearly Slips Breakdown' : 'Weekly Slips Breakdown'}
                    </h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 text-[11px] font-semibold text-foreground">Period</TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-foreground text-right">Receipts</TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-foreground text-right">THP</TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-foreground text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(p.weeklySlips || p.groupedSlips).map((s: any, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/5">
                          <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDate(s.startDate)} - {fmtDate(s.endDate)}
                          </TableCell>
                          <TableCell className="py-2 text-right text-xs font-mono">{rp(s.receipts || s.totalReceipts)}</TableCell>
                          <TableCell className="py-2 text-right text-xs font-mono">{rp(s.takeHomePay)}</TableCell>
                          <TableCell className="py-2 text-right text-xs">
                            <span className={
                              s.statusLabel === 'Release' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 
                              s.statusLabel === 'Lock' ? 'text-rose-600 dark:text-rose-400 font-medium' : 
                              'text-muted-foreground'
                            }>
                              {s.statusLabel || s.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )
        }

        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedPayroll(null)} />
            <div className="relative w-screen max-w-3xl bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Employee Payslip Details</span>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
                    ID: <span className="text-primary">{selectedPayroll.idPayroll}</span>
                    {badge(selectedPayroll.statusLabel, selectedPayroll.statusLabel === 'Release' ? 'green' : selectedPayroll.statusLabel === 'Lock' ? 'red' : 'muted')}
                    {badge(selectedPayroll.payStatus, selectedPayroll.payStatus === 'Paid' ? 'green' : selectedPayroll.payStatus === 'Unpaid' ? 'red' : 'amber')}
                  </h3>
                </div>
                <button onClick={() => setSelectedPayroll(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">
                {renderPayslip(selectedPayroll)}
              </div>
            </div>
          </div>
        )
      })()}
      </>
      )}
    </div>
  )
}
