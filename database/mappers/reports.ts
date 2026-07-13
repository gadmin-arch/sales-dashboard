import type { Report } from '../types'
import { parseNum } from './orders'

/** If hours > 16 it's likely a typo — fall back to 8 */
function clampHours(h: number): number {
  return h > 16 ? 8 : h
}
// reports columns (0-based):
// 0:report_id 1:report_date 2:report_prj_id 3:report_time 4:report_overtime
// 5:report_progress 6:report_remarks 7:report_user 8:report_score
// 9:report_created_at 10:report_deleted_at
export function mapReport(row: string[]): Report {
  return {
    reportId: row[0] || '',
    reportDate: row[1] || '',
    reportPrjId: (row[2] || '').trim(),
    reportTime: clampHours(parseNum(row[3])),
    reportOvertime: parseNum(row[4]),
    reportProgress: row[5] || '',
    reportRemarks: row[6] || '',
    reportUser: (row[7] || '').trim(),
    reportScore: parseNum(row[8]),
    reportCreatedAt: row[9] || '',
    deletedAt: row[10] || '',
  }
}
