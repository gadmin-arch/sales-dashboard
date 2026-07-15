import { google, sheets_v4 } from 'googleapis'
import { GOOGLE_CONFIG } from './config'

let sheetsClient: sheets_v4.Sheets | null = null

export function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient

  const credentials = GOOGLE_CONFIG.getServiceAccountCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  sheetsClient = google.sheets({ version: 'v4', auth })
  return sheetsClient
}

export async function fetchSheet(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const sheets = getSheetsClient()
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return response.data.values || []
}

/**
 * One batchGet per spreadsheet instead of one values.get per sheet — the
 * Sheets read quota (60 req/min/user) is the scarce resource, not bytes.
 * valueRanges come back in request order.
 */
export async function fetchSheetsBatch(
  spreadsheetId: string,
  ranges: string[]
): Promise<string[][][]> {
  const sheets = getSheetsClient()
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges })
  return (response.data.valueRanges || []).map((vr) => vr.values || [])
}

type SheetRows = { headers: string[]; rows: string[][] }

// ── Google-fallback micro-batching ──
// The read path only hits the Sheets API when Neon has no copy of a sheet.
// Those misses arrive in bursts (one compute fetches 5-15 sheets in a
// Promise.all), and the Sheets READ QUOTA (60 requests/min/user) is the
// scarce resource there — bytes are not. Concurrent fallback reads for the
// same spreadsheet therefore coalesce into ONE values.batchGet (one request
// against the quota regardless of how many ranges it carries).
type PendingRange = { range: string; resolve: (rows: string[][]) => void; reject: (err: unknown) => void }
const FALLBACK_BATCH_WINDOW_MS = 25
const pendingFallbacks = new Map<string, PendingRange[]>()

export function fetchSheetCoalesced(spreadsheetId: string, range: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    let pending = pendingFallbacks.get(spreadsheetId)
    if (!pending) {
      pendingFallbacks.set(spreadsheetId, (pending = []))
      setTimeout(async () => {
        const batch = pendingFallbacks.get(spreadsheetId) || []
        pendingFallbacks.delete(spreadsheetId)
        try {
          if (batch.length === 1) {
            batch[0].resolve(await fetchSheet(spreadsheetId, batch[0].range))
          } else {
            console.log(`[sheets] fallback batchGet ${batch.length} ranges in 1 request (${spreadsheetId.slice(0, 8)}…)`)
            const results = await fetchSheetsBatch(spreadsheetId, batch.map((b) => b.range))
            batch.forEach((b, i) => b.resolve(results[i] || []))
          }
        } catch (err) {
          for (const b of batch) b.reject(err)
        }
      }, FALLBACK_BATCH_WINDOW_MS)
    }
    pending.push({ range, resolve, reject })
  })
}

// Two layers:
// - rowsCache: short-lived cache so filter-applies don't re-download the same
//   sheets every time. Also de-duplicates concurrent reads (holds the promise).
// - lastGood: the last SUCCESSFUL read per sheet, kept indefinitely as a
//   fallback so a failed fetch (quota/network) serves the previous data instead
//   of breaking the page.
// A page load / hard refresh calls clearSheetCache() (via ?fresh=1) so it
// re-reads from Google; in-app filter-applies hit the warm cache.
const SHEET_TTL_MS = 5 * 60 * 1000
const rowsCache = new Map<string, { at: number; promise: Promise<SheetRows> }>()
const lastGood = new Map<string, SheetRows>()

/**
 * @param columns Optional 0-based sheet column indices to read. When given,
 * the Neon path SELECTs only those columns (the big sheet tables are read in
 * full on every compute miss, and unused columns are the bulk of that egress).
 * Returned rows are SPARSE arrays with values at their ORIGINAL indices, so
 * positional mappers keep working; every index a caller reads (including
 * soft-delete filters) must be listed. Sheets-API fallback paths still return
 * full rows — a superset, which is also fine for the mappers.
 */
