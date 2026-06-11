import type { Company } from '../types'

// companies sheet columns:
// 0:company_id 1:company_name

export function mapCompany(row: string[]): Company {
  return {
    companyId: row[0] || '',
    companyName: row[1] || '',
  }
}