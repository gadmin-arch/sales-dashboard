// Shared server-side helpers for the dashboard API routes (no JSX).

import { clearSheetCache } from '@/database/client'

/** Read the standard dashboard query params; honour `fresh=1` by clearing the sheet cache. */
export function parseDashboardParams(searchParams: URLSearchParams): { dateFrom: string; dateTo: string } {
  if (searchParams.get('fresh') === '1') clearSheetCache()
  return {
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  }
}

/** Apply a chart cross-filter (cType/cVal) to a row set via a per-type predicate map. */
export function applyChartFilter<T>(
  searchParams: URLSearchParams,
  rows: T[],
  handlers: Record<string, (row: T, val: string) => boolean>,
): T[] {
  const cType = searchParams.get('cType')
  const cVal = searchParams.get('cVal')
  if (!cType || !cVal) return rows
  const h = handlers[cType]
  return h ? rows.filter((r) => h(r, cVal)) : rows
}

/** Distinct ids → [{value,label}] sorted by label. */
export function buildOptions(ids: string[], label: (id: string) => string): { value: string; label: string }[] {
  return [...new Set(ids.filter(Boolean))]
    .map((id) => ({ value: id, label: label(id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Record<id,number> → top-N [{name,value}] sorted desc, rounded, positives only. */
export function topN(agg: Record<string, number>, n = 10, label?: (k: string) => string): { name: string; value: number }[] {
  return Object.entries(agg)
    .map(([k, v]) => ({ name: label ? label(k) : k, value: Math.round(v) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}
