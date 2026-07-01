import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapPayroll, mapPayrollPayment, mapPayrollListItem, mapOccupation } from '../mappers/payroll'
import type { Payroll, PayrollPayment, PayrollListItem, Occupation } from '../types'

const cfg = GOOGLE_CONFIG.payroll
const ssId = cfg.spreadsheetId
const sheets = cfg.sheets

export async function getAllPayroll(): Promise<Payroll[]> {
  const { rows } = await fetchAllRows(ssId, sheets.payroll)
  // drop header echo + soft-deleted rows (deleted_at at index 21)
  return rows.filter((r) => r[0] && r[0] !== 'user' && !r[21]).map(mapPayroll)
}

export async function getPayrollPayments(): Promise<PayrollPayment[]> {
  const { rows } = await fetchAllRows(cfg.paymentsSpreadsheetId, sheets.payrollPayments)
  return rows.filter((r) => r[0] && r[0] !== 'pp_id' && !r[8]).map(mapPayrollPayment)
}

export async function getPayrollLists(): Promise<PayrollListItem[]> {
  const { rows } = await fetchAllRows(ssId, sheets.payrollLists)
  return rows.filter((r) => r[0] && r[0] !== 'id_payrolllist' && !r[11]).map(mapPayrollListItem)
}

export async function getOccupations(): Promise<Occupation[]> {
  const { rows } = await fetchAllRows(ssId, sheets.occupations)
  return rows.filter((r) => r[0] && r[0] !== 'occupation_id').map(mapOccupation)
}

// ── Reference maps (categories, types, statuses) ──
let categoryMap: Map<string, string> | null = null
let typeMap: Map<string, { name: string; positive: boolean }> | null = null
let statusMap: Map<string, string> | null = null

export async function loadPayrollRefMaps(): Promise<void> {
  if (categoryMap) return
  const [catRows, typeRows, statusRows] = await Promise.all([
    fetchAllRows(ssId, sheets.payrollCategories),
    fetchAllRows(ssId, sheets.payrollTypes),
    fetchAllRows(ssId, sheets.payrollStatus),
  ])
  categoryMap = new Map()
  for (const r of catRows.rows) if (r[0] && r[0] !== 'id_category') categoryMap.set(r[0], r[1] || r[0])
  typeMap = new Map()
  for (const r of typeRows.rows) {
    if (r[0] && r[0] !== 'id_type') typeMap.set(r[0], { name: r[1] || r[0], positive: String(r[4]).toUpperCase() === 'TRUE' })
  }
  statusMap = new Map()
  for (const r of statusRows.rows) if (r[0] && r[0] !== 'payroll_status_id') statusMap.set(r[0], r[1] || r[0])
}

export function getPayrollCategoryLabel(id: string): string {
  return categoryMap?.get(id) || id || '-'
}
export function getPayrollTypeInfo(id: string): { name: string; positive: boolean } {
  return typeMap?.get(id) || { name: id || '-', positive: true }
}
export function getPayrollStatusLabel(id: string): string {
  return statusMap?.get(id) || id || '-'
}
