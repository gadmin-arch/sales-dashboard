import { NextRequest, NextResponse } from 'next/server'
import { getInvoicingData } from '@/database/repos/invoicing'
import { getCompanyNameMap } from '@/database/repos/companies'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { clearSheetCache } from '@/database/client'



export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('fresh') === '1') clearSheetCache()
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const customer = parseMulti(searchParams, 'customer')

    const [{ payments, paymentDetails, invoices, invPrjMap }, nameMap] = await Promise.all([getInvoicingData(), getCompanyNameMap()])
    const nameOf = (id: string) => nameMap.get(id) || id || '-'

    // Link each payment to its invoice(s) via payment_details (pd_pay_id -> pd_inv_id),
    // then resolve invoice number + order number (prj) per inv_id.
    const invNoById = new Map<string, string>()
    for (const inv of invoices) if (inv.invId) invNoById.set(inv.invId, inv.invNumber)
    const payLink = new Map<string, { invIds: Set<string>; invNos: Set<string>; prjs: Set<string> }>()
    for (const pd of paymentDetails) {
      if (!pd.payId || !pd.invId) continue
      let e = payLink.get(pd.payId)
      if (!e) { e = { invIds: new Set(), invNos: new Set(), prjs: new Set() }; payLink.set(pd.payId, e) }
      e.invIds.add(pd.invId)
      const no = invNoById.get(pd.invId); if (no) e.invNos.add(no)
      const prj = invPrjMap.get(pd.invId); if (prj) prj.split(',').forEach((x) => e!.prjs.add(x.trim()))
    }
    const joinOr = (s?: Set<string>) => (s && s.size ? [...s].join(', ') : '-')

    let filtered = filterDataByDateRange(payments, (p) => p.payDate, dateFrom, dateTo)
    if (customer.length) filtered = filtered.filter((p) => customer.includes(p.payCompanyId))

    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      if (cType === 'month') filtered = filtered.filter(p => formatMonth(p.payDate) === cVal)
      if (cType === 'customer') filtered = filtered.filter(p => nameOf(p.payCompanyId) === cVal)
    }

    const amountOf = (p: { payTotalAmount: number; payAmount: number }) => p.payTotalAmount || p.payAmount

    // ── KPIs ──
    const totalCollected = filtered.reduce((s, p) => s + amountOf(p), 0)
    const paymentCount = filtered.length
    const avgPayment = paymentCount > 0 ? Math.round(totalCollected / paymentCount) : 0
    const now = new Date()
    const thisMonthKey = formatMonth(`${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`)
    const paymentsThisMonth = filtered
      .filter((p) => formatMonth(p.payDate) === thisMonthKey)
      .reduce((s, p) => s + amountOf(p), 0)

    // ── Monthly trend ──
    const trendAgg: Record<string, { value: number }> = {}
    for (const p of filtered) {
      const k = formatMonth(p.payDate)
      if (!k) continue
      ;(trendAgg[k] ??= { value: 0 }).value += amountOf(p)
    }
    const trend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({ name, value: Math.round(v.value) }))

    // ── By customer ──
    const custAgg: Record<string, number> = {}
    for (const p of filtered) {
      const c = p.payCompanyId || '-'
      custAgg[c] = (custAgg[c] || 0) + amountOf(p)
    }
    const byCustomer = Object.entries(custAgg)
      .map(([id, value]) => ({ customer: nameOf(id), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)

    // ── Filter options (value = id, label = customer name) ──
    const customerList = [...new Set(payments.map((p) => p.payCompanyId).filter(Boolean))]
      .map((id) => ({ value: id, label: nameOf(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))

    // ── Table ──
    const tableRows = [...filtered]
      .sort((a, b) => (parseDate(b.payDate)?.getTime() || 0) - (parseDate(a.payDate)?.getTime() || 0))
      .map((p) => {
        const link = payLink.get(p.payId)
        return {
          payId: p.payId,
          invNumber: joinOr(link?.invNos),
          prj: joinOr(link?.prjs),
          invId: joinOr(link?.invIds),
          customer: nameOf(p.payCompanyId),
          date: p.payDate,
          currency: p.payCurrency,
          amount: amountOf(p),
          remarks: p.payRemarks,
        }
      })

    return NextResponse.json({
      kpis: { totalCollected, paymentsThisMonth, paymentCount, avgPayment },
      trend,
      byCustomer,
      payments: tableRows,
      totalRows: filtered.length,
      filterOptions: { customerList },
    })
  } catch (error) {
    console.error('Payments API error:', error)
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 })
  }
}
