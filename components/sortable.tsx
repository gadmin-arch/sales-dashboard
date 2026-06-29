'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { TableHead } from '@/components/ui/table'
import { SortIcon } from '@/lib/sales-helpers'
import { cn } from '@/lib/utils'

// Value-agnostic comparator: numbers numerically, real dates chronologically,
// everything else as numeric-aware strings (so "230267" / "INV-2024-001" sort sensibly).
function parseSortableDate(s: string): number | null {
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]).getTime()
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime()
  return null
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const as = (a ?? '').toString().trim()
  const bs = (b ?? '').toString().trim()
  const ad = parseSortableDate(as)
  const bd = parseSortableDate(bs)
  if (ad !== null && bd !== null) return ad - bd
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
}

export interface SortState {
  sorted: <T>(rows: T[]) => T[]
  sortKey: string
  sortDir: 'asc' | 'desc'
  toggle: (key: string) => void
}

/**
 * Client-side sorting state. Returns the sorted rows plus header helpers.
 * Compose with useLoadMore: sort first, then paginate the sorted result.
 */
export function useSort<T>(rows: T[], initialKey: string, initialDir: 'asc' | 'desc' = 'desc') {
  const [sortKey, setSortKey] = useState(initialKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialDir)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const c = compareValues((a as Record<string, unknown>)[sortKey], (b as Record<string, unknown>)[sortKey])
      return sortDir === 'asc' ? c : -c
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggle = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  return { sorted, sortKey, sortDir, toggle }
}

interface SortHeadProps {
  label: ReactNode
  column: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

export function SortHead({ label, column, sortKey, sortDir, onSort, className }: SortHeadProps) {
  return (
    <TableHead
      onClick={() => onSort(column)}
      className={cn(
        'cursor-pointer select-none text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon column={column} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </TableHead>
  )
}
