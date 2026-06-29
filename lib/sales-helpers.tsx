// Shared UI helpers for sales page

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { type SelectRootChangeEventDetails } from '@base-ui/react/select'

export type SortDir = 'asc' | 'desc'

// Currency formatter
export function fmtCurrency(v: number, currency = 'IDR'): string {
  const prefix = currency === 'USD' ? '$ ' : currency === 'EUR' ? '€ ' : currency === 'SGD' ? 'SGD ' : 'IDR '
  if (v >= 1_000_000_000) return prefix + (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return prefix + (v / 1_000_000).toFixed(0) + 'M'
  if (v >= 1_000) return prefix + (v / 1_000).toFixed(0) + 'K'
  return prefix + v.toLocaleString('id-ID')
}

// Select change handler
export function onSel(setter: (v: string) => void) {
  return (v: string | null, _d: SelectRootChangeEventDetails) => { setter(v ?? 'all') }
}

// Progress bar
export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-[0_0_0.625rem_0.625rem] bg-secondary overflow-hidden ${className || ''}`}>
      <div
        className="h-full rounded-[0_0_0.625rem_0.625rem] transition-all"
        style={{ width: `${Math.min(value, 100)}%`, background: color || 'var(--primary)' }}
      />
    </div>
  )
}

// Sort icon for table headers
export function SortIcon<T extends string>({ column, sortKey, sortDir }: { column: T; sortKey: T; sortDir: SortDir }) {
  if (sortKey !== column) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />
}

// YTD date range
export function getYTD() {
  const n = new Date()
  return {
    from: new Date(n.getFullYear(), 0, 1).toLocaleDateString('en-CA'),
    to: new Date(n.getFullYear(), n.getMonth(), n.getDate()).toLocaleDateString('en-CA'),
  }
}

// Quick date range presets — single source of truth for keys + readable labels
export type QuickRangeKey = 'thisMonth' | 'last30' | '6month' | '1year' | 'lastYear' | 'YTD'

export const QUICK_RANGES: { key: QuickRangeKey; label: string }[] = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: '6month', label: '6 Months' },
  { key: '1year', label: '1 Year' },
  { key: 'lastYear', label: 'Last Year' },
  { key: 'YTD', label: 'YTD' },
]

export function getQuickDateRange(range: QuickRangeKey) {
  const t = new Date()
  let f = ''
  let to = t.toLocaleDateString('en-CA')
  if (range === 'YTD') {
    f = `${t.getFullYear()}-01-01`
  } else if (range === 'thisMonth') {
    f = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
  } else if (range === 'last30') {
    const p = new Date()
    p.setDate(t.getDate() - 30)
    f = p.toLocaleDateString('en-CA')
  } else if (range === '6month') {
    const p = new Date()
    p.setMonth(t.getMonth() - 6)
    f = p.toLocaleDateString('en-CA')
  } else if (range === '1year') {
    const p = new Date()
    p.setFullYear(t.getFullYear() - 1)
    f = p.toLocaleDateString('en-CA')
  } else if (range === 'lastYear') {
    const ly = t.getFullYear() - 1
    f = `${ly}-01-01`
    to = `${ly}-12-31`
  }
  return { from: f, to }
}

// Order-insensitive equality for multi-select value arrays.
export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((v) => s.has(v))
}

// Build a query string from filter params.
// - string[]  → CSV, omitted when empty (multi-select: empty = "all")
// - string    → omitted when falsy or 'all' (single-select / dates)
export function buildQuery(params: Record<string, string | string[]>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','))
    } else if (v && v !== 'all') {
      q.set(k, v)
    }
  }
  return q.toString()
}
