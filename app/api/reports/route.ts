import { NextRequest, NextResponse } from 'next/server'
import { getAllReports, getAllOrders } from '@/database'
import { getSalesUserNamesMap } from '@/database/repos/sales-users'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { reportDelayHours, delayScore, SCORE_META, parseProgress } from '@/lib/reports-helpers'

const round1 = (n: number) => Math.round(n * 10) / 10
const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)
const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y); const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const dateType = searchParams.get('dateType') || 'report' // 'report' | 'created'
    const worker = parseMulti(searchParams, 'worker')
    const project = parseMulti(searchParams, 'project')

    const [reports, orders] = await Promise.all([getAllReports(), getAllOrders()])

    // Resolve worker (U-xxxx) and project names.
    const userIds = new Set<string>()
    for (const r of reports) if (r.reportUser) userIds.add(r.reportUser)
    const userNames = await getSalesUserNamesMap(userIds)
    const userName = (id: string) => userNames.get(id) || id || '(unknown)'
    const projName = new Map(orders.map((o) => [o.prjId, o.prjName]))
    const projectName = (id: string) => projName.get(id) || id || '-'

    // ── Per-report derived ──
    const enriched = reports.map((r) => {
      const delay = reportDelayHours(r.reportDate, r.reportCreatedAt)
      return {
        ...r,
        delayHours: delay,
        score: delayScore(delay),
        dateBasis: dateType === 'created' ? r.reportCreatedAt : r.reportDate,
        dayKey: (parseDate(r.reportDate)?.toISOString().slice(0, 10)) || '',
      }
    })

    // ── Filter ──
    let filtered = filterDataByDateRange(enriched, (r) => r.dateBasis, dateFrom, dateTo)
    if (worker.length) filtered = filtered.filter((r) => worker.includes(r.reportUser))
    if (project.length) filtered = filtered.filter((r) => project.includes(r.reportPrjId))

    // ── KPIs ──
    const totalReports = filtered.length
    const totalHours = filtered.reduce((s, r) => s + r.reportTime, 0)
    const totalOvertime = filtered.reduce((s, r) => s + r.reportOvertime, 0)
    const activeWorkers = new Set(filtered.map((r) => r.reportUser).filter(Boolean)).size
    const delays = filtered.map((r) => r.delayHours).filter((v): v is number => v != null)
    const avgDelayHours = round1(avg(delays))
    const medianDelayHours = round1(median(delays))
    const sameDay = delays.filter((d) => d === 0).length
    const sameDayRate = delays.length ? round1((sameDay / delays.length) * 100) : 0
    const scores = filtered.map((r) => r.score).filter((v): v is number => v != null)
    const avgScore = scores.length ? round1(avg(scores)) : 0

    // ── Score breakdown (donut) ──
    const scoreCount: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of filtered) if (r.score != null) scoreCount[r.score]++
    const scoreBreakdown = SCORE_META.map((m) => ({ name: m.label, value: scoreCount[m.score] }))

    // ── Monthly trend (reports + hours) ──
    const trendAgg: Record<string, { count: number; hours: number }> = {}
    for (const r of filtered) {
      const k = formatMonth(r.reportDate)
      if (!k) continue
      const a = (trendAgg[k] ??= { count: 0, hours: 0 })
      a.count++; a.hours += r.reportTime
    }
    const monthlyTrend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({
      name, reports: v.count, hours: Math.round(v.hours),
    }))

    // ── Worker leaderboard ──
    type W = { hours: number; ot: number; reports: number; days: Set<string>; delays: number[]; scores: number[] }
    const perWorker = new Map<string, W>()
    for (const r of filtered) {
      const u = r.reportUser || '(blank)'
      const w = perWorker.get(u) ?? { hours: 0, ot: 0, reports: 0, days: new Set(), delays: [], scores: [] }
      w.hours += r.reportTime; w.ot += r.reportOvertime; w.reports++
      if (r.dayKey) w.days.add(r.dayKey)
      if (r.delayHours != null) w.delays.push(r.delayHours)
      if (r.score != null) w.scores.push(r.score)
      perWorker.set(u, w)
    }
    const workers = [...perWorker.entries()].map(([id, w]) => ({
      userId: id,
      worker: userName(id),
      reports: w.reports,
      hours: Math.round(w.hours),
      overtime: Math.round(w.ot),
      uniqueDays: w.days.size,
      avgDelayHours: round1(avg(w.delays)),
      sameDayPct: w.delays.length ? round1((w.delays.filter((d) => d === 0).length / w.delays.length) * 100) : 0,
      avgScore: w.scores.length ? round1(avg(w.scores)) : 0,
    })).sort((a, b) => b.hours - a.hours)

    // Top workers by hours (bar)
    const topWorkers = workers.slice(0, 12).map((w) => ({ name: w.worker, value: w.hours }))

    // ── Hours per project (combined reports × orders) ──
    type P = { hours: number; ot: number; reports: number; workers: Set<string>; progresses: { at: number; pct: number }[] }
    const perProject = new Map<string, P>()
    for (const r of filtered) {
      if (!r.reportPrjId) continue
      const p = perProject.get(r.reportPrjId) ?? { hours: 0, ot: 0, reports: 0, workers: new Set(), progresses: [] }
      p.hours += r.reportTime; p.ot += r.reportOvertime; p.reports++
      if (r.reportUser) p.workers.add(r.reportUser)
      const pct = parseProgress(r.reportProgress)
      const at = parseDate(r.reportCreatedAt)?.getTime() ?? 0
      if (pct != null) p.progresses.push({ at, pct })
      perProject.set(r.reportPrjId, p)
    }
    const projectHours = [...perProject.entries()].map(([id, p]) => {
      const latest = p.progresses.sort((a, b) => b.at - a.at)[0]
      return {
        projectId: id,
        project: projectName(id),
        hours: Math.round(p.hours),
        overtime: Math.round(p.ot),
        reports: p.reports,
        workers: p.workers.size,
        latestProgress: latest ? Math.round(latest.pct) : null,
      }
    }).sort((a, b) => b.hours - a.hours)

    // ── Filter options ──
    const workerList = [...new Set(reports.map((r) => r.reportUser).filter(Boolean))]
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const projectList = [...new Set(reports.map((r) => r.reportPrjId).filter(Boolean))]
      .map((id) => ({ value: id, label: projectName(id) })).sort((a, b) => a.label.localeCompare(b.label))

    return NextResponse.json({
      kpis: {
        totalReports, totalHours: Math.round(totalHours), totalOvertime: Math.round(totalOvertime),
        activeWorkers, avgDelayHours, medianDelayHours, sameDayRate, avgScore,
      },
      scoreBreakdown,
      monthlyTrend,
      topWorkers,
      workers,
      projectHours,
      filterOptions: { workerList, projectList },
    })
  } catch (error) {
    console.error('Worker reports API error:', error)
    return NextResponse.json({ error: 'Failed to load worker reports' }, { status: 500 })
  }
}
