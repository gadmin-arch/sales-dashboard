import { google, sheets_v4 } from 'googleapis'
import { GOOGLE_CONFIG } from './config'

let sheetsClient: sheets_v4.Sheets | null = null

export function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient

  const credentials = GOOGLE_CONFIG.getServiceAccountCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

type SheetRows = { headers: string[]; rows: string[][] }

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

export async function fetchAllRows(
  spreadsheetId: string,
  sheetName: string
): Promise<SheetRows> {
  const key = `${spreadsheetId}::${sheetName}`
  const hit = rowsCache.get(key)
  if (hit && Date.now() - hit.at < SHEET_TTL_MS) return hit.promise

  const promise = (async (): Promise<SheetRows> => {
    // 1. Try to fetch from Neon Postgres database cache first (only in Node.js server environment)
    if (typeof window === 'undefined') {
      try {
        const { query } = require('./db')
        const { initDatabase } = require('./init')
        await initDatabase()
        
        const { rows: dbRows } = await query(
          'SELECT headers, rows FROM sheets_cache WHERE key = $1 LIMIT 1',
          [key]
        )
        
        if (dbRows.length > 0) {
          const parsed = {
            headers: (typeof dbRows[0].headers === 'string' ? JSON.parse(dbRows[0].headers) : dbRows[0].headers) as string[],
            rows: (typeof dbRows[0].rows === 'string' ? JSON.parse(dbRows[0].rows) : dbRows[0].rows) as string[][]
          }
          lastGood.set(key, parsed)
          return parsed
        }
        console.warn(`[sheets] "${sheetName}" not found in database cache. Falling back to Google Sheets API fetch.`)
      } catch (dbErr) {
        console.error('[sheets] Error querying database cache, falling back to Google Sheets API:', dbErr)
      }
    }

    // 2. Fallback to direct Google Sheets API fetch
    try {
      const data = await fetchSheet(spreadsheetId, `${sheetName}!A:ZZZ`)
      const parsed: SheetRows = data.length < 1 ? { headers: [], rows: [] } : { headers: data[0], rows: data.slice(1) }
      lastGood.set(key, parsed) // remember the latest good copy for fallback
      return parsed
    } catch (err) {
      rowsCache.delete(key) // don't keep a failed read cached
      const fallback = lastGood.get(key)
      if (fallback) {
        console.warn(`[sheets] fetch failed for "${sheetName}" — serving last downloaded copy`, err)
        return fallback
      }
      throw err // nothing to fall back to
    }
  })()

  rowsCache.set(key, { at: Date.now(), promise })
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
    rowsCache.delete(`${spreadsheetId}::${sheetName}`)
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
