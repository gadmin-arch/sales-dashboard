// Value-agnostic comparator shared by the client table hooks (components/sortable.tsx)
// and the server-side rows endpoints, so server sorting returns the exact same order
// the client tables used to produce locally.
export function parseSortableDate(s: string): number | null {
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]).getTime()
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime()
  return null
}

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const as = a.toString().trim()
  const bs = b.toString().trim()
  const ad = parseSortableDate(as)
  const bd = parseSortableDate(bs)
  if (ad !== null && bd !== null) return ad - bd
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
}

/** Non-mutating sort by a row field, same semantics as the client useSort hook. */
export function sortRows<T>(rows: T[], sortKey: string, sortDir: 'asc' | 'desc'): T[] {
  const copy = [...rows]
  copy.sort((a, b) => {
    const c = compareValues((a as Record<string, unknown>)[sortKey], (b as Record<string, unknown>)[sortKey])
    return sortDir === 'asc' ? c : -c
  })
  return copy
}

/** Case-insensitive substring search over the given row fields (same as the client tables). */
export function searchRows<T>(rows: T[], q: string, keys: string[]): T[] {
  const query = q.trim().toLowerCase()
  if (!query) return rows
  return rows.filter((r) => keys.some((k) => String((r as Record<string, unknown>)[k] ?? '').toLowerCase().includes(query)))
}
