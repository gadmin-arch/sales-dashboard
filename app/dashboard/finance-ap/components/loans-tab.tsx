'use client'

import { useState } from 'react'
import { KPICard } from '@/components/kpi-card'
import { X, Landmark, DollarSign, CalendarClock, Users, Banknote, Timer } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  type FA,
  type FilterSpec,
  BarCard,
  DataTable,
  FilterBar,
  useRowFilters,
  badge,
  rp,
  rpC,
  fmtDate,
  CHART,
} from './shared'

const LOAN_FILTERS: FilterSpec[] = [
  { field: 'statusLabel', label: 'Status' },
  { field: 'borrower', label: 'Borrower' },
]

export function LoansTab({ d, handleChartClick }: { d: FA['loans']; handleChartClick: (type: string, value: string, label: string) => void }) {
  const k = d.kpis
  const f = useRowFilters(d.rows, LOAN_FILTERS)
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null)

  return (
    <div className="space-y-6">
      <FilterBar specs={LOAN_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Outstanding" value={rpC(k.outstanding)} icon={<Landmark className="h-4 w-4" />} trend={{ value: `${k.repaymentProgress}%`, label: 'repaid', positive: k.repaymentProgress >= 50 }} tooltip="Remaining outstanding balance of employee loans: SUM(amount - repaid)." />
        <KPICard title="Total Disbursed" value={rpC(k.totalDisbursed)} icon={<DollarSign className="h-4 w-4" />} tooltip="Total loan principal disbursed to employees: SUM(loan.amount)." />
        <KPICard title="Expected / Month" value={rpC(k.expectedMonthly)} icon={<CalendarClock className="h-4 w-4" />} trend={{ value: `${k.monthsToClear}mo`, label: 'to clear book', positive: true }} tooltip="Projected monthly repayment inflow: SUM(amount / tenor) across active loans." />
        <KPICard title="Active Loans" value={k.activeLoans.toLocaleString('en-US')} icon={<Users className="h-4 w-4" />} trend={{ value: `${k.borrowers} borrowers`, label: `median ${k.medianTenor}mo`, positive: true }} tooltip="Count of active employee loan books with outstanding balances." />
      </div>
      <BarCard title="Repayment Forecast (next 12 months)" subtitle="Projected payroll-deduction inflow at each loan's installment rate" data={d.forecast} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Expected' }]} height={280}
        onBarClick={(monthStr) => handleChartClick('forecastMonth', monthStr, `Forecast Month = ${monthStr}`)}
        tooltip="Projected monthly payroll deduction repayment inflow to settle active loans." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="Disbursement vs Repayment by Month" data={d.monthly} bars={[{ key: 'Disbursed', color: CHART[3], label: 'Disbursed' }, { key: 'Repaid', color: CHART[0], label: 'Repaid' }]}
          onBarClick={(monthStr) => handleChartClick('loanMonth', monthStr, `Month = ${monthStr}`)}
          tooltip="Monthly comparison of new loan disbursements vs loan repayments." />
        <BarCard title="Top Borrowers by Outstanding" data={d.topBorrowers} bars={[{ key: 'value', color: 'var(--chart-3)' }]} vertical onBarClick={(name) => handleChartClick('borrower', name, `Borrower = ${name}`)} tooltip="Ranking of employees with the highest outstanding loan balances." align="right" />
      </div>
      <DataTable title="Loans" subtitle="Full loan book — outstanding is point-in-time, so this tab isn't scoped by the date filter." rows={d.rows} prefilter={f.predicate} searchKeys={['loanId', 'borrower', 'remarks', 'statusLabel']} initialSort="outstanding" onRowClick={setSelectedLoan}
        cols={[
          { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span> },
          { key: 'borrower', label: 'Borrower', render: (r) => <span className="text-xs font-medium">{r.borrower}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-medium">{rp(r.amount)}</span> },
          { key: 'tenor', label: 'Tenor', align: 'right', render: (r) => `${r.tenor}mo` },
          { key: 'repaid', label: 'Repaid', align: 'right', render: (r) => rp(r.repaid) },
          { key: 'lastRepayDate', label: 'Last Repay', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{r.lastRepayDate === '-' ? '—' : fmtDate(r.lastRepayDate)}</span> },
          { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => r.outstanding > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{rp(r.outstanding)}</span> : <span className="text-muted-foreground">—</span> },
          { key: 'progress', label: 'Progress', align: 'right', render: (r) => `${r.progress}%` },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Settled' ? 'green' : 'sky') },
        ]} />

      {/* Slide-over Loan Drawer Panel */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedLoan(null)}
          />
          {/* Drawer content */}
          <div className="relative w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Loan Record Details</span>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
                  ID: <span className="text-primary">{selectedLoan.loanId}</span>
                  {badge(selectedLoan.statusLabel, selectedLoan.statusLabel === 'Settled' ? 'green' : 'sky')}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLoan(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Borrower Info</span>
                  <div className="text-xs space-y-1 text-foreground">
                    <p className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Disbursed Date:</strong> {fmtDate(selectedLoan.date)}</p>
                    <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Borrower:</strong> {selectedLoan.borrower} ({selectedLoan.userId})</p>
                    <p className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Tenor:</strong> {selectedLoan.tenor} Months</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Payment Details</span>
                  <div className="text-xs space-y-1 text-foreground">
                    <p><strong>Monthly Recovery:</strong> {rp(Math.round(selectedLoan.amount / selectedLoan.tenor))} / month</p>
                    <p><strong>Last Repayment:</strong> {selectedLoan.lastRepayDate === '-' ? '—' : fmtDate(selectedLoan.lastRepayDate)}</p>
                    <p className="truncate" title={selectedLoan.remarks}><strong>Remarks:</strong> {selectedLoan.remarks}</p>
                  </div>
                </div>
              </div>

              {/* Financial Status Summary */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Financial Status Summary</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Borrowed Principal</p>
                    <p className="text-xs font-semibold">{rp(selectedLoan.amount)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Repaid Amount</p>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">-{rp(selectedLoan.repaid)} ({selectedLoan.progress}%)</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Remaining Outstanding</p>
                    <p className={`text-xs font-semibold ${selectedLoan.outstanding > 0.5 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{rp(selectedLoan.outstanding)}</p>
                  </div>
                </div>
              </div>

              {/* Repayments History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-primary" />
                  Repayment History Log ({selectedLoan.repaymentsList.length})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Date</TableHead>
                        <TableHead className="h-8 text-xs">Method / THP</TableHead>
                        <TableHead className="h-8 text-xs text-center">Installment No.</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount Paid</TableHead>
                        <TableHead className="h-8 text-xs">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLoan.repaymentsList.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">No repayments found</TableCell></TableRow>
                      ) : selectedLoan.repaymentsList.map((r: any, idx: number) => (
                        <TableRow key={r.repaymentId || idx}>
                          <TableCell className="text-xs py-2 text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                          <TableCell className="text-xs py-2">{badge(r.thp === 'manual' || r.thp === 'Manual' ? 'Manual' : r.thp, r.thp === 'manual' || r.thp === 'Manual' ? 'sky' : 'green')}</TableCell>
                          <TableCell className="text-xs py-2 text-center font-medium">#{r.count}</TableCell>
                          <TableCell className="text-xs py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{rp(r.amount)}</TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground max-w-[200px] truncate" title={r.remarks}>{r.remarks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
