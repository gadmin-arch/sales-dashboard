import { NextRequest, NextResponse } from 'next/server'
import { cachedRoute } from '@/lib/route-cache'
import { getProjectDashboardData } from '@/database/repos/projects-dashboard'
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
      projectsData,
      allOrders,
      salesUsers,
      orderTypes,
      peStatuses,
      financeStatuses,
    ] = await Promise.all([
      getProjectDashboardData({
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
      projects: projectsData,
      salesUserList,
      pePicList,
      peTeamList,
      orderTypeList,
      projectStatusList,
      invoiceStatusList,
      projectFlagList
    })
}

// v2: bump the cache name when a bugfix must bypass entries computed by older
// code (the data cache outlives deploys; version only changes at sync time).
const getData = cachedRoute('projects-v2', compute)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getData(searchParams))
  } catch (error: any) {
    console.error('Projects Dashboard API error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
