import { query } from '../db'
import { fetchSheet } from '../client'
import { GOOGLE_CONFIG } from '../config'
import type { AccessUser } from '../types'
import type { Roles } from '@/lib/nav'

async function fetchUsersFromSheet(): Promise<AccessUser[]> {
  try {
    const rawData = await fetchSheet(GOOGLE_CONFIG.users.spreadsheetId, 'users!A:I')
    const rows = rawData.slice(1) // Skip header

    function parseBool(value: string | undefined): boolean {
      if (!value) return false
      const v = value.trim().toLowerCase()
      return v === 'true' || v === '1' || v === 'yes' || v === 'x' || v === '\u2713' || v === '\u2714'
    }

    const users: AccessUser[] = []
    for (const row of rows) {
      if (!row[0] || row[0].trim() === '') continue
      users.push({
        email: row[0].trim().toLowerCase(),
        name: (row[1] || '').trim(),
        sales: parseBool(row[2]),
        finance: parseBool(row[3]),
        project: parseBool(row[4]),
        purchasing: parseBool(row[5]),
        payroll: parseBool(row[6]),
        'cost control': parseBool(row[7]),
        admin: parseBool(row[8]),
      })
    }
    return users
  } catch (err) {
    console.warn('[db] Error fetching dashboard_users fallback from Google Sheets:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function getAllAccessUsers(): Promise<AccessUser[]> {
  try {
    const { rows } = await query(`
      SELECT email, name, sales, finance, project, purchasing, payroll, cost_control AS "cost control", admin
      FROM dashboard_users
      ORDER BY name ASC
    `)
    return rows.map((row) => ({
      email: row.email.toLowerCase(),
      name: row.name,
      sales: !!row.sales,
      finance: !!row.finance,
      project: !!row.project,
      purchasing: !!row.purchasing,
      payroll: !!row.payroll,
      'cost control': !!row['cost control'],
      admin: !!row.admin,
    }))
  } catch (e) {
    console.warn('[db] Neon query failed for dashboard_users, falling back to Google Sheets:', e)
    return fetchUsersFromSheet()
  }
}

export async function findAccessUserByEmail(email: string): Promise<AccessUser | null> {
  try {
    const { rows } = await query(`
      SELECT email, name, sales, finance, project, purchasing, payroll, cost_control AS "cost control", admin
      FROM dashboard_users
      WHERE LOWER(email) = $1
      LIMIT 1
    `, [email.toLowerCase()])

    if (rows.length === 0) return null
    const row = rows[0]
    return {
      email: row.email.toLowerCase(),
      name: row.name,
      sales: !!row.sales,
      finance: !!row.finance,
      project: !!row.project,
      purchasing: !!row.purchasing,
      payroll: !!row.payroll,
      'cost control': !!row['cost control'],
      admin: !!row.admin,
    }
  } catch (e) {
    console.warn('[db] Neon query failed for findAccessUserByEmail, falling back to Google Sheets:', e)
    const allUsers = await fetchUsersFromSheet()
    return allUsers.find((u) => u.email === email.toLowerCase()) || null
  }
}

export async function saveAccessUser(email: string, name: string, roles: Roles): Promise<void> {
  const emailLower = email.trim().toLowerCase()
  await query(`
    INSERT INTO dashboard_users (email, name, sales, finance, project, purchasing, payroll, cost_control, admin, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        sales = EXCLUDED.sales,
        finance = EXCLUDED.finance,
        project = EXCLUDED.project,
        purchasing = EXCLUDED.purchasing,
        payroll = EXCLUDED.payroll,
        cost_control = EXCLUDED.cost_control,
        admin = EXCLUDED.admin,
        updated_at = NOW()
  `, [
    emailLower,
    name.trim(),
    roles.sales,
    roles.finance,
    roles.project,
    roles.purchasing,
    roles.payroll,
    roles['cost control'],
    roles.admin,
  ])
}
