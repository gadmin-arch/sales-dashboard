import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapLoan, mapRepayment } from '../mappers/loans'
import type { Loan, Repayment } from '../types'

const ssId = GOOGLE_CONFIG.payroll.spreadsheetId
const sheets = GOOGLE_CONFIG.payroll.sheets

export async function getAllLoans(): Promise<Loan[]> {
  const { rows } = await fetchAllRows(ssId, sheets.loans)
  // drop header echo + soft-deleted rows (deleted_at at index 11)
  return rows.filter((r) => r[0] && r[0] !== 'loan_id' && !r[11]).map(mapLoan)
}

export async function getRepayments(): Promise<Repayment[]> {
  const { rows } = await fetchAllRows(ssId, sheets.repayments)
  // drop header echo + soft-deleted rows (deleted_at at index 9)
  return rows.filter((r) => r[0] && r[0] !== 'repayment_id' && !r[9]).map(mapRepayment)
}
