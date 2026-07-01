import { NextRequest, NextResponse } from 'next/server'
import {
  getAllOrders,
  getAllPayroll, getPayrollPayments, getPayrollLists,
  loadPayrollRefMaps, getPayrollStatusLabel, getPayrollCategoryLabel, getPayrollTypeInfo,
  getAllLoans, getRepayments,
  getAllMealBenefits, getMealBenefitReleases, loadMealRefMaps, getMbTypeLabel,
} from '@/database'
import { getFinanceAPData, getPaymentLogs } from '@/database/repos/finance-ap'
import { getSalesUserNamesMap } from '@/database/repos/sales-users'
import { parseDashboardParams } from '@/lib/api-helpers'
import { filterDataByDateRange } from '@/lib/utils-date-currency'
import { makeProjectLabeler } from '@/lib/purchasing-helpers'
import {
  computePoPayments, computePayroll, computeMeal, computeLoans, computeReimburse, computeOverview,
  byMonth, mergeMonthly,
} from '@/lib/finance-ap-helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom: from, dateTo: to } = parseDashboardParams(searchParams)
    const now = Date.now()

    // Fetch every stream + reference data in parallel.
    const [finance, paymentLogs, orders, payroll, payrollPayments, payrollLists, loans, repayments, meal, mealReleases] =
      await Promise.all([
        getFinanceAPData(),
        getPaymentLogs(),
        getAllOrders(),
        getAllPayroll(),
        getPayrollPayments(),
        getPayrollLists(),
        getAllLoans(),
        getRepayments(),
        getAllMealBenefits(),
        getMealBenefitReleases(),
      ])
    await Promise.all([loadPayrollRefMaps(), loadMealRefMaps()])

    const { paymentRequests, payments, reimburseCashIn, reimburseCashOut, paymentStatusesMap, reimburseStatusesMap } = finance

    // Borrower names (loans) — one batched lookup.
    const userIds = new Set<string>()
    for (const l of loans) if (l.userId) userIds.add(l.userId)
    const userNames = await getSalesUserNamesMap(userIds)
    const borrowerName = (id: string) => userNames.get(id) || id || '-'

    const proj = makeProjectLabeler(orders)
    // 'AN' (Approval Needed) has no row in the payment_statuses sheet — label it explicitly.
    const AP_STATUS_FALLBACK: Record<string, string> = { AN: 'Approval Needed' }
    const apStatusLabel = (id: string) => paymentStatusesMap.get(id) || AP_STATUS_FALLBACK[id] || id
    const reimburseStatusLabel = (id: string) => reimburseStatusesMap.get(id) || id

    // Date-scope each stream by its primary date (KPIs/charts/tables reflect the window).
    const dr = <T,>(arr: T[], dateOf: (t: T) => string) => filterDataByDateRange(arr, dateOf, from, to)

    // Capture the filtered arrays so the cross-stream monthly chart can reuse them.
    const fPaymentReqs = dr(paymentRequests, (r) => r.payreqCreatedAt)
    const fPayments = dr(payments, (p) => p.pCreatedAt)
    const fPayrollPay = dr(payrollPayments, (p) => p.createdAt)
    const fLoans = dr(loans, (l) => l.date)
    const fReimburseOut = dr(reimburseCashOut, (r) => r.reimburseDate)
    const fReleases = dr(mealReleases, (r) => r.createdAt)

    const poPayments = computePoPayments(fPaymentReqs, fPayments, paymentLogs, apStatusLabel, now)
    const payrollData = computePayroll(
      dr(payroll, (p) => p.createdAt),
      fPayrollPay,
      payrollLists, // line items carry no own date; scoped via their parent payslip
      getPayrollStatusLabel,
      getPayrollCategoryLabel,
      (id) => getPayrollTypeInfo(id).positive,
    )
    const mealData = computeMeal(dr(meal, (b) => b.date), fReleases, getMbTypeLabel)
    // Loans are a running ledger: a loan disbursed before the window can still be
    // outstanding today. Show the FULL book here (not date-scoped); the Overview's
    // period cash-outflow contribution is computed separately from fLoans below.
    const loansData = computeLoans(loans, repayments, borrowerName, now)
    const reimburse = computeReimburse(
      dr(reimburseCashIn, (r) => r.reimburseDate),
      fReimburseOut,
      reimburseStatusLabel,
      proj.bare,
    )

    // Cross-stream monthly cash outflow (stacked by stream).
    const overviewMonthly = mergeMonthly([
      ['PO Payments', byMonth(fPayments, (p) => p.pCreatedAt, (p) => p.pAmount)],
      ['Payroll', byMonth(fPayrollPay, (p) => p.createdAt, (p) => p.amount)],
      ['Reimburse', byMonth(fReimburseOut.filter((r) => r.reimburseStatus === 'A'), (r) => r.reimburseDate, (r) => r.reimburseAmount)],
      ['Loans', byMonth(fLoans, (l) => l.date, (l) => l.amount)],
      ['Meal', byMonth(fReleases.filter((r) => r.type === 'R' || r.type === 'P'), (r) => r.createdAt, (r) => r.amount)],
    ])

    const overview = computeOverview({
      poPaid: poPayments.kpis.totalPaid,
      apOutstanding: poPayments.kpis.totalOutstanding,
      apRecords: payments.length,
      payrollDisbursed: payrollData.kpis.totalDisbursed,
      payrollUnpaid: payrollData.kpis.releasedUnpaid,
      payslips: payrollData.kpis.payslips,
      reimburseOut: reimburse.kpis.totalOut,
      reimburseBalance: reimburse.kpis.balance,
      reimburseClaims: reimburse.kpis.approvedClaims,
      mealReleased: mealData.kpis.netReleased,
      mealRequests: mealData.kpis.approvedRequests,
      loansDisbursed: fLoans.reduce((s, l) => s + l.amount, 0), // period-scoped cash outflow
      loansOutstanding: loansData.kpis.outstanding, // book-wide outstanding (point-in-time)
      loanCount: loansData.kpis.loanCount,
      pendingAp: poPayments.kpis.pendingApproval,
    })

    return NextResponse.json({
      overview: { ...overview, monthly: overviewMonthly },
      poPayments,
      payroll: payrollData,
      meal: mealData,
      loans: loansData,
      reimburse,
      dateRange: { from, to },
    })
  } catch (error) {
    console.error('Finance AP API error:', error)
    return NextResponse.json({ error: 'Failed to load Finance AP data' }, { status: 500 })
  }
}
