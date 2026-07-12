import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapReport } from '../mappers/reports'
import type { Report } from '../types'
import { unstable_cache } from 'next/cache'

const ssId = GOOGLE_CONFIG.reports.spreadsheetId
const archiveSsId = GOOGLE_CONFIG.reports.archiveSpreadsheetId
const sheets = GOOGLE_CONFIG.reports.sheets

// Fetch archive with Next.js persistent cache (revalidates once a week).
// Bypasses the frequent clearSheetCache logic because this is historical data.
const getArchiveReports = unstable_cache(
  async (): Promise<Report[]> => {
    try {
      const { rows } = await fetchAllRows(archiveSsId, sheets.reports)
      return rows.filter((r) => r[0] && r[0] !== 'report_id' && !r[10]).map(mapReport)
    } catch (error) {
      console.warn('[reports] Failed to fetch archive reports:', error)
      return [] // Fallback to empty if archive sheet is unavailable to prevent breaking current reports
    }
  },
  ['worker-reports-archive-2024'],
  { revalidate: 86400 * 7 } // 1 week
)

// All non-deleted worker reports. deleted_at is column K (index 10).
export async function getAllReports(): Promise<Report[]> {
  const [currentData, archiveData] = await Promise.all([
    fetchAllRows(ssId, sheets.reports),
    getArchiveReports()
  ])
  
  const currentReports = currentData.rows
    .filter((r) => r[0] && r[0] !== 'report_id' && !r[10])
    .map(mapReport)
    
  return [...currentReports, ...archiveData]
}
