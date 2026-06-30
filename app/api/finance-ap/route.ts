import { NextRequest, NextResponse } from 'next/server'
import { getFinanceAPData } from '@/database/repos/finance-ap'
import { getCompanyNameMap } from '@/database/repos/companies'
import { getPeStatusLabelSync, getAllOrders } from '@/database/repos/orders'
import { clearSheetCache } from '@/database/client'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'

const CATEGORY_MAP: Record<string, string> = {
  O: 'Office Expense',
  S: 'Operational Service',
  M: 'Materials & Tools',
  R: 'Repairs & Utilities',
}

function getCategoryName(typeId: string): string {
  if (!typeId) return 'Uncategorized'
  const prefix = typeId.split('-')[0].toUpperCase()
  return CATEGORY_MAP[prefix] || `Other (${typeId})`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('fresh') === '1') clearSheetCache()
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const status = parseMulti(searchParams, 'status') // filter for payment requests
    const employee = parseMulti(searchParams, 'employee') // filter by requester (user name)
    const project = parseMulti(searchParams, 'project') // filter by project code (prj_id)

    const [financeData, companyMap, orders] = await Promise.all([
      getFinanceAPData(),
      getCompanyNameMap(),
      getAllOrders(),
    ])

    const { paymentRequests, payments, reimburseCashIn, reimburseCashOut, paymentStatusesMap, reimburseStatusesMap } = financeData

    // Build project statuses map from orders
    const prjMap = new Map<string, { name: string; status: string; customerId: string }>()
    for (const o of orders) {
      if (o.prjId) {
        prjMap.set(o.prjId, {
          name: o.prjName,
          status: o.prjPeStatus,
          customerId: o.prjCompanyId || o.prjEndUserId || '',
        })
      }
    }

    const today = new Date()

    // 1. Filter Payment Requests by Created Date
    let filteredRequests = filterDataByDateRange(paymentRequests, (r) => r.payreqCreatedAt, dateFrom, dateTo)
    if (status.length) filteredRequests = filteredRequests.filter((r) => status.includes(r.payreqStatus))
    if (employee.length) filteredRequests = filteredRequests.filter((r) => employee.includes(r.payreqCreatedBy))
    if (project.length) filteredRequests = filteredRequests.filter((r) => project.includes(r.payreqPoId))

    // 2. Filter Reimburse Cash Out by Date
    let filteredReimburseOut = filterDataByDateRange(reimburseCashOut, (r) => r.reimburseDate, dateFrom, dateTo)
    // Filter Reimbursements that are Approved (status 'A')
    const approvedReimburseOut = filteredReimburseOut.filter((r) => r.reimburseStatus === 'A')
    
    if (employee.length) {
      filteredReimburseOut = filteredReimburseOut.filter((r) => employee.includes(r.reimburseUserIdFk))
    }
    if (project.length) {
      filteredReimburseOut = filteredReimburseOut.filter((r) => project.includes(r.reimbursePrjIdFk))
    }

    // 3. Filter Payments
    let filteredPayments = filterDataByDateRange(payments, (p) => p.pCreatedAt, dateFrom, dateTo)
    
    // Cross-Filtering logic
    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      if (cType === 'status') {
        filteredRequests = filteredRequests.filter(r => paymentStatusesMap.get(r.payreqStatus) === cVal)
      }
      if (cType === 'opExpense') {
        filteredReimburseOut = filteredReimburseOut.filter(r => getCategoryName(r.reimburseTypeIdFk) === cVal)
      }
      if (cType === 'aging') {
        filteredRequests = filteredRequests.filter(r => {
          if (r.payreqStatus === 'P' || r.payreqStatus === 'CC') return false
          const due = parseDate(r.payreqDuedate)
          const days = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0
          if (cVal === 'Current') return days <= 0
          if (cVal === '1-30') return days >= 1 && days <= 30
          if (cVal === '31-60') return days >= 31 && days <= 60
          if (cVal === '61-90') return days >= 61 && days <= 90
          if (cVal === '90+') return days >= 91
          return true
        })
      }
      if (cType === 'month') {
        filteredRequests = filteredRequests.filter(r => formatMonth(r.payreqCreatedAt) === cVal)
        filteredReimburseOut = filteredReimburseOut.filter(r => formatMonth(r.reimburseDate) === cVal)
      }
    }

    // ── KPIs ──
    // Outstanding AP = Unpaid amount of requests that are not paid/cancelled (R, C, RF?)
    // Note: status P is Paid, CC is Cancelled. Rest is outstanding.
    const outstandingRequests = filteredRequests.filter((r) => r.payreqStatus !== 'P' && r.payreqStatus !== 'CC')
    const totalOutstandingAP = outstandingRequests.reduce((sum, r) => sum + Math.max(0, r.payreqAmount - r.payreqPayAmount), 0)
    
    // Total cash outflow = payments + approved reimburse cash out
    const totalPaymentsCash = filteredPayments.reduce((sum, p) => sum + p.pAmount, 0)
    const totalReimburseCash = approvedReimburseOut.reduce((sum, r) => sum + r.reimburseAmount, 0)
    const totalCashOutflow = totalPaymentsCash + totalReimburseCash

    // Pending requests count (status 'C' - Created)
    const pendingApprovalCount = paymentRequests.filter((r) => r.payreqStatus === 'C').length

    // Petty Cash stats (Status 'A' - Approved)
    const totalReimburseIn = reimburseCashIn
      .filter((r) => r.reimburseStatus === 'A')
      .reduce((sum, r) => sum + r.reimburseAmount, 0)
    const totalReimburseOutVal = reimburseCashOut
      .filter((r) => r.reimburseStatus === 'A')
      .reduce((sum, r) => sum + r.reimburseAmount, 0)
    const pettyCashBalance = totalReimburseIn - totalReimburseOutVal

    // ── Cash Outflow Trend (Monthly) ──
    const trendAgg: Record<string, { Payments: number; Reimburse: number; Total: number }> = {}
    
    for (const p of filteredPayments) {
      const k = formatMonth(p.pCreatedAt)
      if (!k) continue
      trendAgg[k] ??= { Payments: 0, Reimburse: 0, Total: 0 }
      trendAgg[k].Payments += p.pAmount
      trendAgg[k].Total += p.pAmount
    }
    for (const r of approvedReimburseOut) {
      const k = formatMonth(r.reimburseDate)
      if (!k) continue
      trendAgg[k] ??= { Payments: 0, Reimburse: 0, Total: 0 }
      trendAgg[k].Reimburse += r.reimburseAmount
      trendAgg[k].Total += r.reimburseAmount
    }
    const trend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({
      name,
      Payments: Math.round(v.Payments),
      Reimburse: Math.round(v.Reimburse),
      Total: Math.round(v.Total)
    }))

    // ── Aging Payables (Outstanding requests only) ──
    const agingDefs = [
      { name: 'Current', min: -Infinity, max: 0 },
      { name: '1-30', min: 1, max: 30 },
      { name: '31-60', min: 31, max: 60 },
      { name: '61-90', min: 61, max: 90 },
      { name: '90+', min: 91, max: Infinity },
    ]
    const aging = agingDefs.map((d) => ({ name: d.name, value: 0 }))
    for (const r of outstandingRequests) {
      const due = parseDate(r.payreqDuedate)
      const days = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0
      const idx = agingDefs.findIndex((d) => days >= d.min && days <= d.max)
      if (idx >= 0) {
        aging[idx].value += Math.max(0, r.payreqAmount - r.payreqPayAmount)
      }
    }

    // ── Reimbursement Category Breakdown ──
    const catAgg: Record<string, number> = {}
    for (const r of approvedReimburseOut) {
      const cat = getCategoryName(r.reimburseTypeIdFk)
      catAgg[cat] = (catAgg[cat] || 0) + r.reimburseAmount
    }
    const categoryBreakdown = Object.entries(catAgg).map(([name, value]) => ({
      name,
      value: Math.round(value)
    })).sort((a, b) => b.value - a.value)

    // ── Project Cost Analysis (Top Projects Operational Expense) ──
    const prjAgg: Record<string, { name: string; amount: number }> = {}
    
    // Group from payment requests
    for (const r of filteredRequests) {
      if (!r.payreqPoId) continue
      const prjInfo = prjMap.get(r.payreqPoId)
      const name = prjInfo ? prjInfo.name : r.payreqPoId
      prjAgg[r.payreqPoId] ??= { name, amount: 0 }
      prjAgg[r.payreqPoId].amount += r.payreqAmount
    }
    
    // Group from reimburse cash out
    for (const r of approvedReimburseOut) {
      if (!r.reimbursePrjIdFk) continue
      const prjInfo = prjMap.get(r.reimbursePrjIdFk)
      const name = prjInfo ? prjInfo.name : r.reimburseProjectName || r.reimbursePrjIdFk
      prjAgg[r.reimbursePrjIdFk] ??= { name, amount: 0 }
      prjAgg[r.reimbursePrjIdFk].amount += r.reimburseAmount
    }

    const projectExpenses = Object.entries(prjAgg)
      .map(([projectId, v]) => ({
        projectId,
        projectName: v.name,
        amount: Math.round(v.amount)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // ── Top Requesters / Employees ──
    const empAgg: Record<string, { name: string; amount: number; count: number }> = {}
    
    // Payment requests
    for (const r of filteredRequests) {
      const creator = r.payreqCreatedBy || 'Unknown'
      empAgg[creator] ??= { name: creator, amount: 0, count: 0 }
      empAgg[creator].amount += r.payreqAmount
      empAgg[creator].count++
    }
    // Reimbursements
    for (const r of approvedReimburseOut) {
      const user = r.reimburseUserName || r.reimburseUserIdFk || 'Unknown'
      empAgg[user] ??= { name: user, amount: 0, count: 0 }
      empAgg[user].amount += r.reimburseAmount
      empAgg[user].count++
    }
    
    const topEmployees = Object.values(empAgg)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // ── Detail Table: Outstanding Payment Requests ──
    const outstandingTable = outstandingRequests.map((r) => {
      const due = parseDate(r.payreqDuedate)
      const daysOverdue = due && due < today ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0
      const prjInfo = prjMap.get(r.payreqPoId)
      return {
        payreqId: r.payreqId,
        poId: r.payreqPoId,
        projectName: prjInfo ? prjInfo.name : '-',
        invoiceNumber: r.payreqInvoiceNumber || '-',
        amount: r.payreqAmount,
        paidAmount: r.payreqPayAmount,
        outstanding: Math.max(0, r.payreqAmount - r.payreqPayAmount),
        dueDate: r.payreqDuedate,
        daysOverdue,
        statusLabel: paymentStatusesMap.get(r.payreqStatus) || r.payreqStatus,
        remarks: r.payreqRemarks || '-',
        file: r.payreqFile || null,
        createdBy: r.payreqCreatedBy
      }
    }).sort((a, b) => b.outstanding - a.outstanding)

    // ── Detail Table: Top Reimbursement Claims ──
    const reimburseTable = filteredReimburseOut.map((r) => {
      return {
        reimburseId: r.reimburseId,
        date: r.reimburseDate,
        projectName: r.reimburseProjectName || '-',
        description: r.reimburseDescription,
        amount: r.reimburseAmount,
        category: getCategoryName(r.reimburseTypeIdFk),
        statusLabel: reimburseStatusesMap.get(r.reimburseStatus) || r.reimburseStatus,
        remarks: r.reimburseRemarks || '-',
        employeeName: r.reimburseUserName || r.reimburseUserIdFk,
        image: r.reimburseImage || null
      }
    }).sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))

    // ── Options lists for dropdowns ──
    const employeeList = [...new Set([
      ...paymentRequests.map((r) => r.payreqCreatedBy),
      ...reimburseCashOut.map((r) => r.reimburseUserName || r.reimburseUserIdFk)
    ])].filter(Boolean).map(emp => ({ value: emp, label: emp })).sort((a, b) => a.label.localeCompare(b.label))

    const projectList = [...new Set([
      ...paymentRequests.map((r) => r.payreqPoId),
      ...reimburseCashOut.map((r) => r.reimbursePrjIdFk)
    ])].filter(Boolean).map(prj => {
      const prjInfo = prjMap.get(prj)
      return { value: prj, label: prjInfo ? `${prj} - ${prjInfo.name}` : prj }
    }).sort((a, b) => a.label.localeCompare(b.label))

    const statusList = Array.from(paymentStatusesMap.entries()).map(([value, label]) => ({
      value,
      label
    }))

    return NextResponse.json({
      kpis: {
        totalOutstandingAP,
        totalCashOutflow,
        pendingApprovalCount,
        pettyCashBalance,
        totalReimburseIn,
        totalReimburseOut: totalReimburseOutVal
      },
      trend,
      aging,
      categoryBreakdown,
      projectExpenses,
      topEmployees,
      paymentRequestsList: outstandingTable,
      reimbursementsList: reimburseTable,
      filterOptions: {
        employeeList,
        projectList,
        statusList
      }
    })
  } catch (error) {
    console.error('Finance AP API error:', error)
    return NextResponse.json({ error: 'Failed to load Finance AP data' }, { status: 500 })
  }
}
