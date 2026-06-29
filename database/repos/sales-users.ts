import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapSalesUser, mapSalesRole, mapDepartement } from '../mappers/sales-users'
import type { SalesUser, SalesRole, Departement } from '../types'

let userCache: Map<string, SalesUser> | null = null
let roleCache: Map<string, string> | null = null
let deptCache: Map<string, string> | null = null

async function loadCache() {
  if (userCache) return

  const ssId = GOOGLE_CONFIG.salesUsers.spreadsheetId
  const s = GOOGLE_CONFIG.salesUsers.sheets

  const [userRows, roleRows, deptRows] = await Promise.all([
    fetchAllRows(ssId, s.users),
    fetchAllRows(ssId, s.roles),
    fetchAllRows(ssId, s.departements),
  ])

  userCache = new Map()
  for (const row of userRows.rows) {
    const u = mapSalesUser(row)
    if (u.userId) userCache.set(u.userId, u)
  }

  roleCache = new Map()
  for (const row of roleRows.rows) {
    const r = mapSalesRole(row)
    if (r.roleId) roleCache.set(r.roleId, r.roleName)
  }

  deptCache = new Map()
  for (const row of deptRows.rows) {
    const d = mapDepartement(row)
    if (d.departementId) deptCache.set(d.departementId, d.departementName)
  }
}

export async function getSalesUserNamesMap(userIds: Set<string>): Promise<Map<string, string>> {
  const users = await getAllSalesUsers()
  const map = new Map<string, string>()
  for (const u of users) {
    if (u.userId && userIds.has(u.userId)) {
      map.set(u.userId, u.name)
    }
  }
  for (const id of userIds) {
    if (!map.has(id)) map.set(id, id)
  }
  return map
}

export async function getAllSalesUsers(): Promise<SalesUser[]> {
  await loadCache()
  return Array.from(userCache!.values())
}

export async function getSalesUserById(userId: string): Promise<SalesUser | null> {
  await loadCache()
  return userCache!.get(userId) || null
}

export async function getSalesUserName(userId: string): Promise<string> {
  const user = await getSalesUserById(userId)
  return user?.name || userId
}

export function getRoleName(roleId: string): string {
  return roleCache?.get(roleId) || roleId
}

export function getDepartementName(deptId: string): string {
  return deptCache?.get(deptId) || deptId
}
