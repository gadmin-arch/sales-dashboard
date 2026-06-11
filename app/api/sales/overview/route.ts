import { NextRequest, NextResponse } from 'next/server'
import { getProjectOrders, getOrderTypeLabelSync, loadRefMaps as loadOrderRefMaps, getAllOrderTypes, getOrdersSheetHeaders } from '@/database/repos/orders'
import { getAllQuotations, getStatusLabel, loadRefMaps as loadQuotRefMaps } from '@/database/repos/quotations'
import { getAllSalesUsers } from '@/database/repos/sales-users'
import { getAllCompanies } from '@/database/repos/companies'
import type { Order, Quotation, SalesUser, Company } from '@/database'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const debug = url.searchParams.get('debug') === '1'

  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const salesUser = searchParams.get('salesUser') || ''
    const currency = searchParams.get('currency') || ''
    const orderType = searchParams.get('orderType') || ''
    const period = (searchParams.get('period') as 'monthly' | 'weekly') || 'monthly'

    await Promise.all([loadOrderRefMaps(), loadQuotRefMaps()])

    const [orders, quotations, salesUsers, companies] = await Promise.all([
      getProjectOrders(),
      getAllQuotations(),
      getAllSalesUsers(),
      getAllCompanies(),
    ])

    // Build company map for customer lookup
    const companyMap = new Map<string, string>()
    for (const c of companies) {
      if (c.companyId) companyMap.set(c.companyId, c.companyName)
    }

    // Build maps for lookups
    const quotMap = new Map<string, Quotation>()
    for (const q of quotations) {
      if (q.qId) quotMap.set(q.qId, q)
    }

    const userMap = new Map<string, SalesUser>()
    for (const u of salesUsers) {
      if (u.userId) userMap.set(u.userId, u)
    }

    // Build order-to-sales-owner map via quotation linkage (fallback for orders without prjOwner)
    const orderToSalesOwner = new Map<string, string>()
    for (const o of orders) {
      if (!o.prjOwner && o.prjQId) {
        const quot = quotMap.get(o.prjQId)
        if (quot && quot.qOwner) {
          orderToSalesOwner.set(o.prjId, quot.qOwner)
        }
      }
    }

    // Apply filters
    let filteredOrders = filterByDateRange(orders, dateFrom, dateTo)
    let filteredQuotations = filterQuotationsByDate(quotations, dateFrom, dateTo)

    if (salesUser) {
      filteredOrders = filteredOrders.filter((o) => {
        return o.prjOwner === salesUser || orderToSalesOwner.get(o.prjId) === salesUser
      })
      filteredQuotations = filteredQuotations.filter((q) => q.qOwner === salesUser || q.createdBy === salesUser)
    }
    if (currency) {
      filteredOrders = filteredOrders.filter((o) => o.poCurrency === currency)
      filteredQuotations = filteredQuotations.filter((q) => q.qCurrency === currency)
    }
    if (orderType) {
      filteredOrders = filteredOrders.filter((o) => o.prjOtId === orderType)
      filteredQuotations = filteredQuotations.filter((q) => q.qType === orderType)
    }

    // ── KPIs ──
    const totalProjects = filteredOrders.length
    const totalSales = filteredOrders.reduce((s, o) => s + o.prjPoTotal, 0)
    const totalQuotations = filteredQuotations.length
    const totalQuotationValue = filteredQuotations.reduce((s, q) => s + q.qFinalPrice, 0)

    // ── Quotation status breakdown ──
    const quotStatusBreakdown: Record<string, number> = {}
    for (const q of filteredQuotations) {
      const label = getStatusLabel(q.qStatus)
      quotStatusBreakdown[label] = (quotStatusBreakdown[label] || 0) + 1
    }

    // ── Sales by order type ──
    const salesByTypeMap: Record<string, number> = {}
    for (const o of filteredOrders) {
      const label = getOrderTypeLabelSync(o.prjOtId)
      salesByTypeMap[label] = (salesByTypeMap[label] || 0) + o.prjPoTotal
    }
    const salesByType = Object.entries(salesByTypeMap).map(([name, value]) => ({ name, value }))

    // ── Revenue trend (with material/service breakdown for tooltips) ──
    const revenueAgg: Record<string, { total: number; material: number; service: number }> = {}
    for (const o of filteredOrders) {
      const key = period === 'weekly' ? formatWeek(o.prjPoDate) : formatMonth(o.prjPoDate)
      if (!key) continue
      if (!revenueAgg[key]) revenueAgg[key] = { total: 0, material: 0, service: 0 }
      revenueAgg[key].total += o.prjPoTotal
      revenueAgg[key].material += o.prjPoMaterial
      revenueAgg[key].service += o.prjPoService
    }
    const revenueTrend = sortPeriods(revenueAgg, period).map(([name, v]) => ({
      name,
      value: Math.round(v.total),
      material: Math.round(v.material),
      service: Math.round(v.service),
    }))

    // ── Price composition (100% stacked) ──
    const priceCompByPeriod: Record<string, { material: number; service: number }> = {}
    for (const o of filteredOrders) {
      const key = period === 'weekly' ? formatWeek(o.prjPoDate) : formatMonth(o.prjPoDate)
      if (!key) continue
      if (!priceCompByPeriod[key]) priceCompByPeriod[key] = { material: 0, service: 0 }
      priceCompByPeriod[key].material += o.prjPoMaterial
      priceCompByPeriod[key].service += o.prjPoService
    }
    const priceComposition = sortPeriods(priceCompByPeriod, period).map(([name, v]) => {
      const total = v.material + v.service
      return {
        name,
        material: total > 0 ? Math.round((v.material / total) * 100) : 0,
        service: total > 0 ? 100 - Math.round((v.material / total) * 100) : 0,
      }
    })

    // ── Top projects ──
    const topProjects = [...filteredOrders]
      .sort((a, b) => b.prjPoTotal - a.prjPoTotal)
      .map((o) => {
        const salesOwnerId = o.prjOwner || orderToSalesOwner.get(o.prjId)
        const customerId = o.prjCompanyId || o.prjEndUserId
        return {
          prjId: o.prjId,
          name: o.prjName,
          salesOwner: userMap.get(salesOwnerId)?.name || salesOwnerId || '-',
          customer: companyMap.get(customerId) || customerId || '-',
          type: getOrderTypeLabelSync(o.prjOtId),
          currency: o.poCurrency,
          total: o.prjPoTotal,
          material: o.prjPoMaterial,
          service: o.prjPoService,
          poDate: o.prjPoDate,
        }
      })

    // ── Top sales persons (aggregate from prjOwner + linked quotation owner) ──
    const salesPersonMap: Record<string, { name: string; totalPrice: number; projectCount: number; quotationCount: number }> = {}
    for (const o of filteredOrders) {
      const owner = o.prjOwner || orderToSalesOwner.get(o.prjId)
      if (!owner) continue
      if (!salesPersonMap[owner]) {
        const user = userMap.get(owner)
        salesPersonMap[owner] = { name: user?.name || owner, totalPrice: 0, projectCount: 0, quotationCount: 0 }
      }
      salesPersonMap[owner].totalPrice += o.prjPoTotal
      salesPersonMap[owner].projectCount++
    }
    for (const q of filteredQuotations) {
      const owner = q.qOwner || q.createdBy
      if (!owner) continue
      if (!salesPersonMap[owner]) {
        const user = userMap.get(owner)
        salesPersonMap[owner] = { name: user?.name || owner, totalPrice: 0, projectCount: 0, quotationCount: 0 }
      }
      salesPersonMap[owner].quotationCount++
    }
    const topSalesPersons = Object.values(salesPersonMap)
      .sort((a, b) => b.totalPrice - a.totalPrice)
      .slice(0, 10)

    // ── Summary by type ──
    const summaryMap: Record<string, { quotationCount: number; projectCount: number; totalPrice: number; material: number; service: number }> = {}
    for (const o of filteredOrders) {
      const type = getOrderTypeLabelSync(o.prjOtId)
      if (!summaryMap[type]) summaryMap[type] = { quotationCount: 0, projectCount: 0, totalPrice: 0, material: 0, service: 0 }
      summaryMap[type].projectCount++
      summaryMap[type].totalPrice += o.prjPoTotal
      summaryMap[type].material += o.prjPoMaterial
      summaryMap[type].service += o.prjPoService
    }
    const summary = Object.entries(summaryMap).map(([type, d]) => ({
      type,
      quotationCount: d.quotationCount,
      projectCount: d.projectCount,
      totalPrice: Math.round(d.totalPrice),
      material: Math.round(d.material),
      service: Math.round(d.service),
    }))

    // ── PO Composition (Material vs Service) ──
    const totalMaterial = filteredOrders.reduce((s, o) => s + (o.prjPoMaterial || 0), 0)
    const totalService = filteredOrders.reduce((s, o) => s + (o.prjPoService || 0), 0)
    const poComposition = [
      { name: 'PO Material', value: Math.round(totalMaterial) },
      { name: 'PO Service', value: Math.round(totalService) }
    ]

    // ── Sales users that appear in ANY order or quotation ──
    const activeUserIds = new Set<string>()
    for (const o of orders) {
      if (o.prjOwner) activeUserIds.add(o.prjOwner)
      const linkedOwner = orderToSalesOwner.get(o.prjId)
      if (linkedOwner) activeUserIds.add(linkedOwner)
    }
    for (const q of quotations) {
      if (q.qOwner) activeUserIds.add(q.qOwner)
      if (q.createdBy) activeUserIds.add(q.createdBy)
    }
    const salesUserList = Array.from(activeUserIds)
      .map((id) => { const u = userMap.get(id); return { id, name: u?.name || id, email: u?.email || '' } })
      .sort((a, b) => a.name.localeCompare(b.name))

    // ── Unique currencies in filtered data ──
    const currencySet = new Set<string>()
    for (const o of filteredOrders) { if (o.poCurrency) currencySet.add(o.poCurrency) }
    for (const q of filteredQuotations) { if (q.qCurrency) currencySet.add(q.qCurrency) }
    const currencyList = Array.from(currencySet).sort()

    // ── Order types for dropdown ──
    const orderTypeList = await getAllOrderTypes()

    const result: any = {
      kpis: { totalProjects, totalSales, totalQuotations, totalQuotationValue },
      quotStatusBreakdown,
      salesByType,
      revenueTrend,
      priceComposition,
      poComposition,
      topProjects,
      topSalesPersons,
      summary,
      salesUserList,
      currencyList,
      orderTypeList,
    }

    // Debug: include raw data samples
    if (debug) {
      result._debug = {
        ordersSample: orders.slice(0, 5).map(o => ({ prjId: o.prjId, prjOwner: o.prjOwner, createdBy: o.createdBy, prjQId: o.prjQId })),
        quotationsSample: quotations.slice(0, 3).map(q => ({ qId: q.qId, qOwner: q.qOwner })),
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sales overview error:', error)
    return NextResponse.json({ error: 'Failed to load sales data' }, { status: 500 })
  }
}

