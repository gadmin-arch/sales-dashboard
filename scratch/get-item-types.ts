import 'dotenv/config'
import { fetchAllRows } from '../database/client'
import { GOOGLE_CONFIG } from '../database/config'

async function run() {
  try {
    const it = await fetchAllRows(GOOGLE_CONFIG.financeAP.typesSpreadsheetId, 'item_types')
    console.log("ItemTypes rows:", it.rows)
  } catch(e: any) { console.error("IT Error:", e.message) }
}

run()
