import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapCompany, mapPicCompany } from '../mappers/companies'
import type { Company, PicCompany } from '../types'

export async function getAllCompanies(): Promise<Company[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.companies.spreadsheetId,
    GOOGLE_CONFIG.companies.sheets.companies
  )
  return rows.filter((r) => r[0] && r[0] !== 'company_id' && !r[13]).map(mapCompany)
}

// Company id -> name map, rebuilt fresh each call (the client layer handles
// fetch failure by falling back to the last downloaded copy).
export async function getCompanyNameMap(): Promise<Map<string, string>> {
  const companies = await getAllCompanies()
  const map = new Map<string, string>()
  for (const c of companies) if (c.companyId) map.set(c.companyId, c.companyName)
  return map
}

export async function getAllPicCompanies(): Promise<PicCompany[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.companies.spreadsheetId,
    GOOGLE_CONFIG.companies.sheets.picCompanies
  )
  return rows.filter((r) => r[0] && r[0] !== 'picc_id').map(mapPicCompany)
}