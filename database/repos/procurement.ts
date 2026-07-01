import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapPurchaseOrder, mapPoLine, mapProcItem } from '../mappers/procurement'
import type { PurchaseOrder, PoLine, ProcItem } from '../types'

let statusMap: Map<string, string> | null = null
let paymentTypeMap: Map<string, string> | null = null
let itemTypeMap: Map<string, string> | null = null

const ssId = GOOGLE_CONFIG.procurement.spreadsheetId
const sheets = GOOGLE_CONFIG.procurement.sheets

export async function loadRefMaps(): Promise<void> {
  if (statusMap) return
  const [stRows, ptRows, itRows] = await Promise.all([
    fetchAllRows(ssId, sheets.statuses),
    fetchAllRows(ssId, sheets.paymentTypes),
    fetchAllRows(ssId, sheets.itemTypes),
  ])
  statusMap = new Map()
  for (const r of stRows.rows) if (r[0]) statusMap.set(r[0], r[1] || r[0])
  paymentTypeMap = new Map()
  for (const r of ptRows.rows) if (r[0]) paymentTypeMap.set(r[0], r[1] || r[0])
  itemTypeMap = new Map()
  for (const r of itRows.rows) if (r[0]) itemTypeMap.set(r[0], r[1] || r[0])
}

export function getPoStatusLabel(id: string): string {
  return statusMap?.get(id) || id || '-'
}
export function getPaymentTypeLabel(id: string): string {
  return paymentTypeMap?.get(id) || id || '-'
}
export function getItemTypeLabel(id: string): string {
  return itemTypeMap?.get(id) || id || '-'
}

export async function getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { rows } = await fetchAllRows(ssId, sheets.pos)
  // drop header echo + soft-deleted rows (PO_DeletedAt at index 58)
  return rows.filter((r) => r[0] && r[0] !== 'PO_Number' && !r[58]).map(mapPurchaseOrder)
}

export async function getAllPoLines(): Promise<PoLine[]> {
  const { rows } = await fetchAllRows(ssId, sheets.poLists)
  // drop header echo + soft-deleted rows (POL_DeletedAt at index 31)
  return rows.filter((r) => r[0] && r[0] !== 'POL_ID' && !r[31]).map(mapPoLine)
}

// item_id -> item name, from the Items master sheet (skip soft-deleted, Item_DeletedAt at index 13)
export async function getItemNameMap(): Promise<Map<string, string>> {
  const { rows } = await fetchAllRows(ssId, sheets.items)
  const map = new Map<string, string>()
  for (const r of rows) {
    if (!r[0] || r[0] === 'Item_ID' || r[13]) continue
    const item = mapProcItem(r)
    if (item.itemId) map.set(item.itemId, item.itemName)
  }
  return map
}

// item_id -> full item (for type/category breakdowns; skip soft-deleted)
export async function getItemMap(): Promise<Map<string, ProcItem>> {
  const { rows } = await fetchAllRows(ssId, sheets.items)
  const map = new Map<string, ProcItem>()
  for (const r of rows) {
    if (!r[0] || r[0] === 'Item_ID' || r[13]) continue
    const item = mapProcItem(r)
    if (item.itemId) map.set(item.itemId, item)
  }
  return map
}
