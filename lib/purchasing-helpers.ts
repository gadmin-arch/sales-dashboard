// Shared server-side helpers for the purchasing dashboards (requests / orders / vendors).
// Pure TS (no JSX) so it can be imported from API routes.

import type { Order, PurchaseOrder, PoLine } from '@/database'
import { parseDate } from '@/lib/utils-date-currency'

export const distinct = <T,>(arr: T[]): T[] => [...new Set(arr)]

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Project labeler from the orders sheet.
 * - `label(id)` → "id - name" (searchable by both; falls back to id alone, "-" when empty)
 * - `bare(id)`  → just the name (falls back to id) — used for chart axes where id is shown separately
 */
export function makeProjectLabeler(orders: Order[]) {
  const map = new Map<string, string>()
  for (const o of orders) if (o.prjId) map.set(o.prjId, o.prjName)
  return {
    label: (id: string): string => {
      if (!id) return '-'
      const n = map.get(id)
      return n ? `${id} - ${n}` : id
    },
    bare: (id: string): string => map.get(id) || id,
  }
}

/** Generic id → name lookup builder (first non-empty name per id wins). */
export function makeNamer<T>(rows: T[], idOf: (r: T) => string, nameOf: (r: T) => string): (id: string) => string {
  const map = new Map<string, string>()
  for (const r of rows) {
    const id = idOf(r)
    if (id && !map.has(id)) map.set(id, nameOf(r) || id)
  }
  return (id: string) => map.get(id) || id || '-'
}

/** Vendor id → display name, taken from the PO rows themselves. */
export const makeVendorNamer = (pos: PurchaseOrder[]) => makeNamer(pos, (p) => p.poCompanyId, (p) => p.poCompanyName)

/**
 * pr_id → latest purchase date, resolved as POLists(pol_pr_id) → POs.PO_Date.
 * Single pass over PO lines; keeps the newest PO date per PR.
 */
export function makePrPurchaseDates(pos: PurchaseOrder[], poLines: PoLine[]): Map<string, Date> {
  const poDate = new Map<string, string>()
  for (const po of pos) if (po.poNumber) poDate.set(po.poNumber, po.poDate)
  const out = new Map<string, Date>()
  for (const l of poLines) {
    if (!l.polPrId) continue
    const d = parseDate(poDate.get(l.polPoNumber) || '')
    if (!d) continue
    const cur = out.get(l.polPrId)
    if (!cur || d > cur) out.set(l.polPrId, d)
  }
  return out
}
