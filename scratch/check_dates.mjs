import { readFileSync } from 'fs'
import { google } from 'googleapis'

// Parse .env.local
const envRaw = readFileSync('.env', 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) {
    let key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
}

const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS)
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const sheets = google.sheets({ version: 'v4', auth })

const SPREADSHEET_ID = '17IGDVtFew69_JV63aCEckpMCYqf2iyIdVPHXkwzI_tQ'
const SHEET = 'payment_requests'

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `${SHEET}!A:ZZ`,
})
const rows = res.data.values || []
if (!rows.length) { console.log('No data'); process.exit() }

const headers = rows[0]
console.log('\n=== PAYMENT REQUESTS SHEET HEADERS ===')
headers.forEach((h, i) => console.log(`  [${i}] ${h}`))

console.log('\n=== FIRST 5 ROWS ===')
for (let i = 1; i <= Math.min(5, rows.length - 1); i++) {
  console.log(`Row ${i}:`)
  rows[i].forEach((v, idx) => {
    if (v) console.log(`  [${idx}] ${headers[idx] || `col_${idx}`}: "${v}"`)
  })
}
