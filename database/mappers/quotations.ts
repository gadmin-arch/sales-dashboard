import type { Quotation, QuotationStatus, QuotationType, QuotationLog } from '../types'
import { parseNum } from './orders'

// quotations sheet columns:
// 0:q_id 1:q_description 2:q_qd_id 3:q_rfq_id 4:q_lead_id 5:q_o_id
// 6:q_c_id 7:q_picc_id 8:q_work_unit 9:q_currency
// 10:q_barecost_service 11:q_service_price 12:q_barecost_material 13:q_material_price
// 14:q_barecost_final 15:q_final_price 16:q_flag 17:q_file 18:q_type
// 19:q_date 20:q_status 21:q_references 22:q_purchase_service 23:q_remarks
// 24:q_owner 25:created_by 26:created_at 27:updated_by 28:updated_at 29:deleted_at

export function mapQuotation(row: string[]): Quotation {
  return {
    qId: row[0] || '',
    qDescription: row[1] || '',
    qQdId: row[2] || '',
    qRfqId: row[3] || '',
    qLeadId: row[4] || '',
    qOId: row[5] || '',
    qCId: row[6] || '',
    qPiccId: row[7] || '',
    qWorkUnit: row[8] || '',
    qCurrency: (row[9] || 'IDR').trim(),
    qBarecostService: parseNum(row[10]),
    qServicePrice: parseNum(row[11]),
    qBarecostMaterial: parseNum(row[12]),
    qMaterialPrice: parseNum(row[13]),
    qBarecostFinal: parseNum(row[14]),
    qFinalPrice: parseNum(row[15]),
    qFlag: row[16] || '',
    qFile: row[17] || '',
    qType: row[18] || '',
    qDate: row[19] || '',
    qStatus: row[20] || '',
    qReferences: row[21] || '',
    qPurchaseService: row[22] || '',
    qRemarks: row[23] || '',
    qOwner: row[24] || '',
    createdBy: row[25] || '',
    deletedAt: row[29] || '',
  }
}

export function mapQuotationStatus(row: string[]): QuotationStatus {
  return { qsId: row[0] || '', qsDescription: row[1] || '' }
}

export function mapQuotationType(row: string[]): QuotationType {
  return { qtId: row[0] || '', qtDesc: row[1] || '' }
}

export function mapQuotationLog(row: string[]): QuotationLog {
  return {
    qlId: row[0] || '',
    qlQId: row[1] || '',
    qlStatusOld: row[2] || '',
    qlStatusNew: row[3] || '',
    createdBy: row[4] || '',
    createdAt: row[5] || '',
  }
}
