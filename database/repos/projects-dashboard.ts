import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { parseNum } from '../mappers/orders'
import { getAllOrders } from './orders'
import { getAllPoLines, getAllPurchaseOrders } from './procurement'
import { getFinanceAPData } from './finance-ap'
import { getAllReports } from './reports'
import { isMaterial, CostControlFilter } from './cost-control'
import { getAllSalesUsers, getTeamNameSync } from './sales-users'

export interface ProjectDashboardData {
  prjId: string
  prjName: string
  budgetTotal: number
  spentTotal: number
  utilizationPct: number
  
  purchasingItems: Array<{ date: string; description: string; type: string; poNumber: string }>
  reimburseItems: Array<{ date: string; description: string; type: string; requestor: string }>
  mealItems: Array<{ date: string; description: string; requestor: string }>

  overtimeHours: number
  reportCount: number
  reportHours: number

  pePicName: string
  peTeamName: string
}

export async function getProjectDashboardData(f: CostControlFilter = {}): Promise<ProjectDashboardData[]> {
  const [
    allProjects,
    pos,
    polines,
    financeAP,
    reports,
    overtimeRes,
    mbdRes,
    mbRes,
    salesUsers
  ] = await Promise.all([
    getAllOrders(),
    getAllPurchaseOrders(),
    getAllPoLines(),
    getFinanceAPData(),
    getAllReports(),
    fetchAllRows(GOOGLE_CONFIG.reports.overtimeSpreadsheetId, GOOGLE_CONFIG.reports.sheets.overtimes),
    fetchAllRows(GOOGLE_CONFIG.payroll.spreadsheetId, 'meal_benefit_details'),
    fetchAllRows(GOOGLE_CONFIG.payroll.spreadsheetId, 'meal_benefits'),
    getAllSalesUsers(),
  ])

  // Apply filters to projects first
  let projects = allProjects
  if (f.salesUser && f.salesUser.length > 0) {
    projects = projects.filter(p => f.salesUser!.includes(p.prjOwner))
  }
  if (f.projectStatus && f.projectStatus.length > 0) {
    projects = projects.filter(p => f.projectStatus!.includes(p.prjPeStatus))
  }
  if (f.invoiceStatus && f.invoiceStatus.length > 0) {
    projects = projects.filter(p => f.invoiceStatus!.includes(p.prjFStatus))
  }
  if (f.orderType && f.orderType.length > 0) {
    projects = projects.filter(p => f.orderType!.includes(p.prjOtId))
  }
  if (f.projectFlag && f.projectFlag.length > 0) {
    projects = projects.filter(p => f.projectFlag!.includes(p.prjFlag))
  }
  if (f.pePic && f.pePic.length > 0) {
    projects = projects.filter(p => f.pePic!.includes(p.prjPePic || ''))
  }
  if (f.peTeam && f.peTeam.length > 0) {
    projects = projects.filter(p => f.peTeam!.some(team => (p.prjPeSiteId || '').split(',').map(s => s.trim()).includes(team)))
  }
  if (f.dateFrom && f.dateTo) {
    const fromTime = new Date(f.dateFrom).getTime()
    const toTime = new Date(f.dateTo).getTime()
    projects = projects.filter(p => {
      let dStr = p.prjPoDate
      if (!dStr) dStr = p.createdAt
      if (!dStr) return false
      const pTime = new Date(dStr).getTime()
      return pTime >= fromTime && pTime <= toTime
    })
  }

  const validMbs = new Set<string>()
  for (const r of mbRes.rows) {
    if (!r[0] || r[0] === 'mb_id' || r[27]) continue // deleted_at is col 27
    validMbs.add(r[0])
  }

  // Aggregate Meals
  // mbd cols: 1 mbd_mb_id, 2 mbd_start_date, 6 mbd_approved, 7 mbd_project_id,
  // 8 mbd_notes, 10 mbd_date, 14 mbd_user_name, 20 deleted_at
  const mealItemsByPrj = new Map<string, Array<{ date: string; description: string; requestor: string; amount: number }>>()
  for (const r of mbdRes.rows) {
    if (!r[0] || r[0] === 'mbd_id' || r[20]) continue // deleted
    const mbId = r[1]
    if (!validMbs.has(mbId)) continue

    const prjId = r[7]
    if (!prjId) continue

    if (!mealItemsByPrj.has(prjId)) mealItemsByPrj.set(prjId, [])
    mealItemsByPrj.get(prjId)!.push({
      date: r[10] || r[2] || '',
      description: r[8] || 'Meal Benefit',
      requestor: r[14] || '',
      amount: parseNum(r[6])
    })
  }

  // Aggregate Overtimes
  const overtimeByPrj = new Map<string, number>()
  for (const r of overtimeRes.rows) {
    if (!r[0] || r[0] === 'overtime_id' || r[13]) continue
    const status = (r[9] || '').trim().toUpperCase() // A=Approved P=Pending R=Rejected
    if (status !== 'A' && status !== 'P') continue
    const prjId = r[14]
    if (!prjId) continue
    overtimeByPrj.set(prjId, (overtimeByPrj.get(prjId) || 0) + parseNum(r[6]))
  }

  // Aggregate Reports
  const reportCountByPrj = new Map<string, number>()
  const reportHoursByPrj = new Map<string, number>()
  for (const r of reports) {
    const prjId = r.reportPrjId
    if (!prjId) continue
    reportCountByPrj.set(prjId, (reportCountByPrj.get(prjId) || 0) + 1)
    reportHoursByPrj.set(prjId, (reportHoursByPrj.get(prjId) || 0) + r.reportTime)
  }

  // Aggregate Purchasing POs
  const validPos = new Map<string, string>() // poNumber -> poDate
  for (const po of pos) {
    if (!po.poStatus.toLowerCase().includes('cancel') && !po.poStatus.toLowerCase().includes('reject')) {
      validPos.set(po.poNumber, po.poDate)
    }
  }

  const purchasingItemsByPrj = new Map<string, Array<{ date: string; description: string; type: string; poNumber: string; amount: number }>>()
  for (const pol of polines) {
    if (!validPos.has(pol.polPoNumber)) continue
    const prjId = pol.polPrjId
    if (!prjId) continue
    
    if (!purchasingItemsByPrj.has(prjId)) purchasingItemsByPrj.set(prjId, [])
    purchasingItemsByPrj.get(prjId)!.push({
      date: validPos.get(pol.polPoNumber) || '',
      description: pol.polItemName || '',
      type: isMaterial(pol.polItemTypeId) ? 'Material' : 'Service',
      poNumber: pol.polPoNumber,
      amount: pol.polTotal
    })
  }

  // Aggregate Reimburse
  const reimburseItemsByPrj = new Map<string, Array<{ date: string; description: string; type: string; requestor: string; amount: number }>>()
  for (const rem of financeAP.reimburseCashOut) {
    if ((rem.reimburseStatus || '').trim().toUpperCase() !== 'A') continue // A=Approve
    const prjId = rem.reimbursePrjIdFk
    if (!prjId) continue

    if (!reimburseItemsByPrj.has(prjId)) reimburseItemsByPrj.set(prjId, [])
    reimburseItemsByPrj.get(prjId)!.push({
      date: rem.reimburseDate || '',
      description: rem.reimburseDescription || '',
      type: isMaterial(rem.reimburseTypeIdFk) ? 'Material' : 'Service',
      requestor: rem.reimburseUserName || '',
      amount: rem.reimburseAmount
    })
  }

  // Final mapping
  const result: ProjectDashboardData[] = projects.map(prj => {
    const pId = prj.prjId
    const purItems = purchasingItemsByPrj.get(pId) || []
    const remItems = reimburseItemsByPrj.get(pId) || []
    const mItems = mealItemsByPrj.get(pId) || []
    
    const budgetTotal = (prj.prjPoMaterial || 0) + (prj.prjPoService || 0)
    
    const purTotal = purItems.reduce((sum, item) => sum + item.amount, 0)
    const remTotal = remItems.reduce((sum, item) => sum + item.amount, 0)
    const mTotal = mItems.reduce((sum, item) => sum + item.amount, 0)
    
    const spentTotal = purTotal + remTotal + mTotal
    const utilizationPct = budgetTotal > 0 ? (spentTotal / budgetTotal) * 100 : (spentTotal > 0 ? 100 : 0)

    const peUser = prj.prjPePic ? salesUsers.find(u => u.userId === prj.prjPePic) : null
    const pePicName = peUser ? peUser.name : prj.prjPePic || ''
    const peTeamName = prj.prjPeSiteId || ''

    // Omit amount fields for the frontend so it's impossible to show them by mistake
    const safePurItems = purItems.map(i => ({ date: i.date, description: i.description, type: i.type, poNumber: i.poNumber }))
    const safeRemItems = remItems.map(i => ({ date: i.date, description: i.description, type: i.type, requestor: i.requestor }))
    const safeMealItems = mItems.map(i => ({ date: i.date, description: i.description, requestor: i.requestor }))

    return {
      prjId: pId,
      prjName: prj.prjName,
      budgetTotal,
      spentTotal,
      utilizationPct,
      purchasingItems: safePurItems,
      reimburseItems: safeRemItems,
      mealItems: safeMealItems,
      overtimeHours: overtimeByPrj.get(pId) || 0,
      reportCount: reportCountByPrj.get(pId) || 0,
      reportHours: reportHoursByPrj.get(pId) || 0,
      pePicName,
      peTeamName,
    }
  })

  return result.filter(r => r.budgetTotal > 0 || r.spentTotal > 0)
}
