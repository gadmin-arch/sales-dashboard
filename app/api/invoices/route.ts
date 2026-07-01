import { NextRequest, NextResponse } from 'next/server'
import { getInvoicingData } from '@/database/repos/invoicing'
import { getCompanyNameMap } from '@/database/repos/companies'
import { getProjectCompletionDates, getAllOrders, loadRefMaps, getPeStatusLabelSync } from '@/database/repos/orders'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import type { Invoice } from '@/database/types'

type PayStatus = 'overdue_ongoing' | 'overdue' | 'on_time' | 'unpaid'

const STATUS_LABELS: Record<PayStatus, string> = {
  overdue_ongoing: 'Overdue (On Going)',
  overdue: 'Overdue',
  on_time: 'On Time',
  unpaid: 'Unpaid',
}

function statusOf(inv: Invoice, paymentDateStr: string | null, today: Date): PayStatus {
  const pct = inv.invPaymentPercentage
  const due = parseDate(inv.invEstPaymentDate)
  const isFullyPaid = pct >= 100

  if (isFullyPaid) {
    if (due && paymentDateStr) {
      const payDate = parseDate(paymentDateStr)
      if (payDate && payDate > due) {
        return 'overdue'
      }
    }
    return 'on_time'
  } else {
    if (due && due < today) {
      return 'overdue_ongoing'
    }
    return 'unpaid'
  }
}



