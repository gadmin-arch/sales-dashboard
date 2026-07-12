import 'dotenv/config'
import { fetchAllRows } from '../database/client'
import { GOOGLE_CONFIG } from '../database/config'

async function run() {
  try {
    const cot = await fetchAllRows(GOOGLE_CONFIG.financeAP.typesSpreadsheetId, 'cash_out_types')
    console.log("CashOutTypes rows:", cot.rows)
  } catch(e: any) { console.error("COT Error:", e.message) }
}

run()
