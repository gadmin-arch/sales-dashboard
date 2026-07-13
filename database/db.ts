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
  return p.query(text, params)
}
