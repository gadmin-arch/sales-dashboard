import { query } from '../db'
import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'

export interface LeaveRecord {
  userId: string
  leaveId: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  remarks: string
  reason: string
}

export interface OvertimeRecord {
  userId: string
  date: string
  timeStr: string
  remarks: string
  reason: string
}

export interface AttendanceRecord {
  userId: string
  date: string
  workHours: number
  isHoliday: boolean
  isWeekend: boolean
  clockIn?: string
  clockOut?: string
}

function getTableName(spreadsheetId: string, sheetName: string): string {
  const prefix = spreadsheetId.substring(0, 8).toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const name = sheetName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return `sheet_${prefix}_${name}`
}

// Convert DD/MM/YYYY or YYYY-MM-DD or MM/DD/YYYY to Date object securely
function robustParseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  
  // Try native JS parsing first (handles MM/DD/YYYY and YYYY-MM-DD natively)
  let parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }

  // If native parsing failed, it might be DD/MM/YYYY (where DD > 12, causing JS to fail)
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      if (parts[2].length === 4) {
         // DD/MM/YYYY fallback
         parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
      } else if (parts[0].length === 4) {
         // YYYY/MM/DD fallback
         parsed = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`)
      }
    }
  }
  
  if (!parsed || isNaN(parsed.getTime())) return null
  return parsed
}

export async function getPublicHolidays(): Promise<Set<string>> {
  try {
    const { headers, rows } = await fetchAllRows(GOOGLE_CONFIG.reports.overtimeSpreadsheetId, GOOGLE_CONFIG.reports.sheets.holidays)
    const idx = Object.fromEntries(headers.map((h, i) => [h.toLowerCase().trim(), i]))
    
    const holidays = new Set<string>()
    for (const row of rows) {
      const holiday_date = row[idx['holiday_date']] || ''
      if (holiday_date) {
        const d = robustParseDate(holiday_date)
        if (d) holidays.add(d.toISOString().split('T')[0])
      }
    }
    return holidays
  } catch (e) {
    console.warn('Error fetching holidays', e instanceof Error ? e.message : e)
    return new Set()
  }
}

export function isHolidayOrWeekend(date: Date, publicHolidays: Set<string>, userSite: string): { isHoliday: boolean, isWeekend: boolean } {
  const dateStr = date.toISOString().split('T')[0]
  const isPublicHoliday = publicHolidays.has(dateStr)
  
  const day = date.getDay()
  let isWeekend = false
  
  if (!userSite || userSite.toUpperCase() === 'HO') {
    isWeekend = (day === 0 || day === 6) // Sunday or Saturday
  } else {
    isWeekend = (day === 0) // Sunday only
  }
  
  return {
    isHoliday: isPublicHoliday,
    isWeekend: isWeekend
  }
}

export async function getAttendancesData(dateFrom?: string, dateTo?: string): Promise<AttendanceRecord[]> {
  const records: AttendanceRecord[] = []
  
  const sources = [
    { spread: GOOGLE_CONFIG.attendances.currentSpreadsheetId, sheet: GOOGLE_CONFIG.attendances.sheets.attendances },
    { spread: GOOGLE_CONFIG.attendances.backupSpreadsheetId, sheet: GOOGLE_CONFIG.attendances.sheets.attendances }
  ]
  
  for (const source of sources) {
    try {
      const { headers, rows } = await fetchAllRows(source.spread, source.sheet)
      const idx = Object.fromEntries(headers.map((h, i) => [h.toLowerCase().trim(), i]))
      
      for (const row of rows) {
        const user_id = row[idx['attendance_user_id']] || ''
        if (!user_id) continue

        const attendance_counter = row[idx['attendance_counter']] || ''
        const attendance_date = row[idx['attendance_date']] || ''
        const attendance_approved_hours = row[idx['attendance_approved_hours']] || ''
        const attendance_total_hours = row[idx['attendance_total_hours']] || ''

        // attendance_counter: 1=clock in, 2=clock out, 3=approved
        const counter = parseInt(attendance_counter) || 0
        if (counter < 2) continue
        
        const attendance_time_in = row[idx['attendance_time_in']] || ''
        const attendance_time_out = row[idx['attendance_time_out']] || ''
        
        const d = robustParseDate(attendance_date)
        if (!d) continue
        
        if (dateFrom) {
          const from = robustParseDate(dateFrom)
          if (from && d < from) continue
        }
        if (dateTo) {
          const to = robustParseDate(dateTo)
          if (to) {
             const toEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
             if (d > toEnd) continue
          }
        }
        
        // Use approved_hours first, fallback to parsing total_hours (HH:MM:SS)
        let approvedHours = parseFloat(attendance_approved_hours) || 0
        if (approvedHours === 0 && attendance_total_hours) {
          const match = attendance_total_hours.match(/(\d+):(\d+)/)
          if (match) {
            approvedHours = parseInt(match[1]) + parseInt(match[2]) / 60
          }
        }
        
        // Rule: Worker Reports Sanitization - Clamp hours > 16 to 8
        if (approvedHours > 16) {
          approvedHours = 8
        }

        
        records.push({
          userId: user_id.toLowerCase().trim(),
          date: d.toISOString().split('T')[0],
          workHours: approvedHours,
          isHoliday: false, // will be evaluated by caller using isHolidayOrWeekend
          isWeekend: false, // will be evaluated by caller using isHolidayOrWeekend
          clockIn: attendance_time_in,
          clockOut: attendance_time_out,
        })
      }
    } catch (e) {
      console.warn(`Spreadsheet ${source.spread} might not exist yet or failed`, e)
    }
  }
  
  return records
}

export async function getLeavesData(dateFrom?: string, dateTo?: string): Promise<LeaveRecord[]> {
  try {
    const { headers, rows } = await fetchAllRows(GOOGLE_CONFIG.reports.overtimeSpreadsheetId, GOOGLE_CONFIG.reports.sheets.leaves)
    const idx = Object.fromEntries(headers.map((h, i) => [h.toLowerCase().trim(), i]))
    
    const records: LeaveRecord[] = []
    for (const row of rows) {
      const leave_user_id = row[idx['leave_user_id']] || ''
      if (!leave_user_id) continue

      const leave_status = row[idx['leave_status']] || ''
      const status = leave_status.toLowerCase()
      // Status 'A' = Approved, 'P' = Pending, 'R' = Rejected
      if (status !== 'a' && status !== 'approved' && status !== 'done' && status !== 'approve') continue
      
      const leave_start_date = row[idx['leave_start_date']] || ''
      const leave_end_date = row[idx['leave_end_date']] || ''
      const startD = robustParseDate(leave_start_date)
      const endD = robustParseDate(leave_end_date)
      
      if (!startD || !endD) continue
      
      if (dateFrom) {
        const from = robustParseDate(dateFrom)
        if (from && endD < from) continue // leave ended before filter start
      }
      if (dateTo) {
        const to = robustParseDate(dateTo)
        if (to) {
             const toEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
             if (startD > toEnd) continue
        }
      }
      
      records.push({
        userId: leave_user_id.toLowerCase().trim(),
        leaveId: row[idx['leave_id']] || '',
        startDate: startD.toISOString().split('T')[0],
        endDate: endD.toISOString().split('T')[0],
        totalDays: parseFloat(row[idx['leave_total_days']]) || 0,
        status: leave_status,
        remarks: row[idx['leave_remarks']] || '',
        reason: row[idx['leave_reason']] || ''
      })
    }
    return records
  } catch (e) {
    console.warn('Error fetching leaves', e instanceof Error ? e.message : e)
    return []
  }
}

export async function getOvertimesData(dateFrom?: string, dateTo?: string): Promise<OvertimeRecord[]> {
  try {
    const { headers, rows } = await fetchAllRows(GOOGLE_CONFIG.reports.overtimeSpreadsheetId, GOOGLE_CONFIG.reports.sheets.overtimes)
    const idx = Object.fromEntries(headers.map((h, i) => [h.toLowerCase().trim(), i]))
    
    const records: OvertimeRecord[] = []
    for (const row of rows) {
      const overtime_user_id = row[idx['overtime_user_id']] || ''
      if (!overtime_user_id) continue

      const overtime_status = row[idx['overtime_status']] || ''
      const status = overtime_status.toLowerCase()
      // Status 'A' = Approved, 'P' = Pending, 'R' = Rejected
      if (status !== 'a' && status !== 'approved' && status !== 'done' && status !== 'approve') continue
      
      const overtime_date = row[idx['overtime_date']] || ''
      const d = robustParseDate(overtime_date)
      if (!d) continue
      
      if (dateFrom) {
        const from = robustParseDate(dateFrom)
        if (from && d < from) continue
      }
      if (dateTo) {
        const to = robustParseDate(dateTo)
        if (to) {
             const toEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
             if (d > toEnd) continue
        }
      }
      
      records.push({
        userId: overtime_user_id.toLowerCase().trim(),
        date: d.toISOString().split('T')[0],
        timeStr: row[idx['overtime_time']] || '',
        remarks: row[idx['overtime_remarks']] || '',
        reason: row[idx['overtime_reason']] || ''
      })
    }
    return records
  } catch (e) {
    console.warn('Error fetching overtimes', e instanceof Error ? e.message : e)
    return []
  }
}
