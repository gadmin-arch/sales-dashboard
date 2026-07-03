import { fetchAllRows, registerCacheClearCallback } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapPayroll, mapPayrollPayment, mapPayrollListItem, mapOccupation } from '../mappers/payroll'
import type { Payroll, PayrollPayment, PayrollListItem, Occupation, TravelAllowance, UserTerStatus, TerRate } from '../types'

const parseNum = (v: string | undefined): number => {
  if (!v) return 0
  const n = parseFloat(v.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
}

const cfg = GOOGLE_CONFIG.payroll
const ssId = cfg.spreadsheetId
const sheets = cfg.sheets

let categoryMap: Map<string, string> | null = null
let typeMap: Map<string, { name: string; positive: boolean; takehomepay_status: boolean; receipt_status: boolean; tax_status: boolean }> | null = null
let statusMap: Map<string, string> | null = null

registerCacheClearCallback(() => {
  categoryMap = null
  typeMap = null
  statusMap = null
})

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
    if (r[0] && r[0] !== 'id_type') {
      typeMap.set(r[0], {
        name: r[1] || r[0],
        positive: String(r[4]).toUpperCase() === 'TRUE',
        takehomepay_status: String(r[2]).toUpperCase() === 'TRUE',
        receipt_status: String(r[3]).toUpperCase() === 'TRUE',
        tax_status: String(r[5]).toUpperCase() === 'TRUE',
      })
    }
  }
  statusMap = new Map()
  for (const r of statusRows.rows) if (r[0] && r[0] !== 'payroll_status_id') statusMap.set(r[0], r[1] || r[0])
}

export function getPayrollCategoryLabel(id: string): string {
  return categoryMap?.get(id) || id || '-'
}
export function getPayrollTypeInfo(id: string): { name: string; positive: boolean; takehomepay_status: boolean; receipt_status: boolean; tax_status: boolean } {
  return typeMap?.get(id) || { name: id || '-', positive: true, takehomepay_status: true, receipt_status: true, tax_status: true }
}
export function getPayrollStatusLabel(id: string): string {
  return statusMap?.get(id) || id || '-'
}

export async function getTravelAllowances(): Promise<TravelAllowance[]> {
  const { rows } = await fetchAllRows(cfg.travelSpreadsheetId, cfg.sheets.travelAllowances)
  return rows.filter((r) => r[0] && r[0] !== 'ta_id').map((r) => ({
    taId: r[0] || '',
    userId: r[1] || '',
    date: r[2] || '',
    amount: parseNum(r[3]),
    totalDays: parseNum(r[4]),
  }))
}

export async function getUserTerStatuses(): Promise<UserTerStatus[]> {
  const { rows } = await fetchAllRows(cfg.taxStatusSpreadsheetId, cfg.sheets.userTerStatuses)
  return rows.filter((r) => r[0] && r[0] !== 'uts_user_id').map((r) => ({
    userId: r[0] || '',
    taxStatusId: r[1] || '',
    terStatusId: r[2] || '',
  }))
}

export async function getTerRates(): Promise<TerRate[]> {
  const { rows } = await fetchAllRows(cfg.terSpreadsheetId, cfg.sheets.ters)
  return rows.filter((r) => r[0] && r[0] !== 'ter_id').map((r) => {
    let pct = 0
    const pctStr = r[3] || ''
    if (pctStr.endsWith('%')) {
      pct = parseFloat(pctStr.slice(0, -1)) / 100
    } else {
      pct = parseFloat(pctStr)
    }
    return {
      id: r[0] || '',
      lowerLimit: parseNum(r[1]),
      upperLimit: parseNum(r[2]),
      percentage: pct,
      status: r[4] || '',
    }
  })
}