// ── helpers ──

function sortPeriods<T>(data: Record<string, T>, period: 'monthly' | 'weekly'): [string, T][] {
  return Object.entries(data).sort(([a], [b]) => {
    return period === 'weekly' ? parseWeekKey(a) - parseWeekKey(b) : parseMonthKey(a) - parseMonthKey(b)
  })
}

function parseMonthKey(key: string): number {
  const months: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
  const parts = key.split(' ')
  if (parts.length !== 2) return 0
  return (parseInt(parts[1]) || 0) * 100 + (months[parts[0]] || 0)
}

function parseWeekKey(key: string): number {
  const match = key.match(/^W(\d+) (\d{4})$/)
  if (!match) return 0
  return (parseInt(match[2]) || 0) * 100 + (parseInt(match[1]) || 0)
}

function formatWeek(dateStr: string): string | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return 'W' + weekNum + ' ' + d.getFullYear()
}

function formatMonth(dateStr: string): string | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return months[d.getMonth()] + ' ' + d.getFullYear()
}

function filterByDateRange(orders: Order[], from: string, to: string): Order[] {
  if (!from && !to) return orders
  return orders.filter((o) => {
    if (!o.prjPoDate) return false
    const d = parseDate(o.prjPoDate)
    if (!d) return true
    if (from && d < new Date(from)) return false
    if (to && d > new Date(to + 'T23:59:59')) return false
    return true
  })
}

function filterQuotationsByDate(quots: Quotation[], from: string, to: string): Quotation[] {
  if (!from && !to) return quots
  return quots.filter((q) => {
    if (!q.qDate) return false
    const d = parseDate(q.qDate)
    if (!d) return true
    if (from && d < new Date(from)) return false
    if (to && d > new Date(to + 'T23:59:59')) return false
    return true
  })
}

function parseDate(str: string): Date | null {
  if (!str) return null
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const [, d, m, y] = dashMatch
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  const iso = new Date(str)
  return isNaN(iso.getTime()) ? null : iso
}