export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const customer = parseMulti(searchParams, 'customer')
    const status = parseMulti(searchParams, 'status')
    const projectStatus = parseMulti(searchParams, 'projectStatus')
    const minAmountParam = searchParams.get('minAmount')
    const minPaymentParam = searchParams.get('minPayment')
    const minAmount = minAmountParam ? parseFloat(minAmountParam) : null
    const minPayment = minPaymentParam ? parseFloat(minPaymentParam) : null

    const [{ invoices, invPrjMap, paymentDetails }, nameMap, completionMap, orders] = await Promise.all([
      getInvoicingData(),
      getCompanyNameMap(),
      getProjectCompletionDates(),
      getAllOrders(),
    ])
    await loadRefMaps()
    const nameOf = (id: string) => nameMap.get(id) || id || '-'
    const today = new Date()

    // Build prj_id → pe_status map from orders
    const prjStatusMap = new Map<string, string>()
    for (const o of orders) if (o.prjId) prjStatusMap.set(o.prjId, o.prjPeStatus)

    // Helper: get pe_status(es) for an invoice via its linked prj(s)
    const getInvPeStatuses = (invId: string): string[] => {
      const prjStr = invPrjMap.get(invId) || ''
      if (!prjStr) return []
      return prjStr.split(',').map(p => p.trim()).filter(Boolean).map(p => prjStatusMap.get(p) || '').filter(Boolean)
    }

    // ── Filter invoices ──
    let filtered = filterDataByDateRange(invoices, (inv) => inv.invDate, dateFrom, dateTo)
    if (customer.length) filtered = filtered.filter((inv) => customer.includes(inv.invCompanyId))
    if (projectStatus.length) filtered = filtered.filter((inv) => {
      const statuses = getInvPeStatuses(inv.invId)
      return statuses.some(s => projectStatus.includes(s))
    })

    // Actual collected amount per invoice from payment_details (pd_total_amount),
    // joined on pd_inv_id = inv_id, scoped to the filtered invoices.
    const filteredIds = new Set(filtered.map((inv) => inv.invId))
    const paidByInv = new Map<string, number>()
    const payMonthsByInv = new Map<string, Set<string>>() // inv_id -> months it received a payment
    const paymentDatesByInv = new Map<string, string>() // inv_id -> latest payment date
    for (const pd of paymentDetails) {
      if (!filteredIds.has(pd.invId)) continue
      paidByInv.set(pd.invId, (paidByInv.get(pd.invId) || 0) + pd.amount)
      const mk = formatMonth(pd.date)
      if (mk) { let s = payMonthsByInv.get(pd.invId); if (!s) payMonthsByInv.set(pd.invId, (s = new Set())); s.add(mk) }
      if (pd.date) {
        const currentMax = paymentDatesByInv.get(pd.invId)
        if (!currentMax || pd.date > currentMax) {
          paymentDatesByInv.set(pd.invId, pd.date)
        }
      }
    }

    // ── Per-invoice derived rows ──
    const rows = filtered.map((inv) => {
      const payDate = paymentDatesByInv.get(inv.invId) || null
      const st = statusOf(inv, payDate, today)
      // Outstanding from the payment percentage: (1 - pct) * invoice amount.
      // Paid uses the actual collected amount field (inv_payment_amount).
      const pct = Math.min(100, Math.max(0, inv.invPaymentPercentage))
      const amount = inv.invAmount
      const outstanding = Math.max(0, (1 - pct / 100) * amount)
      const paid = paidByInv.get(inv.invId) || 0
      const due = parseDate(inv.invEstPaymentDate)
      
      let daysOverdue = 0
      if (due) {
        if (st === 'overdue_ongoing') {
          daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
        } else if (st === 'overdue' && payDate) {
          const actualPayDate = parseDate(payDate)
          if (actualPayDate) {
            daysOverdue = Math.max(0, Math.floor((actualPayDate.getTime() - due.getTime()) / 86400000))
          }
        }
      }

      // Lead time: days from project completion (status -> C) to the invoice date
      const prjStr = invPrjMap.get(inv.invId) || ''
      const firstPrj = prjStr.split(',')[0].trim()
      const compDate = firstPrj ? parseDate(completionMap.get(firstPrj) || '') : null
      const invDate = parseDate(inv.invDate)
      const leadTimeRaw = compDate && invDate ? Math.round((invDate.getTime() - compDate.getTime()) / 86400000) : null
      const leadTime = leadTimeRaw !== null && leadTimeRaw < 0 ? null : leadTimeRaw
      
      const estPaymentDays = invDate && due ? Math.max(0, Math.round((due.getTime() - invDate.getTime()) / 86400000)) : null
      const payDateObj = payDate ? parseDate(payDate) : null
      const actualPaymentDays = invDate && payDateObj ? Math.max(0, Math.round((payDateObj.getTime() - invDate.getTime()) / 86400000)) : null

      return {
        invId: inv.invId,
        invNumber: inv.invNumber,
        prj: prjStr || '-',
        leadTime,
        customerId: inv.invCompanyId,
        customer: nameOf(inv.invCompanyId),
        invoiceDate: inv.invDate,
        dueDate: inv.invEstPaymentDate,
        paymentDate: payDate || '-',
        amount,
        paid,
        outstanding,
        status: st,
        statusLabel: STATUS_LABELS[st],
        daysOverdue,
        paymentMonths: [...(payMonthsByInv.get(inv.invId) || [])],
        refName: inv.invRefName,
        remarks: inv.invRemarks,
        completedDate: firstPrj ? completionMap.get(firstPrj) || '-' : '-',
        estPaymentDays,
        actualPaymentDays,
      }
    })

    // ── Apply Min Amount, Min Payment and Status Filters ──
    let filteredRows = rows
    if (minAmount !== null && !isNaN(minAmount)) {
      filteredRows = filteredRows.filter((r) => r.amount >= minAmount)
    }
    if (minPayment !== null && !isNaN(minPayment)) {
      filteredRows = filteredRows.filter((r) => r.paid >= minPayment)
    }
    if (status.length) {
      filteredRows = filteredRows.filter((r) => status.includes(r.status))
    }

    // ── Apply Chart Filters (Cross-Filtering) ──
    let finalRows = filteredRows
    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      finalRows = finalRows.filter((r) => {
        if (cType === 'status') return r.statusLabel === cVal
        if (cType === 'invoiceMonth') return formatMonth(r.invoiceDate) === cVal
        if (cType === 'paymentMonth') return r.paymentMonths.includes(cVal)
        if (cType === 'dueMonth') return formatMonth(r.dueDate) === cVal
        if (cType === 'aging') {
          if (cVal === 'Current') return r.daysOverdue <= 0
          if (cVal === '1-30') return r.daysOverdue >= 1 && r.daysOverdue <= 30
          if (cVal === '31-60') return r.daysOverdue >= 31 && r.daysOverdue <= 60
          if (cVal === '61-90') return r.daysOverdue >= 61 && r.daysOverdue <= 90
          if (cVal === '90+') return r.daysOverdue >= 91
        }
        if (cType === 'leadTime') {
          if (r.leadTime === null) return false
          if (cVal === 'Early (<0)') return r.leadTime < 0
          if (cVal === '0-7') return r.leadTime >= 0 && r.leadTime <= 7
          if (cVal === '8-14') return r.leadTime >= 8 && r.leadTime <= 14
          if (cVal === '15-30') return r.leadTime >= 15 && r.leadTime <= 30
          if (cVal === '31-60') return r.leadTime >= 31 && r.leadTime <= 60
          if (cVal === '60+') return r.leadTime >= 61
        }
        if (cType === 'estPaymentDays') {
          if (r.estPaymentDays === null) return false
          if (cVal === '0-15') return r.estPaymentDays >= 0 && r.estPaymentDays <= 15
          if (cVal === '16-30') return r.estPaymentDays >= 16 && r.estPaymentDays <= 30
          if (cVal === '31-45') return r.estPaymentDays >= 31 && r.estPaymentDays <= 45
          if (cVal === '46-60') return r.estPaymentDays >= 46 && r.estPaymentDays <= 60
          if (cVal === '60+') return r.estPaymentDays >= 61
        }
        if (cType === 'actualPaymentDays') {
          if (r.actualPaymentDays === null) return false
          if (cVal === '0-15') return r.actualPaymentDays >= 0 && r.actualPaymentDays <= 15
          if (cVal === '16-30') return r.actualPaymentDays >= 16 && r.actualPaymentDays <= 30
          if (cVal === '31-45') return r.actualPaymentDays >= 31 && r.actualPaymentDays <= 45
          if (cVal === '46-60') return r.actualPaymentDays >= 46 && r.actualPaymentDays <= 60
          if (cVal === '60+') return r.actualPaymentDays >= 61
        }
        return true
      })
    }
    const finalIds = new Set(finalRows.map((r) => r.invId))

    // ── KPIs ──
    const totalInvoiced = finalRows.reduce((s, r) => s + r.amount, 0)
    const totalPaid = finalRows.reduce((s, r) => s + r.paid, 0)
    const totalOutstanding = finalRows.reduce((s, r) => s + r.outstanding, 0)
    const overdueRows = finalRows.filter((r) => r.status === 'overdue_ongoing')
    const overdueCount = overdueRows.length
    const overdueAmount = overdueRows.reduce((s, r) => s + r.outstanding, 0)
    // Collected % = Total Invoiced / (Total Invoiced + Total Outstanding)
    const collectionRate = (totalInvoiced + totalOutstanding) > 0 ? Math.round((totalInvoiced / (totalInvoiced + totalOutstanding)) * 1000) / 10 : 0

    // ── Status breakdown (donut) ──
    const statusCounts: Record<PayStatus, number> = { overdue_ongoing: 0, overdue: 0, on_time: 0, unpaid: 0 }
    for (const r of finalRows) statusCounts[r.status]++
    const statusBreakdown = (Object.keys(statusCounts) as PayStatus[])
      .map((k) => ({ name: STATUS_LABELS[k], value: statusCounts[k] }))
      .filter((x) => x.value > 0)

    // ── Invoice vs Payment trend (monthly) ──
    // Invoice = invoiced amount by invoice month (date filter applies to invoice date).
    // Payment = cash collected by payment date (pd_date) WITHIN the selected range,
    // so a YTD filter shows exactly the payments received during YTD — regardless of
    // when the invoice was issued. Scoped to the customer filter only.
    const invCompanyById = new Map<string, string>()
    for (const inv of invoices) if (inv.invId) invCompanyById.set(inv.invId, inv.invCompanyId)

    let payForTrend = filterDataByDateRange(paymentDetails, (pd) => pd.date, dateFrom, dateTo)
    if (customer.length) payForTrend = payForTrend.filter((pd) => customer.includes(invCompanyById.get(pd.invId) || ''))

    const trendAgg: Record<string, { Invoice: number; Payment: number }> = {}
    for (const r of finalRows) {
      const k = formatMonth(r.invoiceDate)
      if (!k) continue
      ;(trendAgg[k] ??= { Invoice: 0, Payment: 0 }).Invoice += r.amount
    }
    for (const pd of payForTrend) {
      const k = formatMonth(pd.date)
      if (!k) continue
      ;(trendAgg[k] ??= { Invoice: 0, Payment: 0 }).Payment += pd.amount
    }
    const trend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({
      name,
      Invoice: Math.round(v.Invoice),
      Payment: Math.round(v.Payment),
    }))

    // ── Invoice vs Payment trend (By Invoice Date) ──
    const cohortTrendAgg: Record<string, { Invoice: number; Payment: number }> = {}
    for (const r of finalRows) {
      const k = formatMonth(r.invoiceDate)
      if (!k) continue
      if (!cohortTrendAgg[k]) cohortTrendAgg[k] = { Invoice: 0, Payment: 0 }
      cohortTrendAgg[k].Invoice += r.amount
      cohortTrendAgg[k].Payment += r.paid
    }
    const trendByInvoiceDate = sortByPeriod(cohortTrendAgg, 'monthly').map(([name, v]) => ({
      name,
      Invoice: Math.round(v.Invoice),
      Payment: Math.round(v.Payment),
    }))

    // ── Invoice vs Payment trend (Filtered by Invoice Date, Plotted by Actual Date) ──
    const relatedPaymentsAgg: Record<string, { Invoice: number; Payment: number }> = {}
    for (const r of finalRows) {
      const k = formatMonth(r.invoiceDate)
      if (!k) continue
      if (!relatedPaymentsAgg[k]) relatedPaymentsAgg[k] = { Invoice: 0, Payment: 0 }
      relatedPaymentsAgg[k].Invoice += r.amount
    }
    for (const pd of paymentDetails) {
      if (!finalIds.has(pd.invId)) continue
      const k = formatMonth(pd.date)
      if (!k) continue
      if (!relatedPaymentsAgg[k]) relatedPaymentsAgg[k] = { Invoice: 0, Payment: 0 }
      relatedPaymentsAgg[k].Payment += pd.amount
    }
    const trendByRelatedPaymentDate = sortByPeriod(relatedPaymentsAgg, 'monthly').map(([name, v]) => ({
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
    for (const r of finalRows) {
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
    for (const r of finalRows) {
      if (r.leadTime === null) continue
      leadSum += r.leadTime
      leadCount++
      const idx = leadDefs.findIndex((d) => r.leadTime! >= d.min && r.leadTime! <= d.max)
      if (idx >= 0) leadTimeDistribution[idx].value++
    }
    const avgLeadTime = leadCount > 0 ? Math.round(leadSum / leadCount) : 0

    // ── Payment Estimate Days distribution (invoice -> due date, in days) ──
    const estDefs = [
      { name: '0-15', min: 0, max: 15 },
      { name: '16-30', min: 16, max: 30 },
      { name: '31-45', min: 31, max: 45 },
      { name: '46-60', min: 46, max: 60 },
      { name: '60+', min: 61, max: Infinity },
    ]
    const estPaymentDaysDistribution = estDefs.map((d) => ({ name: d.name, value: 0 }))
    let estSum = 0
    let estCount = 0
    for (const r of finalRows) {
      if (r.estPaymentDays === null) continue
      estSum += r.estPaymentDays
      estCount++
      const idx = estDefs.findIndex((d) => r.estPaymentDays! >= d.min && r.estPaymentDays! <= d.max)
      if (idx >= 0) estPaymentDaysDistribution[idx].value++
    }
    const avgEstPaymentDays = estCount > 0 ? Math.round(estSum / estCount) : 0

    // ── Payment Actual Days distribution (invoice -> payment date, in days) ──
    const actDefs = [
      { name: '0-15', min: 0, max: 15 },
      { name: '16-30', min: 16, max: 30 },
      { name: '31-45', min: 31, max: 45 },
      { name: '46-60', min: 46, max: 60 },
      { name: '60+', min: 61, max: Infinity },
    ]
    const actualPaymentDaysDistribution = actDefs.map((d) => ({ name: d.name, value: 0 }))
    let actSum = 0
    let actCount = 0
    for (const r of finalRows) {
      if (r.actualPaymentDays === null) continue
      actSum += r.actualPaymentDays
      actCount++
      const idx = actDefs.findIndex((d) => r.actualPaymentDays! >= d.min && r.actualPaymentDays! <= d.max)
      if (idx >= 0) actualPaymentDaysDistribution[idx].value++
    }
    const avgActualPaymentDays = actCount > 0 ? Math.round(actSum / actCount) : 0

    // ── Estimated Payment Schedule (outstanding by est payment date month) ──
    const estAgg: Record<string, number> = {}
    for (const r of finalRows) {
      if (r.outstanding <= 0) continue
      const k = formatMonth(r.dueDate)  // dueDate = invEstPaymentDate
      if (!k) continue
      estAgg[k] = (estAgg[k] || 0) + r.outstanding
    }
    const estPaymentSchedule = sortByPeriod(estAgg, 'monthly').map(([name, v]) => ({
      name,
      outstanding: Math.round(v),
    }))

    // ── Customer summary ──
    const custAgg: Record<string, { totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }> = {}
    for (const r of finalRows) {
      const c = (custAgg[r.customerId] ??= { totalInvoiced: 0, totalPaid: 0, outstanding: 0, overdue: 0 })
      c.totalInvoiced += r.amount
      c.totalPaid += r.paid
      c.outstanding += r.outstanding
      if (r.status === 'overdue_ongoing') c.overdue += r.outstanding
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

    // Project status options from all prj_ids linked to invoices
    const allPrjStatuses = new Set<string>()
    for (const inv of invoices) {
      const statuses = getInvPeStatuses(inv.invId)
      statuses.forEach(s => allPrjStatuses.add(s))
    }
    const projectStatusList = [...allPrjStatuses]
      .map(s => ({ value: s, label: getPeStatusLabelSync(s) || s }))
      .sort((a, b) => a.label.localeCompare(b.label))

    // ── Invoice table (full filtered set; client paginates with Load More) ──
    const tableRows = [...finalRows]
      .sort((a, b) => (parseDate(b.invoiceDate)?.getTime() || 0) - (parseDate(a.invoiceDate)?.getTime() || 0))

    return NextResponse.json({
      kpis: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        overdueCount,
        overdueAmount,
        collectionRate,
        invoiceCount: finalRows.length,
        avgLeadTime,
        avgEstPaymentDays,
        avgActualPaymentDays
      },
      statusBreakdown,
      trend,
      trendByInvoiceDate,
      trendByRelatedPaymentDate,
      aging,
      leadTimeDistribution,
      estPaymentDaysDistribution,
      actualPaymentDaysDistribution,
      estPaymentSchedule,
      customerSummary,
      invoices: tableRows,
      totalRows: finalRows.length,
      filterOptions: { customerList, statusList, projectStatusList },
    })
  } catch (error) {
    console.error('Invoices API error:', error)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}
