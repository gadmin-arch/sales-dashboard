import { query } from '../db'
import type { AccessUser } from '../types'
import type { Roles } from '@/lib/nav'

export async function getAllAccessUsers(): Promise<AccessUser[]> {
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
}

export async function findAccessUserByEmail(email: string): Promise<AccessUser | null> {
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
