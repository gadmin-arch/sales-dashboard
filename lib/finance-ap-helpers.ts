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
  MealBenefit, MealBenefitDetail, MealBenefitRelease, MealBenefitEvidence,
  TravelAllowance, UserTerStatus, TerRate, Occupation, SalesUser,
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

/** Monthly average [{name,value}] (chronological) from items, averaging valueOf bucketed by dateOf. */
export function avgByMonth<T>(items: T[], dateOf: (t: T) => string, valueOf: (t: T) => number | null): { name: string; value: number }[] {
  const sumAgg: Record<string, number> = {}
  const countAgg: Record<string, number> = {}
  for (const it of items) {
    const val = valueOf(it)
    if (val == null) continue
    const k = formatMonth(dateOf(it))
    if (!k) continue
    sumAgg[k] = (sumAgg[k] || 0) + val
    countAgg[k] = (countAgg[k] || 0) + 1
  }
  const avgAgg: Record<string, number> = {}
  for (const k in sumAgg) {
    avgAgg[k] = countAgg[k] > 0 ? round(sumAgg[k] / countAgg[k] * 10) / 10 : 0
  }
  return sortByPeriod(avgAgg, 'monthly').map(([name, value]) => ({ name, value }))
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

export function leadHours(fromStr: string, toStr: string): number | null {
  const a = parseDate(fromStr), b = parseDate(toStr)
  if (!a || !b) return null
  const diffMs = b.getTime() - a.getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return hours < 0 ? 0 : hours
}

export function bucketDuration(valuesInHours: number[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {
    '< 2 Hours': 0,
    '2 - 12 Hours': 0,
    '12 - 24 Hours': 0,
    '1 - 3 Days': 0,
    '> 3 Days': 0,
  }
  for (const h of valuesInHours) {
    if (h < 2) counts['< 2 Hours']++
    else if (h < 12) counts['2 - 12 Hours']++
    else if (h < 24) counts['12 - 24 Hours']++
    else if (h < 72) counts['1 - 3 Days']++
    else counts['> 3 Days']++
  }
  const DURATION_BUCKETS = ['< 2 Hours', '2 - 12 Hours', '12 - 24 Hours', '1 - 3 Days', '> 3 Days']
  return DURATION_BUCKETS.map((name) => ({ name, value: counts[name] }))
}

export function bucketDueToPaid(valuesInHours: number[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {
    'On Time / Early': 0,
    '0 - 2 Days': 0,
    '2 - 7 Days': 0,
    '7 - 30 Days': 0,
    '> 30 Days': 0,
  }
  for (const h of valuesInHours) {
    if (h <= 0) {
      counts['On Time / Early']++
    } else {
      const d = h / 24
      if (d <= 2) counts['0 - 2 Days']++
      else if (d <= 7) counts['2 - 7 Days']++
      else if (d <= 30) counts['7 - 30 Days']++
      else counts['> 30 Days']++
    }
  }
  const BUCKETS = ['On Time / Early', '0 - 2 Days', '2 - 7 Days', '7 - 30 Days', '> 30 Days']
  return BUCKETS.map((name) => ({ name, value: counts[name] }))
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
export function timelinessOf(r: PaymentRequest, paidTime: string | undefined, now: number, adjustedDueDateStr?: string): { key: string; label: string } {
  if (r.payreqStatus === 'CC' || r.payreqStatus === 'RF') {
    return { key: 'completed', label: 'Completed' }
  }
  const noNotify = !r.payreqNotify || r.payreqNotify === 'undefined'
  if (r.payreqStatus === 'C' && noNotify) {
    return { key: 'onTrack', label: 'On Track' }
  }
  const due = parseDate(adjustedDueDateStr || r.payreqDuedate)
  const paid = r.payreqStatus === 'P' || !!paidTime
  if (!due) return paid ? { key: 'completed', label: 'Completed' } : { key: 'noDue', label: 'No Due Date' }
  const dueDay = startOfDay(due)
  if (paid) {
    const pt = paidTime ? parseDate(paidTime) : null
    if (!pt) return { key: 'onTime', label: 'On Time' }
    return startOfDay(pt) <= dueDay ? { key: 'onTime', label: 'On Time' } : { key: 'overdue', label: 'Overdue (late)' }
  }
  return now > due.getTime() ? { key: 'overdueOngoing', label: 'Overdue (ongoing)' } : { key: 'onTrack', label: 'On Track' }
}
const TIMELINESS_ORDER = ['On Time', 'On Track', 'Overdue (ongoing)', 'Overdue (late)', 'Completed', 'No Due Date']

function isNationalHoliday(date: Date): boolean {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const ymd = `${y}-${m}-${d}`

  const HOLIDAYS = new Set([
    // 2024
    '2024-01-01', '2024-02-08', '2024-02-09', '2024-02-10', '2024-03-11',
    '2024-03-12', '2024-03-29', '2024-03-31', '2024-04-08', '2024-04-09',
    '2024-04-10', '2024-04-11', '2024-04-12', '2024-04-15', '2024-05-01',
    '2024-05-09', '2024-05-10', '2024-05-23', '2024-05-24', '2024-06-01',
    '2024-06-17', '2024-06-18', '2024-07-07', '2024-08-17', '2024-09-16',
    '2024-12-25', '2024-12-26',

    // 2025
    '2025-01-01', '2025-01-27', '2025-01-29', '2025-03-28', '2025-03-29',
    '2025-03-31', '2025-04-01', '2025-04-02', '2025-04-03', '2025-04-18',
    '2025-04-20', '2025-05-01', '2025-05-12', '2025-05-13', '2025-05-29',
    '2025-05-30', '2025-06-01', '2025-06-06', '2025-06-09', '2025-06-27',
    '2025-08-17', '2025-09-05', '2025-12-25', '2025-12-26',

    // 2026
    '2026-01-01', '2026-01-15', '2026-02-17', '2026-03-18', '2026-03-19',
    '2026-03-20', '2026-03-21', '2026-03-23', '2026-03-24', '2026-04-03',
    '2026-04-05', '2026-05-01', '2026-05-14', '2026-05-15', '2026-05-25',
    '2026-05-26', '2026-06-01', '2026-05-27', '2026-05-28', '2026-06-16',
    '2026-08-17', '2026-08-25', '2026-12-25', '2026-12-26'
  ])

  return HOLIDAYS.has(ymd)
}

function getNextWorkingDay(date: Date): Date {
  const next = new Date(date)
  while (true) {
    next.setDate(next.getDate() + 1)
    const day = next.getDay()
    if (day !== 0 && day !== 6 && !isNationalHoliday(next)) {
      break
    }
  }
  return next
}

export function adjustDueDate(dueDateStr: string, notifyDateStr?: string): string {
  if (!dueDateStr) return ''
  const current = parseDate(dueDateStr)
  if (!current) return dueDateStr

  let targetDate = current
  if (notifyDateStr) {
    const notify = parseDate(notifyDateStr)
    if (notify && notify.getTime() > current.getTime()) {
      targetDate = new Date(notify.getTime() + 2 * 60 * 60 * 1000)
    }
  }

  const hours = targetDate.getHours()
  const minutes = targetDate.getMinutes()
  const seconds = targetDate.getSeconds()

  const isAfter5PM = (hours > 17) || (hours === 17 && (minutes > 0 || seconds > 0))

  if (isAfter5PM) {
    const fivePM = new Date(targetDate)
    fivePM.setHours(17, 0, 0, 0)
    const exceededMs = targetDate.getTime() - fivePM.getTime()

    const maxAddedMs = 2 * 60 * 60 * 1000
    const addedMs = Math.min(exceededMs, maxAddedMs)

    const nextDay = getNextWorkingDay(targetDate)
    const result = new Date(nextDay)
    result.setHours(8, 0, 0, 0)
    const finalDate = new Date(result.getTime() + addedMs)
    
    return `${finalDate.getMonth() + 1}/${finalDate.getDate()}/${finalDate.getFullYear()} ${String(finalDate.getHours()).padStart(2, '0')}:${String(finalDate.getMinutes()).padStart(2, '0')}:${String(finalDate.getSeconds()).padStart(2, '0')}`
  }

  const day = targetDate.getDay()
  if (day === 0 || day === 6 || isNationalHoliday(targetDate)) {
    const nextDay = getNextWorkingDay(targetDate)
    const result = new Date(nextDay)
    result.setHours(8, 0, 0, 0)
    return `${result.getMonth() + 1}/${result.getDate()}/${result.getFullYear()} 08:00:00`
  }

  if (targetDate !== current) {
    return `${targetDate.getMonth() + 1}/${targetDate.getDate()}/${targetDate.getFullYear()} ${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}:${String(targetDate.getSeconds()).padStart(2, '0')}`
  }

  return dueDateStr
}

export function computePoPayments(
  requests: PaymentRequest[],
  payments: FinancePayment[],
  logs: PaymentLog[],
  statusLabel: (id: string) => string,
  now: number,
  employeeName: (id: string) => string = (id) => id,
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
    const adjustedDueStr = adjustDueDate(r.payreqDuedate, r.payreqNotify)
    const due = parseDate(adjustedDueStr)
    const isCreatedNoNotify = r.payreqStatus === 'C' && (!r.payreqNotify || r.payreqNotify === 'undefined')
    const days = (due && !isCreatedNoNotify) ? Math.floor((now - startOfDay(due)) / MS_PER_DAY) : 0
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
  const reqToApprovalList: number[] = []
  const reqToPaidList: number[] = []
  const approvalToPaidList: number[] = []
  const reqToDueList: number[] = []
  const overdueDaysList: number[] = []
  const dueToPaidList: number[] = []

  const reqToApprovalHours: number[] = []
  const reqToPaidHours: number[] = []
  const approvalToPaidHours: number[] = []
  const reqToDueHours: number[] = []
  const overdueHoursList: number[] = []
  const dueToPaidHoursList: number[] = []

  const timelinessAgg: Record<string, number> = {}
  let tempoCount = 0
  const rows = requests.map((r) => {
    const adjustedDueDateStr = adjustDueDate(r.payreqDuedate, r.payreqNotify)
    const reqStart = (r.payreqNotify && r.payreqNotify !== 'undefined') ? r.payreqNotify : r.payreqCreatedAt
    const anTime = anAt.get(r.payreqId)
    const paidTime = firstPaymentAt.get(r.payreqId) || paidLogAt.get(r.payreqId)
    
    // 1. Req → Approval
    const leadToAN = anTime ? leadDays(reqStart, anTime) : null
    if (leadToAN != null) reqToApprovalList.push(leadToAN)
    const hoursToApproval = anTime ? leadHours(reqStart, anTime) : null
    if (hoursToApproval != null) reqToApprovalHours.push(hoursToApproval)

    // 2. Req → Paid
    const leadToPaid = paidTime ? leadDays(reqStart, paidTime) : null
    if (leadToPaid != null) reqToPaidList.push(leadToPaid)
    const hoursToPaid = paidTime ? leadHours(reqStart, paidTime) : null
    if (hoursToPaid != null) reqToPaidHours.push(hoursToPaid)

    // 3. Approval → Paid
    const approvalToPaid = (anTime && paidTime) ? leadDays(anTime, paidTime) : null
    if (approvalToPaid != null) approvalToPaidList.push(approvalToPaid)
    const hoursApprovalToPaid = (anTime && paidTime) ? leadHours(anTime, paidTime) : null
    if (hoursApprovalToPaid != null) approvalToPaidHours.push(hoursApprovalToPaid)

    // 4. Req → Due
    const requestDuration = leadDays(reqStart, adjustedDueDateStr)
    if (requestDuration != null) reqToDueList.push(requestDuration)
    const hoursToDue = leadHours(reqStart, adjustedDueDateStr)
    if (hoursToDue != null) reqToDueHours.push(hoursToDue)

    const isTempo = /tempo/i.test(r.payreqRemarks || '')
    if (isTempo) tempoCount++
    const t = timelinessOf(r, paidTime, now, adjustedDueDateStr)
    timelinessAgg[t.label] = (timelinessAgg[t.label] || 0) + 1

    let overdueDays = 0
    let hoursOverdue = null
    const due = parseDate(adjustedDueDateStr)
    if (t.label === 'Overdue (late)' && paidTime) {
      const pt = parseDate(paidTime)
      if (pt && due) {
        overdueDays = Math.max(0, Math.floor((startOfDay(pt) - startOfDay(due)) / MS_PER_DAY))
        hoursOverdue = Math.max(0, (pt.getTime() - due.getTime()) / (1000 * 60 * 60))
        if (overdueDays > 0) overdueDaysList.push(overdueDays)
        if (hoursOverdue != null && hoursOverdue > 0) overdueHoursList.push(hoursOverdue)
      }
    } else if (t.label === 'Overdue (ongoing)') {
      if (due) {
        overdueDays = Math.max(0, Math.floor((now - startOfDay(due)) / MS_PER_DAY))
        hoursOverdue = Math.max(0, (now - due.getTime()) / (1000 * 60 * 60))
      }
    }

    let dueToPaidHours = null
    const dueToPaidDays = (paidTime && due) ? leadDays(adjustedDueDateStr, paidTime) : null
    if (dueToPaidDays != null) dueToPaidList.push(dueToPaidDays)

    if (paidTime && due) {
      const pt = parseDate(paidTime)
      if (pt) dueToPaidHours = (pt.getTime() - due.getTime()) / (1000 * 60 * 60)
    }
    if (dueToPaidHours != null) dueToPaidHoursList.push(dueToPaidHours)

    return {
      payreqId: r.payreqId,
      poId: r.payreqPoId || '-',
      invoiceNumber: r.payreqInvoiceNumber || '-',
      dueDate: adjustedDueDateStr,
      amount: r.payreqAmount,
      paid: r.payreqPayAmount,
      outstanding: apOutstanding(r),
      daysOverdue: overdueDays,
      statusLabel: statusLabel(r.payreqStatus),
      timeliness: t.label,
      timelinessKey: t.key,
      isTempo,
      tempoType: isTempo ? 'Tempo' : 'Non-Deferred',
      leadToAN,
      leadToPaid,
      approvalToPaid,
      requestDuration,
      hoursToApproval,
      hoursToPaid,
      hoursApprovalToPaid,
      hoursToDue,
      hoursOverdue,
      dueToPaidHours,
      createdAt: r.payreqCreatedAt,
      createdBy: employeeName(r.payreqCreatedBy) || r.payreqCreatedBy || '-',
    }
  }).sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))

  const onTime = timelinessAgg['On Time'] || 0
  const latePaid = timelinessAgg['Overdue (late)'] || 0
  const timelinessBreakdown = TIMELINESS_ORDER
    .filter((k) => timelinessAgg[k])
    .map((k) => ({ name: k, value: timelinessAgg[k] }))

  const avgReqToApproval = avgOf(reqToApprovalList)
  const avgReqToPaid = avgOf(reqToPaidList)
  const avgApprovalToPaid = avgOf(approvalToPaidList)
  const avgReqToDue = avgOf(reqToDueList)
  const avgOverdue = avgOf(overdueDaysList)
  const avgDueToPaid = avgOf(dueToPaidList)

  const leadTimes = [
    { name: 'Req → Approval', value: avgReqToApproval },
    { name: 'Req → Paid', value: avgReqToPaid },
    { name: 'Approval → Paid', value: avgApprovalToPaid },
    { name: 'Req → Due (Term)', value: avgReqToDue },
    { name: 'Avg Overdue', value: avgOverdue },
    { name: 'Due → Paid', value: avgDueToPaid },
  ]

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
      avgReqToApproval,
      leadToApprovalCount: reqToApprovalList.length,
      avgReqToPaid,
      leadToPaidCount: reqToPaidList.length,
      avgApprovalToPaid,
      avgReqToDue,
      avgOverdue,
      avgDueToPaid,
      // timeliness + tempo
      onTimeRate: pct(onTime, onTime + latePaid),
      tempoCount,
    },
    aging,
    byStatus,
    topByPo,
    monthlyOutflow,
    payments: payments.map(p => ({ payreqId: p.pPayreqId, date: p.pCreatedAt, amount: p.pAmount })),
    timelinessBreakdown,
    leadTimes,
    trendReqToApproval: bucketDuration(reqToApprovalHours),
    trendReqToPaid: bucketDuration(reqToPaidHours),
    trendApprovalToPaid: bucketDuration(approvalToPaidHours),
    trendReqToDue: bucketDuration(reqToDueHours),
    trendOverdue: bucketDuration(overdueHoursList),
    trendDueToPaid: bucketDueToPaid(dueToPaidHoursList),
    rows,
  }
}

