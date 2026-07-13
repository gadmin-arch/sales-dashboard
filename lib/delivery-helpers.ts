// Shared logic for the Project Delivery dashboard (no JSX).
import { parseDate } from './utils-date-currency'
import type { Order, ProjectLog, Bast } from '@/database'

const MS_PER_DAY = 86_400_000
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// ── Benchmark (planned) dates ──
// Plan columns first (X = prj_start_date_plan / Y = prj_due_date_plan),
// falling back to the working start/due (V = prj_start_date / W = prj_due_date).
export const benchmarkStart = (o: Order) => o.prjStartDatePlan?.trim() || o.prjStartDate?.trim() || ''
export const benchmarkEnd = (o: Order) => o.prjDueDatePlan?.trim() || o.prjDueDate?.trim() || ''

// ── Actual dates ──
// Build actual-date maps from project_log status transitions:
//   earliest NS→IP = actual start, earliest IP→D = actual end,
//   earliest *→D (any old status) = project "Done" event.
export function buildLogMaps(logs: ProjectLog[]) {
  const nsToIp = new Map<string, Date>()
  const ipToD = new Map<string, Date>()
  const doneAt = new Map<string, Date>()
  for (const l of logs) {
    const pid = l.plPrjId
    if (!pid) continue
    const d = parseDate(l.createdAt)
    if (!d) continue
    if (l.plStatusOld === 'NS' && l.plStatusNew === 'IP') {
      const cur = nsToIp.get(pid); if (!cur || d < cur) nsToIp.set(pid, d)
    } else if (l.plStatusOld === 'IP' && l.plStatusNew === 'D') {
      const cur = ipToD.get(pid); if (!cur || d < cur) ipToD.set(pid, d)
    }
    if (l.plStatusNew === 'D') {
      const cur = doneAt.get(pid); if (!cur || d < cur) doneAt.set(pid, d)
    }
  }
  return { nsToIp, ipToD, doneAt }
}

// Actual dates: actual columns (Z/AA) first, else the project_log fallback.
export function actualStart(o: Order, nsToIp: Map<string, Date>): Date | null {
  return parseDate(o.prjStartDateActual) || nsToIp.get(o.prjId) || null
}
export function actualEnd(o: Order, ipToD: Map<string, Date>): Date | null {
  return parseDate(o.prjEndDateActual) || ipToD.get(o.prjId) || null
}

// Whole-day variance (actual − benchmark). Positive = late, negative = early. Null if either missing.
export function dayVariance(benchmark: string, actual: Date | null): number | null {
  const b = parseDate(benchmark)
  if (!b || !actual) return null
  return Math.round((startOfDay(actual).getTime() - startOfDay(b).getTime()) / MS_PER_DAY)
}

// Whole-day difference between two dates. Null if either missing.
export function daysBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY)
}

// ── BAST-based delivery timeliness (base layer = due date) ──
// Earliest BAST submit date per project.
export function buildBastSubmitMap(basts: Bast[]) {
  const m = new Map<string, Date>()
  for (const b of basts) {
    const d = parseDate(b.bastSubmitDate)
    if (!d) continue
    const cur = m.get(b.bastPrjId); if (!cur || d < cur) m.set(b.bastPrjId, d)
  }
  return m
}

export type DeliveryStatus = 'onTime' | 'overtime' | 'pending'
// BAST-based judging adds a fourth state: projects that are Completed or fully
// invoiced (payment percentage ≥ 100) never file a BAST, so they are exempt
// rather than forever-pending.
export type BastDeliveryStatus = DeliveryStatus | 'noBast'
export const DELIVERY_LABELS: Record<BastDeliveryStatus, string> = {
  onTime: 'On Time',
  overtime: 'Overtime',
  pending: 'Pending (no BAST)',
  noBast: 'No BAST Required',
}
// Same statuses judged against the project_log "Done" date instead of the BAST submit.
export const DONE_LABELS: Record<DeliveryStatus, string> = {
  onTime: 'On Time',
  overtime: 'Overtime',
  pending: 'Pending (not done)',
}

// BAST submit date vs project due date:
//   submitted after due   → Overtime
//   submitted on/before due → On Time
//   no BAST submitted yet  → Pending
export function deliveryStatus(dueStr: string, bastSubmit: Date | null): DeliveryStatus {
  if (!bastSubmit) return 'pending'
  const due = parseDate(dueStr)
  if (!due) return 'onTime' // delivered; no due date to prove lateness
  return startOfDay(bastSubmit).getTime() > startOfDay(due).getTime() ? 'overtime' : 'onTime'
}

// A project is "silently overdue" when its due date has passed and no BAST exists yet.
export function isOverduePending(dueStr: string, bastSubmit: Date | null, today: Date): boolean {
  if (bastSubmit) return false
  const due = parseDate(dueStr)
  if (!due) return false
  return startOfDay(today).getTime() > startOfDay(due).getTime()
}
