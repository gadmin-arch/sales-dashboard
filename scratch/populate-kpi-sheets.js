/**
 * Final script to populate KPI 2025 and Report 2025 sheets
 * with accurate data from the Workers KPI dashboard data sources.
 * 
 * Uses proper column ranges and correct field mappings.
 */
const { google } = require('googleapis')

const SPREADSHEET_ID = '1ewPSuvq2HK7WLvApZO_ux-odxh1wkmQI8cJGN70pxRg'

const REPORTS_ID = '1mLwt4zNcZUjSu84_la8ZSZGFgdfD8Cww3dIG_g3Hehc'
const ARCHIVE_ID = '1bkHV5VtoQaPwnfCQ-OogHEBTmYr0_lH-FhFsAjsVztQ'
const SALES_USERS_ID = '1RQXhFN3ifmxExaUtSe78ZpGhuWSQWjnrYFGOExhyRsU'
const ORDERS_ID = '13FLiQhCtntVTijB41m5N3lyAQDnq19ML8sVejfLAUDY'

async function readSheet(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return res.data.values || []
}

function parseDate(str) {
  if (!str) return null
  // Try mm/dd/yyyy (Google Sheets US format)
  const m = String(str).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
    if (!isNaN(d.getTime())) return d
  }
  // ISO
  const iso = new Date(str)
  if (!isNaN(iso.getTime())) return iso
  return null
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function reportDelayHours(reportDate, createdAt) {
  const rd = parseDate(reportDate)
  const cd = parseDate(createdAt)
  if (!rd || !cd) return null
  const diffMs = startOfDay(cd).getTime() - startOfDay(rd).getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)))
}

function delayScore(delayHours) {
  if (delayHours == null) return null
  if (delayHours === 0) return 4
  if (delayHours <= 24) return 3
  if (delayHours <= 72) return 2
  return 1
}

function clampHours(h) {
  const n = Number(h) || 0
  return n > 16 ? 8 : n
}

