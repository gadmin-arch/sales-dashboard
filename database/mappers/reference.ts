import type { OrderType, Flag, PeStatus, BastStatus, FinanceStatus, ProjectLog, Bast, BastLog, FinanceLog } from '../types'

export function mapOrderType(row: string[]): OrderType {
  return { otId: row[0] || '', otDescription: row[1] || '' }
}

export function mapFlag(row: string[]): Flag {
  return { flagId: row[0] || '', flagDesc: row[1] || '' }
}

export function mapPeStatus(row: string[]): PeStatus {
  return { pesId: row[0] || '', pesDescription: row[1] || '', pesLevel: parseInt(row[2]) || 0 }
}

export function mapBastStatus(row: string[]): BastStatus {
  return { bsId: row[0] || '', bsDescription: row[1] || '' }
}

export function mapFinanceStatus(row: string[]): FinanceStatus {
  return { fsId: row[0] || '', fsDescription: row[1] || '' }
}

export function mapProjectLog(row: string[]): ProjectLog {
  return {
    plId: row[0] || '',
    plPrjId: row[1] || '',
    plStatusOld: row[2] || '',
    plStatusNew: row[3] || '',
    createdBy: row[4] || '',
    createdAt: row[5] || '',
  }
}

export function mapBast(row: string[]): Bast {
  return {
    bastId: row[0] || '',
    bastNumber: row[1] || '',
    bastPrjId: row[2] || '',
    bastFile: row[3] || '',
    bastCreatedDate: row[4] || '',
    bastSubmitDate: row[5] || '',
    bastReceivedDate: row[6] || '',
    bastStatus: row[7] || '',
    createdBy: row[8] || '',
    createdAt: row[9] || '',
    updatedBy: row[10] || '',
    updatedAt: row[11] || '',
    deletedAt: row[12] || '',
  }
}

export function mapBastLog(row: string[]): BastLog {
  return {
    blId: row[0] || '',
    blBastId: row[1] || '',
    blStatusOld: row[2] || '',
    blStatusNew: row[3] || '',
    createdBy: row[4] || '',
    createdAt: row[5] || '',
  }
}

export function mapFinanceLog(row: string[]): FinanceLog {
  return {
    flId: row[0] || '',
    flPrjId: row[1] || '',
    flStatusOld: row[2] || '',
    flStatusNew: row[3] || '',
    createdBy: row[4] || '',
    createdAt: row[5] || '',
  }
}
