'use client'

import { useState } from 'react'
import { KPICard } from '@/components/kpi-card'
import { DonutChart } from '@/components/donut-chart'
import { X, Utensils, DollarSign, Receipt, Wallet, CalendarClock, Users, Layers } from 'lucide-react'
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
} from './shared'

const MEAL_FILTERS: FilterSpec[] = [
  { field: 'typeLabel', label: 'Type' },
  { field: 'projectId', label: 'Project' },
  { field: 'statusLabel', label: 'Status' },
  { field: 'requestedBy', label: 'Requested By' },
]

export function MealTab({ d, handleChartClick }: { d: FA['meal']; handleChartClick: (type: string, value: string, label: string) => void }) {
  const k = d.kpis
  const f = useRowFilters(d.rows, MEAL_FILTERS)
  const [selectedMeal, setSelectedMeal] = useState<any | null>(null)

  return (
    <div className="space-y-6">
      <FilterBar specs={MEAL_FILTERS} sel={f.sel} setSel={f.setSel} options={f.options} active={f.active} onClear={f.clear} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Approved Benefit" value={rpC(k.totalApproved)} icon={<Utensils className="h-4 w-4" />} tooltip="Total approved employee meal benefit budget: SUM(mb_total WHERE status='A')." />
        <KPICard title="Net Released" value={rpC(k.netReleased)} icon={<DollarSign className="h-4 w-4" />} tooltip="Total meal funds disbursed: SUM(release.amount where type is R=Release or P=Return/negative)." />
        <KPICard title="Total Evidence (Real)" value={rpC(k.totalEvidence)} icon={<Receipt className="h-4 w-4" />} tooltip="Total actual employee meal expenditure supported by evidence receipts." />
        <KPICard title="Leftover Balance" value={rpC(k.totalDifference)} icon={<Wallet className="h-4 w-4" />} trend={{ value: `${k.netReleased > 0 ? Math.round((k.totalDifference / k.netReleased) * 100) : 0}%`, label: 'of released', positive: k.totalDifference >= 0 }} tooltip="Difference in meal funds (Net Released - Total Evidence) remaining as cash balance." />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarCard title="Approved Meal Benefit by Month" data={d.approvedByMonth} bars={[{ key: 'value', color: 'var(--chart-1)', label: 'Approved' }]}
          onBarClick={(monthStr) => handleChartClick('mealMonth', monthStr, `Month = ${monthStr}`)}
          tooltip="Monthly trend of approved meal benefit budgets." />
        <ChartCard title="Spend by Meal Type" subtitle="Click to filter" tooltip="Approved meal benefits grouped by category (Overtime Meal, Guest Meal, Operational, etc.)." align="right">
          <DonutChart data={d.byType} height={260} onSliceClick={(name) => handleChartClick('typeLabel', name, `Type = ${name}`)} />
        </ChartCard>
      </div>
      <BarCard title="Top Projects by Approved Spend" data={d.topProjects} bars={[{ key: 'value', color: 'var(--chart-4)' }]} vertical height={300} categoryKey="id" yAxisWidth={75} labelFormatter={(id) => d.topProjects.find(p => p.id === id)?.name || id} onBarClick={(id) => handleChartClick('project', id, `Project = ${d.topProjects.find(p => p.id === id)?.name || id}`)} tooltip="Ranking of projects with the highest approved meal benefit spend." />
      
      <DataTable title="Meal Benefit Requests" rows={d.rows} prefilter={f.predicate} searchKeys={['mbId', 'typeLabel', 'projectId', 'zone', 'requestedBy', 'statusLabel']} initialSort="date" onRowClick={setSelectedMeal}
        cols={[
          { key: 'mbId', label: 'ID', render: (r) => <span className="text-xs font-semibold text-primary">{r.mbId}</span> },
          { key: 'date', label: 'Date', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span> },
          { key: 'typeLabel', label: 'Type', render: (r) => <span className="text-xs">{r.typeLabel}</span> },
          { key: 'projectId', label: 'Project', render: (r) => <span className="text-xs text-muted-foreground">{r.projectId}</span> },
          { key: 'users', label: 'Users', align: 'right', render: (r) => r.users },
          { key: 'approvedAmount', label: 'Approved', align: 'right', render: (r) => <span className="font-medium">{rp(r.approvedAmount)}</span> },
          { key: 'released', label: 'Released', align: 'right', render: (r) => rp(r.released) },
          { key: 'evidence', label: 'Evidence', align: 'right', render: (r) => rp(r.evidence) },
          { 
            key: 'diff', 
            label: 'Difference', 
            align: 'right', 
            render: (r) => (
              <div className="text-right">
                <div>
                  {r.diff > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{rp(r.diff)}</span>
                  ) : r.diff < 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">{rp(r.diff)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {r.prevBalance !== 0 && (
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5" title="Accumulated balance from previous requests">
                    Prev: {r.prevBalance > 0 ? `+${rp(r.prevBalance)}` : rp(r.prevBalance)}
                  </div>
                )}
              </div>
            )
          },
          { key: 'statusLabel', label: 'Status', render: (r) => badge(r.statusLabel, r.statusLabel === 'Approved' ? 'green' : r.statusLabel === 'Rejected' ? 'red' : 'sky') },
          { key: 'requestedBy', label: 'Requested By', render: (r) => <span className="text-xs font-medium">{r.requestedBy}</span> },
        ]} />

      {/* Meal Request Cash Balances */}
      <DataTable
        title="Meal Request Cash Balances"
        subtitle="Summary of meal benefit funds released, actual evidence spent, and net balance per employee."
        rows={d.userBalances}
        searchKeys={['employeeName']}
        initialSort="balance"
        prefilter={(r: any) => {
          const v = f.sel['requestedBy']
          return !v?.length || v.includes(String(r.employeeName ?? ''))
        }}
        cols={[
          { key: 'employeeName', label: 'Employee', render: (r) => <span className="text-xs font-semibold">{r.employeeName}</span> },
          { key: 'released', label: 'Total Released', align: 'right', render: (r) => rp(r.released) },
          { key: 'evidence', label: 'Total Evidence (Spent)', align: 'right', render: (r) => rp(r.evidence) },
          { key: 'balance', label: 'Net Balance', align: 'right', render: (r) => r.balance > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{rp(r.balance)}</span> : r.balance < 0 ? <span className="text-rose-600 dark:text-rose-400 font-medium">{rp(r.balance)}</span> : <span className="text-muted-foreground">—</span> },
        ]} />

      {/* Slide-over Drawer Panel */}
      {selectedMeal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedMeal(null)}
          />
          {/* Drawer content */}
          <div className="relative w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Meal Benefit Request Details</span>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
                  ID: <span className="text-primary">{selectedMeal.mbId}</span>
                  {badge(selectedMeal.statusLabel, selectedMeal.statusLabel === 'Approved' ? 'green' : selectedMeal.statusLabel === 'Rejected' ? 'red' : 'sky')}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedMeal(null)}
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
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Request Info</span>
                  <div className="text-xs space-y-1 text-foreground">
                    <p className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Date:</strong> {fmtDate(selectedMeal.date)}</p>
                    <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Users/Days:</strong> {selectedMeal.users} Users / {selectedMeal.days} Days</p>
                    <p className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Zone:</strong> {selectedMeal.zone}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Project & Requester</span>
                  <div className="text-xs space-y-1 text-foreground">
                    <p><strong>Project:</strong> {selectedMeal.projectName} ({selectedMeal.projectId})</p>
                    <p><strong>Requested By:</strong> {selectedMeal.requestedBy}</p>
                    <p><strong>Meal Type:</strong> {selectedMeal.typeLabel}</p>
                  </div>
                </div>
              </div>

              {/* Financial Status Summary */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Financial Status Summary</span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Approved</p>
                    <p className="text-xs font-semibold">{rp(selectedMeal.approvedAmount)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Released</p>
                    <p className="text-xs font-semibold">{rp(selectedMeal.released)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Evidence</p>
                    <p className="text-xs font-semibold">{rp(selectedMeal.evidence)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Difference</p>
                    <p className={`text-xs font-semibold ${selectedMeal.diff > 0 ? "text-emerald-600 dark:text-emerald-400" : selectedMeal.diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      {selectedMeal.diff > 0 ? `+${rp(selectedMeal.diff)}` : rp(selectedMeal.diff)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Itemized Meal Details Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  Itemized Meal Details ({selectedMeal.details.length})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Employee</TableHead>
                        <TableHead className="h-8 text-xs">Date</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                        <TableHead className="h-8 text-xs text-right">Approved</TableHead>
                        <TableHead className="h-8 text-xs">Notes / Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMeal.details.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">No itemized details found</TableCell></TableRow>
                      ) : selectedMeal.details.map((d: any, idx: number) => (
                        <TableRow key={d.mbdId || idx}>
                          <TableCell className="text-xs py-2 font-medium">{d.userName}</TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground whitespace-nowrap">{fmtDate(d.date)}</TableCell>
                          <TableCell className="text-xs py-2 text-right">{rp(d.amount)}</TableCell>
                          <TableCell className="text-xs py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">{rp(d.approved)}</TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground max-w-[200px] truncate" title={d.notes}>{d.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Disbursement History (Releases) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Disbursement History ({selectedMeal.releases.length})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Date</TableHead>
                        <TableHead className="h-8 text-xs">Type</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                        <TableHead className="h-8 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMeal.releases.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No disbursement releases found</TableCell></TableRow>
                      ) : selectedMeal.releases.map((r: any, idx: number) => (
                        <TableRow key={r.mbrId || idx}>
                          <TableCell className="text-xs py-2 text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                          <TableCell className="text-xs py-2">{badge(r.type, r.type === 'Release' ? 'sky' : 'amber')}</TableCell>
                          <TableCell className="text-xs py-2 text-right font-medium">{rp(r.amount)}</TableCell>
                          <TableCell className="text-xs py-2">{badge(r.status, 'green')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Submitted Evidences */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" />
                  Submitted Evidence Receipts ({selectedMeal.evidences.length})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8 text-xs">Date</TableHead>
                        <TableHead className="h-8 text-xs">Receipt / File</TableHead>
                        <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                        <TableHead className="h-8 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMeal.evidences.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No evidence receipts submitted</TableCell></TableRow>
                      ) : selectedMeal.evidences.map((e: any, idx: number) => (
                        <TableRow key={e.mbeId || idx}>
                          <TableCell className="text-xs py-2 text-muted-foreground whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                          <TableCell className="text-xs py-2 font-medium max-w-[200px] truncate" title={e.file}>{e.file}</TableCell>
                          <TableCell className="text-xs py-2 text-right font-semibold">{rp(e.amount)}</TableCell>
                          <TableCell className="text-xs py-2">{badge(e.status, 'green')}</TableCell>
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
