import { NextRequest, NextResponse } from 'next/server'
import { cachedRoute } from '@/lib/route-cache'
import {
  getAllOrders,
  getAllPayroll, getPayrollPayments, getPayrollLists,
  loadPayrollRefMaps, getPayrollStatusLabel, getPayrollCategoryLabel, getPayrollTypeInfo,
  getAllLoans, getRepayments,
  getAllMealBenefits, getMealBenefitDetails, getMealBenefitReleases, getMealBenefitEvidences, loadMealRefMaps, getMbTypeLabel,
  getTravelAllowances, getUserTerStatuses, getTerRates, getOccupations, getAllSalesUsers,
} from '@/database'
import { getFinanceAPData, getPaymentLogs } from '@/database/repos/finance-ap'
import { getSalesUserNamesMap } from '@/database/repos/sales-users'
import { parseDashboardParams } from '@/lib/api-helpers'
import { filterDataByDateRange, parseDate } from '@/lib/utils-date-currency'
import { makeProjectLabeler } from '@/lib/purchasing-helpers'
import {
  computePoPayments, computePayroll, computeMeal, computeLoans, computeReimburse, computeOverview,
  byMonth, mergeMonthly, reimburseCategory, timelinessOf, adjustDueDate,
} from '@/lib/finance-ap-helpers'

