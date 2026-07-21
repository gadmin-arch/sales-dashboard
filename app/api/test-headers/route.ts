import { NextResponse } from 'next/server'
import { fetchAllRows } from '@/database/client'
import { GOOGLE_CONFIG } from '@/database/config'

export async function GET() {
  const { headers } = await fetchAllRows(GOOGLE_CONFIG.attendances.currentSpreadsheetId, GOOGLE_CONFIG.attendances.sheets.attendances)
  return NextResponse.json({ headers })
}
