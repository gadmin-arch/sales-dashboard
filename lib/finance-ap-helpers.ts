// All Finance-AP dashboard formulas live here (pure TS, no JSX) so the API route
// stays thin and every KPI/aging/breakdown is defined in one place.
//
// Streams: Reimburse (petty cash) · PO Payments (AP) · Payroll · Meal Benefits · Loans.
// Numbers below were validated against live sheets on 2026-07-01 (see finance-ap-redesign memory).

import { parseDate, formatMonth, sortByPeriod } from '@/lib/utils-date-currency'
import type {
  PaymentRequest, FinancePayment, ReimburseCashIn, ReimburseCashOut, PaymentLog,
} from '@/database/repos/finance-ap'
import type {
  Payroll, PayrollPayment, PayrollListItem, Loan, Repayment,
  MealBenefit, MealBenefitRelease,
} from '@/database'

// ── Shared math ──
export const sum = (a: number[]): number => a.reduce((s, n) => s + n, 0)
export const round = (n: number): number => Math.round(n)
export const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0)

export function median(a: number[]): number {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2)
}

/** Record<id,number> → top-N [{name,value}] sorted desc, rounded, positives only. */
export function topN(agg: Record<string, number>, n = 10, label?: (k: string) => string): { name: string; value: number }[] {
  return Object.entries(agg)
    .map(([k, v]) => ({ name: label ? label(k) : k, value: round(v) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}

/** Monthly [{name,value}] (chronological) from items, summing valueOf bucketed by dateOf. */
export function byMonth<T>(items: T[], dateOf: (t: T) => string, valueOf: (t: T) => number): { name: string; value: number }[] {
  const agg: Record<string, number> = {}
  for (const it of items) {
    const k = formatMonth(dateOf(it))
    if (!k) continue
    agg[k] = (agg[k] || 0) + valueOf(it)
  }
  return sortByPeriod(agg, 'monthly').map(([name, value]) => ({ name, value: round(value) }))
}

/** Distinct ids → [{value,label}] sorted by label. */
export function buildOptions(ids: string[], label: (id: string) => string): { value: string; label: string }[] {
  return [...new Set(ids.filter(Boolean))]
    .map((id) => ({ value: id, label: label(id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const MS_PER_DAY = 86_400_000
export const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
export const daysOverdue = (dueStr: string, now: number): number => {
  const due = parseDate(dueStr)
  if (!due) return 0
  const d = Math.floor((now - startOfDay(due)) / MS_PER_DAY)
  return d > 0 ? d : 0
}

// ════════════════════════ PO PAYMENTS (Accounts Payable) ════════════════════════
// Outstanding excludes terminal states P(Paid)/CC(Cancel)/RF(Rejected); RF rows net to 0
// but pollute aging COUNTS, so they are excluded outright.
export const AP_TERMINAL = new Set(['P', 'CC', 'RF'])
export const isApOpen = (r: PaymentRequest): boolean => !!r.payreqStatus && !AP_TERMINAL.has(r.payreqStatus)
export const apOutstanding = (r: PaymentRequest): number => (isApOpen(r) ? Math.max(0, r.payreqAmount - r.payreqPayAmount) : 0)

export const AGING_BUCKETS = [
  { name: 'Current', min: -Infinity, max: 0 },
  { name: '1-30', min: 1, max: 30 },
  { name: '31-60', min: 31, max: 60 },
  { name: '61-90', min: 61, max: 90 },
  { name: '90+', min: 91, max: Infinity },
] as const

/** Whole-day lead time (date-only), clamped to ≥0; null if either date is missing. */
function leadDays(fromStr: string, toStr: string): number | null {
  const a = parseDate(fromStr), b = parseDate(toStr)
  if (!a || !b) return null
  const d = Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY)
  return d < 0 ? 0 : d
}
const avgOf = (a: number[]) => (a.length ? Math.round((sum(a) / a.length) * 10) / 10 : 0)

// Payment timeliness vs the (scheduled/tempo) due date.
//  • paid on/before due → On Time   • paid after due → Overdue (late)
//  • unpaid & past due → Overdue (ongoing)   • unpaid & not yet due → On Track
function timelinessOf(r: PaymentRequest, paidTime: string | undefined, now: number): { key: string; label: string } {
  const due = parseDate(r.payreqDuedate)
  const paid = r.payreqStatus === 'P' || !!paidTime
  if (!due) return paid ? { key: 'completed', label: 'Completed' } : { key: 'noDue', label: 'No Due Date' }
  const dueDay = startOfDay(due)
  if (paid) {
    const pt = paidTime ? parseDate(paidTime) : null
    if (!pt) return { key: 'onTime', label: 'On Time' }
    return startOfDay(pt) <= dueDay ? { key: 'onTime', label: 'On Time' } : { key: 'overdue', label: 'Overdue (late)' }
  }
  return now > dueDay ? { key: 'overdueOngoing', label: 'Overdue (ongoing)' } : { key: 'onTrack', label: 'On Track' }
}
const TIMELINESS_ORDER = ['On Time', 'On Track', 'Overdue (ongoing)', 'Overdue (late)', 'Completed', 'No Due Date']

export function computePoPayments(
  requests: PaymentRequest[],
  payments: FinancePayment[],
  logs: PaymentLog[],
  statusLabel: (id: string) => string,
  now: number,
) {
  const open = requests.filter(isApOpen)
  const totalOutstanding = sum(open.map(apOutstanding))
  const totalPaid = sum(payments.map((p) => p.pAmount))

  // Index the first payment date + first AN/Paid log timestamp per request.
  const ms = (s: string) => parseDate(s)?.getTime() ?? Infinity
  const firstPaymentAt = new Map<string, string>()
  for (const p of payments) {
    if (!p.pPayreqId) continue
    const cur = firstPaymentAt.get(p.pPayreqId)
    if (!cur || ms(p.pCreatedAt) < ms(cur)) firstPaymentAt.set(p.pPayreqId, p.pCreatedAt)
  }
  const anAt = new Map<string, string>()
  const paidLogAt = new Map<string, string>()
  for (const l of logs) {
    if (l.statusNew === 'AN') { const c = anAt.get(l.payreqId); if (!c || ms(l.createdAt) < ms(c)) anAt.set(l.payreqId, l.createdAt) }
    if (l.statusNew === 'P') { const c = paidLogAt.get(l.payreqId); if (!c || ms(l.createdAt) < ms(c)) paidLogAt.set(l.payreqId, l.createdAt) }
  }

  // Aging (outstanding only)
  const aging = AGING_BUCKETS.map((b) => ({ name: b.name, value: 0, count: 0 }))
  let overdue = 0
  for (const r of open) {
    const out = apOutstanding(r)
    if (out <= 0) continue
    const due = parseDate(r.payreqDuedate)
    const days = due ? Math.floor((now - startOfDay(due)) / MS_PER_DAY) : 0
    const idx = AGING_BUCKETS.findIndex((b) => days >= b.min && days <= b.max)
    if (idx >= 0) { aging[idx].value = round(aging[idx].value + out); aging[idx].count++ }
    if (days >= 1) overdue += out
  }

  const statusAgg: Record<string, number> = {}
  const poAgg: Record<string, number> = {}
  for (const r of open) {
    const out = apOutstanding(r)
    statusAgg[r.payreqStatus] = (statusAgg[r.payreqStatus] || 0) + out
    if (r.payreqPoId) poAgg[r.payreqPoId] = (poAgg[r.payreqPoId] || 0) + out
  }
  const byStatus = topN(statusAgg, 20, statusLabel)
  const topByPo = topN(poAgg, 10)
  const monthlyOutflow = byMonth(payments, (p) => p.pCreatedAt, (p) => p.pAmount)
  const largest = topByPo[0] || { name: '-', value: 0 }

  // Lead times, request duration, timeliness, tempo — over ALL requests.
  const leadAN: number[] = [], leadPaid: number[] = [], durations: number[] = []
  const timelinessAgg: Record<string, number> = {}
  let tempoCount = 0
  const rows = requests.map((r) => {
    const start = r.payreqNotify || r.payreqCreatedAt // notify_at, else created_at
    const anTime = anAt.get(r.payreqId)
    const paidTime = firstPaymentAt.get(r.payreqId) || paidLogAt.get(r.payreqId)
    const leadToAN = anTime ? leadDays(start, anTime) : null
    const leadToPaid = paidTime ? leadDays(start, paidTime) : null
    const requestDuration = leadDays(r.payreqCreatedAt, r.payreqDuedate)
    if (leadToAN != null) leadAN.push(leadToAN)
    if (leadToPaid != null) leadPaid.push(leadToPaid)
    if (requestDuration != null) durations.push(requestDuration)
    const isTempo = /tempo/i.test(r.payreqRemarks || '')
    if (isTempo) tempoCount++
    const t = timelinessOf(r, paidTime, now)
    timelinessAgg[t.label] = (timelinessAgg[t.label] || 0) + 1
    return {
      payreqId: r.payreqId,
      poId: r.payreqPoId || '-',
      invoiceNumber: r.payreqInvoiceNumber || '-',
      dueDate: r.payreqDuedate,
      amount: r.payreqAmount,
      paid: r.payreqPayAmount,
      outstanding: apOutstanding(r),
      daysOverdue: daysOverdue(r.payreqDuedate, now),
      statusLabel: statusLabel(r.payreqStatus),
      timeliness: t.label,
      timelinessKey: t.key,
      isTempo,
      leadToAN,
      leadToPaid,
      requestDuration,
      createdAt: r.payreqCreatedAt,
      createdBy: r.payreqCreatedBy,
    }
  }).sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))

  const onTime = timelinessAgg['On Time'] || 0
  const latePaid = timelinessAgg['Overdue (late)'] || 0
  const timelinessBreakdown = TIMELINESS_ORDER
    .filter((k) => timelinessAgg[k])
    .map((k) => ({ name: k, value: timelinessAgg[k] }))

  return {
    kpis: {
      totalOutstanding: round(totalOutstanding),
      overdue: round(overdue),
      pctOverdue: pct(overdue, totalOutstanding),
      openCount: open.length,
      pendingApproval: requests.filter((r) => r.payreqStatus === 'C').length,
      totalPaid: round(totalPaid),
      totalRequests: requests.length,
      largestExposure: largest.value,
      largestExposurePo: largest.name,
      // lead times (days)
      avgLeadToApproval: avgOf(leadAN),
      leadToApprovalCount: leadAN.length,
      avgLeadToPaid: avgOf(leadPaid),
      leadToPaidCount: leadPaid.length,
      avgRequestDuration: avgOf(durations),
      // timeliness + tempo
      onTimeRate: pct(onTime, onTime + latePaid),
      tempoCount,
    },
    aging,
    byStatus,
    topByPo,
    monthlyOutflow,
    timelinessBreakdown,
    rows,
  }
}

// ════════════════════════ PAYROLL ════════════════════════
export function computePayroll(
  payroll: Payroll[],
  payments: PayrollPayment[],
  lists: PayrollListItem[],
  statusLabel: (id: string) => string,
  categoryLabel: (id: string) => string,
  typeIsPositive: (id: string) => boolean,
) {
  const thpRows = payroll.filter((p) => p.takeHomePay > 0)
  const totalReceipts = sum(payroll.map((p) => p.totalReceipts)) // gross "penerimaan"
  const totalThp = sum(payroll.map((p) => p.takeHomePay))
  const totalReleased = sum(payroll.map((p) => p.releasedPrice))
  const totalDisbursed = sum(payments.map((p) => p.amount)) // money actually transferred

  // Disbursed per slip (join on id_payroll), and released-but-unpaid backlog.
  const paidByPayroll: Record<string, number> = {}
  for (const p of payments) paidByPayroll[p.payrollId] = (paidByPayroll[p.payrollId] || 0) + p.amount
  const releasedUnpaid = payroll.filter((p) => p.releasedPrice > 0 && !(paidByPayroll[p.idPayroll] > 0))
  const releasedUnpaidTotal = sum(releasedUnpaid.map((p) => p.releasedPrice))

  // Status breakdown
  const statusAgg: Record<string, number> = {}
  for (const p of payroll) statusAgg[p.status] = (statusAgg[p.status] || 0) + 1
  const statusBreakdown = Object.entries(statusAgg)
    .map(([k, v]) => ({ name: statusLabel(k), value: v }))
    .sort((a, b) => b.value - a.value)

  // Additions vs reductions (payroll_lists × payroll_types.positive)
  const addAgg: Record<string, number> = {}
  const redAgg: Record<string, number> = {}
  for (const l of lists) {
    if (typeIsPositive(l.typeId)) addAgg[l.categoryId] = (addAgg[l.categoryId] || 0) + l.amount
    else redAgg[l.categoryId] = (redAgg[l.categoryId] || 0) + l.amount
  }
  const totalAdditions = sum(Object.values(addAgg))
  const totalReductions = sum(Object.values(redAgg))
  const topAdditions = topN(addAgg, 10, categoryLabel)
  const topReductions = topN(redAgg, 10, categoryLabel)

  // Monthly THP / released / disbursed (disbursed bucketed by slip period via join)
  const thpByMonth = byMonth(payroll, (p) => p.startDate, (p) => p.takeHomePay)
  const releasedByMonth = byMonth(payroll, (p) => p.startDate, (p) => p.releasedPrice)
  const disbursedByMonth = byMonth(payroll, (p) => p.startDate, (p) => paidByPayroll[p.idPayroll] || 0)
  const monthly = mergeMonthly([
    ['THP', thpByMonth], ['Released', releasedByMonth], ['Disbursed', disbursedByMonth],
  ])

  // THP distribution
  const dist = [
    { name: '< 1M', value: 0 }, { name: '1-2M', value: 0 }, { name: '2-5M', value: 0 },
    { name: '5-10M', value: 0 }, { name: '> 10M', value: 0 },
  ]
  for (const p of thpRows) {
    const v = p.takeHomePay
    const i = v < 1e6 ? 0 : v < 2e6 ? 1 : v < 5e6 ? 2 : v < 1e7 ? 3 : 4
    dist[i].value++
  }

  const rows = payroll
    .map((p) => {
      const disbursed = paidByPayroll[p.idPayroll] || 0
      const payStatus = p.releasedPrice <= 0 ? '-'
        : disbursed === 0 ? 'Unpaid'
        : disbursed + 1 < p.releasedPrice ? 'Short'
        : disbursed > p.releasedPrice + 1 ? 'Over' : 'Paid'
      // payroll periods vary — some weekly, some monthly; infer from the start→end span.
      const sp = parseDate(p.startDate), ep = parseDate(p.endDate)
      const spanDays = sp && ep ? Math.round((ep.getTime() - sp.getTime()) / MS_PER_DAY) : 30
      return {
        employee: p.userId,
        period: p.description || `${p.startDate} – ${p.endDate}`,
        periodType: spanDays <= 10 ? 'Weekly' : 'Monthly',
        startDate: p.startDate,
        endDate: p.endDate,
        statusLabel: statusLabel(p.status),
        receipts: p.totalReceipts,
        reductions: p.thpReduction,
        takeHomePay: p.takeHomePay,
        released: p.releasedPrice,
        disbursed,
        payStatus,
      }
    })
    .sort((a, b) => (parseDate(b.startDate)?.getTime() || 0) - (parseDate(a.startDate)?.getTime() || 0))

  return {
    kpis: {
      totalReceipts: round(totalReceipts),
      totalThp: round(totalThp),
      totalDisbursed: round(totalDisbursed),
      totalReleased: round(totalReleased),
      // "kurang" — money still owed: per-slip (released − disbursed), positive gaps only
      // (so an over-disbursed slip can't mask an under-paid one).
      shortfall: round(sum(payroll.map((p) => Math.max(0, p.releasedPrice - (paidByPayroll[p.idPayroll] || 0))))),
      releasedUnpaid: round(releasedUnpaidTotal),
      releasedUnpaidCount: releasedUnpaid.length,
      payslips: payroll.length,
      employees: new Set(payroll.map((p) => p.userId)).size,
      avgThp: thpRows.length ? round(totalThp / thpRows.length) : 0,
      medianThp: median(thpRows.map((p) => p.takeHomePay)),
      totalReductions: round(totalReductions),
      totalAdditions: round(totalAdditions),
      disbursementCoverage: pct(totalDisbursed, totalReleased),
    },
    statusBreakdown,
    topAdditions,
    topReductions,
    monthly,
    distribution: dist,
    rows,
  }
}

// ════════════════════════ MEAL BENEFITS ════════════════════════
export function computeMeal(
  benefits: MealBenefit[],
  releases: MealBenefitRelease[],
  typeLabel: (id: string) => string,
) {
  const approved = benefits.filter((b) => b.status === 'A')
  const totalApproved = sum(approved.map((b) => b.total))

  // Net released per mb_id (R positive, P negative — only typed rows)
  const relByMb: Record<string, number> = {}
  let netReleased = 0
  for (const r of releases) {
    if (r.type !== 'R' && r.type !== 'P') continue
    relByMb[r.mbId] = (relByMb[r.mbId] || 0) + r.amount
    netReleased += r.amount
  }
  const outstanding = totalApproved - netReleased

  // By type, by project
  const typeAgg: Record<string, number> = {}
  const projAgg: Record<string, number> = {}
  for (const b of approved) {
    typeAgg[b.type] = (typeAgg[b.type] || 0) + b.total
    if (b.projectId) projAgg[b.projectId] = (projAgg[b.projectId] || 0) + b.total
  }
  const byType = topN(typeAgg, 12, typeLabel)
  const topProjects = topN(projAgg, 10)
  const approvedByMonth = byMonth(approved, (b) => b.date, (b) => b.total)

  const rows = approved
    .map((b) => {
      const released = relByMb[b.mbId] || 0
      return {
        mbId: b.mbId,
        date: b.date,
        typeLabel: typeLabel(b.type),
        projectId: b.projectId || '-',
        zone: b.zone || '(unassigned)',
        users: b.totalUser,
        days: b.totalDays,
        approvedAmount: b.total,
        released: round(released),
        outstanding: round(b.total - released),
        requestedBy: b.userId || '-',
      }
    })
    .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))

  return {
    kpis: {
      totalApproved: round(totalApproved),
      netReleased: round(netReleased),
      outstanding: round(outstanding),
      releaseRate: pct(netReleased, totalApproved),
      approvedRequests: approved.length,
      avgPerRequest: approved.length ? round(totalApproved / approved.length) : 0,
      beneficiaries: round(sum(approved.map((b) => b.totalUser))),
      approvalRate: pct(approved.length, benefits.length),
    },
    byType,
    topProjects,
    approvedByMonth,
    rows,
  }
}

// ════════════════════════ LOANS ════════════════════════
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function computeLoans(loans: Loan[], repayments: Repayment[], borrowerName: (id: string) => string, now = Date.now()) {
  const repaidByLoan: Record<string, number> = {}
  for (const r of repayments) repaidByLoan[r.loanId] = (repaidByLoan[r.loanId] || 0) + r.amount

  const totalDisbursed = sum(loans.map((l) => l.amount))
  const totalRepaid = sum(repayments.map((r) => r.amount))

  let totalOutstanding = 0
  let active = 0
  const outByBorrower: Record<string, number> = {}
  const rows = loans
    .map((l) => {
      const repaid = repaidByLoan[l.loanId] || 0
      const outstanding = Math.max(0, l.amount - repaid)
      if (outstanding > 0.5) { active++; outByBorrower[l.userId] = (outByBorrower[l.userId] || 0) + outstanding }
      totalOutstanding += outstanding
      return {
        loanId: l.loanId,
        date: l.date,
        borrower: borrowerName(l.userId),
        amount: l.amount,
        tenor: l.tenor,
        repaid: round(repaid),
        outstanding: round(outstanding),
        progress: pct(repaid, l.amount),
        statusLabel: outstanding <= 0.5 ? 'Settled' : 'Active',
        remarks: l.remarks || '-',
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding)

  const topBorrowers = topN(outByBorrower, 10)
  const monthlyRepayment = byMonth(repayments, (r) => r.date, (r) => r.amount)
  const monthlyDisbursement = byMonth(loans, (l) => l.date, (l) => l.amount)
  const monthly = mergeMonthly([['Disbursed', monthlyDisbursement], ['Repaid', monthlyRepayment]])

  // ── Repayment forecast ──
  // Employee loans are recovered via monthly payroll deduction (installment ≈ amount/tenor).
  // Project each active loan's remaining balance forward at its installment rate over the
  // next 12 months → expected monthly collection inflow.
  const HORIZON = 12
  const base = new Date(now)
  const forecast = Array.from({ length: HORIZON }, (_, i) => {
    const m = new Date(base.getFullYear(), base.getMonth() + 1 + i, 1) // start next month
    return { name: `${MONTH_LABELS[m.getMonth()]} ${m.getFullYear()}`, value: 0 }
  })
  let expectedMonthly = 0
  let maxMonthsToClear = 0
  for (const l of loans) {
    const repaid = repaidByLoan[l.loanId] || 0
    let remaining = Math.max(0, l.amount - repaid)
    if (remaining <= 0.5 || l.tenor <= 0) continue
    const installment = l.amount / l.tenor
    if (installment <= 0) continue
    const monthsLeft = Math.ceil(remaining / installment)
    maxMonthsToClear = Math.max(maxMonthsToClear, monthsLeft)
    for (let i = 0; i < HORIZON && remaining > 0.5; i++) {
      const pay = Math.min(installment, remaining)
      forecast[i].value += pay
      remaining -= pay
    }
  }
  for (const f of forecast) f.value = round(f.value)
  expectedMonthly = forecast[0]?.value || 0

  return {
    kpis: {
      totalDisbursed: round(totalDisbursed),
      totalRepaid: round(totalRepaid),
      outstanding: round(totalOutstanding),
      activeLoans: active,
      loanCount: loans.length,
      repaymentProgress: pct(totalRepaid, totalDisbursed),
      borrowers: new Set(loans.map((l) => l.userId)).size,
      avgLoanSize: loans.length ? round(totalDisbursed / loans.length) : 0,
      medianTenor: median(loans.map((l) => l.tenor)),
      expectedMonthly,
      monthsToClear: maxMonthsToClear,
    },
    topBorrowers,
    monthly,
    forecast,
    rows,
  }
}

// ════════════════════════ REIMBURSE (petty cash) ════════════════════════
export const REIMBURSE_CATEGORY: Record<string, string> = {
  O: 'Office Expense', S: 'Operational Service', M: 'Materials & Tools', R: 'Repairs & Utilities',
}
export function reimburseCategory(typeId: string): string {
  if (!typeId) return 'Uncategorized'
  return REIMBURSE_CATEGORY[typeId.split('-')[0].toUpperCase()] || `Other (${typeId})`
}

export function computeReimburse(
  cashIn: ReimburseCashIn[],
  cashOut: ReimburseCashOut[],
  statusLabel: (id: string) => string,
  projectLabel: (id: string) => string,
) {
  const inApproved = cashIn.filter((r) => r.reimburseStatus === 'A')
  const outApproved = cashOut.filter((r) => r.reimburseStatus === 'A')
  const totalIn = sum(inApproved.map((r) => r.reimburseAmount))
  const totalOut = sum(outApproved.map((r) => r.reimburseAmount))

  const catAgg: Record<string, number> = {}
  const projAgg: Record<string, number> = {}
  const empAgg: Record<string, number> = {}
  for (const r of outApproved) {
    const cat = reimburseCategory(r.reimburseTypeIdFk)
    catAgg[cat] = (catAgg[cat] || 0) + r.reimburseAmount
    if (r.reimbursePrjIdFk) projAgg[r.reimbursePrjIdFk] = (projAgg[r.reimbursePrjIdFk] || 0) + r.reimburseAmount
    const emp = r.reimburseUserName || r.reimburseUserIdFk || 'Unknown'
    empAgg[emp] = (empAgg[emp] || 0) + r.reimburseAmount
  }
  const categoryBreakdown = topN(catAgg, 12, (k) => k)
  const topProjects = topN(projAgg, 10, projectLabel)
  const topEmployees = topN(empAgg, 10, (k) => k)

  // Monthly in/out + running balance
  const inByMonth = byMonth(inApproved, (r) => r.reimburseDate, (r) => r.reimburseAmount)
  const outByMonth = byMonth(outApproved, (r) => r.reimburseDate, (r) => r.reimburseAmount)
  const merged = mergeMonthly([['CashIn', inByMonth], ['CashOut', outByMonth]])
  let running = 0
  const monthly = merged.map((m) => {
    running += (Number(m.CashIn) || 0) - (Number(m.CashOut) || 0)
    return { ...m, Balance: round(running) }
  })

  const rows = outApproved
    .map((r) => ({
      reimburseId: r.reimburseId,
      date: r.reimburseDate,
      projectName: r.reimburseProjectName || projectLabel(r.reimbursePrjIdFk) || '-',
      description: r.reimburseDescription,
      category: reimburseCategory(r.reimburseTypeIdFk),
      amount: r.reimburseAmount,
      statusLabel: statusLabel(r.reimburseStatus),
      employeeName: r.reimburseUserName || r.reimburseUserIdFk,
      image: r.reimburseImage || null,
    }))
    .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))

  return {
    kpis: {
      balance: round(totalIn - totalOut),
      totalIn: round(totalIn),
      totalOut: round(totalOut),
      pending: cashOut.filter((r) => r.reimburseStatus === 'P').length + cashIn.filter((r) => r.reimburseStatus === 'P').length,
      approvedClaims: outApproved.length,
      avgTicket: outApproved.length ? round(totalOut / outApproved.length) : 0,
    },
    categoryBreakdown,
    topProjects,
    topEmployees,
    monthly,
    rows,
  }
}

// ════════════════════════ OVERVIEW (cross-stream) ════════════════════════
export interface StreamOutflow { stream: string; outflow: number; outstanding: number; records: number }

export function computeOverview(streams: {
  poPaid: number; apOutstanding: number; apRecords: number;
  payrollDisbursed: number; payrollUnpaid: number; payslips: number;
  reimburseOut: number; reimburseBalance: number; reimburseClaims: number;
  mealReleased: number; mealRequests: number;
  loansDisbursed: number; loansOutstanding: number; loanCount: number;
  pendingAp: number;
}) {
  const composition: StreamOutflow[] = [
    { stream: 'PO Payments', outflow: streams.poPaid, outstanding: streams.apOutstanding, records: streams.apRecords },
    { stream: 'Payroll', outflow: streams.payrollDisbursed, outstanding: streams.payrollUnpaid, records: streams.payslips },
    { stream: 'Reimburse', outflow: streams.reimburseOut, outstanding: 0, records: streams.reimburseClaims },
    { stream: 'Loans', outflow: streams.loansDisbursed, outstanding: streams.loansOutstanding, records: streams.loanCount },
    { stream: 'Meal Benefits', outflow: streams.mealReleased, outstanding: 0, records: streams.mealRequests },
  ].sort((a, b) => b.outflow - a.outflow)

  const totalOutflow = sum(composition.map((c) => c.outflow))
  const totalOutstanding = streams.apOutstanding + streams.loansOutstanding + streams.payrollUnpaid

  return {
    kpis: {
      totalOutflow: round(totalOutflow),
      totalOutstanding: round(totalOutstanding),
      apOutstanding: round(streams.apOutstanding),
      loansOutstanding: round(streams.loansOutstanding),
      payrollDisbursed: round(streams.payrollDisbursed),
      pettyCashBalance: round(streams.reimburseBalance),
      pendingAp: streams.pendingAp,
    },
    composition: composition.map((c) => ({ ...c, outflow: round(c.outflow), pctOutflow: pct(c.outflow, totalOutflow) })),
    outstandingByStream: composition
      .filter((c) => c.outstanding > 0)
      .map((c) => ({ name: c.stream, value: round(c.outstanding) }))
      .sort((a, b) => b.value - a.value),
  }
}

// ── merge several monthly [{name,value}] series into [{name, <series>:value}] ──
type MonthRow = { name: string; [series: string]: number | string }
export function mergeMonthly(series: [string, { name: string; value: number }[]][]): MonthRow[] {
  const order: string[] = []
  const map: Record<string, MonthRow> = {}
  for (const [key, rows] of series) {
    for (const r of rows) {
      if (!map[r.name]) { map[r.name] = { name: r.name }; order.push(r.name) }
      map[r.name][key] = r.value
    }
  }
  // keep chronological order from the first non-empty series via sortByPeriod
  const agg: Record<string, number> = {}
  for (const name of order) agg[name] = 0
  return sortByPeriod(agg, 'monthly').map(([name]) => {
    const row = map[name]
    for (const [key] of series) if (row[key] == null) row[key] = 0
    return row
  })
}