// ════════════════════════ PAYROLL ════════════════════════
function calculateTerRate(gross: number, category: string, terRates: TerRate[]): number {
  if (gross <= 0) return 0
  const match = terRates.find(r => r.status === category && gross >= r.lowerLimit && gross < (r.upperLimit || Infinity))
  if (match) {
    return match.percentage
  }
  return 0
}

export function computePayroll(
  payroll: Payroll[],
  payments: PayrollPayment[],
  lists: PayrollListItem[],
  statusLabel: (id: string) => string,
  categoryLabel: (id: string) => string,
  typeIsPositive: (id: string) => boolean,
  loans: Loan[],
  repayments: Repayment[],
  employeeName: (id: string) => string = (id) => id,
  payrollTypeName: (id: string) => string = (id) => id,
  travelAllowances: TravelAllowance[] = [],
  userTerStatuses: UserTerStatus[] = [],
  terRates: TerRate[] = [],
  occupations: Occupation[] = [],
  salesUsers: SalesUser[] = [],
  reimburseCashOut: ReimburseCashOut[] = [],
  mealDetails: MealBenefitDetail[] = [],
  getPayrollTypeInfo?: (id: string) => { name: string; positive: boolean; takehomepay_status: boolean; receipt_status: boolean; tax_status: boolean },
  mealBenefits: MealBenefit[] = [],
  getMbTypeLabel: (id: string) => string = (id) => id
) {
  // Disbursed per slip (join on id_payroll)
  const paidByPayroll: Record<string, number> = {}
  for (const p of payments) paidByPayroll[p.payrollId] = (paidByPayroll[p.payrollId] || 0) + p.amount

  const listItemsByPayroll: Record<string, PayrollListItem[]> = {}
  for (const l of lists) {
    if (!listItemsByPayroll[l.payrollId]) listItemsByPayroll[l.payrollId] = []
    listItemsByPayroll[l.payrollId].push(l)
  }

  // Pre-adjust payroll rows with THP loans and repayments
  const adjustedPayroll = payroll.map((p) => {
    const pStart = parseDate(p.startDate)
    const pEnd = parseDate(p.endDate)
    let loanThp = 0
    let repayThp = 0
    if (pStart && pEnd) {
      const matchingLoans = loans.filter((l) => {
        if (l.userId !== p.userId) return false
        const isThp = l.thp === 'P-7' || String(l.thp).toUpperCase() === 'TRUE' || String(l.thp) === '1'
        if (!isThp) return false
        const lDate = parseDate(l.date)
        return lDate && lDate >= pStart && lDate <= pEnd
      })
      loanThp = sum(matchingLoans.map((l) => l.amount))

      const matchingRepayments = repayments.filter((r) => {
        if (r.userId !== p.userId) return false
        const isThp = r.thp === 'P-8' || String(r.thp).toUpperCase() === 'TRUE' || String(r.thp) === '1'
        if (!isThp) return false
        const rDate = parseDate(r.date)
        return rDate && rDate >= pStart && rDate <= pEnd
      })
      repayThp = sum(matchingRepayments.map((r) => r.amount))
    }

    const rawDisbursed = paidByPayroll[p.idPayroll] || 0

    return {
      ...p,
      takeHomePay: p.takeHomePay, // already includes loan additions/repayments in raw sheets
      disbursed: rawDisbursed,
      loanThp,
      repayThp,
    }
  })

  const thpRows = adjustedPayroll.filter((p) => p.takeHomePay > 0)
  const totalReceipts = sum(adjustedPayroll.map((p) => p.totalReceipts)) // gross "penerimaan"
  const totalThp = sum(adjustedPayroll.map((p) => p.takeHomePay))
  const totalDisbursed = sum(adjustedPayroll.map((p) => p.disbursed)) // money actually transferred

  // Unpaid backlog based on adjusted values (comparing disbursed to takeHomePay)
  const unpaidSlips = adjustedPayroll.filter((p) => p.takeHomePay > 0 && !(p.disbursed > 0))
  const unpaidTotal = sum(unpaidSlips.map((p) => p.takeHomePay))

  // Status breakdown
  const statusAgg: Record<string, number> = {}
  for (const p of adjustedPayroll) statusAgg[p.status] = (statusAgg[p.status] || 0) + 1
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

  // Monthly THP / disbursed (using adjusted values)
  const thpByMonth = byMonth(adjustedPayroll, (p) => p.endDate, (p) => p.takeHomePay)
  const disbursedByMonth = byMonth(adjustedPayroll, (p) => p.endDate, (p) => p.disbursed)
  const monthly = mergeMonthly([
    ['THP', thpByMonth], ['Disbursed', disbursedByMonth],
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

  const groupedWeeklyMap = new Map<string, any[]>()
  const finalRows: any[] = []

  for (const p of adjustedPayroll) {
    const payStatus = p.takeHomePay <= 0 ? '-'
      : p.disbursed === 0 ? 'Unpaid'
      : p.disbursed + 1 < p.takeHomePay ? 'Short'
      : p.disbursed > p.takeHomePay + 1 ? 'Over' : 'Paid'
    const sp = parseDate(p.startDate), ep = parseDate(p.endDate)
    const spanDays = sp && ep ? Math.round((ep.getTime() - sp.getTime()) / MS_PER_DAY) : 30

    const slipItems = listItemsByPayroll[p.idPayroll] || []
    
    // Find user profile, occupation, and tax status
    const userProfile = salesUsers.find(u => u.userId === p.userId)
    const employeeEmail = userProfile?.email || userProfile?.formalEmail || '-'
    const employeeNik = userProfile?.nik || '-'

    const occRecord = occupations.find(o => o.userId === p.userId)
    const employeeOccupation = occRecord?.name || '-'

    const taxStatusRecord = userTerStatuses.find(t => t.userId === p.userId)
    const taxStatus = taxStatusRecord?.taxStatusId || 'TK/0'
    const taxCategory = taxStatusRecord?.terStatusId || 'A'

    // Filter travel allowances
    const matchingTravel = travelAllowances.filter(ta => ta.userId === p.userId && sp && ep && parseDate(ta.date) >= sp && parseDate(ta.date) <= ep)
    const totalTravel = sum(matchingTravel.map(ta => ta.amount * ta.totalDays))

    // Filter matching approved reimbursements with payroll = true
    const matchingReimburse = reimburseCashOut.filter(r => 
      r.reimburseUserIdFk === p.userId && 
      (r.reimbursePayroll === 'TRUE' || String(r.reimbursePayroll).toUpperCase() === 'TRUE' || String(r.reimbursePayroll) === '1') && 
      r.reimburseStatus === 'A' && 
      sp && ep && parseDate(r.reimburseDate) >= sp && parseDate(r.reimburseDate) <= ep
    )
    const totalReimburse = sum(matchingReimburse.map(r => r.reimburseAmount))

    // Filter meal benefit details (meal request)
    const matchingMeal = mealDetails.filter(md => {
      if (md.userId !== p.userId || !sp || !ep) return false
      const mdDate = parseDate(md.date)
      if (!mdDate || mdDate < sp || mdDate > ep) return false
      if (md.deletedAt) return false
      const parentMb = mealBenefits.find(mb => mb.mbId === md.mbId)
      if (parentMb && parentMb.deletedAt) return false
      return true
    })
    const totalMeal = sum(matchingMeal.map(md => md.approved || md.amount))

    // Fallback: getTypeInfo
    const getTypeInfo = getPayrollTypeInfo || ((id) => ({ name: id, positive: true, takehomepay_status: true, receipt_status: true, tax_status: true }))

    let otherAdditionsReceipt = 0
    let otherAdditionsThp = 0
    let taxableAdditionsReceipt = 0
    let reductionReceipts = totalReimburse

    const mappedListItems = slipItems.map((item) => {
      const typeInfo = getTypeInfo(item.typeId)
      const positive = typeInfo.positive
      const isReceipt = typeInfo.receipt_status
      const isThp = typeInfo.takehomepay_status
      const isTaxable = typeInfo.tax_status

      if (positive) {
        if (isReceipt) {
          otherAdditionsReceipt += item.amount
          if (isTaxable) taxableAdditionsReceipt += item.amount
        }
        if (isThp) {
          otherAdditionsThp += item.amount
        }
      } else {
        if (isReceipt) {
          reductionReceipts += item.amount
        }
      }

      return {
        id: item.id,
        category: categoryLabel(item.categoryId),
        type: typeInfo.name || 'Income',
        amount: item.amount,
        positive,
        receipt: isReceipt ? item.amount : 0,
        thp: isThp ? item.amount : 0,
        isTaxable,
        remarks: item.remarks || '-',
      }
    })

    // Add travel allowance, reimburse, meal request to the additions
    otherAdditionsReceipt += totalTravel
    otherAdditionsThp += totalTravel
    taxableAdditionsReceipt += totalTravel

    // Do NOT add reimburse to otherAdditionsReceipt so basicSalary (and thus THP) is not reduced
    // otherAdditionsReceipt += totalReimburse
    // taxableAdditionsReceipt += totalReimburse

    // Calculate Meal allowance lembur (from occupation fallback)
    const cycleDays = spanDays <= 10 ? 6 : 25
    let mealAllowanceAmount = 0
    if (occRecord?.salaryMeal) {
      mealAllowanceAmount = cycleDays * occRecord.salaryMeal
    }
    // Cap meal allowance so we don't exceed totalReceipts
    mealAllowanceAmount = Math.min(mealAllowanceAmount, Math.max(0, p.totalReceipts - otherAdditionsReceipt))

    // Gaji Pokok is the remaining receipts
    const basicSalary = Math.max(0, p.totalReceipts - mealAllowanceAmount - otherAdditionsReceipt)
    const taxableBasic = basicSalary // Gaji Pokok is taxable

    // Tax calculation (all cash allowances must be included in Bruto)
    // The user requested: "yang di hitung di pajak itu total bersih di receipts bukan di earning"
    // So we must subtract all `reductionReceipts` (which includes Reimbursements and other deductions) from the Bruto.
    const regularTaxable = Math.max(0, (taxableBasic + taxableAdditionsReceipt + mealAllowanceAmount) - reductionReceipts)
    const totalTaxableWithMeal = regularTaxable + totalMeal // meal request is taxable, borne by company

    const rateRegular = calculateTerRate(regularTaxable, taxCategory, terRates)
    const pph21Regular = Math.round(regularTaxable * rateRegular)

    const rateTotal = calculateTerRate(totalTaxableWithMeal, taxCategory, terRates)
    const pph21Total = Math.round(totalTaxableWithMeal * rateTotal)

    // Gross up one-step: add Tunjangan Pajak to gross taxable and recompute
    const initialTunjanganPajak = Math.max(0, pph21Total - pph21Regular)
    const grossedTaxable = totalTaxableWithMeal + initialTunjanganPajak
    const rateGrossed = calculateTerRate(grossedTaxable, taxCategory, terRates)
    const pph21Final = Math.round(grossedTaxable * rateGrossed)
    const tunjanganPajak = Math.max(0, pph21Final - pph21Regular)

    // Construct Earnings List
    const slipEarnings: any[] = []
    // 1. Basic Salary
    if (basicSalary > 0) {
      slipEarnings.push({
        name: 'Basic Salary',
        type: 'Income',
        receipt: basicSalary,
        thp: basicSalary,
        nonThpReceipt: 0,
      })
    }
    // 2. Meal Allowance (Overtime)
    if (mealAllowanceAmount > 0) {
      slipEarnings.push({
        name: 'Meal Allowance (Overtime)',
        type: 'Income (Non Tax)',
        receipt: mealAllowanceAmount,
        thp: mealAllowanceAmount,
        nonThpReceipt: 0,
      })
    }
    // 3. Tunjangan Makan (Meal Request)
    if (totalMeal > 0) {
      slipEarnings.push({
        name: 'Tunjangan Makan',
        type: 'Pemasukan (Receipt) (Non Tax)',
        receipt: totalMeal,
        thp: 0,
        nonThpReceipt: 0,
      })
    }
    // 4. Tunjangan Luar Kota (Travel Allowance)
    if (totalTravel > 0) {
      slipEarnings.push({
        name: 'Tunjangan Luar Kota',
        type: 'Pemasukan',
        receipt: totalTravel,
        thp: totalTravel,
        nonThpReceipt: 0,
      })
    }

    if (tunjanganPajak > 0) {
      slipEarnings.push({
        name: 'Tunjangan Pajak',
        type: 'Pemasukan',
        receipt: tunjanganPajak,
        thp: tunjanganPajak,
        nonThpReceipt: 0,
      })
    }
    // 7. Loan Disbursed (THP)
    if (p.loanThp > 0) {
      slipEarnings.push({
        name: 'Loan Disbursed (THP)',
        type: 'Pemasukan (THP)',
        receipt: 0,
        thp: p.loanThp,
        nonThpReceipt: 0,
      })
    }
    // 8. Standard additions
    for (const item of mappedListItems) {
      if (item.positive) {
        const hasReceipt = item.receipt > 0
        const hasThp = item.thp > 0
        slipEarnings.push({
          name: item.category,
          type: item.type,
          receipt: item.receipt,
          thp: item.thp,
          nonThpReceipt: (!hasReceipt && !hasThp) ? item.amount : 0,
        })
      }
    }

    // Construct Reductions List
    const slipReductions: any[] = []
    // 1. PPh 21
    if (pph21Final > 0) {
      slipReductions.push({
        name: `PPh 21 (${(rateGrossed * 100).toFixed(2)}%)`,
        type: 'Tax',
        receipt: 0,
        thp: pph21Final,
        nonThp: 0,
      })
    }
    // 2. Loan Repayments (THP)
    if (p.repayThp > 0) {
      slipReductions.push({
        name: 'Loan Repayment (THP)',
        type: 'Pengurangan (THP)',
        receipt: 0,
        thp: p.repayThp,
        nonThp: 0,
      })
    }
    // 3. Reimburse (Pengurangan Receipt / Kasbon)
    if (totalReimburse > 0) {
      slipReductions.push({
        name: 'Reimbursement',
        type: 'Deduction (Receipt)',
        receipt: totalReimburse,
        thp: 0,
        nonThp: 0,
      })
    }
    // 4. Standard reductions
    for (const item of mappedListItems) {
      if (!item.positive) {
        const hasReceipt = item.receipt > 0
        const hasThp = item.thp > 0
        slipReductions.push({
          name: item.category,
          type: item.type,
          receipt: item.receipt,
          thp: item.thp,
          nonThp: (!hasReceipt && !hasThp) ? item.amount : 0,
        })
      }
    }

    // Map reimburse list details for rendering
    const reimburseList = matchingReimburse.map(r => ({
      date: r.reimburseDate,
      description: r.reimburseDescription || r.reimburseRemarks || '-',
      amount: r.reimburseAmount
    }))

    // Map loans list details for rendering
    const matchingLoansList = loans.filter(l => l.userId === p.userId && sp && ep && parseDate(l.date) >= sp && parseDate(l.date) <= ep)
    const loansList = matchingLoansList.map(l => ({
      date: l.date,
      type: l.thp === 'P-7' || String(l.thp).toUpperCase() === 'TRUE' ? 'THP Loan' : 'Direct Loan',
      amount: l.amount
    }))

    const rowObj = {
      idPayroll: p.idPayroll,
      employee: employeeName(p.userId) || p.userId || '-',
      userId: p.userId,
      period: p.description || `${p.startDate} – ${p.endDate}`,
      periodType: spanDays <= 10 ? 'Weekly' : 'Monthly',
      startDate: p.startDate,
      endDate: p.endDate,
      statusLabel: statusLabel(p.status),
      receipts: p.totalReceipts,
      reductions: p.thpReduction,
      takeHomePay: p.takeHomePay,
      disbursed: p.disbursed,
      payStatus,
      loanThp: p.loanThp,
      repayThp: p.repayThp,
      itemsList: mappedListItems,
      // Extra details for Slip Gaji
      employeeEmail,
      employeeNik,
      employeeOccupation,
      taxStatus,
      taxCategory,
      earnings: slipEarnings,
      reductionsList: slipReductions,
      reimburseList,
      loansList,
      travelDetails: matchingTravel.map(ta => ({ date: ta.date, days: ta.totalDays, amount: ta.amount })),
      mealDetailsList: matchingMeal.map(md => ({ date: md.date, type: getMbTypeLabel(md.type), approved: md.approved })),
      mealRate: occRecord?.salaryMeal || 0,
      file: p.file || '',
    }

    if (spanDays <= 10) {
      const dateObj = ep
      const yyyymm = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : 'unknown'
      const groupKey = `${p.userId}_${yyyymm}`
      if (!groupedWeeklyMap.has(groupKey)) {
        groupedWeeklyMap.set(groupKey, [])
      }
      groupedWeeklyMap.get(groupKey)!.push(rowObj)
    } else {
      finalRows.push(rowObj)
    }
  }

  for (const [groupKey, slips] of groupedWeeklyMap.entries()) {
    slips.sort((a, b) => (parseDate(a.startDate)?.getTime() || 0) - (parseDate(b.startDate)?.getTime() || 0))
    const first = slips[0]
    const last = slips[slips.length - 1]

    const totalReceipts = sum(slips.map(s => s.receipts))
    const totalReductions = sum(slips.map(s => s.reductions))
    const totalLoanThp = sum(slips.map(s => s.loanThp))
    const totalRepayThp = sum(slips.map(s => s.repayThp))
    const totalThp = sum(slips.map(s => s.takeHomePay))
    const totalDisbursed = sum(slips.map(s => s.disbursed))

    const payStatus = totalThp <= 0 ? '-'
      : totalDisbursed === 0 ? 'Unpaid'
      : totalDisbursed + 1 < totalThp ? 'Short'
      : totalDisbursed > totalThp + 1 ? 'Over' : 'Paid'

    const statuses = new Set(slips.map(s => s.statusLabel))
    const statusLabelText = statuses.has('Lock') ? 'Lock' : statuses.has('Release') ? 'Release' : 'Draft'

    const dateObj = parseDate(first.endDate)
    const monthName = dateObj ? MONTH_LABELS[dateObj.getMonth()] + ' ' + dateObj.getFullYear() : 'Weekly Group'

    const mergedEarningsMap = new Map<string, any>()
    const mergedReductionsMap = new Map<string, any>()
    const mergedReimburseMap = new Map<string, any>()
    const mergedLoansMap = new Map<string, any>()
    const mergedTravelDetails = new Map<string, any>()
    const mergedMealDetails = new Map<string, any>()
    for (const s of slips) {
      for (const e of s.earnings) {
        const key = `${e.name}_${e.type}`
        if (!mergedEarningsMap.has(key)) mergedEarningsMap.set(key, { ...e })
        else {
          const m = mergedEarningsMap.get(key)!
          m.receipt += e.receipt
          m.thp += e.thp
          m.nonThpReceipt += e.nonThpReceipt
        }
      }
      for (const r of s.reductionsList) {
        const key = `${r.name}_${r.type}`
        if (!mergedReductionsMap.has(key)) mergedReductionsMap.set(key, { ...r })
        else {
          const m = mergedReductionsMap.get(key)!
          m.receipt += r.receipt
          m.thp += r.thp
          m.nonThp += r.nonThp
        }
      }
      s.reimburseList?.forEach((r: any) => mergedReimburseMap.set(r.date + r.amount, r))
      s.loansList?.forEach((l: any) => mergedLoansMap.set(l.date + l.amount, l))
      s.travelDetails?.forEach((td: any) => mergedTravelDetails.set(`${td.date}-${td.amount}`, td))
      s.mealDetailsList?.forEach((md: any) => mergedMealDetails.set(`${md.date}-${md.type}`, md))
    }

    finalRows.push({
      idPayroll: `GW-${first.userId}-${groupKey.split('_')[1]}`,
      employee: first.employee,
      userId: first.userId,
      period: `Weekly Group: ${monthName}`,
      periodType: 'Weekly',
      startDate: first.startDate,
      endDate: last.endDate,
      statusLabel: statusLabelText,
      receipts: totalReceipts,
      reductions: totalReductions,
      takeHomePay: totalThp,
      disbursed: totalDisbursed,
      payStatus,
      loanThp: totalLoanThp,
      repayThp: totalRepayThp,
      isGroupedWeekly: true,
      weeklySlips: slips,
      itemsList: [], // Grouped row doesn't have direct itemized components on its own
      earnings: Array.from(mergedEarningsMap.values()),
      reductionsList: Array.from(mergedReductionsMap.values()),
      reimburseList: Array.from(mergedReimburseMap.values()),
      loansList: Array.from(mergedLoansMap.values()),
      travelDetails: Array.from(mergedTravelDetails.values()),
      mealDetailsList: Array.from(mergedMealDetails.values()),
      mealRate: first.mealRate,
      employeeEmail: first.employeeEmail,
      employeeNik: first.employeeNik,
      employeeOccupation: first.employeeOccupation,
      taxStatus: first.taxStatus,
      taxCategory: first.taxCategory,
    })
  }

  const rows = finalRows.sort((a, b) => (parseDate(b.startDate)?.getTime() || 0) - (parseDate(a.startDate)?.getTime() || 0))

  return {
    kpis: {
      totalReceipts: round(totalReceipts),
      totalThp: round(totalThp),
      totalDisbursed: round(totalDisbursed),
      shortfall: round(sum(adjustedPayroll.map((p) => Math.max(0, p.takeHomePay - p.disbursed)))),
      unpaid: round(unpaidTotal),
      unpaidCount: unpaidSlips.length,
      payslips: adjustedPayroll.length,
      employees: new Set(adjustedPayroll.map((p) => p.userId)).size,
      avgThp: thpRows.length ? round(totalThp / thpRows.length) : 0,
      medianThp: median(thpRows.map((p) => p.takeHomePay)),
      totalReductions: round(totalReductions),
      totalAdditions: round(totalAdditions),
      disbursementCoverage: pct(totalDisbursed, totalThp),
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
  evidences: MealBenefitEvidence[],
  details: MealBenefitDetail[],
  typeLabel: (id: string) => string,
  projectLabel: (id: string) => string,
  employeeName: (id: string) => string = (id) => id,
) {
  const approved = benefits.filter((b) => b.status === 'A')
  const totalApproved = sum(approved.map((b) => b.total))

  // Net released per mb_id (R positive, P negative — only typed rows)
  const relByMb: Record<string, number> = {}
  const lastReleaseDateByMb: Record<string, string> = {}
  const releasesByMb: Record<string, MealBenefitRelease[]> = {}
  let netReleased = 0
  for (const r of releases) {
    if (!releasesByMb[r.mbId]) releasesByMb[r.mbId] = []
    releasesByMb[r.mbId].push(r)
    
    if (r.type !== 'R' && r.type !== 'P') continue
    relByMb[r.mbId] = (relByMb[r.mbId] || 0) + r.amount
    netReleased += r.amount
    const prev = lastReleaseDateByMb[r.mbId]
    if (!prev || (r.createdAt && (!prev || new Date(r.createdAt).getTime() > new Date(prev).getTime()))) {
      lastReleaseDateByMb[r.mbId] = r.createdAt
    }
  }
  const outstanding = totalApproved - netReleased

  // Evidences by mb_id (only status = A)
  const activeEvidences = evidences.filter((e) => e.status === 'A')
  const evidenceByMb: Record<string, number> = {}
  const evidencesByMb: Record<string, MealBenefitEvidence[]> = {}
  for (const e of activeEvidences) {
    evidenceByMb[e.mbId] = (evidenceByMb[e.mbId] || 0) + e.amount
    if (!evidencesByMb[e.mbId]) evidencesByMb[e.mbId] = []
    evidencesByMb[e.mbId].push(e)
  }
  
  const approvedMbIds = new Set(approved.map((b) => b.mbId))
  const targetEvidences = activeEvidences.filter((e) => approvedMbIds.has(e.mbId))
  const totalEvidence = sum(targetEvidences.map((e) => e.amount))
  const totalDifference = netReleased - totalEvidence

  // Details by mb_id
  const detailsByMb: Record<string, MealBenefitDetail[]> = {}
  for (const d of details) {
    if (!detailsByMb[d.mbId]) detailsByMb[d.mbId] = []
    detailsByMb[d.mbId].push(d)
  }

  // By type, by project
  const typeAgg: Record<string, number> = {}
  const projAgg: Record<string, number> = {}
  for (const b of approved) {
    typeAgg[b.type] = (typeAgg[b.type] || 0) + b.total
    if (b.projectId) projAgg[b.projectId] = (projAgg[b.projectId] || 0) + b.total
  }
  const byType = topN(typeAgg, 12, typeLabel)
  const topProjects = Object.entries(projAgg)
    .map(([id, value]) => ({ id, name: projectLabel(id), value: round(value) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  const approvedByMonth = byMonth(approved, (b) => b.date, (b) => b.total)

  // Meal Request Cash Balances per employee
  const userBalancesMap = new Map<string, { employeeName: string; released: number; evidence: number; balance: number }>()
  for (const b of approved) {
    const name = employeeName(b.userId)
    const emp = (name && name !== b.userId) ? name : (b.userId || 'Unknown')
    if (!userBalancesMap.has(emp)) {
      userBalancesMap.set(emp, { employeeName: emp, released: 0, evidence: 0, balance: 0 })
    }
    const item = userBalancesMap.get(emp)!
    const released = relByMb[b.mbId] || 0
    const evidence = evidenceByMb[b.mbId] || 0
    item.released += released
    item.evidence += evidence
  }
  const userBalances = Array.from(userBalancesMap.values()).map(u => ({
    ...u,
    released: round(u.released),
    evidence: round(u.evidence),
    balance: round(u.released - u.evidence)
  })).sort((a, b) => b.balance - a.balance)

  // Compute previous balances chronologically
  const chronological = [...benefits].sort((a, b) => (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0))
  const runningBalanceByUserId: Record<string, number> = {}
  const prevBalanceMap = new Map<string, number>()
  for (const b of chronological) {
    const released = relByMb[b.mbId] || 0
    const evidence = evidenceByMb[b.mbId] || 0
    const diff = released - evidence
    const prev = runningBalanceByUserId[b.userId] || 0
    prevBalanceMap.set(b.mbId, prev)
    if (b.status === 'A') {
      runningBalanceByUserId[b.userId] = prev + diff
    }
  }

  const rows = benefits
    .map((b) => {
      const released = relByMb[b.mbId] || 0
      const evidence = evidenceByMb[b.mbId] || 0
      const lastReleaseDate = lastReleaseDateByMb[b.mbId] || '-'
      
      const sMap: Record<string, string> = { A: 'Approved', P: 'Pending', R: 'Rejected' }
      const statusLabel = sMap[b.status] || b.status || 'Unknown'

      const reqName = employeeName(b.userId)
      const requestedBy = (reqName && reqName !== b.userId) ? reqName : (b.userId || '-')
      const prevBalance = prevBalanceMap.get(b.mbId) || 0

      return {
        mbId: b.mbId,
        date: b.date,
        typeLabel: typeLabel(b.type),
        projectId: b.projectId || '-',
        projectName: projectLabel(b.projectId) || '-',
        zone: b.zone || '(unassigned)',
        users: b.totalUser,
        days: b.totalDays,
        approvedAmount: b.total,
        released: round(released),
        evidence: round(evidence),
        diff: round(released - evidence),
        prevBalance: round(prevBalance),
        statusLabel,
        requestedBy,
        lastReleaseDate,
        details: (detailsByMb[b.mbId] || []).map((det) => {
          const detName = det.userId ? employeeName(det.userId) : ''
          const userName = (detName && detName !== det.userId) ? detName : (det.userName || det.userId || '-')
          return {
            mbdId: det.mbdId,
            userName,
            amount: det.amount,
            approved: det.approved,
            date: det.date,
            notes: det.remarks || det.notes || '-',
          }
        }),
        releases: (releasesByMb[b.mbId] || []).map((rel) => ({
          mbrId: rel.mbrId,
          amount: rel.amount,
          type: rel.type === 'R' ? 'Release' : rel.type === 'P' ? 'Payback' : rel.type,
          date: rel.createdAt || '-',
          status: rel.status === 'A' ? 'Approved' : rel.status || '-',
        })),
        evidences: (evidencesByMb[b.mbId] || []).map((ev) => ({
          mbeId: ev.mbeId,
          amount: ev.amount,
          file: ev.file || '-',
          date: ev.createdAt || '-',
          status: ev.status === 'A' ? 'Approved' : ev.status || '-',
        })),
      }
    })
    .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))

  return {
    kpis: {
      totalApproved: round(totalApproved),
      netReleased: round(netReleased),
      totalEvidence: round(totalEvidence),
      totalDifference: round(totalDifference),
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
    userBalances,
    rows,
  }
}

// ════════════════════════ LOANS ════════════════════════
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function computeLoans(
  loans: Loan[],
  repayments: Repayment[],
  borrowerName: (id: string) => string,
  payrollTypeName: (id: string) => string = (id) => id,
  now = Date.now(),
  from?: string,
  to?: string,
) {
  const repaidByLoan: Record<string, number> = {}
  const lastRepayDateByLoan: Record<string, string> = {}
  const repaymentsByLoan: Record<string, Repayment[]> = {}
  for (const r of repayments) {
    repaidByLoan[r.loanId] = (repaidByLoan[r.loanId] || 0) + r.amount
    
    if (!repaymentsByLoan[r.loanId]) repaymentsByLoan[r.loanId] = []
    repaymentsByLoan[r.loanId].push(r)

    const prev = lastRepayDateByLoan[r.loanId]
    if (!prev || (r.date && (!prev || new Date(r.date).getTime() > new Date(prev).getTime()))) {
      lastRepayDateByLoan[r.loanId] = r.date
    }
  }

  // Filter loans based on date range OR outstanding balance > 0.5
  const targetLoans = from && to ? loans.filter((l) => {
    const repaid = repaidByLoan[l.loanId] || 0
    const outstanding = Math.max(0, l.amount - repaid)
    const lDate = parseDate(l.date)
    const isWithinDate = lDate && lDate.getTime() >= new Date(from).getTime() && lDate.getTime() <= new Date(to).getTime()
    const hasOutstanding = outstanding > 0.5
    return isWithinDate || hasOutstanding
  }) : loans

  const loanIds = new Set(targetLoans.map(l => l.loanId))
  const targetRepayments = repayments.filter((r) => loanIds.has(r.loanId))

  const totalDisbursed = sum(targetLoans.map((l) => l.amount))
  const totalRepaid = sum(targetRepayments.map((r) => r.amount))

  let totalOutstanding = 0
  let active = 0
  const outByBorrower: Record<string, number> = {}
  const rows = targetLoans
    .map((l) => {
      const repaid = repaidByLoan[l.loanId] || 0
      const outstanding = Math.max(0, l.amount - repaid)
      if (outstanding > 0.5) { active++; outByBorrower[l.userId] = (outByBorrower[l.userId] || 0) + outstanding }
      totalOutstanding += outstanding
      const lastRepayDate = lastRepayDateByLoan[l.loanId] || '-'
      return {
        loanId: l.loanId,
        date: l.date,
        borrower: borrowerName(l.userId),
        userId: l.userId,
        amount: l.amount,
        tenor: l.tenor,
        repaid: round(repaid),
        outstanding: round(outstanding),
        progress: pct(repaid, l.amount),
        statusLabel: outstanding <= 0.5 ? 'Settled' : 'Active',
        remarks: l.remarks || '-',
        lastRepayDate,
        repaymentsList: (repaymentsByLoan[l.loanId] || []).map((rep) => {
          let thpLabel = rep.thp || '-'
          if (rep.thp && rep.thp.toUpperCase() !== 'MANUAL' && rep.thp.toUpperCase() !== 'FALSE') {
            const mapped = payrollTypeName(rep.thp)
            if (mapped && mapped !== rep.thp) thpLabel = mapped
          }
          return {
            repaymentId: rep.repaymentId,
            date: rep.date,
            amount: rep.amount,
            thp: thpLabel,
            count: rep.count,
            remarks: rep.remarks || '-',
          }
        }).sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0)),
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding)

  const topBorrowers = topN(outByBorrower, 10, borrowerName)
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
  for (const l of targetLoans) {
    const repaid = repaidByLoan[l.loanId] || 0
    let remaining = Math.max(0, l.amount - repaid)
    if (remaining <= 0.5 || l.tenor <= 0) continue
    const installment = l.amount / l.tenor
    if (installment <= 0) continue
    const monthsLeft = Math.ceil(remaining / installment)
    maxMonthsToClear = Math.max(maxMonthsToClear, monthsLeft)

    // Calculate forecast start index based on disbursement date
    const lDate = parseDate(l.date)
    let startIndex = 0
    if (lDate) {
      const firstRepayMonth = new Date(lDate.getFullYear(), lDate.getMonth() + 1, 1)
      const firstForecastMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1)
      if (firstRepayMonth > firstForecastMonth) {
        startIndex = (firstRepayMonth.getFullYear() - firstForecastMonth.getFullYear()) * 12 + (firstRepayMonth.getMonth() - firstForecastMonth.getMonth())
      }
    }

    for (let i = startIndex; i < HORIZON && remaining > 0.5; i++) {
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
  employeeName: (id: string) => string = (id) => id,
) {
  const getEmpName = (username: string, userId: string) => {
    if (username && username !== userId) return username
    if (userId) {
      const resolved = employeeName(userId)
      if (resolved && resolved !== userId) return resolved
    }
    return username || userId || '-'
  }

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
    const emp = getEmpName(r.reimburseUserName, r.reimburseUserIdFk)
    empAgg[emp] = (empAgg[emp] || 0) + r.reimburseAmount
  }
  const categoryBreakdown = topN(catAgg, 12, (k) => k)
  const topProjects = Object.entries(projAgg)
    .map(([id, value]) => ({ id, name: projectLabel(id), value: round(value) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  const topEmployees = topN(empAgg, 10, (k) => k)

  // User Petty Cash balances (Cash In, Cash Out, and Net Remaining Balance per user)
  const userBalancesMap = new Map<string, { employeeName: string; cashIn: number; cashOut: number; balance: number }>()
  const historyByEmployee = new Map<string, any[]>()

  for (const r of inApproved) {
    const emp = getEmpName(r.reimburseUserName, r.reimburseUserIdFk)
    if (!userBalancesMap.has(emp)) {
      userBalancesMap.set(emp, { employeeName: emp, cashIn: 0, cashOut: 0, balance: 0 })
    }
    userBalancesMap.get(emp)!.cashIn += r.reimburseAmount

    if (!historyByEmployee.has(emp)) historyByEmployee.set(emp, [])
    historyByEmployee.get(emp)!.push({
      id: r.reimburseId,
      date: r.reimburseDate,
      type: 'Cash In',
      amount: r.reimburseAmount,
      category: 'Petty Cash Refill',
      project: '-',
      description: 'Refill petty cash balance',
    })
  }
  for (const r of outApproved) {
    const emp = getEmpName(r.reimburseUserName, r.reimburseUserIdFk)
    if (!userBalancesMap.has(emp)) {
      userBalancesMap.set(emp, { employeeName: emp, cashIn: 0, cashOut: 0, balance: 0 })
    }
    userBalancesMap.get(emp)!.cashOut += r.reimburseAmount

    if (!historyByEmployee.has(emp)) historyByEmployee.set(emp, [])
    historyByEmployee.get(emp)!.push({
      id: r.reimburseId,
      date: r.reimburseDate,
      type: 'Cash Out',
      amount: r.reimburseAmount,
      category: reimburseCategory(r.reimburseTypeIdFk),
      project: r.reimburseProjectName || projectLabel(r.reimbursePrjIdFk) || '-',
      description: r.reimburseDescription || '-',
    })
  }
  const userBalances = Array.from(userBalancesMap.values()).map(u => {
    const history = (historyByEmployee.get(u.employeeName) || [])
      .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))
    return {
      ...u,
      cashIn: round(u.cashIn),
      cashOut: round(u.cashOut),
      balance: round(u.cashIn - u.cashOut),
      history,
    }
  }).sort((a, b) => b.balance - a.balance)

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
      projectId: r.reimbursePrjIdFk || '-',
      projectName: r.reimburseProjectName || projectLabel(r.reimbursePrjIdFk) || '-',
      description: r.reimburseDescription,
      category: reimburseCategory(r.reimburseTypeIdFk),
      amount: r.reimburseAmount,
      statusLabel: statusLabel(r.reimburseStatus),
      employeeName: getEmpName(r.reimburseUserName, r.reimburseUserIdFk),
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
    userBalances,
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
  const totalOutstanding = sum(composition.map((c) => c.outstanding))

  return {
    kpis: {
      totalOutflow: totalOutflow,
      totalOutstanding: totalOutstanding,
      apOutstanding: streams.apOutstanding,
      loansOutstanding: streams.loansOutstanding,
      payrollDisbursed: streams.payrollDisbursed,
      pettyCashBalance: streams.reimburseBalance,
      pendingAp: streams.pendingAp,
    },
    composition: composition.map((c) => ({ ...c, pctOutflow: pct(c.outflow, totalOutflow) })),
    outstandingByStream: composition
      .filter((c) => c.outstanding > 0)
      .map((c) => ({ name: c.stream, value: c.outstanding }))
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