async function compute(searchParams: URLSearchParams) {
    const { dateFrom: from, dateTo: to } = parseDashboardParams(searchParams)
    const now = Date.now()

    // Fetch every stream + reference data in parallel.
    const [
      finance, paymentLogs, orders, payroll, payrollPayments, payrollLists, loans, repayments, meal, mealDetails, mealReleases, mealEvidences,
      travelAllowances, userTerStatuses, terRates, occupations, salesUsers
    ] =
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
        getMealBenefitDetails(),
        getMealBenefitReleases(),
        getMealBenefitEvidences(),
        getTravelAllowances(),
        getUserTerStatuses(),
        getTerRates(),
        getOccupations(),
        getAllSalesUsers(),
      ])
    await Promise.all([loadPayrollRefMaps(), loadMealRefMaps()])

    let { paymentRequests, payments, reimburseCashIn, reimburseCashOut, paymentStatusesMap, reimburseStatusesMap } = finance
    let filteredLoans = loans
    let filteredRepayments = repayments
    let filteredMeal = meal
    let filteredMealDetails = mealDetails
    let filteredMealReleases = mealReleases
    let filteredMealEvidences = mealEvidences
    let filteredPayroll = payroll
    let filteredPayrollPayments = payrollPayments

    // Borrower / Employee names — one batched lookup.
    const userIds = new Set<string>()
    for (const l of loans) if (l.userId) userIds.add(l.userId)
    for (const r of repayments) if (r.userId) userIds.add(r.userId)
    for (const b of meal) if (b.userId) userIds.add(b.userId)
    for (const p of payroll) if (p.userId) userIds.add(p.userId)
    for (const r of reimburseCashIn) if (r.reimburseUserIdFk) userIds.add(r.reimburseUserIdFk)
    for (const r of reimburseCashOut) if (r.reimburseUserIdFk) userIds.add(r.reimburseUserIdFk)
    for (const r of paymentRequests) if (r.payreqCreatedBy) userIds.add(r.payreqCreatedBy)
    const userNames = await getSalesUserNamesMap(userIds)
    const borrowerName = (id: string) => userNames.get(id) || id || '-'

    const proj = makeProjectLabeler(orders)
    // 'AN' (Approval Needed) has no row in the payment_statuses sheet — label it explicitly.
    const AP_STATUS_FALLBACK: Record<string, string> = { AN: 'Approval Needed' }
    const apStatusLabel = (id: string) => paymentStatusesMap.get(id) || AP_STATUS_FALLBACK[id] || id
    const reimburseStatusLabel = (id: string) => reimburseStatusesMap.get(id) || id

    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')

    if (cType && cVal) {
      if (cType === 'aging') {
        const bucket = [
          { min: -Infinity, max: 0, name: 'Current' },
          { min: 1, max: 30, name: '1-30' },
          { min: 31, max: 60, name: '31-60' },
          { min: 61, max: 90, name: '61-90' },
          { min: 91, max: Infinity, name: '90+' },
        ].find(b => b.name === cVal)
        if (bucket) {
          paymentRequests = paymentRequests.filter((r) => {
            const out = r.payreqAmount - (r.payreqPayAmount || 0)
            if (out <= 0) return false
            if (r.payreqStatus === 'P') return false
            const due = r.payreqDuedate ? new Date(r.payreqDuedate) : null
            if (!due || isNaN(due.getTime())) return false
            due.setHours(0, 0, 0, 0)
            const today = new Date(now)
            today.setHours(0, 0, 0, 0)
            const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
            return days >= bucket.min && days <= bucket.max
          })
          const reqIds = new Set(paymentRequests.map(r => r.payreqId))
          payments = payments.filter(p => reqIds.has(p.pPayreqId))
        }
      }
      else if (cType === 'poMonth') {
        payments = payments.filter((p) => {
          const date = p.pCreatedAt ? new Date(p.pCreatedAt) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
        const reqIds = new Set(payments.map(p => p.pPayreqId))
        paymentRequests = paymentRequests.filter(r => reqIds.has(r.payreqId))
      }
      else if (cType === 'timeliness') {
        const ms = (s: string) => (s ? new Date(s).getTime() : Infinity)
        const firstPaymentAt = new Map<string, string>()
        for (const p of payments) {
          if (!p.pPayreqId) continue
          const cur = firstPaymentAt.get(p.pPayreqId)
          if (!cur || ms(p.pCreatedAt) < ms(cur)) firstPaymentAt.set(p.pPayreqId, p.pCreatedAt)
        }
        const paidLogAt = new Map<string, string>()
        for (const l of paymentLogs) {
          if (l.statusNew === 'P') { const c = paidLogAt.get(l.payreqId); if (!c || ms(l.createdAt) < ms(c)) paidLogAt.set(l.payreqId, l.createdAt) }
        }
        paymentRequests = paymentRequests.filter((r) => {
          const paidTime = firstPaymentAt.get(r.payreqId) || paidLogAt.get(r.payreqId)
          const adjustedDueStr = adjustDueDate(r.payreqDuedate, r.payreqNotify)
          const t = timelinessOf(r, paidTime, now, adjustedDueStr)
          return t.label === cVal
        })
        const reqIds = new Set(paymentRequests.map(r => r.payreqId))
        payments = payments.filter(p => reqIds.has(p.pPayreqId))
      }
      else if (cType === 'status') {
        paymentRequests = paymentRequests.filter(r => apStatusLabel(r.payreqStatus) === cVal)
        const reqIds = new Set(paymentRequests.map(r => r.payreqId))
        payments = payments.filter(p => reqIds.has(p.pPayreqId))
      }
      else if (cType === 'reimburseMonth') {
        reimburseCashOut = reimburseCashOut.filter((r) => {
          const date = r.reimburseDate ? new Date(r.reimburseDate) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
        reimburseCashIn = reimburseCashIn.filter((r) => {
          const date = r.reimburseDate ? new Date(r.reimburseDate) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
      }
      else if (cType === 'category') {
        reimburseCashOut = reimburseCashOut.filter((r) => reimburseCategory(r.reimburseTypeIdFk) === cVal)
      }
      else if (cType === 'project') {
        paymentRequests = paymentRequests.filter((r) => r.payreqSite === cVal)
        const reqIds = new Set(paymentRequests.map(r => r.payreqId))
        payments = payments.filter(p => reqIds.has(p.pPayreqId))
        reimburseCashOut = reimburseCashOut.filter((r) => r.reimbursePrjIdFk === cVal)
        filteredMeal = meal.filter((m) => m.projectId === cVal)
      }
      else if (cType === 'employeeName') {
        reimburseCashOut = reimburseCashOut.filter((r) => r.reimburseUserName === cVal)
        reimburseCashIn = reimburseCashIn.filter((r) => r.reimburseUserName === cVal)
      }
      else if (cType === 'mealMonth') {
        filteredMeal = meal.filter((m) => {
          const date = m.date ? new Date(m.date) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
        filteredMealReleases = mealReleases.filter((m) => {
          const date = m.createdAt ? new Date(m.createdAt) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
      }
      else if (cType === 'typeLabel') {
        filteredMeal = meal.filter((m) => getMbTypeLabel(m.type) === cVal)
        filteredMealReleases = mealReleases.filter((m) => getMbTypeLabel(m.type) === cVal)
      }
      else if (cType === 'loanMonth') {
        filteredLoans = loans.filter((l) => {
          const date = l.date ? new Date(l.date) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
        filteredRepayments = repayments.filter((r) => {
          const date = r.date ? new Date(r.date) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
      }
      else if (cType === 'forecastMonth') {
        const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        filteredLoans = loans.filter((l) => {
          const repaid = repayments
            .filter((r) => r.loanId === l.loanId)
            .reduce((sum, r) => sum + r.amount, 0)
          let remaining = Math.max(0, l.amount - repaid)
          if (remaining <= 0.5 || l.tenor <= 0) return false
          const installment = l.amount / l.tenor
          if (installment <= 0) return false

          const base = new Date(now)
          const lDate = parseDate(l.date)
          let startIndex = 0
          if (lDate) {
            const firstRepayMonth = new Date(lDate.getFullYear(), lDate.getMonth() + 1, 1)
            const firstForecastMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1)
            if (firstRepayMonth > firstForecastMonth) {
              startIndex = (firstRepayMonth.getFullYear() - firstForecastMonth.getFullYear()) * 12 + (firstRepayMonth.getMonth() - firstForecastMonth.getMonth())
            }
          }

          for (let i = startIndex; i < 12 && remaining > 0.5; i++) {
            const m = new Date(base.getFullYear(), base.getMonth() + 1 + i, 1)
            const formatted = `${MONTH_LABELS[m.getMonth()]} ${m.getFullYear()}`
            const pay = Math.min(installment, remaining)
            if (formatted === cVal && pay > 0.5) {
              return true
            }
            remaining -= pay
          }
          return false
        })
        const loanIds = new Set(filteredLoans.map(l => l.loanId))
        filteredRepayments = repayments.filter(r => loanIds.has(r.loanId))
      }
      else if (cType === 'borrower') {
        filteredLoans = loans.filter((l) => borrowerName(l.userId) === cVal)
        filteredRepayments = repayments.filter((r) => borrowerName(r.userId) === cVal)
      }
      else if (cType === 'payrollMonth') {
        filteredPayroll = payroll.filter((p) => {
          const date = p.createdAt ? new Date(p.createdAt) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
        filteredPayrollPayments = payrollPayments.filter((p) => {
          const date = p.createdAt ? new Date(p.createdAt) : null
          if (!date) return false
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formatted = `${months[date.getMonth()]} ${date.getFullYear()}`
          return formatted === cVal
        })
      }
      else if (cType === 'payrollStatus') {
        filteredPayroll = payroll.filter((p) => getPayrollStatusLabel(p.status) === cVal)
      }
    }

    // Date-scope each stream by its primary date (KPIs/charts/tables reflect the window).
    const dr = <T,>(arr: T[], dateOf: (t: T) => string) => filterDataByDateRange(arr, dateOf, from, to)

    // Capture the filtered arrays so the cross-stream monthly chart can reuse them.
    const fPaymentReqs = dr(paymentRequests, (r) => r.payreqCreatedAt)
    const fPayments = dr(payments, (p) => p.pCreatedAt)
    const fPayrollPay = dr(filteredPayrollPayments, (p) => p.createdAt)
    const fLoans = dr(filteredLoans, (l) => l.date)
    const fReimburseOut = dr(reimburseCashOut, (r) => r.reimburseDate)
    const fReleases = dr(filteredMealReleases, (r) => r.createdAt)
    const fEvidences = dr(filteredMealEvidences, (e) => e.createdAt)

    // Trigger route reload
    const poPayments = computePoPayments(fPaymentReqs, fPayments, paymentLogs, apStatusLabel, now, borrowerName)
    const payrollData = computePayroll(
      dr(filteredPayroll, (p) => p.endDate),
      fPayrollPay,
      payrollLists, // line items carry no own date; scoped via their parent payslip
      getPayrollStatusLabel,
      getPayrollCategoryLabel,
      (id) => getPayrollTypeInfo(id).positive,
      filteredLoans,
      filteredRepayments,
      borrowerName,
      (id) => getPayrollTypeInfo(id).name,
      travelAllowances,
      userTerStatuses,
      terRates,
      occupations,
      salesUsers,
      reimburseCashOut,
      mealDetails,
      getPayrollTypeInfo,
      filteredMeal,
      getMbTypeLabel
    )
    const mealData = computeMeal(dr(filteredMeal, (b) => b.date), fReleases, fEvidences, filteredMealDetails, getMbTypeLabel, proj.label, borrowerName)
    const loansData = computeLoans(filteredLoans, filteredRepayments, borrowerName, (id) => getPayrollTypeInfo(id).name, now, from, to)
    const reimburse = computeReimburse(
      dr(reimburseCashIn, (r) => r.reimburseDate),
      fReimburseOut,
      reimburseStatusLabel,
      proj.label,
      borrowerName,
    )

    // Filter loans to only include those paid outside payroll (non-THP)
    const nonThpLoans = fLoans.filter((l) => {
      const isThp = l.thp === 'P-7' || String(l.thp).toUpperCase() === 'TRUE' || String(l.thp) === '1'
      return !isThp
    })

    // Cross-stream monthly cash outflow (stacked by stream).
    // Payroll stream uses the adjusted disbursed amount from payrollData.
    const payrollMonthlyOutflow = byMonth(payrollData.rows, (r) => r.startDate, (r) => r.disbursed)
    const overviewMonthly = mergeMonthly([
      ['PO Payments', byMonth(fPayments, (p) => p.pCreatedAt, (p) => p.pAmount)],
      ['Payroll', payrollMonthlyOutflow],
      ['Reimburse', byMonth(fReimburseOut.filter((r) => r.reimburseStatus === 'A'), (r) => r.reimburseDate, (r) => r.reimburseAmount)],
      ['Loans', byMonth(nonThpLoans, (l) => l.date, (l) => l.amount)],
      ['Meal', byMonth(fReleases.filter((r) => r.type === 'R' || r.type === 'P'), (r) => r.createdAt, (r) => r.amount)],
    ])

    const overview = computeOverview({
      poPaid: poPayments.kpis.totalPaid,
      apOutstanding: poPayments.kpis.totalOutstanding,
      apRecords: payments.length,
      payrollDisbursed: payrollData.kpis.totalDisbursed,
      payrollUnpaid: payrollData.kpis.unpaid,
      payslips: payrollData.kpis.payslips,
      reimburseOut: reimburse.kpis.totalOut,
      reimburseBalance: reimburse.kpis.balance,
      reimburseClaims: reimburse.kpis.approvedClaims,
      mealReleased: mealData.kpis.netReleased,
      mealRequests: mealData.kpis.approvedRequests,
      loansDisbursed: nonThpLoans.reduce((s, l) => s + l.amount, 0), // period-scoped cash outflow (non-THP only)
      loansOutstanding: loansData.kpis.outstanding, // book-wide outstanding (point-in-time)
      loanCount: loansData.kpis.loanCount,
      pendingAp: poPayments.kpis.pendingApproval,
    })

    return ({
      overview: { ...overview, monthly: overviewMonthly },
      poPayments,
      payroll: payrollData,
      meal: mealData,
      loans: loansData,
      reimburse,
      dateRange: { from, to },
    })
}

const getData = cachedRoute('finance-ap', compute)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getData(searchParams))
  } catch (error) {
    console.error('Finance AP API error:', error)
    return NextResponse.json({ error: 'Failed to load Finance AP data' }, { status: 500 })
  }
}
