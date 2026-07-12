import 'dotenv/config'
import { getSheetsClient } from '../database/client'

async function run() {
  const sheets = getSheetsClient()
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: '1EipjDKsudJGnbyv1GB6c4wE9nvj8z425iueozKcIBYk' })
    console.log("Overtime Sheets:", res.data.sheets?.map(s => s.properties?.title))
  } catch (e: any) {
    console.error("Error Overtime:", e.message)
  }

  try {
    const res2 = await sheets.spreadsheets.get({ spreadsheetId: '1UxiyfROclB1w0UOSlGKSpppSL2FCP84rEsgv9-rDW2s' })
    console.log("Types Sheets:", res2.data.sheets?.map(s => s.properties?.title))
  } catch (e: any) {
    console.error("Error Types:", e.message)
  }
}

run()
