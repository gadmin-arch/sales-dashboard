import { NextRequest, NextResponse } from 'next/server'
import { syncAllSheets } from '@/lib/sync-engine'

export const maxDuration = 60 // Allow up to 60 seconds on Vercel

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  // Vercel Cron memanggil dengan header Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization')
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (
    process.env.NODE_ENV === 'production' &&
    secret !== process.env.CRON_SECRET &&
    !isVercelCron
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncAllSheets()
  return NextResponse.json(result)
}
