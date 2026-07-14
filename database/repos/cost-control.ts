import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { parseNum } from '../mappers/orders'
import { parseDate } from '@/lib/utils-date-currency'
import { getAllOrders } from './orders'
import { getAllPoLines, getAllPurchaseOrders } from './procurement'
import { getFinanceAPData } from './finance-ap'
import { getAllReports } from './reports'
import { getAllSalesUsers, getTeamNameSync } from './sales-users'

export interface ProjectCostControl {
  prjId: string
  prjName: string
  budgetMaterial: number
  budgetService: number
  spentMaterial: number
  spentService: number
  spentMeal: number
  
  // Detailed Breakdown
  spentMaterialPurchasing: number
  spentMaterialReimburse: number
  countMaterialPurchasing: number
  countMaterialReimburse: number

  spentServicePurchasing: number
  spentServiceReimburse: number
  countServicePurchasing: number
  countServiceReimburse: number
  countMeal: number

  overtimeHours: number
  reportCount: number
  reportHours: number
  
  pePicName: string
  peTeamName: string
  purchasingItems: Array<{ date: string; description: string; type: 'Material' | 'Service'; poNumber: string; vendor: string; amount: number }>
  reimburseItems: Array<{ date: string; description: string; type: 'Material' | 'Service'; requestor: string; amount: number }>
  overtimeItems: Array<{ date: string; hours: number; workerName: string; reason: string }>
  reportItems: Array<{ date: string; hours: number; workerName: string; remarks: string }>
  mealItems: Array<{ date: string; amount: number; approved: number; userId: string; userName: string; notes: string; type: string }>
}

// Material = type id 'M' / 'M-*', everything else service. Reimburse cash_out_types
// use 'M-1'..'M-9'; procurement POLists use bare letters M/S/C/T.
export function isMaterial(typeId: string): boolean {
  const t = (typeId || '').toUpperCase()
  return t === 'M' || t.startsWith('M-')
}

export interface CostControlFilter {
  dateFrom?: string
  dateTo?: string
  salesUser?: string[]
  orderType?: string[]
  projectStatus?: string[]
  invoiceStatus?: string[]
  projectFlag?: string[]
  pePic?: string[]
  peTeam?: string[]
}

