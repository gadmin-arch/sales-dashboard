import 'dotenv/config'
import { getSheetHeaders } from '../database/client'
import { GOOGLE_CONFIG } from '../database/config'

async function run() {
  try {
    const ot = await getSheetHeaders(GOOGLE_CONFIG.reports.overtimeSpreadsheetId, 'overtimes')
    console.log("Overtimes headers:", ot)
  } catch(e: any) { console.error("OT Error:", e.message) }

  try {
    const cot = await getSheetHeaders(GOOGLE_CONFIG.financeAP.typesSpreadsheetId, 'cash_out_types')
    console.log("CashOutTypes headers:", cot)
  } catch(e: any) { console.error("COT Error:", e.message) }

  try {
    const mbd = await getSheetHeaders(GOOGLE_CONFIG.payroll.spreadsheetId, 'meal_benefit_details')
    console.log("MBD headers:", mbd)
  } catch(e: any) { console.error("MBD Error:", e.message) }
  
  try {
    const mb = await getSheetHeaders(GOOGLE_CONFIG.payroll.spreadsheetId, 'meal_benefits')
    console.log("MB headers:", mb)
  } catch(e: any) { console.error("MB Error:", e.message) }
}

run()
