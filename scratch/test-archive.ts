import 'dotenv/config'
import { fetchSheet } from '../database/client'

async function run() {
  try {
    const data = await fetchSheet('1bkHV5VtoQaPwnfCQ-OogHEBTmYr0_lH-FhFsAjsVztQ', 'reports!A1:Z10')
    console.log("Success! Data length:", data.length)
  } catch (err: any) {
    console.error("Error with 'reports':", err.message)
  }
}

run()
