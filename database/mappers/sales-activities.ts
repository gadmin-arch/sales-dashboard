import type { SalesActivity, SalesActivityType, SalesActivityLevel, SalesActivityStatus, SalesActivityLog, SalesActivityEvidence } from '../types'

// sales_activities sheet columns (0-based):
// 0:sa_id 1:sa_lead_id 2:sa_o_id 3:sa_rfq_id 4:sa_q_id 5:sa_prj_id
// 6:sa_description 7:sa_date 8:sa_type 9:sa_level 10:sa_status
// 11:sa_user_id 12:created_by 13:created_at 14:updated_by 15:updated_at 16:deleted_at

export function mapSalesActivity(row: string[]): SalesActivity {
  return {
    saId: row[0] || '',
    saLeadId: row[1] || '',
    saOId: row[2] || '',
    saRfqId: row[3] || '',
    saQId: row[4] || '',
    saPrjId: row[5] || '',
    saDescription: row[6] || '',
    saDate: row[7] || '',
    saType: row[8] || '',
    saLevel: row[9] || '',
    saStatus: row[10] || '',
    saUserId: row[11] || '',
    createdBy: row[12] || '',
    createdAt: row[13] || '',
    updatedBy: row[14] || '',
    updatedAt: row[15] || '',
    deletedAt: row[16] || '',
  }
}

export function mapSalesActivityType(row: string[]): SalesActivityType {
  return { satId: row[0] || '', satDescription: row[1] || '' }
}

export function mapSalesActivityLevel(row: string[]): SalesActivityLevel {
  return { salId: row[0] || '', salDescription: row[1] || '' }
}

export function mapSalesActivityStatus(row: string[]): SalesActivityStatus {
  return { sasId: row[0] || '', sasDescription: row[1] || '' }
}

export function mapSalesActivityLog(row: string[]): SalesActivityLog {
  return {
    salogId: row[0] || '',
    salogSaId: row[1] || '',
    salogStatusOld: row[2] || '',
    salogStatusNew: row[3] || '',
    createdBy: row[4] || '',
    createdAt: row[5] || '',
  }
}

export function mapSalesActivityEvidence(row: string[]): SalesActivityEvidence {
  return {
    saeId: row[0] || '',
    saeSaId: row[1] || '',
    saeDescription: row[2] || '',
    saeFile: row[3] || '',
    createdBy: row[4] || '',
    createdAt: row[5] || '',
    updatedBy: row[6] || '',
    updatedAt: row[7] || '',
    deletedAt: row[8] || '',
  }
}