function parseNum(val) {
  if (!val) return 0
  const cleaned = String(val).replace(/[^\d.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

const round1 = (n) => Math.round(n * 10) / 10
const avg = (a) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)

function formatRupiah(num) {
  if (!num || num === 0) return '-'
  return 'Rp' + Math.round(num).toLocaleString('id-ID')
}

function rowsToObjects(rows) {
  if (!rows.length) return []
  const headers = rows[0]
  return rows.slice(1).map(r => {
    const obj = {}
    headers.forEach((h, i) => obj[h] = r[i] || '')
    return obj
  })
}

// Get the "benchmark" end date for an order (planned > actual > due)
function benchmarkEnd(ord) {
  // Use prj_due_date_plan if exists, else prj_due_date
  return ord.prj_due_date_plan || ord.prj_due_date || ''
}

async function main() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheetsApi = google.sheets({ version: 'v4', auth })

  console.log('Loading source data...')

  // Load all data — use BZ range for orders to get all columns
  const [reportRows, archiveRows, userRows, orderRows] = await Promise.all([
    readSheet(sheetsApi, REPORTS_ID, 'reports!A1:Z50000'),
    readSheet(sheetsApi, ARCHIVE_ID, 'reports!A1:Z50000'),
    readSheet(sheetsApi, SALES_USERS_ID, 'users!A1:Z500'),
    readSheet(sheetsApi, ORDERS_ID, 'orders!A1:BZ10000'),
  ])

  const reports = rowsToObjects(reportRows)
  const archiveReports = rowsToObjects(archiveRows)
  const allReports = [...reports, ...archiveReports]
  const salesUsers = rowsToObjects(userRows)
  const orders = rowsToObjects(orderRows)

  console.log(`  Main reports: ${reports.length}, Archive: ${archiveReports.length}, Total: ${allReports.length}`)
  console.log(`  Sales Users: ${salesUsers.length}, Orders: ${orders.length}`)

  // Check what fields exist in reports
  const rHeaders = reportRows[0] || []
  console.log(`  Report fields: ${rHeaders.join(', ')}`)

  // Detect field names dynamically
  const has = (arr, name) => arr.includes(name)
  const rUser = has(rHeaders, 'reportUser') ? 'reportUser' : 'report_user'
  const rDate = has(rHeaders, 'reportDate') ? 'reportDate' : 'report_date'
  const rCreated = has(rHeaders, 'reportCreatedAt') ? 'reportCreatedAt' : 'report_created_at'
  const rTime = has(rHeaders, 'reportTime') ? 'reportTime' : 'report_time'
  const rOvertime = has(rHeaders, 'reportOvertime') ? 'reportOvertime' : 'report_overtime'
  const rPrj = has(rHeaders, 'reportPrjId') ? 'reportPrjId' : 'report_prj_id'

  // Build user lookup
  const userHeaders = userRows[0] || []
  const uId = has(userHeaders, 'userId') ? 'userId' : 'user_id'
  const uName = has(userHeaders, 'userName') ? 'userName' : has(userHeaders, 'user_name') ? 'user_name' : 'name'
  const uSite = has(userHeaders, 'siteId') ? 'siteId' : has(userHeaders, 'site_id') ? 'site_id' : 'site'

  const userNameMap = new Map()
  for (const u of salesUsers) {
    if (u[uId]) userNameMap.set(u[uId], u[uName] || u[uId])
  }

  // Build order lookup
  const orderMap = new Map()
  for (const o of orders) {
    const id = o.prj_id || o.prjId || ''
    if (id) orderMap.set(id, o)
  }

  // Filter 2025 reports
  const reports2025 = allReports.filter(r => {
    const d = parseDate(r[rDate])
    return d && d.getFullYear() === 2025
  })
  console.log(`  2025 reports: ${reports2025.length}`)

  // Per-worker aggregation
  const perWorker = new Map()
  for (const r of reports2025) {
    const userId = r[rUser] || ''
    if (!userId) continue

    const delay = reportDelayHours(r[rDate], r[rCreated])
    const score = delayScore(delay)
    const hours = clampHours(r[rTime])
    const overtime = clampHours(r[rOvertime])
    const prjId = r[rPrj] || ''
    const dayKey = (parseDate(r[rDate])?.toISOString().slice(0, 10)) || ''

    if (!perWorker.has(userId)) {
      perWorker.set(userId, {
        reports: 0, hours: 0, overtime: 0,
        days: new Set(), delays: [], scores: [], projects: new Set()
      })
    }
    const w = perWorker.get(userId)
    w.reports++
    w.hours += hours
    w.overtime += overtime
    if (dayKey) w.days.add(dayKey)
    if (delay != null) w.delays.push(delay)
    if (score != null) w.scores.push(score)
    if (prjId) w.projects.add(prjId)
  }

  // Build worker KPIs
  const workerKpis = []
  for (const [userId, w] of perWorker) {
    const name = userNameMap.get(userId) || userId

    let overdueCount = 0
    let totalProjectValue = 0
    const projectsHandled = w.projects.size

    for (const prjId of w.projects) {
      const ord = orderMap.get(prjId)
      if (!ord) continue
      const statusCode = (ord.prj_pe_status || '').trim().toUpperCase()
      if (statusCode === 'CC') continue

      const nominal = parseNum(ord.prj_po_total)
      totalProjectValue += nominal

      const endDateStr = benchmarkEnd(ord)
      const plannedEnd = parseDate(endDateStr)
      if (!plannedEnd) continue
      const pe = startOfDay(plannedEnd).getTime()
      const now = startOfDay(new Date()).getTime()

      const isDone = statusCode === 'D' || statusCode === 'C'
      if (isDone) {
        const actualEnd = parseDate(ord.prj_end_date_actual || '')
        if (actualEnd && startOfDay(actualEnd).getTime() > pe) {
          overdueCount++
        } else if (!actualEnd) {
          // No actual end recorded but completed - can't determine overdue
        }
      } else {
        if (now > pe) overdueCount++
      }
    }

    const overduePct = projectsHandled > 0 ? Math.round((overdueCount / projectsHandled) * 100) : 0

    workerKpis.push({
      userId, name,
      reports: w.reports,
      hours: Math.round(w.hours),
      overtime: Math.round(w.overtime),
      uniqueDays: w.days.size,
      avgDelayHours: round1(avg(w.delays)),
      sameDayPct: w.delays.length ? round1((w.delays.filter(d => d === 0).length / w.delays.length) * 100) : 0,
      avgScore: w.scores.length ? round1(avg(w.scores)) : 0,
      projectsHandled,
      totalProjectValue,
      overdueCount,
      overduePct
    })
  }

  workerKpis.sort((a, b) => b.hours - a.hours)
  console.log(`\nWorkers with 2025 data: ${workerKpis.length}`)

  // Verify some workers
  const miftakhul = workerKpis.find(w => w.name.toLowerCase().includes('miftakhul'))
  if (miftakhul) {
    console.log(`\n[VERIFY] Miftakhul: ${miftakhul.projectsHandled} projects, value=${formatRupiah(miftakhul.totalProjectValue)}, overdue=${miftakhul.overdueCount}, ${miftakhul.overduePct}%`)
  }
  const rizki = workerKpis.find(w => w.name.toLowerCase().includes('rizki perdana'))
  if (rizki) {
    console.log(`[VERIFY] Rizki Perdana: ${rizki.projectsHandled} projects, value=${formatRupiah(rizki.totalProjectValue)}, overdue=${rizki.overdueCount}, ${rizki.overduePct}%`)
  }

  // Read target spreadsheet
  console.log('\nReading target spreadsheet...')
  const [kpiData, repData] = await Promise.all([
    readSheet(sheetsApi, SPREADSHEET_ID, "'KPI 2025'!A1:Z100"),
    readSheet(sheetsApi, SPREADSHEET_ID, "'Report 2025'!A1:Z100"),
  ])

  const kpiNames = kpiData.slice(1).map(r => ({
    name: (r[0] || '').trim(), alias: (r[1] || '-').trim(), row: r
  }))
  const repNames = repData.slice(1).map(r => ({
    name: (r[0] || '').trim(), alias: (r[1] || '-').trim(), row: r
  }))

  // Name matching
  function matchWorker(sheetName, sheetAlias, workerKpiList) {
    const normalise = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const sName = normalise(sheetName)
    const sAlias = normalise(sheetAlias)

    for (const wk of workerKpiList) {
      const wName = normalise(wk.name)
      if (wName === sName || wName === sAlias) return wk
      if (sName && wName.includes(sName)) return wk
      if (sAlias && sAlias !== '-' && wName.includes(sAlias)) return wk
      if (sName && sName.length > 3 && sName.includes(wName) && wName.length > 3) return wk
      if (sAlias && sAlias !== '-' && sAlias.length > 3 && sAlias.includes(wName) && wName.length > 3) return wk
    }
    return null
  }

  // Build KPI 2025
  const kpiRows = []
  kpiRows.push(['Name', 'Alias', 'Site', 'Occupation', 'Project Handled', 'Project Value', 'Project Overdue', 'Overdue Percentage'])

  let kpiMatched = 0
  for (const entry of kpiNames) {
    const match = matchWorker(entry.name, entry.alias, workerKpis)
    if (match && match.projectsHandled > 0) {
      kpiMatched++
      kpiRows.push([
        entry.name,
        entry.alias === '-' ? '-' : entry.alias,
        entry.row[2] || '',
        entry.row[3] || '',
        match.projectsHandled,
        formatRupiah(match.totalProjectValue),
        match.overdueCount,
        `${match.overduePct}%`
      ])
    } else {
      kpiRows.push(entry.row.length >= 8 ? entry.row.slice(0, 8) : [...entry.row.slice(0, 4), '-', '-', '-', '-'])
    }
  }

  // Build Report 2025
  const repRows = []
  repRows.push(['Name', 'Alias', 'Site', 'Occupation', 'Report', 'Hours', 'Overtime', 'Unique Days', 'Avg Delay (hrs)', 'Same Day %', 'Avg Score'])

  let repMatched = 0
  for (const entry of repNames) {
    const match = matchWorker(entry.name, entry.alias, workerKpis)
    if (match && match.reports > 0) {
      repMatched++
      repRows.push([
        entry.name,
        entry.alias === '-' ? '-' : entry.alias,
        entry.row[2] || '',
        entry.row[3] || '',
        match.reports,
        match.hours,
        match.overtime,
        match.uniqueDays,
        match.avgDelayHours,
        `${match.sameDayPct}%`,
        match.avgScore
      ])
    } else {
      const existing = entry.row.slice(0, 5)
      while (existing.length < 5) existing.push('-')
      repRows.push([...existing, '-', '-', '-', '-', '-', '-'])
    }
  }

  // Write back
  console.log(`\nWriting KPI 2025 (${kpiMatched}/${kpiNames.length} matched)...`)
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "'KPI 2025'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: kpiRows },
  })
  console.log('  ✅ KPI 2025 updated!')

  console.log(`Writing Report 2025 (${repMatched}/${repNames.length} matched)...`)
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Report 2025'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: repRows },
  })
  console.log('  ✅ Report 2025 updated!')

  console.log('\n✅ Done! Both sheets updated.')
}

main().catch(console.error)
