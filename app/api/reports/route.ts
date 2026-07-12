import { NextRequest, NextResponse } from 'next/server'
import { getAllReports, getAllOrders, getAllProjectLogs, getAllBasts } from '@/database'
import { getSalesUserNamesMap } from '@/database/repos/sales-users'
import { parseDashboardParams, applyChartFilter } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { reportDelayHours, delayScore, SCORE_META, parseProgress } from '@/lib/reports-helpers'
import {
  benchmarkStart, benchmarkEnd, actualStart, actualEnd,
  buildLogMaps, buildBastSubmitMap, deliveryStatus, isOverduePending, startOfDay
} from '@/lib/delivery-helpers'

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

    const [reports, orders, logs, basts] = await Promise.all([
      getAllReports(),
      getAllOrders(),
      getAllProjectLogs(),
      getAllBasts()
    ])

    const { nsToIp, ipToD } = buildLogMaps(logs)
    const bastSubmitMap = buildBastSubmitMap(basts)
    const today = new Date()

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

    // Chart cross-filter (cType/cVal from a chart click) — same semantics as sales overview:
    // applied after the standard filters so KPIs, charts, and tables all reflect the click.
    const scoreByLabel = new Map(SCORE_META.map((m) => [m.label, m.score]))
    filtered = applyChartFilter(searchParams, filtered, {
      month: (r, v) => formatMonth(r.reportDate) === v,
      score: (r, v) => r.score != null && r.score === scoreByLabel.get(v),
      worker: (r, v) => userName(r.reportUser) === v,
    })

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
    const uniqueProjects = new Set(filtered.map((r) => r.reportPrjId).filter(Boolean)).size

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

    // ── Hours per project (combined reports × orders) ──
    type P = { 
      hours: number; 
      ot: number; 
      reports: number; 
      workers: Set<string>; 
      progresses: { at: number; pct: number }[];
      reportDates: number[];
    }
    const perProject = new Map<string, P>()
    for (const r of filtered) {
      if (!r.reportPrjId) continue
      const p = perProject.get(r.reportPrjId) ?? { hours: 0, ot: 0, reports: 0, workers: new Set(), progresses: [], reportDates: [] }
      p.hours += r.reportTime; p.ot += r.reportOvertime; p.reports++
      if (r.reportUser) p.workers.add(r.reportUser)
      const pct = parseProgress(r.reportProgress)
      const at = parseDate(r.reportCreatedAt)?.getTime() ?? 0
      if (pct != null) p.progresses.push({ at, pct })
      
      const rDate = parseDate(r.reportDate)
      if (rDate) {
        p.reportDates.push(rDate.getTime())
      }
      perProject.set(r.reportPrjId, p)
    }

    const orderMap = new Map(orders.map((o) => [o.prjId, o]))
    const formatDateOnly = (d: Date | null) => d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : ''

    const projectHours = [...perProject.entries()].map(([id, p]) => {
      const latest = p.progresses.sort((a, b) => b.at - a.at)[0]
      const ord = orderMap.get(id)
      
      let plannedStartStr = ''
      let plannedEndStr = ''
      let actualStartStr = ''
      let actualEndStr = ''
      let overdueStatus = 'Active'
      let isOverdue = false
      let overdueDays = 0

      const sortedDates = p.reportDates.sort((a, b) => a - b)
      const firstReportDate = sortedDates[0] ? new Date(sortedDates[0]) : null
      const latestReportDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1]) : null

      if (ord) {
        plannedStartStr = benchmarkStart(ord)
        plannedEndStr = benchmarkEnd(ord)
        
        const aStart = actualStart(ord, nsToIp)
        const aEnd = actualEnd(ord, ipToD)
        const bastSubmit = bastSubmitMap.get(ord.prjId) || null

        // Determine if project is complete/done
        const isDone = (ord.prjPeStatus || '').trim().toUpperCase() === 'DONE' || 
                       (ord.prjPeStatus || '').trim().toUpperCase() === 'COMPLETED' || 
                       !!aEnd || !!bastSubmit

        // Actual start is actualStart date or fallback to first daily report log date
        actualStartStr = aStart ? formatDateOnly(aStart) : formatDateOnly(firstReportDate)
        
        // Actual end / delivery date is BAST submit date, or actualDone date, or fallback to latest daily report log date
        const compDate = bastSubmit || aEnd
        actualEndStr = compDate ? formatDateOnly(compDate) : formatDateOnly(latestReportDate)

        const targetEndDate = parseDate(plannedEndStr)

        if (targetEndDate) {
          const benchmarkDate = isDone ? (compDate || latestReportDate || new Date()) : new Date()

          if (startOfDay(benchmarkDate).getTime() > startOfDay(targetEndDate).getTime()) {
            isOverdue = true
            const diffTime = Math.abs(startOfDay(benchmarkDate).getTime() - startOfDay(targetEndDate).getTime())
            overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            overdueStatus = isDone ? 'Overdue (Done)' : 'Overdue (Active)'
          } else {
            overdueStatus = isDone ? 'On Time' : 'On Track'
          }
        } else {
          overdueStatus = isDone ? 'Completed' : 'Active'
        }
      } else {
        actualStartStr = formatDateOnly(firstReportDate)
        actualEndStr = formatDateOnly(latestReportDate)
        overdueStatus = 'Active'
      }

      return {
        projectId: id,
        project: projectName(id),
        hours: Math.round(p.hours),
        overtime: Math.round(p.ot),
        reports: p.reports,
        workers: p.workers.size,
        latestProgress: latest ? Math.round(latest.pct) : null,
        plannedStart: plannedStartStr,
        plannedEnd: plannedEndStr,
        actualStart: actualStartStr,
        actualEnd: actualEndStr,
        overdueStatus,
        isOverdue,
        overdueDays
      }
    }).sort((a, b) => b.hours - a.hours)

    // Build project metadata mapping for worker lookup
    const projectMetaMap = new Map<string, {
      projectId: string
      project: string
      overdueStatus: string
      isOverdue: boolean
      overdueDays: number
    }>()
    for (const p of projectHours) {
      projectMetaMap.set(p.projectId, {
        projectId: p.projectId,
        project: p.project,
        overdueStatus: p.overdueStatus,
        isOverdue: p.isOverdue,
        overdueDays: p.overdueDays
      })
    }

    // ── Worker leaderboard ──
    type W = { hours: number; ot: number; reports: number; days: Set<string>; delays: number[]; scores: number[]; projects: Set<string> }
    const perWorker = new Map<string, W>()
    for (const r of filtered) {
      const u = r.reportUser || '(blank)'
      const w = perWorker.get(u) ?? { hours: 0, ot: 0, reports: 0, days: new Set(), delays: [], scores: [], projects: new Set() }
      w.hours += r.reportTime; w.ot += r.reportOvertime; w.reports++
      if (r.dayKey) w.days.add(r.dayKey)
      if (r.delayHours != null) w.delays.push(r.delayHours)
      if (r.score != null) w.scores.push(r.score)
      if (r.reportPrjId) w.projects.add(r.reportPrjId)
      perWorker.set(u, w)
    }

    const workers = [...perWorker.entries()].map(([id, w]) => {
      const projectsWorked = [...w.projects].map(pId => {
        const meta = projectMetaMap.get(pId)
        return meta || {
          projectId: pId,
          project: projectName(pId),
          overdueStatus: 'Active',
          isOverdue: false,
          overdueDays: 0
        }
      })

      const uniqueProjectsCount = w.projects.size
      const overdueProjectsCount = projectsWorked.filter(p => p.isOverdue).length

      return {
        userId: id,
        worker: userName(id),
        reports: w.reports,
        hours: Math.round(w.hours),
        overtime: Math.round(w.ot),
        uniqueDays: w.days.size,
        avgDelayHours: round1(avg(w.delays)),
        sameDayPct: w.delays.length ? round1((w.delays.filter((d) => d === 0).length / w.delays.length) * 100) : 0,
        avgScore: w.scores.length ? round1(avg(w.scores)) : 0,
        uniqueProjectsCount,
        overdueProjectsCount,
        projectsWorked
      }
    }).sort((a, b) => b.hours - a.hours)

    // Top workers by hours (bar)
    const topWorkers = workers.slice(0, 12).map((w) => ({ name: w.worker, value: w.hours }))

    // ── Filter options ──
    const workerList = [...new Set(reports.map((r) => r.reportUser).filter(Boolean))]
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const projectList = [...new Set(reports.map((r) => r.reportPrjId).filter(Boolean))]
      .map((id) => ({ value: id, label: projectName(id) })).sort((a, b) => a.label.localeCompare(b.label))

    const totalProjectsCount = projectHours.length
    const overdueProjectsCount = projectHours.filter((p) => p.isOverdue).length
    const overdueProjectsPct = totalProjectsCount ? Math.round((overdueProjectsCount / totalProjectsCount) * 100) : 0

    return NextResponse.json({
      kpis: {
        totalReports, totalHours: Math.round(totalHours), totalOvertime: Math.round(totalOvertime),
        activeWorkers, avgDelayHours, medianDelayHours, sameDayRate, avgScore, uniqueProjects,
        overdueProjectsPct, overdueProjectsCount
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
