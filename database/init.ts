import { query } from './db'

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
    
    console.log('[db] Database tables initialized successfully.')
  } catch (err) {
    console.error('[db] Error initializing database tables:', err)
    throw err;
  }
}
