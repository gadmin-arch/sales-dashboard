import type { Order } from '../types'

// Column indices for the orders sheet (0-based):
// 0:prj_id 1:prj_name 2:prj_lead_id 3:prj_o_id 4:prj_q_id 5:prj_type
// 6:prj_company_id 7:prj_end_user_id 8:prj_picc_id 9:prj_ot_id
// 10:prj_po_number 11:prj_po_date 12:prj_po_file 13:po_currency
// 14:prj_po_material 15:prj_po_service 16:prj_po_total
// 17:prj_est_po_material 18:prj_est_po_service 19:prj_project_cost
// 20:prj_flag 21:prj_start_date 22:prj_due_date
// 23:prj_start_date_plan 24:prj_due_date_plan 25:prj_start_date_actual
// 26:prj_end_date_actual 27:prj_file 28:prj_afi 29:prj_pe_site_id 30:prj_pe_pic 31:prj_pe_status
// 32:prj_f_user 33:prj_f_status 34:prj_inv_percent 35:prj_inv_amount 36:prj_pay_percent 37:prj_pay_amount
// 38:prj_remarks 39:prj_pe_remarks 40:prj_f_remarks 41:prj_owner 42:created_by 43:created_at 44:updated_by 45:updated_at 46:deleted_at 47:notified_at

export function mapOrder(row: string[]): Order {
  return {
    prjId: row[0] || '',
    prjName: row[1] || '',
    prjLeadId: row[2] || '',
    prjOId: row[3] || '',
    prjQId: row[4] || '',
    prjType: row[5] || '',
    prjCompanyId: row[6] || '',
    prjEndUserId: row[7] || '',
    prjPiccId: row[8] || '',
    prjOtId: row[9] || '',
    prjPoNumber: row[10] || '',
    prjPoDate: row[11] || '',
    prjPoFile: row[12] || '',
    poCurrency: (row[13] || 'IDR').trim(),
    prjPoMaterial: parseNum(row[14]),
    prjPoService: parseNum(row[15]),
    prjPoTotal: parseNum(row[16]),
    prjEstPoMaterial: parseNum(row[17]),
    prjEstPoService: parseNum(row[18]),
    prjProjectCost: parseNum(row[19]),
    prjFlag: row[20] || '',
    prjStartDate: row[21] || '',
    prjDueDate: row[22] || '',
    prjStartDatePlan: row[23] || '',
    prjDueDatePlan: row[24] || '',
    prjStartDateActual: row[25] || '',
    prjEndDateActual: row[26] || '',
    prjPeStatus: row[31] || '',
    prjFStatus: row[33] || '',
    prjInvPercent: parseNum(row[34]),
    prjPayPercent: parseNum(row[36]),
    prjOwner: row[41] || '',
    createdBy: row[42] || '',
    createdAt: row[43] || '',
    deletedAt: row[46] || '',
  }
}

// Parse numbers like "1,500,000.00" or "100,000,000.00" or "Rp2,987,000"
// Format: comma = thousands separator, dot = decimal, optional "Rp" prefix
export function parseNum(val: string | undefined): number {
  if (!val) return 0
  // Remove "Rp" prefix, commas, and any other non-numeric chars except dot and minus
  const cleaned = val.replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}
