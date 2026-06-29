import { NextRequest, NextResponse } from 'next/server'
import { clearSheetCache } from '@/database/client'
import { getProjectOrders, getOrderTypeLabelSync, getPeStatusLabelSync, getFinanceStatusLabelSync, loadRefMaps as loadOrderRefMaps, getAllOrderTypes, getAllPeStatuses, getAllFinanceStatuses } from '@/database/repos/orders'
import { getAllQuotations, getStatusLabel, loadRefMaps as loadQuotRefMaps, getAllQuotationTypes } from '@/database/repos/quotations'
import { getAllSalesUsers } from '@/database/repos/sales-users'
import { getAllCompanies } from '@/database/repos/companies'
import { formatMonth, formatWeek, sortByPeriod, parseDate, parseMulti } from '@/lib/utils-date-currency'
import type { Order, Quotation, SalesUser, Company } from '@/database'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const debug = url.searchParams.get('debug') === '1'

  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('fresh') === '1') clearSheetCache()
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const salesUser = parseMulti(searchParams, 'salesUser')
    const currency = searchParams.get('currency') || ''
    const orderType = parseMulti(searchParams, 'orderType')
    const projectStatus = parseMulti(searchParams, 'projectStatus')
    const invoiceStatus = parseMulti(searchParams, 'invoiceStatus')
    const period = (searchParams.get('period') as 'monthly' | 'weekly') || 'monthly'

    await Promise.all([loadOrderRefMaps(), loadQuotRefMaps()])

    const [ordersRaw, quotationsRaw, salesUsers, companies] = await Promise.all([
      getProjectOrders(),
      getAllQuotations(),
      getAllSalesUsers(),
      getAllCompanies(),
    ])

    const orders = ordersRaw.filter((o) => !o.deletedAt)
    const quotations = quotationsRaw.filter((q) => !q.deletedAt)

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

    if (salesUser.length) {
      filteredOrders = filteredOrders.filter((o) =>
        salesUser.includes(o.prjOwner) || salesUser.includes(orderToSalesOwner.get(o.prjId) || '')
      )
      filteredQuotations = filteredQuotations.filter((q) => salesUser.includes(q.qOwner) || salesUser.includes(q.createdBy))
    }
    if (currency) {
      filteredOrders = filteredOrders.filter((o) => o.poCurrency === currency)
      filteredQuotations = filteredQuotations.filter((q) => q.qCurrency === currency)
    }
    if (orderType.length) {
      filteredOrders = filteredOrders.filter((o) => orderType.includes(o.prjOtId))
      filteredQuotations = filteredQuotations.filter((q) => orderType.includes(q.qType))
    }
    // Project status and invoice status are project-level attributes (orders only)
    if (projectStatus.length) {
      filteredOrders = filteredOrders.filter((o) => projectStatus.includes(o.prjPeStatus))
    }
    if (invoiceStatus.length) {
      filteredOrders = filteredOrders.filter((o) => invoiceStatus.includes(o.prjFStatus))
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
    const revenueTrend = sortByPeriod(revenueAgg, period).map(([name, v]) => ({
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
    const priceComposition = sortByPeriod(priceCompByPeriod, period).map(([name, v]) => {
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
          salesOwner: userMap.get(salesOwnerId || '')?.name || salesOwnerId || '-',
          customer: companyMap.get(customerId) || customerId || '-',
          type: getOrderTypeLabelSync(o.prjOtId),
          projectStatus: getPeStatusLabelSync(o.prjPeStatus),
          invoiceStatus: getFinanceStatusLabelSync(o.prjFStatus),
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

    // ── Quotation Summary by Type ──
    const quotationTypes = await getAllQuotationTypes()
    const allTypes = [...quotationTypes, { qtId: '', qtDesc: '(Blank)' }]
    const quotationSummary = allTypes
      .map((qt) => {
        const quotsOfType = filteredQuotations.filter((q) => {
          if (!qt.qtId) {
            return !q.qType || !quotationTypes.some((t) => t.qtId === q.qType)
          }
          return q.qType === qt.qtId
        })
        const wonQuots = quotsOfType.filter((q) => orders.some((o) => o.prjQId === q.qId))
        
        const totalQuotation = quotsOfType.length
        const totalQuotationWon = wonQuots.length
        const wonPercentage = totalQuotation > 0 ? (totalQuotationWon / totalQuotation) * 100 : 0
        
        const totalQuotationWonFinalPrice = wonQuots.reduce((sum, q) => sum + (q.qFinalPrice || 0), 0)
        const relatedOrders = orders.filter((o) => wonQuots.some((q) => o.prjQId === q.qId))
        const totalOrderPriceFromQuotation = relatedOrders.reduce((sum, o) => sum + (o.prjPoTotal || 0), 0)
        const totalQuotationValue = quotsOfType.reduce((sum, q) => sum + (q.qFinalPrice || 0), 0)

        const orderToWonPricePercentage = totalQuotationWonFinalPrice > 0 
          ? (totalOrderPriceFromQuotation / totalQuotationWonFinalPrice) * 100 
          : 0

        return {
          qType: qt.qtDesc || qt.qtId || '(Blank)',
          totalQuotation,
          totalQuotationWon,
          wonPercentage: Math.round(wonPercentage * 10) / 10,
          totalQuotationWonFinalPrice: Math.round(totalQuotationWonFinalPrice),
          totalOrderPriceFromQuotation: Math.round(totalOrderPriceFromQuotation),
          totalQuotationValue: Math.round(totalQuotationValue),
          orderToWonPricePercentage: Math.round(orderToWonPricePercentage * 10) / 10,
        }
      })
      .filter((row) => row.totalQuotation > 0 || row.qType !== '(Blank)')

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

    // ── Order types / status lists for dropdowns ──
    const orderTypeList = await getAllOrderTypes()
    const projectStatusList = await getAllPeStatuses()
    const invoiceStatusList = await getAllFinanceStatuses()

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
      quotationSummary,
      salesUserList,
      currencyList,
      orderTypeList,
      projectStatusList,
      invoiceStatusList,
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

// ── helpers (using shared utils) ──

function filterByDateRange(items: any[], from: string, to: string) {
  if (!from && !to) return items
  return items.filter((o: any) => {
    if (!o.prjPoDate) return false
    const d = parseDate(o.prjPoDate)
    if (!d) return true
    if (from && d < new Date(from)) return false
    if (to && d > new Date(to + 'T23:59:59')) return false
    return true
  })
}

function filterQuotationsByDate(quots: any[], from: string, to: string) {
  if (!from && !to) return quots
  return quots.filter((q: any) => {
    if (!q.qDate) return false
    const d = parseDate(q.qDate)
    if (!d) return true
    if (from && d < new Date(from)) return false
    if (to && d > new Date(to + 'T23:59:59')) return false
    return true
  })
}
