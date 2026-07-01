import type { Loan, Repayment } from '../types'
import { parseNum } from './orders'

// loans columns:
// 0:loan_id 1:loan_date 2:loan_user_id 3:loan_amount 4:loan_tenor 5:loan_paid
// 6:loan_count 7:loan_thp 8:loan_remarks 9:created_at 10:updated_at 11:deleted_at
// 12:created_by 13:updated_by
export function mapLoan(row: string[]): Loan {
  return {
    loanId: row[0] || '',
    date: row[1] || '',
    userId: row[2] || '',
    amount: parseNum(row[3]),
    tenor: parseNum(row[4]),
    paid: parseNum(row[5]),
    count: parseNum(row[6]),
    thp: row[7] || '',
    remarks: row[8] || '',
    createdAt: row[9] || '',
    deletedAt: row[11] || '',
  }
}

// repayments columns:
// 0:repayment_id 1:repayment_date 2:repayment_loan_id 3:repayment_user_id
// 4:repayment_amount 5:repayment_thp 6:repayment_count 7:repayment_remarks
// 8:created_at 9:deleted_at 10:edited_at 11:created_by 12:updated_by
export function mapRepayment(row: string[]): Repayment {
  return {
    repaymentId: row[0] || '',
    date: row[1] || '',
    loanId: row[2] || '',
    userId: row[3] || '',
    amount: parseNum(row[4]),
    thp: row[5] || '',
    count: parseNum(row[6]),
    remarks: row[7] || '',
    createdAt: row[8] || '',
    deletedAt: row[9] || '',
  }
}
