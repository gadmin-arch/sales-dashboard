import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { parseNum } from '../mappers/orders'

export interface PaymentRequest {
  payreqId: string
  payreqPoId: string
  payreqInvoiceNumber: string
  payreqSite: string
  payreqReceiptDate: string
  payreqInvoiceDate: string
  payreqPercentage: string
  payreqAmount: number
  payreqPayAmount: number
  payreqDuedate: string
  payreqFile: string
  payreqInvFile: string
  payreqRemarks: string
  payreqStatus: string
  payreqCreatedAt: string
  payreqUpdatedAt: string
  payreqDeletedAt?: string
  payreqCreatedBy: string
  payreqUpdatedBy: string
  payreqNotify: string
}

export interface FinancePayment {
  pId: string
  pPayreqId: string
  pPercentage: string
  pAmount: number
  pEvidence: string
  pRemarks: string
  pBank: string
  pSite: string
  pCreatedAt: string
  pUpdatedAt: string
  pDeletedAt?: string
  pCreatedBy: string
  pUpdatedBy: string
  pNotif: string
}

export interface ReimburseCashIn {
  reimburseId: string
  reimburseDate: string
  reimburseDescription: string
  reimburseAmount: number
  reimburseImage: string
  reimburseRemarks: string
  reimburseStatus: string
  reimburseUserIdFk: string
  reimburseUserName: string
  reimburseAdminUserIdFk: string
  reimburseAdminUserName: string
  reimburseCreatedAt: string
  reimburseApprovedAt: string
  reimburseDeletedAt?: string
  reimburseAdminStatus: string
}

export interface ReimburseCashOut {
  reimburseId: string
  reimburseDate: string
  reimbursePrjIdFk: string
  reimburseProjectName: string
  reimburseDescription: string
  reimburseTypeIdFk: string
  reimburseAmount: number
  reimburseImage: string
  reimburseRemarks: string
  reimburseStatus: string
  reimburseUserIdFk: string
  reimburseUserName: string
  reimburseAdminUserIdFk: string
  reimburseAdminUserName: string
  reimburseCreatedAt: string
  reimburseApprovedAt: string
  reimburseDeletedAt?: string
  reimburseAdminStatus: string
  reimburseApprover: string
  reimbursePayroll: string
}

export interface FinanceAPData {
  paymentRequests: PaymentRequest[]
  payments: FinancePayment[]
  reimburseCashIn: ReimburseCashIn[]
  reimburseCashOut: ReimburseCashOut[]
  paymentStatusesMap: Map<string, string>
  reimburseStatusesMap: Map<string, string>
}

