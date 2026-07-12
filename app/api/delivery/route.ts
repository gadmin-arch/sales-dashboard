import { NextRequest, NextResponse } from 'next/server'
import {
  getAllOrders, getAllProjectLogs, getAllBasts,
  loadOrdersRefMaps, getPeStatusLabelSync,
} from '@/database'
import { getSalesUserNamesMap } from '@/database/repos/sales-users'
import { parseDashboardParams, applyChartFilter } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti } from '@/lib/utils-date-currency'
import {
  benchmarkStart, benchmarkEnd, buildLogMaps, actualStart, actualEnd, dayVariance,
  buildBastSubmitMap, deliveryStatus, isOverduePending, startOfDay,
  DELIVERY_LABELS, type DeliveryStatus,
} from '@/lib/delivery-helpers'

const round1 = (n: number) => Math.round(n * 10) / 10
const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y); const n = s.length
  return n % 2 ? s[(n - 1) / 2] : round1((s[n / 2 - 1] + s[n / 2]) / 2)
}
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const dateType = searchParams.get('dateType') || 'due' // 'due' | 'start' | 'end' | 'created'
    const status = parseMulti(searchParams, 'status')
    const owner = parseMulti(searchParams, 'owner')
    const type = parseMulti(searchParams, 'type')
    const delivery = parseMulti(searchParams, 'delivery')

    const [orders, logs, basts] = await Promise.all([getAllOrders(), getAllProjectLogs(), getAllBasts()])
    await loadOrdersRefMaps()

    const { nsToIp, ipToD } = buildLogMaps(logs)
    const bastSubmitMap = buildBastSubmitMap(basts)
    const today = new Date()

    // Resolve owner / creator names
    const userIds = new Set<string>()
    for (const o of orders) { if (o.prjOwner) userIds.add(o.prjOwner); if (o.createdBy) userIds.add(o.createdBy) }
    const userNames = await getSalesUserNamesMap(userIds)
    const userName = (id: string) => userNames.get(id) || id || '-'

    const fromD = dateFrom ? new Date(dateFrom) : null
    const toD = dateTo ? new Date(dateTo + 'T23:59:59') : null

    // ── Per-project derived ──
    const enriched = orders.map((o) => {
      const bStart = benchmarkStart(o), bEnd = benchmarkEnd(o)
      const aStart = actualStart(o, nsToIp), aEnd = actualEnd(o, ipToD)
      const bastSubmit = bastSubmitMap.get(o.prjId) || null
      const startVar = dayVariance(bStart, aStart)
      const endVar = dayVariance(bEnd, aEnd)
      const ds = deliveryStatus(o.prjDueDate || bEnd, bastSubmit)
      const durationDays = (aStart && aEnd)
        ? Math.round((startOfDay(aEnd).getTime() - startOfDay(aStart).getTime()) / 86_400_000)
        : null
      // anchor date for the range filter, depending on the selected basis
      const anchor =
        dateType === 'start' ? parseDate(bStart)
          : dateType === 'end' ? aEnd
            : dateType === 'created' ? parseDate(o.createdAt)
              : parseDate(bEnd) // 'due' (default)
      return {
        prjId: o.prjId, project: o.prjName, type: o.prjType,
        ownerId: o.prjOwner, owner: userName(o.prjOwner),
        creatorId: o.createdBy, creator: userName(o.createdBy),
        statusCode: o.prjPeStatus, statusLabel: getPeStatusLabelSync(o.prjPeStatus) || o.prjPeStatus || '(blank)',
        benchmarkStart: bStart, benchmarkEnd: bEnd,
        actualStart: iso(aStart), actualEnd: iso(aEnd),
        bastSubmit: iso(bastSubmit),
        startVariance: startVar, endVariance: endVar,
        durationDays,
        delivery: ds,
        deliveryLabel: DELIVERY_LABELS[ds],
        overduePending: isOverduePending(o.prjDueDate || bEnd, bastSubmit, today),
        createdAt: o.createdAt,
        anchor,
      }
    })

    // ── Filter ──
    let filtered = enriched
    if (fromD || toD) {
      filtered = filtered.filter((r) => {
        if (!r.anchor) return false
        if (fromD && r.anchor < fromD) return false
        if (toD && r.anchor > toD) return false
        return true
      })
    }
    if (status.length) filtered = filtered.filter((r) => status.includes(r.statusCode))
    if (owner.length) filtered = filtered.filter((r) => owner.includes(r.ownerId))
    if (type.length) filtered = filtered.filter((r) => type.includes(r.type))
    if (delivery.length) filtered = filtered.filter((r) => delivery.includes(r.delivery))

    // Lateness bucket for a delivered project (null = pending, excluded from the chart).
    const bucketOf = (r: (typeof enriched)[number]): string | null => {
      if (r.delivery === 'pending') return null
      const v = r.endVariance
      if (v == null) return r.delivery === 'overtime' ? '1–7d late' : 'On time'
      if (v < 0) return 'Early'
      if (v === 0) return 'On time'
      if (v <= 7) return '1–7d late'
      if (v <= 30) return '8–30d late'
      return '>30d late'
    }

    // Chart cross-filter (cType/cVal from a chart click) — same semantics as sales overview:
    // applied after the standard filters so KPIs, charts, and tables all reflect the click.
    filtered = applyChartFilter(searchParams, filtered, {
      delivery: (r, v) => r.deliveryLabel === v,
      status: (r, v) => r.statusLabel === v,
      createdMonth: (r, v) => formatMonth(r.createdAt) === v,
      lateness: (r, v) => bucketOf(r) === v,
    })

    // ── KPIs ──
    const totalProjects = filtered.length
    const onTime = filtered.filter((r) => r.delivery === 'onTime').length
    const overtime = filtered.filter((r) => r.delivery === 'overtime').length
    const pending = filtered.filter((r) => r.delivery === 'pending').length
    const judged = onTime + overtime
    const onTimeRate = judged ? round1((onTime / judged) * 100) : 0
    const overduePending = filtered.filter((r) => r.overduePending).length
    const durations = filtered.map((r) => r.durationDays).filter((v): v is number => v != null && v >= 0)
    const medianDuration = median(durations)
    const endVars = filtered.map((r) => r.endVariance).filter((v): v is number => v != null)
    const medianEndVariance = median(endVars)
    const withActualEnd = filtered.filter((r) => r.actualEnd).length

    // ── Delivery breakdown (donut) ──
    const deliveryBreakdown = (['onTime', 'overtime', 'pending'] as DeliveryStatus[])
      .map((k) => ({ name: DELIVERY_LABELS[k], value: filtered.filter((r) => r.delivery === k).length }))

    // ── Status breakdown (donut) — "status based on <basis> date" via dateType ──
    const statusAgg: Record<string, number> = {}
    for (const r of filtered) statusAgg[r.statusLabel] = (statusAgg[r.statusLabel] || 0) + 1
    const statusBreakdown = Object.entries(statusAgg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    // ── Lateness distribution (BAST submit − due, for delivered projects) ──
    const buckets: Record<string, number> = { Early: 0, 'On time': 0, '1–7d late': 0, '8–30d late': 0, '>30d late': 0 }
    for (const r of filtered) {
      const b = bucketOf(r)
      if (b) buckets[b]++
    }
    const latenessDist = Object.entries(buckets).map(([name, value]) => ({ name, value }))

    // ── New projects trend (by created_at) ──
    const newAgg: Record<string, number> = {}
    for (const r of filtered) { const k = formatMonth(r.createdAt); if (k) newAgg[k] = (newAgg[k] || 0) + 1 }
    const newProjectsTrend = sortByPeriod(newAgg, 'monthly').map(([name, v]) => ({ name, value: v }))
    const newProjectsCount = filtered.length // within the current filter scope

    // ── Tables ──
    const tableRows = [...filtered].sort((a, b) => {
      const av = a.endVariance ?? -9999, bv = b.endVariance ?? -9999
      return bv - av
    })
    const atRisk = filtered.filter((r) => r.overduePending)
      .map((r) => ({ ...r, daysOverdue: (() => { const d = parseDate(r.benchmarkEnd); return d ? Math.round((startOfDay(today).getTime() - startOfDay(d).getTime()) / 86_400_000) : null })() }))
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))

    // ── Filter options ──
    const statusList = [...new Set(orders.map((o) => o.prjPeStatus).filter(Boolean))]
      .map((id) => ({ value: id, label: getPeStatusLabelSync(id) || id })).sort((a, b) => a.label.localeCompare(b.label))
    const ownerList = [...new Set(orders.map((o) => o.prjOwner).filter(Boolean))]
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const typeList = [...new Set(orders.map((o) => o.prjType).filter(Boolean))]
      .map((t) => ({ value: t, label: t })).sort((a, b) => a.label.localeCompare(b.label))
    const deliveryList = (['onTime', 'overtime', 'pending'] as DeliveryStatus[]).map((k) => ({ value: k, label: DELIVERY_LABELS[k] }))

    return NextResponse.json({
      kpis: {
        totalProjects, onTime, overtime, pending, onTimeRate, overduePending,
        medianDuration, medianEndVariance, withActualEnd, newProjectsCount,
      },
      deliveryBreakdown,
      statusBreakdown,
      latenessDist,
      newProjectsTrend,
      projects: tableRows,
      atRisk,
      totalRows: filtered.length,
      dateType,
      filterOptions: { statusList, ownerList, typeList, deliveryList },
    })
  } catch (error) {
    console.error('Project delivery API error:', error)
    return NextResponse.json({ error: 'Failed to load project delivery data' }, { status: 500 })
  }
}
