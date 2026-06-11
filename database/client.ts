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

export async function fetchAllRows(
  spreadsheetId: string,
  sheetName: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const data = await fetchSheet(spreadsheetId, `${sheetName}!A:ZZZ`)
  if (data.length < 1) return { headers: [], rows: [] }
  return { headers: data[0], rows: data.slice(1) }
}

export async function getSheetHeaders(
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  const data = await fetchSheet(spreadsheetId, `${sheetName}!A1:1`)
  return data[0] || []
}
