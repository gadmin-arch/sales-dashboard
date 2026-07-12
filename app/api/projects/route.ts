import { NextRequest, NextResponse } from 'next/server'
import { getProjectDashboardData } from '@/database/repos/projects-dashboard'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseMulti } from '@/lib/utils-date-currency'
import {
  loadRefMaps as loadOrderRefMaps,
  getAllOrderTypes,
  getAllPeStatuses,
  getAllFinanceStatuses,
} from '@/database/repos/orders'
import { getAllSalesUsers } from '@/database/repos/sales-users'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const salesUser = parseMulti(searchParams, 'salesUser')
    const orderType = parseMulti(searchParams, 'orderType')
    const projectStatus = parseMulti(searchParams, 'projectStatus')
    const invoiceStatus = parseMulti(searchParams, 'invoiceStatus')
    const projectFlag = parseMulti(searchParams, 'projectFlag')

    await loadOrderRefMaps()
    const [
      projectsData,
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
      }),
      getAllSalesUsers(),
      getAllOrderTypes(),
      getAllPeStatuses(),
      getAllFinanceStatuses(),
    ])

    const salesUserList = salesUsers.filter((u) => u.userId).map((u) => ({ id: u.userId, name: u.name, email: u.email }))
    const orderTypeList = orderTypes
    const projectStatusList = peStatuses
    const invoiceStatusList = financeStatuses
    // Hardcoded for now
    const projectFlagList = [
      { flagId: 'External', flagDescription: 'External' },
      { flagId: 'Internal', flagDescription: 'Internal' },
      { flagId: 'Urgent', flagDescription: 'Urgent' },
    ]

    return NextResponse.json({
      projects: projectsData,
      salesUserList,
      orderTypeList,
      projectStatusList,
      invoiceStatusList,
      projectFlagList
    })
  } catch (error: any) {
    console.error('Projects Dashboard API error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
