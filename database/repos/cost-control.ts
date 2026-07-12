import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { parseNum } from '../mappers/orders'
import { getAllOrders } from './orders'
import { getAllPoLines, getAllPurchaseOrders } from './procurement'
import { getFinanceAPData } from './finance-ap'
import { getAllReports } from './reports'

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
}

// Map from cash_out_types and item_types where M- is material, everything else is service.
export function isMaterial(typeId: string): boolean {
  return typeId?.toUpperCase().startsWith('M-') || false
}

export interface CostControlFilter {
  dateFrom?: string
  dateTo?: string
  salesUser?: string[]
  orderType?: string[]
  projectStatus?: string[]
  invoiceStatus?: string[]
  projectFlag?: string[]
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
    mbRes
  ] = await Promise.all([
    getAllOrders(),
    getAllPurchaseOrders(),
    getAllPoLines(),
    getFinanceAPData(),
    getAllReports(),
    fetchAllRows(GOOGLE_CONFIG.reports.overtimeSpreadsheetId, GOOGLE_CONFIG.reports.sheets.overtimes),
    fetchAllRows(GOOGLE_CONFIG.payroll.spreadsheetId, 'meal_benefit_details'),
    fetchAllRows(GOOGLE_CONFIG.payroll.spreadsheetId, 'meal_benefits'),
  ])

  // Filter projects
  const projects = allProjects.filter(p => {
    // Basic date fallback
    const targetDate = p.prjPoDate || p.createdAt || ''
    if (f.dateFrom && targetDate < f.dateFrom) return false
    if (f.dateTo && targetDate > f.dateTo) return false
    if (f.salesUser?.length && !f.salesUser.includes(p.prjOwner)) return false
    if (f.orderType?.length && !f.orderType.includes(p.prjOtId)) return false
    if (f.projectStatus?.length && !f.projectStatus.includes(p.prjPeStatus)) return false
    if (f.invoiceStatus?.length && !f.invoiceStatus.includes(p.prjFStatus)) return false
    if (f.projectFlag?.length && !f.projectFlag.includes(p.prjFlag)) return false
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
  for (const r of mbdRes.rows) {
    if (!r[0] || r[0] === 'mbd_id' || r[20]) continue // deleted
    
    const mbId = r[1]
    if (!validMbs.has(mbId)) continue // parent deleted
    
    const prjId = r[7]
    if (!prjId) continue
    
    const approved = parseNum(r[6])
    mealByPrj.set(prjId, (mealByPrj.get(prjId) || 0) + approved)
    mealCountByPrj.set(prjId, (mealCountByPrj.get(prjId) || 0) + 1)
  }

  // Aggregate Overtimes per project
  // overtime_time (6), overtime_status (9), overtime_deleted_at (13), overtime_prj (14)
  const overtimeByPrj = new Map<string, number>()
  for (const r of overtimeRes.rows) {
    if (!r[0] || r[0] === 'overtime_id' || r[13]) continue // deleted
    const status = (r[9] || '').toLowerCase()
    if (status !== 'approved' && status !== 'pending') continue
    
    const prjId = r[14]
    if (!prjId) continue

    const hours = parseNum(r[6])
    overtimeByPrj.set(prjId, (overtimeByPrj.get(prjId) || 0) + hours)
  }

  // Aggregate Reports per project
  const reportCountByPrj = new Map<string, number>()
  const reportHoursByPrj = new Map<string, number>()
  for (const r of reports) {
    const prjId = r.reportPrjId
    if (!prjId) continue
    
    reportCountByPrj.set(prjId, (reportCountByPrj.get(prjId) || 0) + 1)
    reportHoursByPrj.set(prjId, (reportHoursByPrj.get(prjId) || 0) + r.reportTime)
  }

  // Aggregate Purchasing POs
  // We need to know which PO is approved/valid. 
  // Let's assume all poLines whose parent PO is not soft-deleted and status != 'Cancelled' are valid.
  // We already filter soft-deleted POs in getAllPurchaseOrders.
  const validPos = new Set<string>()
  for (const po of pos) {
    // Only count if it's not cancelled or rejected, or just take all for now?
    // Usually status 'Approved' or 'Completed'. Let's say all that are not 'Cancelled'/'Rejected'.
    // We will just include all since it's "spent" unless cancelled.
    if (!po.poStatus.toLowerCase().includes('cancel') && !po.poStatus.toLowerCase().includes('reject')) {
      validPos.add(po.poNumber)
    }
  }

  const purMatByPrj = new Map<string, number>()
  const purSvcByPrj = new Map<string, number>()
  const countPurMatByPrj = new Map<string, number>()
  const countPurSvcByPrj = new Map<string, number>()
  for (const pol of polines) {
    if (!validPos.has(pol.polPoNumber)) continue
    const prjId = pol.polPrjId
    if (!prjId) continue

    if (isMaterial(pol.polItemTypeId)) {
      purMatByPrj.set(prjId, (purMatByPrj.get(prjId) || 0) + pol.polTotal)
      countPurMatByPrj.set(prjId, (countPurMatByPrj.get(prjId) || 0) + 1)
    } else {
      purSvcByPrj.set(prjId, (purSvcByPrj.get(prjId) || 0) + pol.polTotal)
      countPurSvcByPrj.set(prjId, (countPurSvcByPrj.get(prjId) || 0) + 1)
    }
  }

  // Aggregate Reimburse (Cash Out)
  const reimMatByPrj = new Map<string, number>()
  const reimSvcByPrj = new Map<string, number>()
  const countReimMatByPrj = new Map<string, number>()
  const countReimSvcByPrj = new Map<string, number>()
  for (const rem of financeAP.reimburseCashOut) {
    // Only approved and not deleted
    if (rem.reimburseStatus.toLowerCase() !== 'approved') continue
    const prjId = rem.reimbursePrjIdFk
    if (!prjId) continue

    if (isMaterial(rem.reimburseTypeIdFk)) {
      reimMatByPrj.set(prjId, (reimMatByPrj.get(prjId) || 0) + rem.reimburseAmount)
      countReimMatByPrj.set(prjId, (countReimMatByPrj.get(prjId) || 0) + 1)
    } else {
      reimSvcByPrj.set(prjId, (reimSvcByPrj.get(prjId) || 0) + rem.reimburseAmount)
      countReimSvcByPrj.set(prjId, (countReimSvcByPrj.get(prjId) || 0) + 1)
    }
  }

  // Final mapping
  const result: ProjectCostControl[] = projects.map(prj => {
    const pId = prj.prjId
    const purMat = purMatByPrj.get(pId) || 0
    const reimMat = reimMatByPrj.get(pId) || 0
    const purSvc = purSvcByPrj.get(pId) || 0
    const reimSvc = reimSvcByPrj.get(pId) || 0
    const meal = mealByPrj.get(pId) || 0

    return {
      prjId: pId,
      prjName: prj.prjName,
      budgetMaterial: prj.prjPoMaterial,
      budgetService: prj.prjPoService,
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
    }
  })

  // Optionally sort by something (e.g. recent projects or largest budget)
  // return result.sort((a, b) => (b.budgetMaterial + b.budgetService) - (a.budgetMaterial + a.budgetService))
  return result.filter(r => (r.budgetMaterial + r.budgetService) > 0 || (r.spentMaterial + r.spentService) > 0)
}
