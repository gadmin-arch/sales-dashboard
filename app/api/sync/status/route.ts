import { NextResponse } from 'next/server'
import { query } from '@/database/db'
import { initDatabase } from '@/database/init'

export async function GET() {
  try {
    await initDatabase()
    
    // Auto-clean any stale IN_PROGRESS row older than 5 minutes to prevent infinite UI spinning
    await query(`
      UPDATE sync_metadata
      SET status = 'FAILED', error_message = 'Sinkronisasi terhenti karena melebihi batas waktu (timeout 5 menit)'
      WHERE status = 'IN_PROGRESS' AND last_sync_time < NOW() - INTERVAL '5 minutes';
    `)

    const { rows } = await query(`
      SELECT id, last_sync_time, status, error_message, details
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
      details: rows[0].details || null,
      history: rows.map(r => ({
        id: r.id,
        lastSyncTime: r.last_sync_time,
        status: r.status,
        errorMessage: r.error_message,
        details: r.details || null
      }))
    })
  } catch (err: any) {
    console.error('[sync-status] Error fetching status:', err)
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}
