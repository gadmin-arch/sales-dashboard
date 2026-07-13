import { NextRequest, NextResponse } from 'next/server'
import { cachedRoute } from '@/lib/route-cache'
import {
  getAllPurchaseRequests, getItemNameMap, getAllOrders, getAllPurchaseOrders, getAllPoLines,
  getPrStatusLabel, loadPurchasingRefMaps,
} from '@/database'
import { getSalesUserNamesMap } from '@/database/repos/sales-users'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { distinct, startOfDay, makeProjectLabeler, makePrPurchaseDates } from '@/lib/purchasing-helpers'

// Approval status has no dedicated reference sheet; map the known codes.
const APPROVAL_LABELS: Record<string, string> = { A: 'Approved', P: 'Pending', R: 'Rejected' }
const approvalLabel = (id: string) => APPROVAL_LABELS[id] || (id ? id : 'Unset')

// Computed overdue status (replaces raw pr_overdue_status).
const OVERDUE_LABELS: Record<string, string> = {
  active: 'Active',
  onTime: 'On Time',
  dueToday: 'Due Today',
  overdue: 'Overdue',
  overdueOngoing: 'Overdue (ongoing)',
  unhandledOverdue: 'Unhandled Overdue',
}
const OVERDUE_KEYS = Object.keys(OVERDUE_LABELS)
const OVERDUE_BAD = new Set(['overdue', 'overdueOngoing', 'unhandledOverdue'])

const MS_PER_DAY = 86_400_000
// Whole-day lead time (date-only) between two dates, clamped to >= 0.
// Returns null when either endpoint is missing. created_at carries a time-of-day
// while PO_Date / completed_at are date-only, so both are floored to the day first —
// a PR created 09:00 and its PO stamped midnight the SAME day is 0 days, not -1.
const leadDays = (from: Date | null | undefined, to: Date | null | undefined): number | null => {
  if (!from || !to) return null
  const days = Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY)
  return days < 0 ? 0 : days
}

