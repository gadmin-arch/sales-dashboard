import { NextRequest, NextResponse } from 'next/server'
import { getInvoicingData } from '@/database/repos/invoicing'
import { getCompanyNameMap } from '@/database/repos/companies'
import { getProjectCompletionDates } from '@/database/repos/orders'
import { clearSheetCache } from '@/database/client'
import { parseDate, formatMonth, sortByPeriod, parseMulti } from '@/lib/utils-date-currency'
import type { Invoice } from '@/database/types'

type PayStatus = 'paid' | 'partial' | 'unpaid' | 'overdue'

const STATUS_LABELS: Record<PayStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
}

// Payment status is driven by the payment PERCENTAGE, not the amount —
// e.g. 100% with amount 0 still counts as fully collected ("paid").
function statusOf(inv: Invoice, today: Date): PayStatus {
  const pct = inv.invPaymentPercentage
  if (pct >= 100) return 'paid'
  const due = parseDate(inv.invEstPaymentDate)
  if (due && due < today) return 'overdue'
  return pct > 0 ? 'partial' : 'unpaid'
}

function inRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const d = parseDate(dateStr)
  if (!d) return true
  if (from && d < new Date(from)) return false
  if (to && d > new Date(to + 'T23:59:59')) return false
  return true
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('fresh') === '1') clearSheetCache()
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const customer = parseMulti(searchParams, 'customer')
    const status = parseMulti(searchParams, 'status')

    const [{ invoices, invPrjMap, paymentDetails }, nameMap, completionMap] = await Promise.all([
      getInvoicingData(),
      getCompanyNameMap(),
      getProjectCompletionDates(),
    ])
    const nameOf = (id: string) => nameMap.get(id) || id || '-'
    const today = new Date()

    // ── Filter invoices ──
    let filtered = invoices.filter((inv) => inRange(inv.invDate, dateFrom, dateTo))
    if (customer.length) filtered = filtered.filter((inv) => customer.includes(inv.invCompanyId))
    if (status.length) filtered = filtered.filter((inv) => status.includes(statusOf(inv, today)))

    // Actual collected amount per invoice from payment_details (pd_total_amount),
    // joined on pd_inv_id = inv_id, scoped to the filtered invoices.
    const filteredIds = new Set(filtered.map((inv) => inv.invId))
    const paidByInv = new Map<string, number>()
    for (const pd of paymentDetails) {
      if (!filteredIds.has(pd.invId)) continue
      paidByInv.set(pd.invId, (paidByInv.get(pd.invId) || 0) + pd.amount)
    }

    // ── Per-invoice derived rows ──
    const rows = filtered.map((inv) => {
      const st = statusOf(inv, today)
      // Outstanding from the payment percentage: (1 - pct) * invoice amount.
      // Paid uses the actual collected amount field (inv_payment_amount).
      const pct = Math.min(100, Math.max(0, inv.invPaymentPercentage))
      const amount = inv.invAmount
      const outstanding = Math.max(0, (1 - pct / 100) * amount)
      const paid = paidByInv.get(inv.invId) || 0
      const due = parseDate(inv.invEstPaymentDate)
      const daysOverdue = st === 'overdue' && due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0
      // Lead time: days from project completion (status -> C) to the invoice date
      const prjStr = invPrjMap.get(inv.invId) || ''
      const firstPrj = prjStr.split(',')[0].trim()
      const compDate = firstPrj ? parseDate(completionMap.get(firstPrj) || '') : null
      const invDate = parseDate(inv.invDate)
      const leadTime = compDate && invDate ? Math.round((invDate.getTime() - compDate.getTime()) / 86400000) : null
      return {
        invId: inv.invId,
        invNumber: inv.invNumber,
        prj: prjStr || '-',
        leadTime,
        customerId: inv.invCompanyId,
        customer: nameOf(inv.invCompanyId),
        invoiceDate: inv.invDate,
        dueDate: inv.invEstPaymentDate,
        amount,
        paid,
        outstanding,
        status: st,
        statusLabel: STATUS_LABELS[st],
        daysOverdue,
        refName: inv.invRefName,
        remarks: inv.invRemarks,
      }
    })

    // ── KPIs ──
    const totalInvoiced = rows.reduce((s, r) => s + r.amount, 0)
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
    const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0)
    const overdueRows = rows.filter((r) => r.status === 'overdue')
    const overdueCount = overdueRows.length
    const overdueAmount = overdueRows.reduce((s, r) => s + r.outstanding, 0)
    const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 1000) / 10 : 0

    // ── Status breakdown (donut) ──
    const statusCounts: Record<PayStatus, number> = { paid: 0, partial: 0, unpaid: 0, overdue: 0 }
    for (const r of rows) statusCounts[r.status]++
    const statusBreakdown = (Object.keys(statusCounts) as PayStatus[])
      .map((k) => ({ name: STATUS_LABELS[k], value: statusCounts[k] }))
      .filter((x) => x.value > 0)

    // ── Invoice vs Payment trend (monthly) ──
    // Invoice by invoice month; Payment by payment_details pd_date (real collection date).
    const trendAgg: Record<string, { Invoice: number; Payment: number }> = {}
    for (const r of rows) {
      const k = formatMonth(r.invoiceDate)
      if (!k) continue
      ;(trendAgg[k] ??= { Invoice: 0, Payment: 0 }).Invoice += r.amount
    }
    for (const pd of paymentDetails) {
      if (!filteredIds.has(pd.invId)) continue
      const k = formatMonth(pd.date)
      if (!k) continue
      ;(trendAgg[k] ??= { Invoice: 0, Payment: 0 }).Payment += pd.amount
    }
    const trend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({
      name,
      Invoice: Math.round(v.Invoice),
      Payment: Math.round(v.Payment),
    }))

    // ── Aging receivables (outstanding only) ──
    const agingDefs = [
      { name: 'Current', min: -Infinity, max: 0 },
      { name: '1-30', min: 1, max: 30 },
      { name: '31-60', min: 31, max: 60 },
      { name: '61-90', min: 61, max: 90 },
      { name: '90+', min: 91, max: Infinity },
    ]
    const aging = agingDefs.map((d) => ({ name: d.name, value: 0 }))
    for (const r of rows) {
      if (r.outstanding <= 0) continue
      const due = parseDate(r.dueDate)
      const days = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0
      const idx = agingDefs.findIndex((d) => days >= d.min && days <= d.max)
      if (idx >= 0) aging[idx].value += Math.round(r.outstanding)
    }

    // ── Lead-time distribution (completion -> invoice date, in days) ──
    const leadDefs = [
      { name: 'Early (<0)', min: -Infinity, max: -1 },
      { name: '0-7', min: 0, max: 7 },
      { name: '8-14', min: 8, max: 14 },
      { name: '15-30', min: 15, max: 30 },
      { name: '31-60', min: 31, max: 60 },
      { name: '60+', min: 61, max: Infinity },
    ]
    const leadTimeDistribution = leadDefs.map((d) => ({ name: d.name, value: 0 }))
    let leadSum = 0
    let leadCount = 0
    for (const r of rows) {
      if (r.leadTime === null) continue
      leadSum += r.leadTime
      leadCount++
      const idx = leadDefs.findIndex((d) => r.leadTime! >= d.min && r.leadTime! <= d.max)
      if (idx >= 0) leadTimeDistribution[idx].value++
    }
    const avgLeadTime = leadCount > 0 ? Math.round(leadSum / leadCount) : 0

    // ── Customer summary ──
    const custAgg: Record<string, { totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }> = {}
    for (const r of rows) {
      const c = (custAgg[r.customerId] ??= { totalInvoiced: 0, totalPaid: 0, outstanding: 0, overdue: 0 })
      c.totalInvoiced += r.amount
      c.totalPaid += r.paid
      c.outstanding += r.outstanding
      if (r.status === 'overdue') c.overdue += r.outstanding
    }
    const customerSummary = Object.entries(custAgg)
      .map(([customerId, v]) => ({
        customer: nameOf(customerId),
        totalInvoiced: Math.round(v.totalInvoiced),
        totalPaid: Math.round(v.totalPaid),
        outstanding: Math.round(v.outstanding),
        overdue: Math.round(v.overdue),
      }))
      .sort((a, b) => b.outstanding - a.outstanding)

    // ── Filter options (value = id, label = customer name) ──
    const customerList = [...new Set(invoices.map((i) => i.invCompanyId).filter(Boolean))]
      .map((id) => ({ value: id, label: nameOf(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const statusList = (Object.keys(STATUS_LABELS) as PayStatus[]).map((k) => ({ value: k, label: STATUS_LABELS[k] }))

    // ── Invoice table (full filtered set; client paginates with Load More) ──
    const tableRows = [...rows]
      .sort((a, b) => (parseDate(b.invoiceDate)?.getTime() || 0) - (parseDate(a.invoiceDate)?.getTime() || 0))

    return NextResponse.json({
      kpis: { totalInvoiced, totalPaid, totalOutstanding, overdueCount, overdueAmount, collectionRate, invoiceCount: rows.length, avgLeadTime },
      statusBreakdown,
      trend,
      aging,
      leadTimeDistribution,
      customerSummary,
      invoices: tableRows,
      totalRows: rows.length,
      filterOptions: { customerList, statusList },
    })
  } catch (error) {
    console.error('Invoices API error:', error)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}
