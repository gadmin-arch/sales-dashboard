import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapReport } from '../mappers/reports'
import type { Report } from '../types'

const ssId = GOOGLE_CONFIG.reports.spreadsheetId
const sheets = GOOGLE_CONFIG.reports.sheets

// All non-deleted worker reports. deleted_at is column K (index 10).
export async function getAllReports(): Promise<Report[]> {
  const { rows } = await fetchAllRows(ssId, sheets.reports)
  return rows.filter((r) => r[0] && r[0] !== 'report_id' && !r[10]).map(mapReport)
}
