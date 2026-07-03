'use client'

import { useState } from 'react'
import { KPICard } from '@/components/kpi-card'
import { DonutChart } from '@/components/donut-chart'
import { X, Wallet, DollarSign, TrendingDown, Receipt, Banknote } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

const REIMBURSE_FILTERS: FilterSpec[] = [
  { field: 'category', label: 'Category' },
  { field: 'employeeName', label: 'Employee' },
]

export function ReimburseTab({ d, handleChartClick }: { d: FA['reimburse']; handleChartClick: (type: string, value: string, label: string) => void }) {
  const k = d.kpis
  const f = useRowFilters(d.rows, REIMBURSE_FILTERS)
  const [selectedEmpBalance, setSelectedEmpBalance] = useState<any | null>(null)

  return (
    <div className="space-y-6">
      <FilterBar specs={REIMBURSE_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Petty Cash Balance" value={rpC(k.balance)} icon={<Wallet className="h-4 w-4" />} trend={{ value: k.pending, label: 'pending', positive: k.balance >= 0 }} tooltip="Current petty cash balance: Total Refill (Cash In) minus Total Claims (Cash Out)." />
        <KPICard title="Cash In (Approved)" value={rpC(k.totalIn)} icon={<DollarSign className="h-4 w-4" />} tooltip="Total petty cash refill (Cash In) approved: SUM(amount WHERE status='A' & cash_in)." />
        <KPICard title="Cash Out (Approved)" value={rpC(k.totalOut)} icon={<TrendingDown className="h-4 w-4" />} tooltip="Total petty cash claims (Cash Out) approved: SUM(amount WHERE status='A' & cash_out)." />
        <KPICard title="Claims" value={k.approvedClaims.toLocaleString('en-US')} icon={<Receipt className="h-4 w-4" />} trend={{ value: rpC(k.avgTicket), label: 'avg ticket', positive: true }} tooltip="Count of approved petty cash claim records." />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarCard title="Monthly In / Out + Balance" data={d.monthly} bars={[{ key: 'CashIn', color: CHART[0], label: 'In' }, { key: 'CashOut', color: CHART[1], label: 'Out' }]} className="lg:col-span-2" height={280}
          onBarClick={(monthStr) => handleChartClick('reimburseMonth', monthStr, `Month = ${monthStr}`)}
          tooltip="Monthly trend of petty cash refill (Cash In) vs claim cash-outs." />
        <ChartCard title="Spend by Category" subtitle="Click to filter" tooltip="Petty cash claims grouped by operational category." align="right">
          <DonutChart data={d.categoryBreakdown} height={280} onSliceClick={(name) => handleChartClick('category', name, `Category = ${name}`)} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="Top Projects by Spend" data={d.topProjects} bars={[{ key: 'value', color: 'var(--chart-4)' }]} vertical categoryKey="id" yAxisWidth={75} labelFormatter={(id) => d.topProjects.find(p => p.id === id)?.name || id} onBarClick={(id) => handleChartClick('project', id, `Project = ${d.topProjects.find(p => p.id === id)?.name || id}`)} tooltip="Ranking of projects with the highest petty cash claim spend." />
        <BarCard title="Top Employees by Cash-Out" data={d.topEmployees} bars={[{ key: 'value', color: 'var(--chart-2)' }]} vertical onBarClick={(name) => handleChartClick('employeeName', name, `Employee = ${name}`)} tooltip="Ranking of employees with the highest petty cash claim spend." align="right" />
      </div>
 
      <DataTable title="Reimbursement Claims (Approved)" rows={d.rows} prefilter={f.predicate} searchKeys={['reimburseId', 'projectName', 'description', 'employeeName', 'category']} initialSort="date"
        cols={[
          { key: 'reimburseId', label: 'ID', render: (r) => <span className="text-xs font-semibold text-primary">{r.reimburseId}</span> },
          { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span> },
          { key: 'employeeName', label: 'Employee', render: (r) => <span className="text-xs">{r.employeeName}</span> },
          { key: 'category', label: 'Category', render: (r) => <span className="text-xs text-muted-foreground">{r.category}</span> },
          { key: 'description', label: 'Description', render: (r) => <div className="max-w-[350px] whitespace-normal break-words text-xs leading-normal text-muted-foreground">{r.description}</div> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-medium">{rp(r.amount)}</span> },
        ]} />
 
      {/* User Petty Cash Balances */}
      <DataTable
        title="User Petty Cash Balances"
        subtitle="Summary of petty cash funding (Cash In), expenditures (Cash Out), and net balance per employee."
        rows={d.userBalances}
        searchKeys={['employeeName']}
        initialSort="balance"
        onRowClick={setSelectedEmpBalance}
        prefilter={(r: any) => {
          const v = f.sel['employeeName']
          return !v?.length || v.includes(String(r.employeeName ?? ''))
        }}
        cols={[
          { key: 'employeeName', label: 'Employee', render: (r) => <span className="text-xs font-semibold text-primary">{r.employeeName}</span> },
          { key: 'cashIn', label: 'Total Cash In', align: 'right', render: (r) => <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{rp(r.cashIn)}</span> },
          { key: 'cashOut', label: 'Total Cash Out', align: 'right', render: (r) => <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">{rp(r.cashOut)}</span> },
          { key: 'balance', label: 'Total Balance', align: 'right', render: (r) => <span className={`text-xs font-semibold ${r.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-primary'}`}>{rp(r.balance)}</span> },
        ]}
      />

      {/* Slide-over Petty Cash Balance Drawer Panel */}
      {selectedEmpBalance && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedEmpBalance(null)}
          />
          {/* Drawer content */}
          <div className="relative w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">User Petty Cash Details</span>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
                  Employee: <span className="text-primary">{selectedEmpBalance.employeeName}</span>
                </h3>
              </div>
              <button 
                onClick={() => setSelectedEmpBalance(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Financial Status Summary */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Petty Cash Status Summary</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Total Cash In</p>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{rp(selectedEmpBalance.cashIn)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Total Cash Out</p>
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">-{rp(selectedEmpBalance.cashOut)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Net Remaining Balance</p>
                    <p className={`text-xs font-bold ${selectedEmpBalance.balance >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400"}`}>{rp(selectedEmpBalance.balance)}</p>
                  </div>
                </div>
              </div>

              {/* Transactions History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-primary" />
                  Transaction Log ({selectedEmpBalance.history.length})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Date</TableHead>
                        <TableHead className="h-8 text-xs">Type</TableHead>
                        <TableHead className="h-8 text-xs">Category</TableHead>
                        <TableHead className="h-8 text-xs">Project</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                        <TableHead className="h-8 text-xs">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEmpBalance.history.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">No transactions found</TableCell></TableRow>
                      ) : selectedEmpBalance.history.map((t: any, idx: number) => (
                        <TableRow key={t.id || idx}>
                          <TableCell className="text-xs py-2 text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                          <TableCell className="text-xs py-2">
                            {badge(t.type, t.type === 'Cash In' ? 'green' : 'red')}
                          </TableCell>
                          <TableCell className="text-xs py-2 font-medium">{t.category}</TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground whitespace-nowrap">{t.project}</TableCell>
                          <TableCell className={`text-xs py-2 text-right font-semibold ${t.type === 'Cash In' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {t.type === 'Cash In' ? `+${rp(t.amount)}` : `-${rp(t.amount)}`}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground max-w-[150px] truncate" title={t.description}>{t.description}</TableCell>
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
