import { query } from './db'
import { fetchSheet } from './client'
import { GOOGLE_CONFIG } from './config'

export async function initDatabase() {
  if (typeof window !== 'undefined') return

  console.log('[db] Initializing database tables...')
  try {
    // Create sheets_cache table
    await query(`
      CREATE TABLE IF NOT EXISTS sheets_cache (
        key VARCHAR(500) PRIMARY KEY,
        headers JSONB NOT NULL,
        rows JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `)
    
    // Create sync_metadata table
    await query(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id SERIAL PRIMARY KEY,
        last_sync_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) NOT NULL,
        error_message TEXT
      );
    `)

    // Create dashboard_users table
    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_users (
        email VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sales BOOLEAN DEFAULT FALSE NOT NULL,
        finance BOOLEAN DEFAULT FALSE NOT NULL,
        project BOOLEAN DEFAULT FALSE NOT NULL,
        purchasing BOOLEAN DEFAULT FALSE NOT NULL,
        payroll BOOLEAN DEFAULT FALSE NOT NULL,
        cost_control BOOLEAN DEFAULT FALSE NOT NULL,
        admin BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `)
    
    console.log('[db] Database tables initialized successfully.')

    // Bootstrap dashboard_users table if empty
    const { rows: countRows } = await query('SELECT COUNT(*) FROM dashboard_users')
    const userCount = parseInt(countRows[0]?.count || '0', 10)
    if (userCount === 0) {
      console.log('[db] dashboard_users table is empty. Bootstrapping from Google Sheets...')
      try {
        const rawData = await fetchSheet(GOOGLE_CONFIG.users.spreadsheetId, 'users!A:I')
        const rows = rawData.slice(1) // Skip header

        function parseBool(value: string | undefined): boolean {
          if (!value) return false
          const v = value.trim().toLowerCase()
          return v === 'true' || v === '1' || v === 'yes' || v === 'x' || v === '\u2713' || v === '\u2714'
        }

        let count = 0
        for (const row of rows) {
          if (!row[0] || row[0].trim() === '') continue
          const email = row[0].trim().toLowerCase()
          const name = (row[1] || '').trim()
          const sales = parseBool(row[2])
          const finance = parseBool(row[3])
          const project = parseBool(row[4])
          const purchasing = parseBool(row[5])
          const payroll = parseBool(row[6])
          const costControl = parseBool(row[7])
          const admin = parseBool(row[8])

          await query(`
            INSERT INTO dashboard_users (email, name, sales, finance, project, purchasing, payroll, cost_control, admin)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (email) DO NOTHING
          `, [email, name, sales, finance, project, purchasing, payroll, costControl, admin])
          count++
        }
        console.log(`[db] Successfully bootstrapped ${count} users into dashboard_users table.`)
      } catch (err) {
        console.error('[db] Error bootstrapping dashboard_users from Google Sheets:', err)
      }
    }
  } catch (err) {
    console.error('[db] Error initializing database tables:', err)
    throw err;
  }
}
