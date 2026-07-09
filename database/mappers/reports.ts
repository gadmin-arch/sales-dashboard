import type { Report } from '../types'
import { parseNum } from './orders'

// reports columns (0-based):
// 0:report_id 1:report_date 2:report_prj_id 3:report_time 4:report_overtime
// 5:report_progress 6:report_remarks 7:report_user 8:report_score
// 9:report_created_at 10:report_deleted_at
export function mapReport(row: string[]): Report {
  return {
    reportId: row[0] || '',
    reportDate: row[1] || '',
    reportPrjId: (row[2] || '').trim(),
    reportTime: parseNum(row[3]),
    reportOvertime: parseNum(row[4]),
    reportProgress: row[5] || '',
    reportRemarks: row[6] || '',
    reportUser: (row[7] || '').trim(),
    reportScore: parseNum(row[8]),
    reportCreatedAt: row[9] || '',
    deletedAt: row[10] || '',
  }
}
