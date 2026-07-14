import { NextResponse } from 'next/server'
import { query } from '@/database/db'
import { initDatabase } from '@/database/init'

export async function GET() {
  try {
    await initDatabase()
    
    const { rows } = await query(`
      SELECT id, last_sync_time, status, error_message
      FROM sync_metadata
      ORDER BY last_sync_time DESC
      LIMIT 5
    `)
    
    if (rows.length === 0) {
      return NextResponse.json({ success: true, lastSyncTime: null, status: 'NEVER', history: [] })
    }
    
    return NextResponse.json({
      success: true,
      lastSyncTime: rows[0].last_sync_time,
      status: rows[0].status,
      errorMessage: rows[0].error_message,
      history: rows.map(r => ({
        id: r.id,
        lastSyncTime: r.last_sync_time,
        status: r.status,
        errorMessage: r.error_message
      }))
    })
  } catch (err: any) {
    console.error('[sync-status] Error fetching status:', err)
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}
