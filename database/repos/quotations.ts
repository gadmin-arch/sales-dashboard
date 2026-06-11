import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import {
  mapQuotation, mapQuotationStatus, mapQuotationType, mapQuotationLog,
} from '../mappers/quotations'
import type { Quotation, QuotationStatus, QuotationType, QuotationLog } from '../types'

let statusMap: Map<string, string> | null = null
let typeMap: Map<string, string> | null = null

export async function loadRefMaps() {
  if (statusMap) return
  const ssId = GOOGLE_CONFIG.quotations.spreadsheetId
  const s = GOOGLE_CONFIG.quotations.sheets

  const [statusRows, typeRows] = await Promise.all([
    fetchAllRows(ssId, s.quotationStatuses),
    fetchAllRows(ssId, s.quotationTypes),
  ])

  statusMap = new Map()
  for (const row of statusRows.rows) {
    const st = mapQuotationStatus(row)
    if (st.qsId) statusMap.set(st.qsId, st.qsDescription)
  }

  typeMap = new Map()
  for (const row of typeRows.rows) {
    const t = mapQuotationType(row)
    if (t.qtId) typeMap.set(t.qtId, t.qtDesc)
  }
}

export async function getAllQuotations(): Promise<Quotation[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.quotations.spreadsheetId,
    GOOGLE_CONFIG.quotations.sheets.quotations
  )
  // Filter out header row and deleted rows (deleted_at at index 30)
  return rows.filter((r) => r[0] && r[0] !== 'q_id' && !r[30]).map(mapQuotation)
}

export async function getQuotationsByOwner(ownerId: string): Promise<Quotation[]> {
  const all = await getAllQuotations()
  return all.filter((q) => q.qOwner === ownerId)
}

export async function getQuotationStatuses(): Promise<QuotationStatus[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.quotations.spreadsheetId,
    GOOGLE_CONFIG.quotations.sheets.quotationStatuses
  )
  return rows.filter((r) => r[0]).map(mapQuotationStatus)
}

export function getStatusLabel(statusId: string): string {
  return statusMap?.get(statusId) || statusId
}

export function getQuotationTypeLabel(typeId: string): string {
  return typeMap?.get(typeId) || typeId
}
