import { Pool } from '@neondatabase/serverless'

const connectionString = process.env.POSTGRES || process.env.DATABASE_URL

if (!connectionString && typeof window === 'undefined') {
  console.warn('WARNING: POSTGRES or DATABASE_URL connection string is missing from environment variables.')
}

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (pool) return pool
  
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  
  return pool
}

export async function query(text: string, params?: any[]) {
  const p = getDbPool()
  const t0 = Date.now()
  const res = await p.query(text, params)
  // Egress signal: full-sheet reads are the dominant Neon transfer cost.
  // Covers both the legacy sheets_cache blob and the structured-table path.
  if (text.includes('FROM sheets_cache') && text.includes('SELECT')) {
    const kb = res.rows[0] ? Math.round(JSON.stringify(res.rows[0]).length / 1024) : 0
    console.log(`[db] sheet read (blob) key=${params?.[0]} ~${kb}KB ${Date.now() - t0}ms`)
  } else {
    const m = text.match(/SELECT \* FROM "(sheet_[^"]+)"/)
    if (m) {
      const sampleKb = res.rows[0] ? JSON.stringify(res.rows[0]).length / 1024 : 0
      console.log(`[db] sheet read ${m[1]} rows=${res.rows.length} ~${Math.round(sampleKb * res.rows.length)}KB ${Date.now() - t0}ms`)
    }
  }
  return res
}
