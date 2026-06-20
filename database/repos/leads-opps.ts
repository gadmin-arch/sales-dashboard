import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapLead, mapOpportunity } from '../mappers/leads-opps'
import type { Lead, Opportunity } from '../types'

export async function getAllLeads(): Promise<Lead[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.leads.spreadsheetId,
    GOOGLE_CONFIG.leads.sheets.leads
  )
  return rows.filter((r) => r[0] && r[0] !== 'lead_id' && !r[13]).map(mapLead)
}

export async function getAllOpportunities(): Promise<Opportunity[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.opportunities.spreadsheetId,
    GOOGLE_CONFIG.opportunities.sheets.opportunities
  )
  return rows.filter((r) => r[0] && r[0] !== 'o_id' && !r[13]).map(mapOpportunity)
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