export async function fetchAllRows(
  spreadsheetId: string,
  sheetName: string,
  columns?: number[]
): Promise<SheetRows> {
  // DB rows in sheet_metadata / sheets_cache are keyed WITHOUT the column list;
  // only the in-process caches fragment per column subset.
  const key = `${spreadsheetId}::${sheetName}`
  const wanted = columns?.length ? [...new Set(columns)].sort((a, b) => a - b) : null
  const cacheKey = wanted ? `${key}::cols=${wanted.join(',')}` : key
  const hit = rowsCache.get(cacheKey)
  if (hit && Date.now() - hit.at < SHEET_TTL_MS) return hit.promise

  const promise = (async (): Promise<SheetRows> => {
    // 1. Try to fetch from Neon Postgres database cache first (only in Node.js server environment)
    if (typeof window === 'undefined') {
      try {
        const { query } = require('./db')
        const { initDatabase } = require('./init')
        await initDatabase()
        
        // A. Try sheet_metadata and structured table
        const { rows: metaRows } = await query(
          'SELECT table_name, headers, col_names FROM sheet_metadata WHERE key = $1 LIMIT 1',
          [key]
        )

        if (metaRows.length > 0) {
          const tableName = metaRows[0].table_name
          const headers = (typeof metaRows[0].headers === 'string' ? JSON.parse(metaRows[0].headers) : metaRows[0].headers) as string[]
          const colNames = (typeof metaRows[0].col_names === 'string' ? JSON.parse(metaRows[0].col_names) : metaRows[0].col_names) as string[]

          // Query the structured table — only the requested columns when the
          // caller declared its subset (positions in the row are preserved).
          const sel = wanted?.filter((i) => i >= 0 && i < colNames.length)
          const selectList = sel?.length ? sel.map((i) => `"${colNames[i]}"`).join(', ') : '*'
          const { rows: dataRows } = await query(`SELECT ${selectList} FROM "${tableName}" ORDER BY id ASC`)
          const rows = dataRows.map((r: any) => {
            if (sel?.length) {
              const row: string[] = []
              for (const i of sel) row[i] = r[colNames[i]] !== null && r[colNames[i]] !== undefined ? String(r[colNames[i]]) : ''
              return row
            }
            return colNames.map(col => r[col] !== null && r[col] !== undefined ? String(r[col]) : '')
          })

          const parsed = { headers, rows }
          lastGood.set(cacheKey, parsed)
          return parsed
        }
        
        // B. Fallback to sheets_cache if not found in structured tables
        const { rows: dbRows } = await query(
          'SELECT headers, rows FROM sheets_cache WHERE key = $1 LIMIT 1',
          [key]
        )
        
        if (dbRows.length > 0) {
          const parsed = {
            headers: (typeof dbRows[0].headers === 'string' ? JSON.parse(dbRows[0].headers) : dbRows[0].headers) as string[],
            rows: (typeof dbRows[0].rows === 'string' ? JSON.parse(dbRows[0].rows) : dbRows[0].rows) as string[][]
          }
          lastGood.set(cacheKey, parsed)
          return parsed
        }
        console.warn(`[sheets] "${sheetName}" not found in database cache. Falling back to Google Sheets API fetch.`)
      } catch (dbErr) {
        console.error('[sheets] Error querying database cache, falling back to Google Sheets API:', dbErr)
      }
    }

    // 2. Fallback to the Sheets API — coalesced so a burst of misses for one
    // spreadsheet costs one read request instead of one per sheet.
    try {
      const data = await fetchSheetCoalesced(spreadsheetId, `${sheetName}!A:ZZZ`)
      const parsed: SheetRows = data.length < 1 ? { headers: [], rows: [] } : { headers: data[0], rows: data.slice(1) }
      lastGood.set(cacheKey, parsed) // remember the latest good copy for fallback
      // Write back to Neon so other server instances read the DB copy instead
      // of re-hitting the Sheets API (DB writes are free ingress; the Sheets
      // per-minute read quota is the scarce resource on this path).
      if (typeof window === 'undefined') {
        try {
          const { query } = require('./db')
          await query(`
            INSERT INTO sheets_cache (key, headers, rows, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (key) DO UPDATE
            SET headers = EXCLUDED.headers,
                rows = EXCLUDED.rows,
                updated_at = NOW();
          `, [key, JSON.stringify(parsed.headers), JSON.stringify(parsed.rows)])
        } catch (writeErr) {
          console.warn(`[sheets] write-back to sheets_cache failed for "${sheetName}":`, writeErr)
        }
      }
      return parsed
    } catch (err) {
      rowsCache.delete(cacheKey) // don't keep a failed read cached
      const fallback = lastGood.get(cacheKey)
      if (fallback) {
        console.warn(`[sheets] fetch failed for "${sheetName}" — serving last downloaded copy`, err)
        return fallback
      }
      throw err // nothing to fall back to
    }
  })()

  rowsCache.set(cacheKey, { at: Date.now(), promise })
  promise.catch(() => {}) // avoid unhandled rejection on the no-fallback path
  return promise
}

const cacheClearCallbacks: (() => void)[] = []

export function registerCacheClearCallback(cb: () => void) {
  cacheClearCallbacks.push(cb)
}

/** Force the next reads to hit Google again (keeps lastGood for fallback). */
export function clearSheetCache(spreadsheetId?: string, sheetName?: string): void {
  if (spreadsheetId && sheetName) {
    // Also drop the per-column-subset variants of this sheet's cache entries.
    const prefix = `${spreadsheetId}::${sheetName}`
    for (const k of [...rowsCache.keys()]) {
      if (k === prefix || k.startsWith(`${prefix}::cols=`)) rowsCache.delete(k)
    }
  } else {
    rowsCache.clear()
    for (const cb of cacheClearCallbacks) {
      try { cb() } catch (err) { console.error('Cache clear callback error:', err) }
    }
  }
}

export async function getSheetHeaders(
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  const data = await fetchSheet(spreadsheetId, `${sheetName}!A1:1`)
  return data[0] || []
}
