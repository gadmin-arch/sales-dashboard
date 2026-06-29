import type { Invoice, Payment } from '../types'
import { parseNum } from './orders'

// invoices sheet columns (0-based):
// 0:inv_id 1:inv_number 2:inv_r_id 3:inv_date 4:inv_estimated_payment_date
// 5:inv_company_id 6:inv_npwp 7:inv_telephone 8:inv_fax 9:inv_address
// 10:inv_currency 11:inv_total 12:inv_discount 13:inv_net 14:inv_tax_basis
// 15:inv_tax 16:inv_amount 17:inv_payment_amount 18:inv_payment_percentage
// 19:inv_ref_name 20:inv_ref_description 21:inv_ref_date 22:inv_payment_terms
// 23:inv_delivery_mode 24:inv_tax_id 25:inv_remarks
export function mapInvoice(row: string[]): Invoice {
  return {
    invId: row[0] || '',
    invNumber: row[1] || '',
    invDate: row[3] || '',
    invEstPaymentDate: row[4] || '',
    invCompanyId: row[5] || '',
    invCurrency: (row[10] || 'IDR').trim(),
    invTotal: parseNum(row[11]),
    invNet: parseNum(row[13]),
    invAmount: parseNum(row[16]),
    invPaymentAmount: parseNum(row[17]),
    invPaymentPercentage: parseNum(row[18]),
    invRefName: row[19] || '',
    invRefDescription: row[20] || '',
    invRemarks: row[25] || '',
  }
}

// payments sheet columns (0-based):
// 0:pay_id 1:pay_company_id 2:pay_file 3:pay_date 4:pay_currency
// 5:pay_amount 6:pay_net 7:pay_tax_basis 8:pay_ppn_amount 9:pay_pph_amount
// 10:pay_total_amount 11:pay_remarks 12:created_at 13:created_by
// 14:updated_at 15:updated_by 16:deleted_at 17:is_valid_amount
export function mapPayment(row: string[]): Payment {
  return {
    payId: row[0] || '',
    payCompanyId: row[1] || '',
    payDate: row[3] || '',
    payCurrency: (row[4] || 'IDR').trim(),
    payAmount: parseNum(row[5]),
    payTotalAmount: parseNum(row[10]),
    payRemarks: row[11] || '',
    deletedAt: row[16] || '',
  }
}
