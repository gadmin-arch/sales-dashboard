import { GOOGLE_CONFIG } from '@/database/config'
import { NextResponse } from 'next/server'
import { query } from '@/database/db'
import { fetchSheetsBatch } from '@/database/client'

function getTableName(spreadsheetId: string, sheetName: string): string {
  const prefix = spreadsheetId.substring(0, 8).toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const name = sheetName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return `sheet_${prefix}_${name}`
}

function getSafeColNames(headers: string[]): string[] {
  const seenNames = new Set<string>()
  seenNames.add('id')
  return headers.map((h, i) => {
    let clean = h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '')
    if (!clean || /^[0-9]/.test(clean) || clean === 'id') {
      clean = `col_${i}_${clean || 'field'}`
    }
    let uniqueName = clean
    let counter = 1
    while (seenNames.has(uniqueName)) {
      uniqueName = `${clean}_${counter++}`
    }
    seenNames.add(uniqueName)
    return uniqueName
  })
}

export async function GET() {
  const targets = [
    { spreadsheetId: GOOGLE_CONFIG.reports.overtimeSpreadsheetId, sheetName: GOOGLE_CONFIG.reports.sheets.overtimes },
    { spreadsheetId: GOOGLE_CONFIG.reports.overtimeSpreadsheetId, sheetName: GOOGLE_CONFIG.reports.sheets.leaves },
    { spreadsheetId: GOOGLE_CONFIG.reports.overtimeSpreadsheetId, sheetName: GOOGLE_CONFIG.reports.sheets.holidays },
    { spreadsheetId: GOOGLE_CONFIG.attendances.currentSpreadsheetId, sheetName: GOOGLE_CONFIG.attendances.sheets.attendances },
    { spreadsheetId: GOOGLE_CONFIG.attendances.backupSpreadsheetId, sheetName: GOOGLE_CONFIG.attendances.sheets.attendances }
  ]
  
  let synced = 0;
  for (const t of targets) {
     try {
       const [rawData] = await fetchSheetsBatch(t.spreadsheetId, [`${t.sheetName}!A:ZZZ`])
       const headers = rawData.length > 0 ? rawData[0] : []
       const rows = rawData.length > 1 ? rawData.slice(1) : []
       
       if (headers.length > 0) {
         const tableName = getTableName(t.spreadsheetId, t.sheetName)
         const colNames = getSafeColNames(headers)
         await query(`DROP TABLE IF EXISTS "${tableName}"`)
         const colDefs = colNames.map(col => `"${col}" TEXT`).join(',\n')
         await query(`CREATE TABLE "${tableName}" (id SERIAL PRIMARY KEY, ${colDefs})`)
         
         if (rows.length > 0) {
           const batchSize = 100
           for (let i = 0; i < rows.length; i += batchSize) {
             const batch = rows.slice(i, i + batchSize)
             const valuesPlaceholder: string[] = []
             const flatValues: any[] = []
             batch.forEach((row) => {
               const rowPlaceholders: string[] = []
               colNames.forEach((_, colIndex) => {
                 const val = row[colIndex] !== undefined ? String(row[colIndex]) : null
                 flatValues.push(val)
                 rowPlaceholders.push(`$${flatValues.length}`)
               })
               valuesPlaceholder.push(`(${rowPlaceholders.join(', ')})`)
             })
             await query(`INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES ${valuesPlaceholder.join(', ')}`, flatValues)
           }
         }
         
         await query(`
            INSERT INTO sheet_metadata (key, table_name, headers, col_names, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (key) DO UPDATE
            SET table_name = EXCLUDED.table_name,
                headers = EXCLUDED.headers,
                col_names = EXCLUDED.col_names,
                updated_at = NOW();
          `, [`${t.spreadsheetId}::${t.sheetName}`, tableName, JSON.stringify(headers), JSON.stringify(colNames)])
          
         synced++
       }
     } catch (e) {
       console.error(e)
     }
  }
  return NextResponse.json({ synced })
}
