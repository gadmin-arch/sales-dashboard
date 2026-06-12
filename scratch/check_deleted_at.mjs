import { readFileSync } from 'fs'
import { google } from 'googleapis'

// Parse .env.local
const envRaw = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) {
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    env[key] = val
  }
}

const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS)
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const sheets = google.sheets({ version: 'v4', auth })

const SPREADSHEET_ID = '1uUMyAtXgAXLKBmTdXuozHlVGyi7JlX83S2Nj-nrhEuk'
const SHEET = 'quotations'

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `${SHEET}!A:ZZZ`,
})
const rows = res.data.values || []
if (!rows.length) { console.log('No data'); process.exit() }

const headers = rows[0]
console.log('\n=== QUOTATION SHEET HEADERS ===')
headers.forEach((h, i) => console.log(`  [${i}] ${h}`))

const deletedAtIdx = headers.indexOf('deleted_at')
console.log(`\n=== deleted_at actual column index: ${deletedAtIdx} ===`)
console.log(`=== Code now filters using index: 29 ===`)
if (deletedAtIdx !== 29) {
  console.log('⚠️  MISMATCH! Wrong column index — filter is broken!')
} else {
  console.log('✅ Column index 29 is correct — fix is working!')
}

// Find Q2026-0017
const dataRows = rows.slice(1)
const target = dataRows.find(r => r[0] === 'Q2026-0017')
if (target) {
  console.log(`\n=== Q2026-0017 FOUND in raw sheet ===`)
  console.log(`  value at actual deleted_at col ${deletedAtIdx}: "${target[deletedAtIdx] ?? ''}"`)
  const passesFilterReal = !target[deletedAtIdx]
  console.log(`  Would pass the filter (col 29)?  ${passesFilterReal ? '❌ YES — still gets through' : '✅ NO — correctly excluded!'}`)
} else {
  console.log('\n=== Q2026-0017 not found in raw sheet ===')
}
