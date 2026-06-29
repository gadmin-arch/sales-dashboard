import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import {
  mapSalesActivity, mapSalesActivityType, mapSalesActivityLevel, mapSalesActivityStatus,
} from '../mappers/sales-activities'
import type { SalesActivity, SalesActivityType, SalesActivityLevel, SalesActivityStatus } from '../types'

let typeMap: Map<string, string> | null = null
let levelMap: Map<string, string> | null = null
let statusMap: Map<string, string> | null = null

export async function loadRefMaps() {
  if (typeMap) return
  const ssId = GOOGLE_CONFIG.salesActivities.spreadsheetId
  const s = GOOGLE_CONFIG.salesActivities.sheets

  const [typeRows, levelRows, statusRows] = await Promise.all([
    fetchAllRows(ssId, s.types),
    fetchAllRows(ssId, s.levels),
    fetchAllRows(ssId, s.statuses),
  ])

  typeMap = new Map()
  for (const row of typeRows.rows) {
    const t = mapSalesActivityType(row)
    if (t.satId) typeMap.set(t.satId, t.satDescription)
  }

  levelMap = new Map()
  for (const row of levelRows.rows) {
    const l = mapSalesActivityLevel(row)
    if (l.salId) levelMap.set(l.salId, l.salDescription)
  }

  statusMap = new Map()
  for (const row of statusRows.rows) {
    const st = mapSalesActivityStatus(row)
    if (st.sasId) statusMap.set(st.sasId, st.sasDescription)
  }
}

export async function getAllSalesActivities(): Promise<SalesActivity[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.salesActivities.spreadsheetId,
    GOOGLE_CONFIG.salesActivities.sheets.activities
  )
  return rows.filter((r) => r[0] && r[0] !== 'sa_id' && !r[16]).map(mapSalesActivity)
}

export async function getAllActivityTypes(): Promise<SalesActivityType[]> {
  await loadRefMaps()
  const result: SalesActivityType[] = []
  if (typeMap) {
    for (const [satId, satDescription] of typeMap.entries()) {
      if (satId !== 'sat_id') result.push({ satId, satDescription })
    }
  }
  return result
}

export async function getAllActivityLevels(): Promise<SalesActivityLevel[]> {
  await loadRefMaps()
  const result: SalesActivityLevel[] = []
  if (levelMap) {
    for (const [salId, salDescription] of levelMap.entries()) {
      if (salId !== 'sal_id') result.push({ salId, salDescription })
    }
  }
  return result
}

export async function getAllActivityStatuses(): Promise<SalesActivityStatus[]> {
  await loadRefMaps()
  const result: SalesActivityStatus[] = []
  if (statusMap) {
    for (const [sasId, sasDescription] of statusMap.entries()) {
      if (sasId !== 'sas_id') result.push({ sasId, sasDescription })
    }
  }
  return result
}

export function getActivityTypeLabel(typeId: string): string {
  return typeMap?.get(typeId) || typeId
}

export function getActivityLevelLabel(levelId: string): string {
  return levelMap?.get(levelId) || levelId
}

export function getActivityStatusLabel(statusId: string): string {
  return statusMap?.get(statusId) || statusId
}

// Get user names for activities by fetching sales users and building a map
export async function getSalesUserNamesForActivities(
  activities: SalesActivity[]
): Promise<Map<string, string>> {
  const uniqueUserIds = new Set<string>()
  for (const a of activities) {
    if (a.saOwner) uniqueUserIds.add(a.saOwner)
    if (a.createdBy) uniqueUserIds.add(a.createdBy)
  }
  const { getSalesUserNamesMap } = await import('./sales-users')
  return getSalesUserNamesMap(uniqueUserIds)
}
