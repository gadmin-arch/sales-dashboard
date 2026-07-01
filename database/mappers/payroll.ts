import type { Payroll, PayrollPayment, PayrollListItem, Occupation } from '../types'
import { parseNum } from './orders'

// payroll columns (0-based):
// 0:user 1:payroll_account_id 2:start_date 3:end_date 4:id_payroll 5:description
// 6:reduction_amount 7:receipt_amount 8:total_receipts 9:takehomepay_reduction
// 10:takehomepay_receipt 11:takehomepay 12:released_price 13:file 14:status
// 15:log_at 16:print 17:created_by 18:updated_by 19:updated_at 20:created_at 21:deleted_at
export function mapPayroll(row: string[]): Payroll {
  return {
    userId: row[0] || '',
    payrollAccountId: row[1] || '',
    startDate: row[2] || '',
    endDate: row[3] || '',
    idPayroll: row[4] || '',
    description: row[5] || '',
    reductionAmount: parseNum(row[6]),
    receiptAmount: parseNum(row[7]),
    totalReceipts: parseNum(row[8]),
    thpReduction: parseNum(row[9]),
    thpReceipt: parseNum(row[10]),
    takeHomePay: parseNum(row[11]),
    releasedPrice: parseNum(row[12]),
    file: row[13] || '',
    status: row[14] || '',
    createdBy: row[17] || '',
    updatedAt: row[19] || '',
    createdAt: row[20] || '',
    deletedAt: row[21] || '',
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
