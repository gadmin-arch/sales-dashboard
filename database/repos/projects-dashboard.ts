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
  budgetMaterial: number
  budgetService: number
  budgetTotal: number
  spentMaterial: number
  spentService: number
  spentMeal: number
  reimburseMaterialSpent: number
  reimburseServiceSpent: number
  
  purchasingItems: Array<{ date: string; description: string; type: string; poNumber: string; pctOfOrder: number }>
  reimburseItems: Array<{ date: string; description: string; type: string; requestor: string; amount: number }>
  mealItems: Array<{ date: string; description: string; requestor: string; amount: number }>
  overtimeItems: Array<{ date: string; workerName: string; hours: number; reason: string }>
  reportItems: Array<{ date: string; workerName: string; hours: number; remarks: string }>

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
  const overtimeItemsByPrj = new Map<string, Array<{ date: string; workerName: string; hours: number; reason: string }>>()
  for (const r of overtimeRes.rows) {
    if (!r[0] || r[0] === 'overtime_id' || r[13]) continue
    const status = (r[9] || '').trim().toUpperCase() // A=Approved P=Pending R=Rejected
    if (status !== 'A' && status !== 'P') continue
    const prjId = r[14]
    if (!prjId) continue
    
    const hours = parseNum(r[6])
    overtimeByPrj.set(prjId, (overtimeByPrj.get(prjId) || 0) + hours)
    
    if (!overtimeItemsByPrj.has(prjId)) overtimeItemsByPrj.set(prjId, [])
    overtimeItemsByPrj.get(prjId)!.push({
      date: r[3] || '',
      workerName: r[12] || '',
      hours,
      reason: r[5] || 'Overtime'
    })
  }

  // Aggregate Reports
  const reportCountByPrj = new Map<string, number>()
  const reportHoursByPrj = new Map<string, number>()
  const reportItemsByPrj = new Map<string, Array<{ date: string; workerName: string; hours: number; remarks: string }>>()
  for (const r of reports) {
    const prjId = r.reportPrjId
    if (!prjId) continue
    reportCountByPrj.set(prjId, (reportCountByPrj.get(prjId) || 0) + 1)
    reportHoursByPrj.set(prjId, (reportHoursByPrj.get(prjId) || 0) + r.reportTime)
    
    if (!reportItemsByPrj.has(prjId)) reportItemsByPrj.set(prjId, [])
    reportItemsByPrj.get(prjId)!.push({
      date: r.reportDate || '',
      workerName: r.reportUserName || '',
      hours: r.reportTime,
      remarks: r.reportRemarks || ''
    })
  }

  // Aggregate Purchasing POs
  const validPos = new Map<string, string>() // poNumber -> poDate
  const poInfoByNumber = new Map<string, { vendor: string }>()
  for (const po of pos) {
    if (!po.poStatus.toLowerCase().includes('cancel') && !po.poStatus.toLowerCase().includes('reject')) {
      validPos.set(po.poNumber, po.poDate)
      poInfoByNumber.set(po.poNumber, { vendor: po.poVendorName })
    }
  }

  const purMatByPrj = new Map<string, number>()
  const purSvcByPrj = new Map<string, number>()
  const purchasingItemsByPrj = new Map<string, Array<{ date: string; description: string; type: string; poNumber: string; amount: number }>>()
  
  for (const pol of polines) {
    if (!validPos.has(pol.polPoNumber)) continue
    const prjId = pol.polPrjId
    if (!prjId) continue

    const amount = pol.polTotal
    const isMat = isMaterial(pol.polItemTypeId)
    const type = isMat ? 'Material' : 'Service'

    if (isMat) {
      purMatByPrj.set(prjId, (purMatByPrj.get(prjId) || 0) + amount)
    } else {
      purSvcByPrj.set(prjId, (purSvcByPrj.get(prjId) || 0) + amount)
    }
    
    if (!purchasingItemsByPrj.has(prjId)) purchasingItemsByPrj.set(prjId, [])
    purchasingItemsByPrj.get(prjId)!.push({
      date: validPos.get(pol.polPoNumber) || '',
      description: pol.polItemName || '',
      type,
      poNumber: pol.polPoNumber,
      amount
    })
  }

  // Aggregate Reimburse
  const reimMatByPrj = new Map<string, number>()
  const reimSvcByPrj = new Map<string, number>()
  const reimburseItemsByPrj = new Map<string, Array<{ date: string; description: string; type: string; requestor: string; amount: number }>>()
  for (const rem of financeAP.reimburseCashOut) {
    if ((rem.reimburseStatus || '').trim().toUpperCase() !== 'A') continue // A=Approve
    const prjId = rem.reimbursePrjIdFk
    if (!prjId) continue

    const isMat = isMaterial(rem.reimburseTypeIdFk)
    const type = isMat ? 'Material' : 'Service'

    if (isMat) {
      reimMatByPrj.set(prjId, (reimMatByPrj.get(prjId) || 0) + rem.reimburseAmount)
    } else {
      reimSvcByPrj.set(prjId, (reimSvcByPrj.get(prjId) || 0) + rem.reimburseAmount)
    }

    if (!reimburseItemsByPrj.has(prjId)) reimburseItemsByPrj.set(prjId, [])
    reimburseItemsByPrj.get(prjId)!.push({
      date: rem.reimburseDate || '',
      description: rem.reimburseDescription || '',
      type,
      requestor: rem.reimburseUserName || '',
      amount: rem.reimburseAmount
    })
  }

  // Final mapping
  const result: ProjectDashboardData[] = projects.map(prj => {
    const pId = prj.prjId
    const purMat = purMatByPrj.get(pId) || 0
    const reimMat = reimMatByPrj.get(pId) || 0
    const purSvc = purSvcByPrj.get(pId) || 0
    const reimSvc = reimSvcByPrj.get(pId) || 0
    const purItems = purchasingItemsByPrj.get(pId) || []
    const remItems = reimburseItemsByPrj.get(pId) || []
    const mItems = mealItemsByPrj.get(pId) || []
    
    const meal = mItems.reduce((sum, item) => sum + item.amount, 0)
    
    const reimburseMaterialSpent = reimMat
    const reimburseServiceSpent = reimSvc

    const peUser = prj.prjPePic ? salesUsers.find(u => u.userId === prj.prjPePic) : null
    const pePicName = peUser ? peUser.name : prj.prjPePic || ''
    const peTeamName = prj.prjPeSiteId || ''

    const poTotal = (prj.prjPoMaterial || 0) + (prj.prjPoService || 0)
    let budgetBase = prj.prjPoTotal || poTotal

    if (prj.prjInvPercent === 100 && prj.prjInvAmount) {
      budgetBase = prj.prjInvAmount
    } else if (prj.prjPayPercent === 100 && prj.prjPayAmount) {
      budgetBase = prj.prjPayAmount
    } else if (prj.prjInvPercent && prj.prjInvPercent > 0 && prj.prjInvAmount) {
      budgetBase = prj.prjInvAmount / (prj.prjInvPercent / 100)
    } else if (prj.prjPayPercent && prj.prjPayPercent > 0 && prj.prjPayAmount) {
      budgetBase = prj.prjPayAmount / (prj.prjPayPercent / 100)
    }

    let budgetMaterial = prj.prjPoMaterial || 0
    let budgetService = prj.prjPoService || 0

    if (poTotal > 0) {
      const factor = budgetBase / poTotal
      budgetMaterial = (prj.prjPoMaterial || 0) * factor
      budgetService = (prj.prjPoService || 0) * factor
    } else if (budgetBase > 0) {
      budgetMaterial = budgetBase
      budgetService = 0
    }
    const budgetTotal = budgetMaterial + budgetService

    // Omit amount fields for purchasing POs so they are never exposed, returning only pctOfOrder
    const safePurItems = purItems.map(i => ({
      date: i.date,
      description: i.description,
      type: i.type,
      poNumber: i.poNumber,
      pctOfOrder: budgetTotal > 0 ? (i.amount / budgetTotal) * 100 : 0
    }))
    
    // Keep amounts for reimbursements and meals
    const safeRemItems = remItems.map(i => ({ date: i.date, description: i.description, type: i.type, requestor: i.requestor, amount: i.amount }))
    const safeMealItems = mItems.map(i => ({ date: i.date, description: i.description, requestor: i.requestor, amount: i.amount }))

    return {
      prjId: pId,
      prjName: prj.prjName,
      budgetMaterial,
      budgetService,
      budgetTotal,
      spentMaterial: purMat + reimMat,
      spentService: purSvc + reimSvc + meal,
      spentMeal: meal,
      reimburseMaterialSpent,
      reimburseServiceSpent,
      purchasingItems: safePurItems,
      reimburseItems: safeRemItems,
      mealItems: safeMealItems,
      overtimeItems: overtimeItemsByPrj.get(pId) || [],
      reportItems: reportItemsByPrj.get(pId) || [],
      overtimeHours: overtimeByPrj.get(pId) || 0,
      reportCount: reportCountByPrj.get(pId) || 0,
      reportHours: reportHoursByPrj.get(pId) || 0,
      pePicName,
      peTeamName,
    }
  })

  return result.filter(r => (r.budgetMaterial + r.budgetService) > 0 || (r.spentMaterial + r.spentService) > 0)
}
