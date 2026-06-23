import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapCompany, mapPicCompany } from '../mappers/companies'
import type { Company, PicCompany } from '../types'

export async function getAllCompanies(): Promise<Company[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.companies.spreadsheetId,
    GOOGLE_CONFIG.companies.sheets.companies
  )
  return rows.filter((r) => r[0] && r[0] !== 'company_id').map(mapCompany)
}

export async function getAllPicCompanies(): Promise<PicCompany[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.companies.spreadsheetId,
    GOOGLE_CONFIG.companies.sheets.picCompanies
  )
  return rows.filter((r) => r[0] && r[0] !== 'picc_id').map(mapPicCompany)
}