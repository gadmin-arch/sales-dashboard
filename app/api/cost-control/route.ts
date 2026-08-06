import { NextRequest, NextResponse } from 'next/server'
import { cachedRouteView } from '@/lib/route-cache'
import { getCostControlData } from '@/database/repos/cost-control'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseMulti, parseDate } from '@/lib/utils-date-currency'
import {
  loadRefMaps as loadOrderRefMaps,
  getAllOrderTypes,
  getAllPeStatuses,
  getAllFinanceStatuses,
  getAllOrders,
  getFlagLabel,
} from '@/database/repos/orders'
import { getAllSalesUsers } from '@/database/repos/sales-users'
import { getAllCompanies } from '@/database/repos/companies'
import { getInvoicingData } from '@/database/repos/invoicing'

export const dynamic = 'force-dynamic'

async function compute(searchParams: URLSearchParams) {
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const dateType = searchParams.get('dateType') || 'po'
    const customer = parseMulti(searchParams, 'customer')
    const salesUser = parseMulti(searchParams, 'salesUser')
    const orderType = parseMulti(searchParams, 'orderType')
    const projectStatus = parseMulti(searchParams, 'projectStatus')
    const invoiceStatus = parseMulti(searchParams, 'invoiceStatus')
    const projectFlag = parseMulti(searchParams, 'projectFlag')
    const pePic = parseMulti(searchParams, 'pePic')
    const peTeam = parseMulti(searchParams, 'peTeam')
    const userEmail = searchParams.get('userEmail') || undefined
    const taxOption = (searchParams.get('taxOption') as any) || 'all'

    await loadOrderRefMaps()
    const [
      costData,
      allOrders,
      companies,
      salesUsers,
      orderTypes,
      peStatuses,
      financeStatuses,
      invoicingData,
    ] = await Promise.all([
      getCostControlData({
        dateFrom,
        dateTo,
        dateType,
        customer,
        salesUser,
        orderType,
        projectStatus,
        invoiceStatus,
        projectFlag,
        pePic,
        peTeam,
        userEmail,
        taxOption,
      }),
      getAllOrders(),
      getAllCompanies(),
      getAllSalesUsers(),
      getAllOrderTypes(),
      getAllPeStatuses(),
      getAllFinanceStatuses(),
      getInvoicingData(),
    ])

    // Filter all orders by date range to extract dynamic filter lists
    const fromTime = dateFrom ? parseDate(dateFrom)?.getTime() : undefined
    const toTime = dateTo ? parseDate(dateTo)?.getTime() : undefined

    const prjInvDatesMap = new Map<string, string[]>()
    const prjPayDatesMap = new Map<string, string[]>()
    const invToPrjIds = new Map<string, string[]>()
    for (const [invId, prjStr] of invoicingData.invPrjMap.entries()) {
      const prjList = prjStr.split(',').map(s => s.trim()).filter(Boolean)
      invToPrjIds.set(invId, prjList)
    }
    for (const inv of invoicingData.invoices) {
      if (!inv.invId || !inv.invDate) continue
      const prjList = invToPrjIds.get(inv.invId) || []
      for (const pId of prjList) {
        if (!prjInvDatesMap.has(pId)) prjInvDatesMap.set(pId, [])
        prjInvDatesMap.get(pId)!.push(inv.invDate)
      }
    }
    for (const pd of invoicingData.paymentDetails) {
      if (!pd.invId || !pd.date) continue
      const prjList = invToPrjIds.get(pd.invId) || []
      for (const pId of prjList) {
        if (!prjPayDatesMap.has(pId)) prjPayDatesMap.set(pId, [])
        prjPayDatesMap.get(pId)!.push(pd.date)
      }
    }

    const dateFilteredOrders = allOrders.filter(p => {
      if (fromTime !== undefined || toTime !== undefined) {
        if (dateType === 'invoice') {
          const dates = prjInvDatesMap.get(p.prjId) || []
          if (dates.length === 0) return false
          return dates.some(d => {
            const t = parseDate(d)?.getTime()
            if (t === undefined) return false
            if (fromTime !== undefined && t < fromTime) return false
            if (toTime !== undefined && t > toTime) return false
            return true
          })
        }
        if (dateType === 'payment') {
          const dates = prjPayDatesMap.get(p.prjId) || []
          if (dates.length === 0) return false
          return dates.some(d => {
            const t = parseDate(d)?.getTime()
            if (t === undefined) return false
            if (fromTime !== undefined && t < fromTime) return false
            if (toTime !== undefined && t > toTime) return false
            return true
          })
        }
        const targetDateStr = dateType === 'plan_start' 
          ? (p.prjStartDatePlan || p.prjStartDate) 
          : dateType === 'plan_due' 
            ? (p.prjDueDatePlan || p.prjDueDate) 
            : dateType === 'actual_end' 
              ? p.prjEndDateActual 
              : (p.prjPoDate || p.createdAt)
        const targetTime = parseDate(targetDateStr)?.getTime()
        if (targetTime === undefined) return false
        if (fromTime !== undefined && targetTime < fromTime) return false
        if (toTime !== undefined && targetTime > toTime) return false
      }
      return true
    })

    // Extract unique active project owners and PE PICs in the date range
    const activeOwnerIds = new Set(dateFilteredOrders.map(p => p.prjOwner).filter(Boolean))
    const activePicIds = new Set(dateFilteredOrders.map(p => p.prjPePic).filter(Boolean))

    // Build salesUserList (only owners active in date range)
    const salesUserList = salesUsers
      .filter((u) => u.userId && activeOwnerIds.has(u.userId))
      .map((u) => ({ id: u.userId, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Build pePicList (only PICs active in date range)
    const pePicList = salesUsers
      .filter((u) => u.userId && activePicIds.has(u.userId))
      .map((u) => ({ id: u.userId, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
      
    // For active PIC IDs that are not in the salesUsers employee directory, add fallback
    activePicIds.forEach(id => {
      if (id && !pePicList.some(u => u.id === id)) {
        pePicList.push({ id, name: id })
      }
    })
    pePicList.sort((a, b) => a.name.localeCompare(b.name))

    // Build peTeamList (split comma-separated sites and filter uniquely in date range)
    const activeTeams = new Set<string>()
    dateFilteredOrders.forEach(p => {
      if (p.prjPeSiteId) {
        p.prjPeSiteId.split(',').map(s => s.trim()).forEach(s => {
          if (s) activeTeams.add(s)
        })
      }
    })
    const peTeamList = Array.from(activeTeams)
      .map(t => ({ id: t, name: t }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Build customerList (companies active in date range)
    const activeCompanyIds = new Set(dateFilteredOrders.map(p => p.prjCompanyId).filter(Boolean))
    const customerList = companies
      .filter((c) => c.companyId && activeCompanyIds.has(c.companyId))
      .map((c) => ({ id: c.companyId, name: c.companyName }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const orderTypeList = [
      { otId: 'Project', otDescription: 'Project' },
      { otId: 'Internal', otDescription: 'Internal' }
    ]
    const projectStatusList = peStatuses
    const invoiceStatusList = financeStatuses
    const activeFlags = new Set<string>()
    dateFilteredOrders.forEach(p => {
      if (p.prjFlag) activeFlags.add(p.prjFlag)
    })
    const projectFlagList = Array.from(activeFlags)
      .map((f) => ({ flagId: f, flagDescription: getFlagLabel(f) || f }))
      .sort((a, b) => a.flagDescription.localeCompare(b.flagDescription))

    return ({
      projects: costData,
      customerList,
      salesUserList,
      pePicList,
      peTeamList,
      orderTypeList,
      projectStatusList,
      invoiceStatusList,
      projectFlagList
    })
}

// v2: the list response no longer embeds the five per-project item arrays —
// they were the bulk of the old ~2MB payload, which exceeded the server data
// cache's per-entry limit so the route effectively never cached. The modal now
// requests them per project via ?detail=<prjId>; both views share one compute.
// Name bumped so stale old-shape cache entries can't be served.
const getView = cachedRouteView('cost-control-v2', compute, ['detail'], (full, view) => {
  if (view.detail) {
    const p = full.projects.find((x) => x.prjId === view.detail)
    return {
      detail: p ? {
        prjId: p.prjId,
        purchasingItems: p.purchasingItems,
        reimburseItems: p.reimburseItems,
        overtimeItems: p.overtimeItems,
        reportItems: p.reportItems,
        mealItems: p.mealItems,
      } : null,
    }
  }
  return {
    ...full,
    projects: full.projects.map(({ purchasingItems, reimburseItems, overtimeItems, reportItems, mealItems, ...rest }) => rest),
  }
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getView(searchParams))
  } catch (error: any) {
    console.error('Cost Control API error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
