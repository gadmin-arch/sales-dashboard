import type { Company, PicCompany } from '../types'

// companies sheet columns:
// 0:company_id 1:company_name

export function mapCompany(row: string[]): Company {
  return {
    companyId: row[0] || '',
    companyName: row[1] || '',
  }
}

export function mapPicCompany(row: string[]): PicCompany {
  return {
    piccId: row[0] || '',
    piccCompanyId: row[1] || '',
    piccName: row[2] || '',
    piccContact: row[3] || '',
    piccEmail: row[4] || '',
    piccOccupation: row[5] || '',
  }
}