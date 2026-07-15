import type { PurchaseRequest, QuotationRequest, QrList, RefRow } from '../types'
import { parseNum } from './orders'

// purchase_requests columns:
// 0:pr_id 1:pr_prf_id 2:pr_item_id 3:pr_quantity 4:pr_quantity_purchased
// 5:pr_estimated_price 6:pr_purchased_price 7:pr_variance 8:pr_duedate 9:pr_remarks
// 10:pr_approval_status 11:pr_status 12:pr_completed_at 13:pr_overdue_status
// 14:pr_project_id 15:pr_handle_by 16:pr_user_id
// 17:created_at 18:updated_at 19:deleted_at 20:created_by 21:updated_by
export function mapPurchaseRequest(row: string[]): PurchaseRequest {
  return {
    prId: row[0] || '',
    prPrfId: row[1] || '',
    prItemId: row[2] || '',
    prQuantity: parseNum(row[3]),
    prQuantityPurchased: parseNum(row[4]),
    prEstimatedPrice: parseNum(row[5]),
    prPurchasedPrice: parseNum(row[6]),
    prVariance: parseNum(row[7]),
    prDuedate: row[8] || '',
    prApprovalStatus: row[10] || '',
    prStatus: row[11] || '',
    prCompletedAt: row[12] || '',
    prOverdueStatus: row[13] || '',
    prProjectId: row[14] || '',
    prHandleBy: row[15] || '',
    prUserId: row[16] || '',
    createdAt: row[17] || '',
    updatedAt: row[18] || '',
    deletedAt: row[19] || '',
  }
}

// quotation_requests columns:
// 0:qr_id 1:qr_qrf_id 2:qr_item_id 3:qr_quantity 4:qr_duedate 5:qr_remarks
// 6:qr_status 7:qr_submitted_at 8:qr_overdue_status 9:qr_handle_by 10:qr_user_id
// 11:created_at 12:updated_at 13:deleted_at 14:created_by 15:updated_by
export function mapQuotationRequest(row: string[]): QuotationRequest {
  return {
    qrId: row[0] || '',
    qrQrfId: row[1] || '',
    qrItemId: row[2] || '',
    qrQuantity: parseNum(row[3]),
    qrDuedate: row[4] || '',
    qrRemarks: row[5] || '',
    qrStatus: row[6] || '',
    qrSubmittedAt: row[7] || '',
    qrOverdueStatus: row[8] || '',
    qrHandleBy: row[9] || '',
    qrUserId: row[10] || '',
    createdAt: row[11] || '',
    updatedAt: row[12] || '',
    deletedAt: row[13] || '',
  }
}

// qr_lists columns (vendor quotes answering a quotation request):
// 0:qrl_id 1:qrl_qr_id 2:qrl_pr_id 3:qrl_item_id 4:qrl_quantity 5:qrl_unit
// 6:qrl_price 7:qrl_total_price 8:qrl_vendor 9:qrl_remarks 10:qrl_eta 11:qrl_due_date
// 12:qrl_status_id 13:qrl_approved_at 14:qrl_approver_id
// 15:created_at 16:updated_at 17:deleted_at 18:created_by 19:updated_by
export function mapQrList(row: string[]): QrList {
  return {
    qrlId: row[0] || '',
    qrlQrId: row[1] || '',
    qrlPrId: row[2] || '',
    qrlItemId: row[3] || '',
    qrlQuantity: parseNum(row[4]),
    qrlUnit: row[5] || '',
    qrlPrice: parseNum(row[6]),
    qrlTotalPrice: parseNum(row[7]),
    qrlVendor: row[8] || '',
    qrlRemarks: row[9] || '',
    qrlEta: row[10] || '',
    qrlDueDate: row[11] || '',
    qrlStatusId: row[12] || '',
    qrlApprovedAt: row[13] || '',
    qrlApproverId: row[14] || '',
    createdAt: row[15] || '',
    deletedAt: row[17] || '',
  }
}

// reference sheets: first two columns are id + name
export function mapRefRow(row: string[]): RefRow {
  return { id: row[0] || '', name: row[1] || '' }
}
