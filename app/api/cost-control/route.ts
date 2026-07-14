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
} from '@/database/repos/orders'
import { getAllSalesUsers } from '@/database/repos/sales-users'

export const dynamic = 'force-dynamic'

async function compute(searchParams: URLSearchParams) {
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const salesUser = parseMulti(searchParams, 'salesUser')
    const orderType = parseMulti(searchParams, 'orderType')
    const projectStatus = parseMulti(searchParams, 'projectStatus')
    const invoiceStatus = parseMulti(searchParams, 'invoiceStatus')
    const projectFlag = parseMulti(searchParams, 'projectFlag')
    const pePic = parseMulti(searchParams, 'pePic')
    const peTeam = parseMulti(searchParams, 'peTeam')

    await loadOrderRefMaps()
    const [
      costData,
      allOrders,
      salesUsers,
      orderTypes,
      peStatuses,
      financeStatuses,
    ] = await Promise.all([
      getCostControlData({
        dateFrom,
        dateTo,
        salesUser,
        orderType,
        projectStatus,
        invoiceStatus,
        projectFlag,
        pePic,
        peTeam,
      }),
      getAllOrders(),
      getAllSalesUsers(),
      getAllOrderTypes(),
      getAllPeStatuses(),
      getAllFinanceStatuses(),
    ])

    // Filter all orders by date range to extract dynamic filter lists
    const fromTime = dateFrom ? parseDate(dateFrom)?.getTime() : undefined
    const toTime = dateTo ? parseDate(dateTo)?.getTime() : undefined

    const dateFilteredOrders = allOrders.filter(p => {
      const targetTime = (parseDate(p.prjPoDate) || parseDate(p.createdAt))?.getTime()
      if ((fromTime !== undefined || toTime !== undefined) && targetTime === undefined) return false
      if (fromTime !== undefined && targetTime! < fromTime) return false
      if (toTime !== undefined && targetTime! > toTime) return false
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
      if (!pePicList.some(u => u.id === id)) {
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

    const orderTypeList = [
      { otId: 'Project', otDescription: 'Project' },
      { otId: 'Internal', otDescription: 'Internal' }
    ]
    const projectStatusList = peStatuses
    const invoiceStatusList = financeStatuses
    const projectFlagList = [
      { flagId: 'External', flagDescription: 'External' },
      { flagId: 'Internal', flagDescription: 'Internal' },
      { flagId: 'Urgent', flagDescription: 'Urgent' },
    ]

    return ({
      projects: costData,
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
