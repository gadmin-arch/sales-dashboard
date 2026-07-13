import { NextRequest, NextResponse } from 'next/server'
import { syncAllSheets } from '@/lib/sync-engine'

export const maxDuration = 60 // Allow up to 60 seconds on Vercel

export async function POST(request: NextRequest) {
  try {
    const result = await syncAllSheets()
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}