async function compute(searchParams: URLSearchParams) {
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const status = parseMulti(searchParams, 'status')
    const overdue = parseMulti(searchParams, 'overdue')
    const approval = parseMulti(searchParams, 'approval')
    const project = parseMulti(searchParams, 'project')
    const handler = parseMulti(searchParams, 'handler')
    const requester = parseMulti(searchParams, 'requester')

    const [prs, itemMap, orders, pos, poLines] = await Promise.all([
      getAllPurchaseRequests(),
      getItemNameMap(),
      getAllOrders(),
      getAllPurchaseOrders(),
      getAllPoLines(),
    ])
    await loadPurchasingRefMaps()

    // pr_id → latest purchase date (POLists.pol_pr_id → POs.PO_Date).
    const prPurchaseDate = makePrPurchaseDates(pos, poLines)

    const today0 = startOfDay(new Date())
    // Overdue status, computed from due date vs purchase/today date.
    // - Any purchase (partial OR full): compare the LATEST PO_Date (fallback completed_at for P) vs due.
    //   late → Overdue, otherwise → On Time.
    // - No purchase at all & past due: Overdue (ongoing); if not yet picked up (status NS/blank) → Unhandled Overdue.
    // - No purchase, due date = today → Due Today. Otherwise → Active.
    const overdueOf = (p: { prId: string; prDuedate: string; prStatus: string; prCompletedAt: string }): { key: string; label: string } => {
      const due = parseDate(p.prDuedate)
      if (!due) return { key: 'active', label: OVERDUE_LABELS.active }
      const dueDay = startOfDay(due).getTime()
      const pd = prPurchaseDate.get(p.prId) || (p.prStatus === 'P' ? parseDate(p.prCompletedAt) : null)
      if (pd) {
        return startOfDay(pd).getTime() > dueDay
          ? { key: 'overdue', label: OVERDUE_LABELS.overdue }
          : { key: 'onTime', label: OVERDUE_LABELS.onTime }
      }
      if (today0.getTime() > dueDay) {
        const notHandled = !p.prStatus || p.prStatus === 'NS'
        return notHandled
          ? { key: 'unhandledOverdue', label: OVERDUE_LABELS.unhandledOverdue }
          : { key: 'overdueOngoing', label: OVERDUE_LABELS.overdueOngoing }
      }
      if (today0.getTime() === dueDay) return { key: 'dueToday', label: OVERDUE_LABELS.dueToday }
      return { key: 'active', label: OVERDUE_LABELS.active }
    }

    const proj = makeProjectLabeler(orders)
    const projectName = proj.label

    // Resolve user names (handlers + requesters) in one batch
    const userIds = new Set<string>()
    for (const p of prs) { if (p.prHandleBy) userIds.add(p.prHandleBy); if (p.prUserId) userIds.add(p.prUserId) }
    const userNames = await getSalesUserNamesMap(userIds)
    const userName = (id: string) => userNames.get(id) || id || '-'

    // ── Filter ──
    // Drop PRs with no item — item id blank or a literal "-" (renders as "-").
    let filtered = prs.filter((p) => { const it = (p.prItemId || '').trim(); return it && it !== '-' })
    filtered = filterDataByDateRange(filtered, (p) => p.createdAt, dateFrom, dateTo)
    if (status.length) filtered = filtered.filter((p) => status.includes(p.prStatus))
    if (overdue.length) filtered = filtered.filter((p) => overdue.includes(overdueOf(p).key))
    if (approval.length) filtered = filtered.filter((p) => approval.includes(p.prApprovalStatus || ''))
    if (project.length) filtered = filtered.filter((p) => project.includes(p.prProjectId))
    if (handler.length) filtered = filtered.filter((p) => handler.includes(p.prHandleBy))
    if (requester.length) filtered = filtered.filter((p) => requester.includes(p.prUserId))

    // ── Per-row derived ──
    const rows = filtered.map((p) => {
      const statusLabel = getPrStatusLabel(p.prStatus)
      const od = overdueOf(p)
      const isPurchased = p.prStatus === 'P'
      const isOverdue = OVERDUE_BAD.has(od.key)
      // variance = estimated - purchased (positive = under budget / saving)
      const variance = p.prVariance || (p.prEstimatedPrice - p.prPurchasedPrice)
      const variancePct = isPurchased && p.prEstimatedPrice > 0
        ? Math.round(((p.prEstimatedPrice - p.prPurchasedPrice) / p.prEstimatedPrice) * 1000) / 10
        : null
      // Lead times (date-only, days): created_at → PO date, and created_at → goods received.
      const createdD = parseDate(p.createdAt)
      const leadTimePO = leadDays(createdD, prPurchaseDate.get(p.prId))
      const leadTimeReceived = leadDays(createdD, parseDate(p.prCompletedAt))
      return {
        prId: p.prId,
        item: itemMap.get(p.prItemId) || p.prItemId || '-',
        projectId: p.prProjectId,
        project: projectName(p.prProjectId),
        qtyReq: p.prQuantity,
        qtyPurchased: p.prQuantityPurchased,
        estimated: p.prEstimatedPrice,
        purchased: p.prPurchasedPrice,
        variance,
        variancePct,
        status: p.prStatus,
        statusLabel,
        overdue: od.key,
        overdueLabel: od.label,
        approval: p.prApprovalStatus || '',
        approvalLabel: approvalLabel(p.prApprovalStatus || ''),
        handlerId: p.prHandleBy,
        handler: userName(p.prHandleBy),
        requesterId: p.prUserId,
        requester: userName(p.prUserId),
        duedate: p.prDuedate,
        createdAt: p.createdAt,
        leadTimePO,
        leadTimeReceived,
        isPurchased,
        isOverdue,
      }
    })

    // ── Cross-filter ──
    let finalRows = rows
    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      finalRows = finalRows.filter((r) => {
        if (cType === 'status') return r.statusLabel === cVal
        if (cType === 'overdue') return r.overdueLabel === cVal
        if (cType === 'prMonth') return formatMonth(r.createdAt) === cVal
        if (cType === 'handler') return r.handler === cVal
        if (cType === 'project') return r.projectId === cVal
        return true
      })
    }

    // ── KPIs ──
    const totalPR = finalRows.length
    const purchasedCount = finalRows.filter((r) => r.isPurchased).length
    const openCount = finalRows.filter((r) => !r.isPurchased).length
    const overdueCount = finalRows.filter((r) => r.isOverdue).length
    const completionRate = totalPR > 0 ? Math.round((purchasedCount / totalPR) * 1000) / 10 : 0
    const totalEstimated = finalRows.reduce((s, r) => s + r.estimated, 0)
    const totalPurchased = finalRows.reduce((s, r) => s + r.purchased, 0)
    // Realized saving rate on actually-purchased lines: (Σest − Σpurchased) / Σest.
    // Aggregate (not average-of-percentages) so a few tiny-estimate lines can't skew it.
    const purchasedRows = finalRows.filter((r) => r.isPurchased && r.estimated > 0)
    const estPurSum = purchasedRows.reduce((s, r) => s + r.estimated, 0)
    const purSum = purchasedRows.reduce((s, r) => s + r.purchased, 0)
    const avgVariancePct = estPurSum > 0 ? Math.round(((estPurSum - purSum) / estPurSum) * 1000) / 10 : 0

    // ── Lead time (date-only, days; negatives already clamped to 0 above) ──
    const avgOf = (a: number[]) => (a.length ? Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10 : 0)
    const medianOf = (a: number[]) => {
      if (!a.length) return 0
      const s = [...a].sort((x, y) => x - y); const n = s.length
      return n % 2 ? s[(n - 1) / 2] : Math.round(((s[n / 2 - 1] + s[n / 2]) / 2) * 10) / 10
    }
    const leadPO = finalRows.map((r) => r.leadTimePO).filter((v): v is number => v != null)
    const leadRecv = finalRows.map((r) => r.leadTimeReceived).filter((v): v is number => v != null)
    const leadTimePOAvg = avgOf(leadPO), leadTimePOMedian = medianOf(leadPO), leadTimePOCount = leadPO.length
    const leadTimeReceivedAvg = avgOf(leadRecv), leadTimeReceivedMedian = medianOf(leadRecv), leadTimeReceivedCount = leadRecv.length

    // ── Status / overdue breakdown (donut) ──
    const countBy = (key: (r: typeof finalRows[number]) => string) => {
      const m: Record<string, number> = {}
      for (const r of finalRows) { const k = key(r); m[k] = (m[k] || 0) + 1 }
      return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }
    const statusBreakdown = countBy((r) => r.statusLabel)
    const overdueBreakdown = countBy((r) => r.overdueLabel)

    // ── Monthly trend (count) & estimated vs purchased value ──
    const trendAgg: Record<string, { count: number; Estimated: number; Purchased: number }> = {}
    for (const r of finalRows) {
      const k = formatMonth(r.createdAt)
      if (!k) continue
      const a = (trendAgg[k] ??= { count: 0, Estimated: 0, Purchased: 0 })
      a.count++; a.Estimated += r.estimated; a.Purchased += r.purchased
    }
    const monthlyTrend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({ name, count: v.count }))
    const estVsActual = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({
      name, Estimated: Math.round(v.Estimated), Purchased: Math.round(v.Purchased),
    }))

    // ── Handler workload (count) ──
    const handlerAgg: Record<string, number> = {}
    for (const r of finalRows) { if (!r.handlerId) continue; handlerAgg[r.handler] = (handlerAgg[r.handler] || 0) + 1 }
    const handlerWorkload = Object.entries(handlerAgg)
      .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12)

    // ── Top projects by purchased value (axis = id, tooltip = name) ──
    const projAgg: Record<string, number> = {}
    for (const r of finalRows) { if (!r.projectId) continue; projAgg[r.projectId] = (projAgg[r.projectId] || 0) + r.purchased }
    const topProjects = Object.entries(projAgg)
      .map(([id, value]) => ({ id, name: proj.bare(id), value: Math.round(value) }))
      .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 10)

    // ── Filter options ──
    const statusList = distinct(prs.map((p) => p.prStatus).filter(Boolean))
      .map((id) => ({ value: id, label: getPrStatusLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const overdueList = OVERDUE_KEYS.map((key) => ({ value: key, label: OVERDUE_LABELS[key] }))
    const approvalList = distinct(prs.map((p) => p.prApprovalStatus || '').filter(Boolean))
      .map((id) => ({ value: id, label: approvalLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const projectList = distinct(prs.map((p) => p.prProjectId).filter(Boolean))
      .map((id) => ({ value: id, label: projectName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const handlerList = distinct(prs.map((p) => p.prHandleBy).filter(Boolean))
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const requesterList = distinct(prs.map((p) => p.prUserId).filter(Boolean))
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))

    const tableRows = [...finalRows].sort(
      (a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0)
    )

    return ({
      kpis: {
        totalPR, purchasedCount, openCount, overdueCount, completionRate, totalEstimated, totalPurchased, avgVariancePct,
        leadTimePOAvg, leadTimePOMedian, leadTimePOCount,
        leadTimeReceivedAvg, leadTimeReceivedMedian, leadTimeReceivedCount,
      },
      statusBreakdown,
      overdueBreakdown,
      monthlyTrend,
      estVsActual,
      handlerWorkload,
      topProjects,
      requests: tableRows,
      totalRows: finalRows.length,
      filterOptions: { statusList, overdueList, approvalList, projectList, handlerList, requesterList },
    })
}

const getData = cachedRoute('purchasing-requests', compute)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getData(searchParams))
  } catch (error) {
    console.error('Purchasing requests API error:', error)
    return NextResponse.json({ error: 'Failed to load purchase requests' }, { status: 500 })
  }
}