export async function getCostControlData(f: CostControlFilter = {}): Promise<ProjectCostControl[]> {
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

  // Filter projects
  const fromTime = f.dateFrom ? parseDate(f.dateFrom)?.getTime() : undefined
  const toTime = f.dateTo ? parseDate(f.dateTo)?.getTime() : undefined
  const projects = allProjects.filter(p => {
    // Sheet dates aren't ISO, so parse before comparing (PO date, created_at fallback)
    const targetTime = (parseDate(p.prjPoDate) || parseDate(p.createdAt))?.getTime()
    if ((fromTime !== undefined || toTime !== undefined) && targetTime === undefined) return false
    if (fromTime !== undefined && targetTime! < fromTime) return false
    if (toTime !== undefined && targetTime! > toTime) return false
    if (f.salesUser?.length && !f.salesUser.includes(p.prjOwner)) return false
    if (f.orderType?.length && !f.orderType.includes(p.prjType)) return false
    if (f.projectStatus?.length && !f.projectStatus.includes(p.prjPeStatus)) return false
    if (f.invoiceStatus?.length && !f.invoiceStatus.includes(p.prjFStatus)) return false
    if (f.projectFlag?.length && !f.projectFlag.includes(p.prjFlag)) return false
    if (f.pePic?.length && !f.pePic.includes(p.prjPePic || '')) return false
    if (f.peTeam?.length && !f.peTeam.some(team => (p.prjPeSiteId || '').split(',').map(s => s.trim()).includes(team))) return false
    return true
  })

  // Process Meal Benefits
  // mb_id (0) -> deleted_at (27)
  const validMbs = new Set<string>()
  for (const r of mbRes.rows) {
    if (!r[0] || r[0] === 'mb_id' || r[27]) continue // deleted_at
    validMbs.add(r[0])
  }

  // Aggregate MBD per project
  // mbd_mb_id (1), mbd_approved (6), mbd_project_id (7), deleted_at (20)
  const mealByPrj = new Map<string, number>()
  const mealCountByPrj = new Map<string, number>()
  const mealItemsByPrj = new Map<string, Array<{ date: string; amount: number; approved: number; userId: string; userName: string; notes: string; type: string }>>()
  for (const r of mbdRes.rows) {
    if (!r[0] || r[0] === 'mbd_id' || r[20]) continue // deleted
    
    const mbId = r[1]
    if (!validMbs.has(mbId)) continue // parent deleted
    
    const prjId = r[7]
    if (!prjId) continue
    
    const amount = parseNum(r[5])
    const approved = parseNum(r[6])
    mealByPrj.set(prjId, (mealByPrj.get(prjId) || 0) + approved)
    mealCountByPrj.set(prjId, (mealCountByPrj.get(prjId) || 0) + 1)

    const userId = r[13] || ''
    let userName = r[14] || ''
    if (!userName && userId) {
      const user = salesUsers.find(u => u.userId === userId)
      if (user) userName = user.name
    }

    if (!mealItemsByPrj.has(prjId)) mealItemsByPrj.set(prjId, [])
    mealItemsByPrj.get(prjId)!.push({
      date: r[10] || '',
      amount,
      approved,
      userId,
      userName,
      notes: r[8] || '',
      type: r[11] || '',
    })
  }

  // Aggregate Overtimes per project
  // overtime_time (6), overtime_status (9), overtime_deleted_at (13), overtime_prj (14)
  const overtimeByPrj = new Map<string, number>()
  const overtimeItemsByPrj = new Map<string, Array<{ date: string; hours: number; workerName: string; reason: string }>>()
  for (const r of overtimeRes.rows) {
    if (!r[0] || r[0] === 'overtime_id' || r[13]) continue // deleted
    const status = (r[9] || '').trim().toUpperCase() // A=Approved P=Pending R=Rejected
    if (status !== 'A' && status !== 'P') continue

    const prjId = r[14]
    if (!prjId) continue

    const hours = parseNum(r[6])
    overtimeByPrj.set(prjId, (overtimeByPrj.get(prjId) || 0) + hours)

    const userId = r[8] || ''
    const workerUser = userId ? salesUsers.find(u => u.userId === userId) : null
    const workerName = workerUser ? workerUser.name : userId || '-'

    if (!overtimeItemsByPrj.has(prjId)) overtimeItemsByPrj.set(prjId, [])
    overtimeItemsByPrj.get(prjId)!.push({
      date: r[2] || '', // overtime_date
      hours,
      workerName,
      reason: r[7] || '' // overtime_reason
    })
  }

  // Aggregate Reports per project
  const reportCountByPrj = new Map<string, number>()
  const reportHoursByPrj = new Map<string, number>()
  const reportItemsByPrj = new Map<string, Array<{ date: string; hours: number; workerName: string; remarks: string }>>()
  for (const r of reports) {
    const prjId = r.reportPrjId
    if (!prjId) continue
    
    reportCountByPrj.set(prjId, (reportCountByPrj.get(prjId) || 0) + 1)
    reportHoursByPrj.set(prjId, (reportHoursByPrj.get(prjId) || 0) + r.reportTime)

    const userId = r.reportUser || ''
    const workerUser = userId ? salesUsers.find(u => u.userId === userId) : null
    const workerName = workerUser ? workerUser.name : userId || '-'

    if (!reportItemsByPrj.has(prjId)) reportItemsByPrj.set(prjId, [])
    reportItemsByPrj.get(prjId)!.push({
      date: r.reportDate || '',
      hours: r.reportTime,
      workerName,
      remarks: r.reportRemarks || ''
    })
  }

  // Aggregate Purchasing POs
  // We need to know which PO is approved/valid. 
  // Let's assume all poLines whose parent PO is not soft-deleted and status != 'Cancelled' are valid.
  // We already filter soft-deleted POs in getAllPurchaseOrders.
  const validPos = new Map<string, { date: string; vendor: string }>()
  for (const po of pos) {
    if (!po.poStatus.toLowerCase().includes('cancel') && !po.poStatus.toLowerCase().includes('reject')) {
      validPos.set(po.poNumber, { date: po.poDate || '', vendor: po.poCompanyName || '' })
    }
  }

  const purMatByPrj = new Map<string, number>()
  const purSvcByPrj = new Map<string, number>()
  const countPurMatByPrj = new Map<string, number>()
  const countPurSvcByPrj = new Map<string, number>()
  const purchasingItemsByPrj = new Map<string, Array<{ date: string; description: string; type: 'Material' | 'Service'; poNumber: string; vendor: string; amount: number }>>()

  for (const pol of polines) {
    const poInfo = validPos.get(pol.polPoNumber)
    if (!poInfo) continue
    const prjId = pol.polPrjId
    if (!prjId) continue

    const type = isMaterial(pol.polItemTypeId) ? 'Material' : 'Service'
    if (type === 'Material') {
      purMatByPrj.set(prjId, (purMatByPrj.get(prjId) || 0) + pol.polTotal)
      countPurMatByPrj.set(prjId, (countPurMatByPrj.get(prjId) || 0) + 1)
    } else {
      purSvcByPrj.set(prjId, (purSvcByPrj.get(prjId) || 0) + pol.polTotal)
      countPurSvcByPrj.set(prjId, (countPurSvcByPrj.get(prjId) || 0) + 1)
    }

    if (!purchasingItemsByPrj.has(prjId)) purchasingItemsByPrj.set(prjId, [])
    purchasingItemsByPrj.get(prjId)!.push({
      date: poInfo.date,
      description: pol.polItemName || '',
      type,
      poNumber: pol.polPoNumber,
      vendor: poInfo.vendor,
      amount: pol.polTotal
    })
  }

  // Aggregate Reimburse (Cash Out)
  const reimMatByPrj = new Map<string, number>()
  const reimSvcByPrj = new Map<string, number>()
  const countReimMatByPrj = new Map<string, number>()
  const countReimSvcByPrj = new Map<string, number>()
  const reimburseItemsByPrj = new Map<string, Array<{ date: string; description: string; type: 'Material' | 'Service'; requestor: string; amount: number }>>()

  for (const rem of financeAP.reimburseCashOut) {
    // Only approved (status codes: A=Approve P=Pending R=Rejected)
    if ((rem.reimburseStatus || '').trim().toUpperCase() !== 'A') continue
    const prjId = rem.reimbursePrjIdFk
    if (!prjId) continue

    const type = isMaterial(rem.reimburseTypeIdFk) ? 'Material' : 'Service'
    if (type === 'Material') {
      reimMatByPrj.set(prjId, (reimMatByPrj.get(prjId) || 0) + rem.reimburseAmount)
      countReimMatByPrj.set(prjId, (countReimMatByPrj.get(prjId) || 0) + 1)
    } else {
      reimSvcByPrj.set(prjId, (reimSvcByPrj.get(prjId) || 0) + rem.reimburseAmount)
      countReimSvcByPrj.set(prjId, (countReimSvcByPrj.get(prjId) || 0) + 1)
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
  const result: ProjectCostControl[] = projects.map(prj => {
    const pId = prj.prjId
    const purMat = purMatByPrj.get(pId) || 0
    const reimMat = reimMatByPrj.get(pId) || 0
    const purSvc = purSvcByPrj.get(pId) || 0
    const reimSvc = reimSvcByPrj.get(pId) || 0
    const meal = mealByPrj.get(pId) || 0

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

    return {
      prjId: pId,
      prjName: prj.prjName,
      budgetMaterial,
      budgetService,
      spentMaterial: purMat + reimMat,
      spentService: purSvc + reimSvc + meal, // meal is part of service cost
      spentMeal: meal,
      
      // Detailed Breakdown
      spentMaterialPurchasing: purMat,
      spentMaterialReimburse: reimMat,
      countMaterialPurchasing: countPurMatByPrj.get(pId) || 0,
      countMaterialReimburse: countReimMatByPrj.get(pId) || 0,

      spentServicePurchasing: purSvc,
      spentServiceReimburse: reimSvc,
      countServicePurchasing: countPurSvcByPrj.get(pId) || 0,
      countServiceReimburse: countReimSvcByPrj.get(pId) || 0,
      countMeal: mealCountByPrj.get(pId) || 0,

      overtimeHours: overtimeByPrj.get(pId) || 0,
      reportCount: reportCountByPrj.get(pId) || 0,
      reportHours: reportHoursByPrj.get(pId) || 0,
      
      pePicName,
      peTeamName,
      purchasingItems: purchasingItemsByPrj.get(pId) || [],
      reimburseItems: reimburseItemsByPrj.get(pId) || [],
      overtimeItems: overtimeItemsByPrj.get(pId) || [],
      reportItems: reportItemsByPrj.get(pId) || [],
      mealItems: mealItemsByPrj.get(pId) || [],
    }
  })

  return result.filter(r => (r.budgetMaterial + r.budgetService) > 0 || (r.spentMaterial + r.spentService) > 0)
}
