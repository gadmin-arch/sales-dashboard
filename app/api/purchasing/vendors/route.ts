import { NextRequest, NextResponse } from 'next/server'
import { getAllPurchaseOrders, getAllQrLists, getPaymentTypeLabel, loadProcurementRefMaps } from '@/database'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseDate, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { distinct, makeVendorNamer } from '@/lib/purchasing-helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const paymentType = parseMulti(searchParams, 'paymentType')
    const minSpend = Number(searchParams.get('minSpend') || '0') || 0

    const [pos, quotes] = await Promise.all([
      getAllPurchaseOrders(),
      getAllQrLists(),
    ])
    await loadProcurementRefMaps()

    const vendorName = makeVendorNamer(pos)

    // Vendor quote activity (from qr_lists; not date-scoped)
    const quoteAgg = new Map<string, { count: number; value: number }>()
    for (const q of quotes) {
      if (!q.qrlVendor) continue
      const a = quoteAgg.get(q.qrlVendor) ?? { count: 0, value: 0 }
      a.count++; a.value += q.qrlTotalPrice
      quoteAgg.set(q.qrlVendor, a)
    }

    // ── Filter POs ──
    let filtered = filterDataByDateRange(pos, (p) => p.poDate, dateFrom, dateTo)
    if (paymentType.length) filtered = filtered.filter((p) => paymentType.includes(p.poPaymentType))

    // ── Aggregate per vendor ──
    type Agg = { vendorId: string; poCount: number; totalSpend: number; lastTs: number; lastPoDate: string; pts: Set<string> }
    const agg = new Map<string, Agg>()
    for (const p of filtered) {
      if (!p.poCompanyId) continue
      const a = agg.get(p.poCompanyId) ?? { vendorId: p.poCompanyId, poCount: 0, totalSpend: 0, lastTs: 0, lastPoDate: '', pts: new Set<string>() }
      a.poCount++
      a.totalSpend += p.poAmount
      if (p.poPaymentType) a.pts.add(p.poPaymentType)
      const ts = parseDate(p.poDate)?.getTime() || 0
      if (ts >= a.lastTs) { a.lastTs = ts; a.lastPoDate = p.poDate }
      agg.set(p.poCompanyId, a)
    }

    const grandTotal = [...agg.values()].reduce((s, a) => s + a.totalSpend, 0)

    let vendorRows = [...agg.values()].map((a) => ({
      vendorId: a.vendorId,
      vendor: vendorName(a.vendorId),
      poCount: a.poCount,
      totalSpend: Math.round(a.totalSpend),
      avgPO: a.poCount > 0 ? Math.round(a.totalSpend / a.poCount) : 0,
      sharePct: grandTotal > 0 ? Math.round((a.totalSpend / grandTotal) * 1000) / 10 : 0,
      lastPoDate: a.lastPoDate,
      paymentTypes: [...a.pts].map(getPaymentTypeLabel).join(', '),
      quotesCount: quoteAgg.get(a.vendorId)?.count || 0,
      quotedValue: Math.round(quoteAgg.get(a.vendorId)?.value || 0),
    }))
    if (minSpend > 0) vendorRows = vendorRows.filter((v) => v.totalSpend >= minSpend)
    vendorRows.sort((a, b) => b.totalSpend - a.totalSpend)

    // ── KPIs ──
    const activeVendors = vendorRows.length
    const totalSpend = vendorRows.reduce((s, v) => s + v.totalSpend, 0)
    const topVendorShare = vendorRows[0]?.sharePct || 0
    const avgPerVendor = activeVendors > 0 ? Math.round(totalSpend / activeVendors) : 0

    // ── Top vendors (bar) ──
    const topVendors = vendorRows.slice(0, 12).map((v) => ({ name: v.vendor, value: v.totalSpend }))

    // ── Pareto (cumulative share over top 15) ──
    let cum = 0
    const pareto = vendorRows.slice(0, 15).map((v) => {
      cum += v.totalSpend
      return { name: v.vendor, spend: v.totalSpend, cumulativePct: totalSpend > 0 ? Math.round((cum / totalSpend) * 1000) / 10 : 0 }
    })

    const paymentTypeList = distinct(pos.map((p) => p.poPaymentType).filter(Boolean))
      .map((id) => ({ value: id, label: getPaymentTypeLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))

    return NextResponse.json({
      kpis: { activeVendors, totalSpend, topVendorShare, avgPerVendor },
      topVendors,
      pareto,
      vendors: vendorRows,
      totalRows: vendorRows.length,
      filterOptions: { paymentTypeList },
    })
  } catch (error) {
    console.error('Purchasing vendors API error:', error)
    return NextResponse.json({ error: 'Failed to load vendors' }, { status: 500 })
  }
}
