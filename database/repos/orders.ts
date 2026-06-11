import { fetchAllRows, getSheetHeaders } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapOrder, parseNum } from '../mappers/orders'
import { mapOrderType } from '../mappers/reference'
import type { Order, OrderType, ProjectLog, Bast, BastLog, FinanceLog } from '../types'

let orderTypeMap: Map<string, string> | null = null
let flagMap: Map<string, string> | null = null

export async function loadRefMaps() {
  if (orderTypeMap) return
  const ssId = GOOGLE_CONFIG.orders.spreadsheetId
  const s = GOOGLE_CONFIG.orders.sheets

  const [otRows, flagRows] = await Promise.all([
    fetchAllRows(ssId, s.orderTypes),
    fetchAllRows(ssId, s.flags),
  ])

  orderTypeMap = new Map()
  for (const row of otRows.rows) {
    const k = row[0] || ''
    const v = row[1] || ''
    if (k) orderTypeMap.set(k, v)
  }

  flagMap = new Map()
  for (const row of flagRows.rows) {
    const k = row[0] || ''
    const v = row[1] || ''
    if (k) flagMap.set(k, v)
  }
}

export async function getAllOrderTypes(): Promise<OrderType[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.orders.spreadsheetId,
    GOOGLE_CONFIG.orders.sheets.orderTypes
  )
  return rows.filter((r) => r[0]).map(mapOrderType)
}

export async function getAllOrders(): Promise<Order[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.orders.spreadsheetId,
    GOOGLE_CONFIG.orders.sheets.orders
  )
  return rows.filter((r) => r[0] && r[0] !== 'prj_id' && !r[46]).map(mapOrder)
}

export async function getOrdersSheetHeaders(): Promise<string[]> {
  const headers = await getSheetHeaders(
    GOOGLE_CONFIG.orders.spreadsheetId,
    GOOGLE_CONFIG.orders.sheets.orders
  )
  return headers
}

export async function getOrdersWithHeaders(): Promise<{ headers: string[]; rows: string[][] }> {
  const { headers, rows } = await fetchAllRows(
    GOOGLE_CONFIG.orders.spreadsheetId,
    GOOGLE_CONFIG.orders.sheets.orders
  )
  return { headers, rows: rows.filter((r) => r[0] && r[0] !== 'prj_id' && !r[46]) }
}

export async function getProjectOrders(): Promise<Order[]> {
  const all = await getAllOrders()
  return all.filter((o) => o.prjType === 'Project')
}

export async function getOrderTypeLabel(otId: string): Promise<string> {
  await loadRefMaps()
  return orderTypeMap?.get(otId) || otId
}

export function getOrderTypeLabelSync(otId: string): string {
  return orderTypeMap?.get(otId) || otId
}

export function getFlagLabel(flagId: string): string {
  return flagMap?.get(flagId) || flagId
}

export async function getProjectLogs(prjId: string): Promise<ProjectLog[]> {
  const { rows } = await fetchAllRows(GOOGLE_CONFIG.orders.spreadsheetId, GOOGLE_CONFIG.orders.sheets.projectLog)
  return rows.filter((r) => r[1] === prjId).map((r) => ({
    plId: r[0] || '', plPrjId: r[1] || '', plStatusOld: r[2] || '',
    plStatusNew: r[3] || '', createdBy: r[4] || '', createdAt: r[5] || '',
  }))
}

export async function getBasts(prjId: string): Promise<Bast[]> {
  const { rows } = await fetchAllRows(GOOGLE_CONFIG.orders.spreadsheetId, GOOGLE_CONFIG.orders.sheets.basts)
  return rows.filter((r) => r[2] === prjId).map((r) => ({
    bastId: r[0] || '', bastNumber: r[1] || '', bastPrjId: r[2] || '',
    bastFile: r[3] || '', bastCreatedDate: r[4] || '', bastSubmitDate: r[5] || '',
    bastReceivedDate: r[6] || '', bastStatus: r[7] || '', createdBy: r[8] || '',
    createdAt: r[9] || '', updatedBy: r[10] || '', updatedAt: r[11] || '', deletedAt: r[12] || '',
  }))
}

export async function getFinanceLogs(prjId: string): Promise<FinanceLog[]> {
  const { rows } = await fetchAllRows(GOOGLE_CONFIG.orders.spreadsheetId, GOOGLE_CONFIG.orders.sheets.financeLog)
  return rows.filter((r) => r[1] === prjId).map((r) => ({
    flId: r[0] || '', flPrjId: r[1] || '', flStatusOld: r[2] || '',
    flStatusNew: r[3] || '', createdBy: r[4] || '', createdAt: r[5] || '',
  }))
}
