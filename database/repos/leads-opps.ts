import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapLead, mapOpportunity, mapLeadRating } from '../mappers/leads-opps'
import type { Lead, Opportunity, LeadRating } from '../types'
import { getAllCompanies, getAllPicCompanies } from './companies'
import { loadRefMaps as loadQuotRefMaps, getQuotationTypeLabel } from './quotations'

export async function getAllLeadRatings(): Promise<LeadRating[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.leads.spreadsheetId,
    GOOGLE_CONFIG.leads.sheets.leadRatings
  )
  return rows.filter((r) => r[0] && r[0] !== 'lr_id').map(mapLeadRating)
}

export async function getAllLeads(): Promise<Lead[]> {
  const [leadsRes, companies, picCompanies, ratings] = await Promise.all([
    fetchAllRows(GOOGLE_CONFIG.leads.spreadsheetId, GOOGLE_CONFIG.leads.sheets.leads),
    getAllCompanies(),
    getAllPicCompanies(),
    getAllLeadRatings(),
  ])

  const companyMap = new Map<string, string>()
  for (const c of companies) {
    if (c.companyId) companyMap.set(c.companyId, c.companyName)
  }

  const picMap = new Map<string, { name: string; contact: string; email: string }>()
  for (const pic of picCompanies) {
    if (pic.piccId) {
      picMap.set(pic.piccId, {
        name: pic.piccName,
        contact: pic.piccContact,
        email: pic.piccEmail,
      })
    }
  }

  const ratingMap = new Map<string, string>()
  for (const r of ratings) {
    if (r.lrId) ratingMap.set(r.lrId, r.lrDescription)
  }

  // Filter out header row and deleted rows (deleted_at is at index 13)
  const activeRows = leadsRes.rows.filter((r) => r[0] && r[0] !== 'lead_id' && !r[13]?.trim())

  return activeRows.map((row) => {
    const cId = row[1] || ''
    const picId = row[2] || ''
    const ratingId = row[4] || ''
    const compName = companyMap.get(cId) || cId
    const picData = picMap.get(picId) || { name: picId, contact: '', email: '' }
    const ratingLabel = ratingMap.get(ratingId) || ratingId
    return mapLead(row, compName, picData, ratingLabel)
  })
}

export async function getAllOpportunities(): Promise<Opportunity[]> {
  const [oppRes, companies, picCompanies] = await Promise.all([
    fetchAllRows(GOOGLE_CONFIG.opportunities.spreadsheetId, GOOGLE_CONFIG.opportunities.sheets.opportunities),
    getAllCompanies(),
    getAllPicCompanies(),
    loadQuotRefMaps(),
  ])

  const companyMap = new Map<string, string>()
  for (const c of companies) {
    if (c.companyId) companyMap.set(c.companyId, c.companyName)
  }

  const picMap = new Map<string, { name: string; contact: string; email: string }>()
  for (const pic of picCompanies) {
    if (pic.piccId) {
      picMap.set(pic.piccId, {
        name: pic.piccName,
        contact: pic.piccContact,
        email: pic.piccEmail,
      })
    }
  }

  // Filter out header row and deleted rows (deleted_at is at index 18)
  const activeRows = oppRes.rows.filter((r) => r[0] && r[0] !== 'o_id' && !r[18]?.trim())

  return activeRows.map((row) => {
    const cId = row[3] || ''
    const picId = row[4] || ''
    const compName = companyMap.get(cId) || cId
    const picData = picMap.get(picId) || { name: picId, contact: '', email: '' }
    const typeId = row[8] || ''
    const stageLabel = getQuotationTypeLabel(typeId)
    return mapOpportunity(row, compName, stageLabel, picData)
  })
}

// Get user names for leads/opportunities by fetching sales users and building a map
export async function getSalesUserNamesForLeadsOpps(
  leads: Lead[],
  opportunities: Opportunity[]
): Promise<Map<string, string>> {
  const uniqueUserIds = new Set<string>()
  for (const l of leads) {
    if (l.assignedTo) uniqueUserIds.add(l.assignedTo)
  }
  for (const o of opportunities) {
    if (o.assignedTo) uniqueUserIds.add(o.assignedTo)
  }
  const { getAllSalesUsers } = await import('./sales-users')
  const users = await getAllSalesUsers()
  const map = new Map<string, string>()
  for (const u of users) {
    if (u.userId && uniqueUserIds.has(u.userId)) {
      map.set(u.userId, u.name)
    }
  }
  // Fallback: if user not found, use the ID as name
  for (const id of uniqueUserIds) {
    if (!map.has(id)) map.set(id, id)
  }
  return map
}
