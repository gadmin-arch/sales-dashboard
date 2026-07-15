import type { Payroll, PayrollPayment, PayrollListItem, Occupation } from '../types'
import { parseNum } from './orders'

// payroll columns (0-based) — the sheet gained `occupation_id` at index 1,
// shifting everything after `user` by +1 (this had zeroed the whole Payroll
// tab: the old deleted_at index 21 landed on created_at, which is always
// filled, so every payslip was dropped as "soft-deleted"):
// 0:user 1:occupation_id 2:payroll_account_id 3:start_date 4:end_date
// 5:id_payroll 6:description 7:reduction_amount 8:receipt_amount
// 9:total_receipts 10:takehomepay_reduction 11:takehomepay_receipt
// 12:takehomepay 13:released_price 14:file 15:status 16:log_at 17:print
// 18:created_by 19:updated_by 20:updated_at 21:created_at 22:deleted_at
export function mapPayroll(row: string[]): Payroll {
  return {
    userId: row[0] || '',
    payrollAccountId: row[2] || '',
    startDate: row[3] || '',
    endDate: row[4] || '',
    idPayroll: row[5] || '',
    description: row[6] || '',
    reductionAmount: parseNum(row[7]),
    receiptAmount: parseNum(row[8]),
    totalReceipts: parseNum(row[9]),
    thpReduction: parseNum(row[10]),
    thpReceipt: parseNum(row[11]),
    takeHomePay: parseNum(row[12]),
    releasedPrice: parseNum(row[13]),
    file: row[14] || '',
    status: row[15] || '',
    createdBy: row[18] || '',
    updatedAt: row[20] || '',
    createdAt: row[21] || '',
    deletedAt: row[22] || '',
  }
}

// payroll_payments columns (payroll_payments_db):
// 0:pp_id 1:pp_payroll_id 2:pp_amount 3:created_by 4:updated_by 5:deleted_by
// 6:created_at 7:updated_at 8:deleted_at
export function mapPayrollPayment(row: string[]): PayrollPayment {
  return {
    ppId: row[0] || '',
    payrollId: row[1] || '',
    amount: parseNum(row[2]),
    createdAt: row[6] || '',
    deletedAt: row[8] || '',
  }
}

// payroll_lists columns:
// 0:id_payrolllist 1:payroll_id 2:pl_fa_id 3:category_id 4:type_id 5:amount 6:remarks
// 7:created_by 8:updated_by 9:updated_at 10:created_at 11:deleted_at
export function mapPayrollListItem(row: string[]): PayrollListItem {
  return {
    id: row[0] || '',
    payrollId: row[1] || '',
    faId: row[2] || '',
    categoryId: row[3] || '',
    typeId: row[4] || '',
    amount: parseNum(row[5]),
    remarks: row[6] || '',
    deletedAt: row[11] || '',
  }
}

// occupations columns:
// 0:occupation_id 1:occupation_user_id 2:occupation_name 3:salary_fixed? 4:salary_fix
// 5:salary_sick 6:salary_permission 7:salary_presence 8:salary_report 9:salary_basic
// 10:salary_overtime 11:salary_meal
export function mapOccupation(row: string[]): Occupation {
  return {
    occupationId: row[0] || '',
    userId: row[1] || '',
    name: row[2] || '',
    salaryFixed: row[3] || '',
    salaryFix: parseNum(row[4]),
    salaryMeal: parseNum(row[11]),
  }
}
