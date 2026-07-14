import { NextRequest, NextResponse } from 'next/server'
import { cachedRoute } from '@/lib/route-cache'
import { getAllReports, getAllOrders, getAllProjectLogs, getAllBasts, getAllOrderTypes } from '@/database'
import { getPeStatusLabelSync, loadRefMaps as loadOrderRefMaps } from '@/database/repos/orders'
import { getSalesUserNamesMap, getAllSalesUsers } from '@/database/repos/sales-users'
import { parseDashboardParams, applyChartFilter } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { reportDelayHours, delayScore, SCORE_META, parseProgress } from '@/lib/reports-helpers'
import {
  benchmarkStart, benchmarkEnd, actualStart, actualEnd,
  buildLogMaps, buildBastSubmitMap, startOfDay
} from '@/lib/delivery-helpers'

const round1 = (n: number) => Math.round(n * 10) / 10
const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)
const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y); const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

async function compute(searchParams: URLSearchParams) {
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const dateType = searchParams.get('dateType') || 'report' // 'report' | 'created'
    const worker = parseMulti(searchParams, 'worker')
    const project = parseMulti(searchParams, 'project')
    const userSite = parseMulti(searchParams, 'userSite')
    const jobStatus = parseMulti(searchParams, 'jobStatus')
    const orderType = parseMulti(searchParams, 'orderType')
    const overdueMethod = searchParams.get('overdueMethod') || 'project' // 'project' | 'worker'

    const [reports, orders, logs, basts, salesUsers, orderTypes] = await Promise.all([
      getAllReports(),
      getAllOrders(),
      getAllProjectLogs(),
      getAllBasts(),
      getAllSalesUsers(),
      getAllOrderTypes()
    ])
    await loadOrderRefMaps() // pe status id -> label

    const { nsToIp, ipToD } = buildLogMaps(logs)
    const bastSubmitMap = buildBastSubmitMap(basts)
    const today = new Date()

    // Resolve worker (U-xxxx) and project names, and map user sites.
    const userIds = new Set<string>()
    for (const r of reports) if (r.reportUser) userIds.add(r.reportUser)
    const userNames = await getSalesUserNamesMap(userIds)
    const userName = (id: string) => userNames.get(id) || id || '(unknown)'
    const projName = new Map(orders.map((o) => [o.prjId, o.prjName]))
    const projectName = (id: string) => projName.get(id) || id || '-'
    const projectOrderTypeMap = new Map(orders.map((o) => [o.prjId, o.prjType || '']))

    const userSiteMap = new Map(salesUsers.map((u) => [u.userId, u.siteId]))
    const userJobStatusMap = new Map(salesUsers.map((u) => [u.userId, u.jobStatus || '']))

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

    const orderMap = new Map(orders.map((o) => [o.prjId, o]))
    const prjStatusLabel = (prjId: string) => {
      const ord = orderMap.get(prjId)
      return ord ? (getPeStatusLabelSync(ord.prjPeStatus) || ord.prjPeStatus || '(none)') : '(unknown)'
    }

    // ── Filter ──
    const dateFiltered = filterDataByDateRange(enriched, (r) => r.dateBasis, dateFrom, dateTo)
    let filtered = dateFiltered
    if (worker.length) filtered = filtered.filter((r) => worker.includes(r.reportUser))
    if (project.length) filtered = filtered.filter((r) => project.includes(r.reportPrjId))
    if (userSite.length) {
      filtered = filtered.filter((r) => {
        const site = userSiteMap.get(r.reportUser) || ''
        return userSite.includes(site)
      })
    }
    if (jobStatus.length) {
      filtered = filtered.filter((r) => {
        const js = userJobStatusMap.get(r.reportUser) || ''
        return jobStatus.includes(js)
      })
    }
    if (orderType.length) {
      filtered = filtered.filter((r) => {
        const otId = projectOrderTypeMap.get(r.reportPrjId) || ''
        return orderType.includes(otId)
      })
    }

    // Chart cross-filter (cType/cVal from a chart click)
    const scoreByLabel = new Map(SCORE_META.map((m) => [m.label, m.score]))
    filtered = applyChartFilter(searchParams, filtered, {
      month: (r, v) => formatMonth(r.reportDate) === v,
      score: (r, v) => r.score != null && r.score === scoreByLabel.get(v),
      worker: (r, v) => userName(r.reportUser) === v,
      prjStatus: (r, v) => prjStatusLabel(r.reportPrjId) === v,
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

        if (overdueMethod === 'worker') {
          actualStartStr = formatDateOnly(firstReportDate)
          actualEndStr = formatDateOnly(latestReportDate)

          const targetEndDate = parseDate(plannedEndStr)
          if (targetEndDate && latestReportDate) {
            if (startOfDay(latestReportDate).getTime() > startOfDay(targetEndDate).getTime()) {
              isOverdue = true
              const diffTime = Math.abs(startOfDay(latestReportDate).getTime() - startOfDay(targetEndDate).getTime())
              overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              overdueStatus = 'Overdue (Log)'
            } else {
              overdueStatus = 'On Track (Log)'
            }
          } else {
            overdueStatus = 'Active'
          }
        } else {
          const isDone = (ord.prjPeStatus || '').trim().toUpperCase() === 'DONE' || 
                         (ord.prjPeStatus || '').trim().toUpperCase() === 'COMPLETED' || 
                         !!aEnd || !!bastSubmit

          actualStartStr = aStart ? formatDateOnly(aStart) : formatDateOnly(firstReportDate)
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

    const projectStatusAgg: Record<string, number> = {}
    const timeScheduleAgg: Record<string, number> = {}
    const timeWorkerAgg: Record<string, number> = {}
    for (const [pId, p] of perProject) {
      const ord = orderMap.get(pId)
      const statusCode = (ord?.prjPeStatus || '').trim().toUpperCase()
      const statusLabel = prjStatusLabel(pId)
      projectStatusAgg[statusLabel] = (projectStatusAgg[statusLabel] || 0) + 1

      if (!ord || statusCode === 'CC') continue
      const plannedEnd = parseDate(benchmarkEnd(ord))
      if (!plannedEnd) continue
      const pe = startOfDay(plannedEnd).getTime()

      const aEnd = actualEnd(ord, ipToD)
      const bast = bastSubmitMap.get(pId) || null
      const isDone = statusCode === 'D' || statusCode === 'C' || !!aEnd || !!bast
      const maxReportTime = p.reportDates.length ? Math.max(...p.reportDates) : null
      const latestReport = maxReportTime ? new Date(maxReportTime) : null

      const compDate = bast || aEnd || latestReport
      const catA = isDone
        ? (compDate && startOfDay(compDate).getTime() > pe ? 'Overdue' : 'On Time')
        : (startOfDay(today).getTime() > pe ? 'Overdue (On Going)' : 'On Going')
      timeScheduleAgg[catA] = (timeScheduleAgg[catA] || 0) + 1

      const catB = isDone
        ? (latestReport && startOfDay(latestReport).getTime() > pe ? 'Overdue' : 'On Time')
        : (latestReport && startOfDay(latestReport).getTime() > pe ? 'Overdue (On Going)' : 'On Going')
      timeWorkerAgg[catB] = (timeWorkerAgg[catB] || 0) + 1
    }

    const TIME_ORDER = ['On Time', 'Overdue', 'On Going', 'Overdue (On Going)']
    const toTimeSeries = (agg: Record<string, number>) => TIME_ORDER.map((name) => ({ name, value: agg[name] || 0 }))
    const timeStatusSchedule = toTimeSeries(timeScheduleAgg)
    const timeStatusWorker = toTimeSeries(timeWorkerAgg)
    const projectStatusMix = Object.entries(projectStatusAgg)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const projectMetaMap = new Map<string, {
      projectId: string
      project: string
      plannedStart: string
      plannedEnd: string
      actualStart: string
      actualEnd: string
      overdueStatus: string
      isOverdue: boolean
      overdueDays: number
    }>()
    for (const p of projectHours) {
      projectMetaMap.set(p.projectId, {
        projectId: p.projectId,
        project: p.project,
        plannedStart: p.plannedStart,
        plannedEnd: p.plannedEnd,
        actualStart: p.actualStart,
        actualEnd: p.actualEnd,
        overdueStatus: p.overdueStatus,
        isOverdue: p.isOverdue,
        overdueDays: p.overdueDays
      })
    }

    const workerProjectDates = new Map<string, { first: Date; latest: Date }>()
    for (const r of filtered) {
      if (!r.reportUser || !r.reportPrjId) continue
      const key = `${r.reportUser}::${r.reportPrjId}`
      const d = parseDate(r.reportDate)
      if (!d) continue
      const existing = workerProjectDates.get(key)
      if (!existing) {
        workerProjectDates.set(key, { first: d, latest: d })
      } else {
        if (d.getTime() < existing.first.getTime()) existing.first = d
        if (d.getTime() > existing.latest.getTime()) existing.latest = d
      }
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
        const key = `${id}::${pId}`
        const wDates = workerProjectDates.get(key)
        
        const workerActualStart = wDates ? wDates.first : null
        const workerActualEnd = wDates ? wDates.latest : null
        
        const ord = orderMap.get(pId)
        const pStartStr = ord ? benchmarkStart(ord) : ''
        const pEndStr = ord ? benchmarkEnd(ord) : ''
        const orderNominal = ord ? ord.prjPoTotal : 0
        
        let isOverdue = false
        let overdueDays = 0
        let overdueStatus = 'Active'
        let actualStartStr = ''
        let actualEndStr = ''

        if (overdueMethod === 'worker') {
          actualStartStr = formatDateOnly(workerActualStart)
          actualEndStr = formatDateOnly(workerActualEnd)
          
          const targetEndDate = parseDate(pEndStr)
          if (targetEndDate && workerActualEnd) {
            const targetTime = startOfDay(targetEndDate).getTime()
            const lastReportTime = startOfDay(workerActualEnd).getTime()
            if (lastReportTime > targetTime) {
              isOverdue = true
              const diffTime = Math.abs(lastReportTime - targetTime)
              overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              overdueStatus = 'Overdue (Log)'
            } else {
              overdueStatus = 'On Track (Log)'
            }
          } else {
            overdueStatus = 'Active'
          }
        } else {
          actualStartStr = meta ? meta.actualStart : ''
          actualEndStr = meta ? meta.actualEnd : ''
          isOverdue = meta ? meta.isOverdue : false
          overdueDays = meta ? meta.overdueDays : 0
          overdueStatus = meta ? meta.overdueStatus : 'Active'
        }

        return {
          projectId: pId,
          project: projectName(pId),
          plannedStart: pStartStr,
          plannedEnd: pEndStr,
          actualStart: actualStartStr,
          actualEnd: actualEndStr,
          overdueStatus,
          isOverdue,
          overdueDays,
          orderNominal
        }
      })

      const uniqueProjectsCount = w.projects.size
      const overdueProjectsCount = projectsWorked.filter(p => p.isOverdue).length
      const overdueProjectsPct = uniqueProjectsCount ? Math.round((overdueProjectsCount / uniqueProjectsCount) * 100) : 0
      const totalOrderNominal = projectsWorked.reduce((sum, p) => sum + p.orderNominal, 0)

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
        overdueProjectsPct,
        projectsWorked,
        totalOrderNominal
      }
    }).sort((a, b) => b.hours - a.hours)

    const topWorkers = workers.slice(0, 12).map((w) => ({ name: w.worker, value: w.hours }))

    const userStatusMap = new Map(salesUsers.map((u) => [u.userId, u.statusId]))
    const workerList = [...new Set(reports.map((r) => r.reportUser).filter(Boolean))]
      .filter((id) => userStatusMap.get(id) === 'A')
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const projectList = [...new Set(dateFiltered.map((r) => r.reportPrjId).filter(Boolean))]
      .map((id) => ({ value: id, label: projectName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const userSiteList = [...new Set(salesUsers.map((u) => u.siteId).filter(Boolean))]
      .map((site) => ({ value: site, label: site }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const jobStatusList = [...new Set(salesUsers.map((u) => u.jobStatus).filter(Boolean))]
      .map((js) => ({ value: js, label: js === 'Int' ? 'Internal (Int)' : js === 'Ext' ? 'External (Ext)' : js }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const orderTypeList = [
      { value: 'Project', label: 'Project' },
      { value: 'Internal', label: 'Internal' }
    ]

    const chartOverdue = (timeScheduleAgg['Overdue'] || 0) + (timeScheduleAgg['Overdue (On Going)'] || 0)
    const chartTotal = Object.values(timeScheduleAgg).reduce((s, v) => s + v, 0)
    const overdueProjectsCount = chartOverdue
    const overdueProjectsPct = chartTotal ? Math.round((chartOverdue / chartTotal) * 100) : 0

    return ({
      kpis: {
        totalReports, totalHours: Math.round(totalHours), totalOvertime: Math.round(totalOvertime),
        activeWorkers, avgDelayHours, medianDelayHours, sameDayRate, avgScore, uniqueProjects,
        overdueProjectsPct, overdueProjectsCount
      },
      scoreBreakdown,
      monthlyTrend,
      topWorkers,
      projectStatusMix,
      timeStatusSchedule,
      timeStatusWorker,
      workers,
      projectHours,
      filterOptions: { workerList, projectList, userSiteList, jobStatusList, orderTypeList },
    })
}

const getData = cachedRoute('cost-control-workers-v1', compute)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getData(searchParams))
  } catch (error) {
    console.error('Cost Control Worker KPIs API error:', error)
    return NextResponse.json({ error: 'Failed to load worker KPIs' }, { status: 500 })
  }
}
