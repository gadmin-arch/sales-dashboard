import { NextRequest, NextResponse } from 'next/server'
import { parseDashboardParams } from '@/lib/api-helpers'
import { getProjectOrders, getOrderTypeLabelSync, getPeStatusLabelSync, getFinanceStatusLabelSync, loadRefMaps as loadOrderRefMaps, getAllOrderTypes, getAllPeStatuses, getAllFinanceStatuses, getFlagLabel } from '@/database/repos/orders'
import { getAllQuotations, getStatusLabel, loadRefMaps as loadQuotRefMaps, getAllQuotationTypes } from '@/database/repos/quotations'
import { getAllSalesUsers } from '@/database/repos/sales-users'
import { getAllCompanies } from '@/database/repos/companies'
import { getInvoicingData } from '@/database/repos/invoicing'
import { parseDate, formatMonth, formatWeek, sortByPeriod, filterDataByDateRange, parseMulti } from '@/lib/utils-date-currency'
import type { Order, Quotation, SalesUser, Company } from '@/database'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const debug = url.searchParams.get('debug') === '1'

  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const salesUser = parseMulti(searchParams, 'salesUser')
    const currency = searchParams.get('currency') || ''
    const orderType = parseMulti(searchParams, 'orderType')
    const projectStatus = parseMulti(searchParams, 'projectStatus')
    const invoiceStatus = parseMulti(searchParams, 'invoiceStatus')
    const projectFlag = parseMulti(searchParams, 'projectFlag')
    const period = (searchParams.get('period') as 'monthly' | 'weekly') || 'monthly'

    await Promise.all([loadOrderRefMaps(), loadQuotRefMaps()])

    const [ordersRaw, quotationsRaw, salesUsers, companies, invoicing] = await Promise.all([
      getProjectOrders(),
      getAllQuotations(),
      getAllSalesUsers(),
      getAllCompanies(),
      getInvoicingData(),
    ])
    const { invoices, invPrjMap, paymentDetails } = invoicing

    const orders = ordersRaw.filter((o) => !o.deletedAt).map((o) => {
      const invPct = o.prjInvPercent || 0
      const payPct = o.prjPayPercent || 0
      if (invPct >= 100 || payPct >= 100) {
        return { ...o, prjFStatus: 'C' }
      }
      return o
    })
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

    // Filter orders and quotations by date
    let filteredOrders = filterDataByDateRange(orders, (o) => o.prjPoDate, dateFrom, dateTo)
    let filteredQuotations = filterDataByDateRange(quotations, (q) => q.qDate, dateFrom, dateTo)

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
    if (projectFlag.length) {
      filteredOrders = filteredOrders.filter((o) => projectFlag.includes(o.prjFlag))
      filteredQuotations = filteredQuotations.filter((q) => projectFlag.includes(q.qFlag))
    }

    // Effective (PO-clamped) invoice/payment months per project — so clicking the Invoice/Payment
    // bar filters by the month it was INVOICED/PAID (matching the chart), not by PO month.
    const poByPrj = new Map<string, Date>()
    for (const o of orders) { const d = parseDate(o.prjPoDate); if (d && o.prjId) poByPrj.set(o.prjId, d) }
    const effKey = (raw: string, po: Date): string => {
      const rd = parseDate(raw); const eff = rd && rd > po ? rd : po
      const s = `${eff.getMonth() + 1}/${eff.getDate()}/${eff.getFullYear()}`
      return (period === 'weekly' ? formatWeek(s) : formatMonth(s)) || ''
    }
    const invMonthsByPrj = new Map<string, Set<string>>()
    const payMonthsByPrj = new Map<string, Set<string>>()
    const addKey = (m: Map<string, Set<string>>, prj: string, key: string) => { if (!key) return; let s = m.get(prj); if (!s) m.set(prj, (s = new Set())); s.add(key) }
    for (const inv of invoices) for (const p of (invPrjMap.get(inv.invId) || '').split(',')) { const prj = p.trim(); const po = poByPrj.get(prj); if (po) addKey(invMonthsByPrj, prj, effKey(inv.invDate, po)) }
    for (const pd of paymentDetails) for (const p of (invPrjMap.get(pd.invId) || '').split(',')) { const prj = p.trim(); const po = poByPrj.get(prj); if (po) addKey(payMonthsByPrj, prj, effKey(pd.date, po)) }

    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      if (cType === 'invoiceMonth') filteredOrders = filteredOrders.filter((o) => invMonthsByPrj.get(o.prjId)?.has(cVal))
      if (cType === 'paymentMonth') filteredOrders = filteredOrders.filter((o) => payMonthsByPrj.get(o.prjId)?.has(cVal))
      if (cType === 'salesType') {
        filteredOrders = filteredOrders.filter(o => getOrderTypeLabelSync(o.prjOtId) === cVal)
        filteredQuotations = filteredQuotations.filter(q => getOrderTypeLabelSync(q.qType) === cVal)
      }
      if (cType === 'poType') {
        if (cVal === 'PO Material') filteredOrders = filteredOrders.filter(o => o.prjPoMaterial > 0)
        if (cVal === 'PO Service') filteredOrders = filteredOrders.filter(o => o.prjPoService > 0)
      }
      if (cType === 'revenueMonth') {
        filteredOrders = filteredOrders.filter(o => {
          const key = period === 'weekly' ? formatWeek(o.prjPoDate) : formatMonth(o.prjPoDate)
          return key === cVal
        })
      }
      if (cType === 'priceCompMonth') {
        filteredOrders = filteredOrders.filter(o => {
          const key = period === 'weekly' ? formatWeek(o.prjPoDate) : formatMonth(o.prjPoDate)
          return key === cVal
        })
      }
      if (cType === 'quotStatus') {
        filteredQuotations = filteredQuotations.filter(q => getStatusLabel(q.qStatus) === cVal)
      }
    }

    // ── KPIs ──
    const totalProjects = filteredOrders.length
    const totalSales = filteredOrders.reduce((s, o) => s + o.prjPoTotal, 0)
    const totalQuotations = filteredQuotations.length
    const totalQuotationValue = filteredQuotations.reduce((s, q) => s + q.qFinalPrice, 0)

    // ── PO → Invoice → Payment conversion (projects selected by prj_po_date) ──
    // Only projects with a VALID prj_po_date are in scope (blanks are dropped — they have no
    // PO period to anchor to). Each series is plotted by its own date, but BACKFILL is clamped:
    // an invoice/payment dated before its project's PO date is plotted at the PO month
    // (effective date = max(record date, PO date)), so the flow never runs backwards.
    const prjPoDate = new Map<string, Date>()
    for (const o of filteredOrders) { const d = parseDate(o.prjPoDate); if (d && o.prjId) prjPoDate.set(o.prjId, d) }
    // Governing PO date for an invoice = earliest PO date among its in-scope linked projects.
    const invPoDate = (invId: string): Date | null => {
      let best: Date | null = null
      for (const p of (invPrjMap.get(invId) || '').split(',')) {
        const d = prjPoDate.get(p.trim())
        if (d && (!best || d < best)) best = d
      }
      return best
    }
    const projInvoices = invoices.filter((inv) => invPoDate(inv.invId) != null)
    const projInvIds = new Set(projInvoices.map((i) => i.invId))
    const projPayments = paymentDetails.filter((pd) => projInvIds.has(pd.invId))
    const totalInvoice = projInvoices.reduce((s, i) => s + i.invAmount, 0)
    const totalPayment = projPayments.reduce((s, pd) => s + pd.amount, 0)

    const convAgg: Record<string, { PO: number; Invoice: number; Payment: number }> = {}
    const bumpAt = (eff: Date, k: 'PO' | 'Invoice' | 'Payment', v: number) => {
      const s = `${eff.getMonth() + 1}/${eff.getDate()}/${eff.getFullYear()}`
      const key = period === 'weekly' ? formatWeek(s) : formatMonth(s)
      if (!key) return
      ;(convAgg[key] ??= { PO: 0, Invoice: 0, Payment: 0 })[k] += v
    }
    // clamp a record's date to its project's PO date (never earlier than PO)
    const clamped = (raw: string, po: Date): Date => { const d = parseDate(raw); return d && d > po ? d : po }
    for (const o of filteredOrders) { const po = prjPoDate.get(o.prjId); if (po) bumpAt(po, 'PO', o.prjPoTotal) }
    for (const inv of projInvoices) { const po = invPoDate(inv.invId)!; bumpAt(clamped(inv.invDate, po), 'Invoice', inv.invAmount) }
    for (const pd of projPayments) { const po = invPoDate(pd.invId); if (po) bumpAt(clamped(pd.date, po), 'Payment', pd.amount) }
    const conversionTimeline = sortByPeriod(convAgg, period).map(([name, v]) => ({
      name, PO: Math.round(v.PO), Invoice: Math.round(v.Invoice), Payment: Math.round(v.Payment),
    }))

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

    // Resolve all project flags from orders & quotations
    const activeFlags = new Set<string>()
    for (const o of orders) if (o.prjFlag) activeFlags.add(o.prjFlag)
    for (const q of quotations) if (q.qFlag) activeFlags.add(q.qFlag)
    const projectFlagList = Array.from(activeFlags)
      .map((f) => ({ flagId: f, flagDescription: getFlagLabel(f) || f }))
      .sort((a, b) => a.flagDescription.localeCompare(b.flagDescription))

    const result: any = {
      kpis: { totalProjects, totalSales, totalQuotations, totalQuotationValue, totalInvoice, totalPayment },
      conversionTimeline,
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
      projectFlagList,
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

// ──
