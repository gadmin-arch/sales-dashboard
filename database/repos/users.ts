import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import type { AccessUser } from '../types'

function parseBool(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'x' || v === '\u2713' || v === '\u2714'
}

export async function getAllAccessUsers(): Promise<AccessUser[]> {
  const { rows } = await fetchAllRows(
    GOOGLE_CONFIG.users.spreadsheetId,
    GOOGLE_CONFIG.users.range.split('!')[0]
  )
  return rows
    .filter((row) => row[0] && row[0].trim() !== '')
    .map((row) => ({
      email: (row[0] || '').trim().toLowerCase(),
      name: (row[1] || '').trim(),
      sales: parseBool(row[2]),
      finance: parseBool(row[3]),
      project: parseBool(row[4]),
      purchasing: parseBool(row[5]),
    }))
}

export async function findAccessUserByEmail(email: string): Promise<AccessUser | null> {
  const users = await getAllAccessUsers()
  return users.find((u) => u.email === email.toLowerCase()) || null
}
