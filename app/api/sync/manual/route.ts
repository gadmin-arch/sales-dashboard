import { NextRequest, NextResponse } from 'next/server'
import { syncAllSheets } from '@/lib/sync-engine'

export const maxDuration = 60 // Allow up to 60 seconds on Vercel

export async function POST(request: NextRequest) {
  try {
    // Non-blocking background sync execution to avoid HTTP 504 gateway timeouts
    syncAllSheets().catch((err) => {
      console.error('[sync-manual] Background sync error:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Sync started in background',
      status: 'IN_PROGRESS'
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}
