// Shared logic for the Worker Reports dashboard (no JSX).
import { parseDate } from './utils-date-currency'

const MS_PER_HOUR = 3_600_000

/**
 * Reporting delay in HOURS: time from the END of the report day (midnight after
 * report_date) to when the report was actually submitted (created_at), floored at 0.
 * - report_date 11/11, submitted 12/11 12:00 → 12 hours
 * - report_date 11/11, submitted 11/11 (any time) → 0 hours
 * Returns null if either date is missing/unparseable.
 */
export function reportDelayHours(reportDate: string, createdAt: string): number | null {
  const rd = parseDate(reportDate)
  const cr = parseDate(createdAt)
  if (!rd || !cr) return null
  const endOfReportDay = new Date(rd.getFullYear(), rd.getMonth(), rd.getDate() + 1)
  const h = (cr.getTime() - endOfReportDay.getTime()) / MS_PER_HOUR
  return h < 0 ? 0 : h
}

/**
 * Discipline score derived from the reporting delay (measured in days):
 *   ≤ 2 days → 4,  2–7 days → 3,  7–30 days → 2,  > 30 days → 1
 * Returns null when the delay can't be computed.
 */
export function delayScore(delayHours: number | null): number | null {
  if (delayHours == null) return null
  const days = delayHours / 24
  if (days <= 2) return 4
  if (days <= 7) return 3
  if (days <= 30) return 2
  return 1
}

export const SCORE_META: { score: number; label: string }[] = [
  { score: 4, label: 'On-time (≤2d)' },
  { score: 3, label: 'Slight (2–7d)' },
  { score: 2, label: 'Late (7–30d)' },
  { score: 1, label: 'Very late (>30d)' },
]
export const scoreLabel = (s: number | null): string =>
  SCORE_META.find((m) => m.score === s)?.label ?? 'n/a'

// Parse a "55%" progress string into a 0–100 number (null when blank/unparseable).
export function parseProgress(p: string): number | null {
  if (!p) return null
  const n = parseFloat(String(p).replace('%', '').trim())
  return isNaN(n) ? null : n
}