export async function getFinanceAPData(): Promise<FinanceAPData> {
  const ssPayReq = GOOGLE_CONFIG.financeAP.paymentRequestSpreadsheetId
  const ssPay = GOOGLE_CONFIG.financeAP.paymentSpreadsheetId
  const ssReim = GOOGLE_CONFIG.financeAP.reimburseSpreadsheetId
  
  const s = GOOGLE_CONFIG.financeAP.sheets

  const [
    payReqRes,
    payStatusRes,
    payRes,
    reimInRes,
    reimOutRes,
    reimStatusRes
  ] = await Promise.all([
    fetchAllRows(ssPayReq, s.paymentRequests),
    fetchAllRows(ssPayReq, s.paymentStatuses),
    fetchAllRows(ssPay, s.payments),
    fetchAllRows(ssReim, s.reimburseCashIn),
    fetchAllRows(ssReim, s.reimburseCashOut),
    fetchAllRows(ssReim, s.reimburseStatus)
  ])

  // Map Payment Statuses
  const paymentStatusesMap = new Map<string, string>()
  for (const r of payStatusRes.rows) {
    if (r[0] && r[0] !== 'ps_id') {
      paymentStatusesMap.set(r[0], r[1] || r[0])
    }
  }
  // Hardcoded fallback for 'RF' (Rejected/Refused) and others if not in sheet
  if (!paymentStatusesMap.has('RF')) paymentStatusesMap.set('RF', 'Rejected')

  // Map Reimburse Statuses
  const reimburseStatusesMap = new Map<string, string>()
  for (const r of reimStatusRes.rows) {
    if (r[0] && r[0] !== 'RS_ID') {
      reimburseStatusesMap.set(r[0], r[1] || r[0])
    }
  }

  // Map Payment Requests
  const paymentRequests = payReqRes.rows
    .filter((r) => r[0] && r[0] !== 'payreq_id' && !r[16]) // deleted_at = col 16
    .map((r): PaymentRequest => ({
      payreqId: r[0] || '',
      payreqPoId: r[1] || '',
      payreqInvoiceNumber: r[2] || '',
      payreqSite: r[3] || '',
      payreqReceiptDate: r[4] || '',
      payreqInvoiceDate: r[5] || '',
      payreqPercentage: r[6] || '',
      payreqAmount: parseNum(r[7]),
      payreqPayAmount: parseNum(r[8]),
      payreqDuedate: r[9] || '',
      payreqFile: r[10] || '',
      payreqInvFile: r[11] || '',
      payreqRemarks: r[12] || '',
      payreqStatus: r[13] || '',
      payreqCreatedAt: r[14] || '',
      payreqUpdatedAt: r[15] || '',
      payreqDeletedAt: r[16],
      payreqCreatedBy: r[17] || '',
      payreqUpdatedBy: r[18] || '',
      payreqNotify: r[19] || '',
    }))

  // Map Payments
  const payments = payRes.rows
    .filter((r) => r[0] && r[0] !== 'p_id' && !r[10]) // deleted_at = col 10
    .map((r): FinancePayment => ({
      pId: r[0] || '',
      pPayreqId: r[1] || '',
      pPercentage: r[2] || '',
      pAmount: parseNum(r[3]),
      pEvidence: r[4] || '',
      pRemarks: r[5] || '',
      pBank: r[6] || '',
      pSite: r[7] || '',
      pCreatedAt: r[8] || '',
      pUpdatedAt: r[9] || '',
      pDeletedAt: r[10],
      pCreatedBy: r[11] || '',
      pUpdatedBy: r[12] || '',
      pNotif: r[13] || '',
    }))

  // Map ReimburseCashIn
  const reimburseCashIn = reimInRes.rows
    .filter((r) => r[0] && r[0] !== 'Reimburse_ID' && !r[13]) // deleted_at = col 13
    .map((r): ReimburseCashIn => ({
      reimburseId: r[0] || '',
      reimburseDate: r[1] || '',
      reimburseDescription: r[2] || '',
      reimburseAmount: parseNum(r[3]),
      reimburseImage: r[4] || '',
      reimburseRemarks: r[5] || '',
      reimburseStatus: r[6] || '',
      reimburseUserIdFk: r[7] || '',
      reimburseUserName: r[8] || '',
      reimburseAdminUserIdFk: r[9] || '',
      reimburseAdminUserName: r[10] || '',
      reimburseCreatedAt: r[11] || '',
      reimburseApprovedAt: r[12] || '',
      reimburseDeletedAt: r[13],
      reimburseAdminStatus: r[14] || '',
    }))

  // Map ReimburseCashOut
  const reimburseCashOut = reimOutRes.rows
    .filter((r) => r[0] && r[0] !== 'Reimburse_ID' && !r[16]) // deleted_at = col 16
    .map((r): ReimburseCashOut => ({
      reimburseId: r[0] || '',
      reimburseDate: r[1] || '',
      reimbursePrjIdFk: r[2] || '',
      reimburseProjectName: r[3] || '',
      reimburseDescription: r[4] || '',
      reimburseTypeIdFk: r[5] || '',
      reimburseAmount: parseNum(r[6]),
      reimburseImage: r[7] || '',
      reimburseRemarks: r[8] || '',
      reimburseStatus: r[9] || '',
      reimburseUserIdFk: r[10] || '',
      reimburseUserName: r[11] || '',
      reimburseAdminUserIdFk: r[12] || '',
      reimburseAdminUserName: r[13] || '',
      reimburseCreatedAt: r[14] || '',
      reimburseApprovedAt: r[15] || '',
      reimburseDeletedAt: r[16],
      reimburseAdminStatus: r[17] || '',
      reimburseApprover: r[18] || '',
      reimbursePayroll: r[19] || '',
    }))

  return {
    paymentRequests,
    payments,
    reimburseCashIn,
    reimburseCashOut,
    paymentStatusesMap,
    reimburseStatusesMap
  }
}

/** A status transition on a payment request (log_payments — no deleted_at column). */
export interface PaymentLog {
  lpId: string
  payreqId: string
  statusOld: string
  statusNew: string // C, R, AN (Approval Needed), P (Paid), CC, RF
  createdAt: string
}

export async function getPaymentLogs(): Promise<PaymentLog[]> {
  const ssPayReq = GOOGLE_CONFIG.financeAP.paymentRequestSpreadsheetId
  const { rows } = await fetchAllRows(ssPayReq, GOOGLE_CONFIG.financeAP.sheets.logPayments)
  return rows
    .filter((r) => r[0] && r[0] !== 'lp_id')
    .map((r) => ({
      lpId: r[0] || '',
      payreqId: r[1] || '',
      statusOld: r[2] || '',
      statusNew: r[3] || '',
      createdAt: r[4] || '',
    }))
}
