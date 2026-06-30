import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapPurchaseRequest, mapQuotationRequest, mapQrList, mapRefRow } from '../mappers/purchasing'
import type { PurchaseRequest, QuotationRequest, QrList, RefRow } from '../types'

let prStatusMap: Map<string, string> | null = null
let qrStatusMap: Map<string, string> | null = null
let overdueStatusMap: Map<string, string> | null = null

const ssId = GOOGLE_CONFIG.purchasing.spreadsheetId
const sheets = GOOGLE_CONFIG.purchasing.sheets

export async function loadRefMaps(): Promise<void> {
  if (prStatusMap) return
  const [prRows, qrRows, odRows] = await Promise.all([
    fetchAllRows(ssId, sheets.prStatuses),
    fetchAllRows(ssId, sheets.qrStatuses),
    fetchAllRows(ssId, sheets.overdueStatuses),
  ])
  prStatusMap = new Map()
  for (const r of prRows.rows) if (r[0]) prStatusMap.set(r[0], r[1] || r[0])
  qrStatusMap = new Map()
  for (const r of qrRows.rows) if (r[0]) qrStatusMap.set(r[0], r[1] || r[0])
  overdueStatusMap = new Map()
  for (const r of odRows.rows) if (r[0]) overdueStatusMap.set(r[0], r[1] || r[0])
}

export function getPrStatusLabel(id: string): string {
  return prStatusMap?.get(id) || id || '-'
}
export function getQrStatusLabel(id: string): string {
  return qrStatusMap?.get(id) || id || '-'
}
export function getOverdueStatusLabel(id: string): string {
  return overdueStatusMap?.get(id) || id || '-'
}

export async function getAllPurchaseRequests(): Promise<PurchaseRequest[]> {
  const { rows } = await fetchAllRows(ssId, sheets.purchaseRequests)
  // drop header echo + soft-deleted rows (deleted_at at index 19)
  return rows.filter((r) => r[0] && r[0] !== 'pr_id' && !r[19]).map(mapPurchaseRequest)
}

export async function getAllQuotationRequests(): Promise<QuotationRequest[]> {
  const { rows } = await fetchAllRows(ssId, sheets.quotationRequests)
  return rows.filter((r) => r[0] && r[0] !== 'qr_id' && !r[13]).map(mapQuotationRequest)
}

export async function getAllQrLists(): Promise<QrList[]> {
  const { rows } = await fetchAllRows(ssId, sheets.qrLists)
  return rows.filter((r) => r[0] && r[0] !== 'qrl_id' && !r[17]).map(mapQrList)
}

export async function getPrStatuses(): Promise<RefRow[]> {
  const { rows } = await fetchAllRows(ssId, sheets.prStatuses)
  return rows.filter((r) => r[0] && r[0] !== 'pr_status_id').map(mapRefRow)
}
