import { NextRequest, NextResponse } from 'next/server'
import { cachedRoute } from '@/lib/route-cache'
import {
  getAllSalesActivities, getAllActivityTypes, getAllActivityLevels, getAllActivityStatuses,
  loadRefMaps as loadActivityRefMaps, getActivityTypeLabel, getActivityLevelLabel, getActivityStatusLabel,
  getSalesUserNamesForActivities,
} from '@/database/repos/sales-activities'
import { parseMulti, parseDate, formatMonth, formatWeek, filterDataByDateRange } from '@/lib/utils-date-currency'
import { parseDashboardParams } from '@/lib/api-helpers'

async function compute(searchParams: URLSearchParams) {
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const salesUser = parseMulti(searchParams, 'salesUser')
    const activityType = parseMulti(searchParams, 'activityType')
    const level = parseMulti(searchParams, 'level')
    const status = parseMulti(searchParams, 'status')
    const period = (searchParams.get('period') as 'monthly' | 'weekly') || 'monthly'

    await loadActivityRefMaps()

    const [activitiesRaw, types, levels, statuses] = await Promise.all([
      getAllSalesActivities(),
      getAllActivityTypes(),
      getAllActivityLevels(),
      getAllActivityStatuses(),
    ])

    const activities = activitiesRaw.filter((a) => !a.deletedAt)

    // Get user names only for users who have activities (efficient - no full user fetch)
    const userNameMap = await getSalesUserNamesForActivities(activities)

    let filtered = filterDataByDateRange(activities, (a) => a.saDate, dateFrom, dateTo)

    if (salesUser.length) {
      filtered = filtered.filter((a) => salesUser.includes(a.saUserId))
    }
    if (activityType.length) {
      filtered = filtered.filter((a) => activityType.includes(getActivityTypeLabel(a.saType)))
    }
    if (level.length) {
      filtered = filtered.filter((a) => level.includes(getActivityLevelLabel(a.saLevel)))
    }
    if (status.length) {
      filtered = filtered.filter((a) => status.includes(getActivityStatusLabel(a.saStatus)))
    }

    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      if (cType === 'type') filtered = filtered.filter(a => getActivityTypeLabel(a.saType) === cVal)
      if (cType === 'status') filtered = filtered.filter(a => getActivityStatusLabel(a.saStatus) === cVal)
      if (cType === 'level') filtered = filtered.filter(a => getActivityLevelLabel(a.saLevel) === cVal)
      if (cType === 'actMonth') {
        filtered = filtered.filter(a => {
          if (!a.saDate) return false
          const key = period === 'weekly' ? formatWeek(a.saDate) : formatMonth(a.saDate)
          return key === cVal
        })
      }
    }

    const totalActivities = filtered.length
    const doneCount = filtered.filter((a) => a.saStatus === 'D').length
    const todoCount = filtered.filter((a) => a.saStatus === 'TD').length
    const holdCount = filtered.filter((a) => a.saStatus === 'H').length
    const cancelCount = filtered.filter((a) => a.saStatus === 'C').length
    const completionRate = totalActivities > 0 ? Math.round((doneCount / totalActivities) * 1000) / 10 : 0

    const now = new Date()
    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    const activitiesThisWeek = filtered.filter((a) => {
      if (!a.saDate) return false
      const d = parseDate(a.saDate)
      return d && d >= oneWeekAgo
    }).length

    const highPriorityCount = filtered.filter((a) => a.saLevel === 'H').length

    const byTypeMap: Record<string, number> = {}
    for (const a of filtered) {
      const label = getActivityTypeLabel(a.saType)
      byTypeMap[label] = (byTypeMap[label] || 0) + 1
    }
    const byType = Object.entries(byTypeMap).map(([name, value]) => ({ name, value }))

    const byStatusMap: Record<string, number> = {}
    for (const a of filtered) {
      const label = getActivityStatusLabel(a.saStatus)
      byStatusMap[label] = (byStatusMap[label] || 0) + 1
    }
    const byStatus = Object.entries(byStatusMap).map(([name, value]) => ({ name, value }))

    const byLevelMap: Record<string, number> = {}
    for (const a of filtered) {
      const label = getActivityLevelLabel(a.saLevel)
      byLevelMap[label] = (byLevelMap[label] || 0) + 1
    }
    const byLevel = Object.entries(byLevelMap).map(([name, value]) => ({ name, value }))

    const trendMap: Record<string, number> = {}
    for (const a of filtered) {
      const key = period === 'weekly' ? formatWeek(a.saDate) : formatMonth(a.saDate)
      if (!key) continue
      trendMap[key] = (trendMap[key] || 0) + 1
    }
    const parsePeriodKey = (key: string): number => {
      if (period === 'weekly') {
        const m = key.match(/^W(\d+) (\d{4})$/)
        return m ? (parseInt(m[2]) || 0) * 100 + (parseInt(m[1]) || 0) : 0
      }
      const months: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
      const parts = key.split(' ')
      return parts.length === 2 ? (parseInt(parts[1]) || 0) * 100 + (months[parts[0]] || 0) : 0
    }
    const trend = Object.entries(trendMap)
      .sort(([a], [b]) => parsePeriodKey(a) - parsePeriodKey(b))
      .map(([name, value]) => ({ name, value }))

    const userAgg: Record<string, { total: number; done: number; todo: number; hold: number; cancel: number }> = {}
    for (const a of filtered) {
      const userId = a.saUserId
      if (!userAgg[userId]) {
        userAgg[userId] = { total: 0, done: 0, todo: 0, hold: 0, cancel: 0 }
      }
      userAgg[userId].total++
      if (a.saStatus === 'D') userAgg[userId].done++
      else if (a.saStatus === 'TD') userAgg[userId].todo++
      else if (a.saStatus === 'H') userAgg[userId].hold++
      else if (a.saStatus === 'C') userAgg[userId].cancel++
    }
    const byUser = Object.entries(userAgg)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10)
      .map(([userId, u]) => ({
        name: userNameMap.get(userId) || userId,
        userId,
        total: u.total,
        done: u.done,
        todo: u.todo,
        hold: u.hold,
        cancel: u.cancel,
        completionRate: u.total > 0 ? Math.round((u.done / u.total) * 100) : 0,
      }))

    const funnel = [
      { name: 'To Do', value: todoCount },
      { name: 'Done', value: doneCount },
      { name: 'Hold', value: holdCount },
      { name: 'Cancel', value: cancelCount },
    ]

    const allActivities = filtered
      .sort((a, b) => {
        const da = parseDate(a.saDate)
        const db = parseDate(b.saDate)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return db.getTime() - da.getTime()
      })
      .map((a) => ({
        saId: a.saId,
        description: a.saDescription,
        type: getActivityTypeLabel(a.saType),
        level: getActivityLevelLabel(a.saLevel),
        status: getActivityStatusLabel(a.saStatus),
        userId: a.saUserId,
        userName: userNameMap.get(a.saUserId) || a.saUserId,
        date: a.saDate,
        hasLinkage: !!(a.saQId || a.saPrjId || a.saLeadId || a.saOId),
      }))

    // Only return users who have activities in the filtered data
    const activeUserIds = new Set(filtered.map(a => a.saUserId))
    const salesUserList = Array.from(activeUserIds)
      .map(id => ({ id, name: userNameMap.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return ({
      kpis: {
        totalActivities,
        completionRate,
        activitiesThisWeek,
        highPriorityCount,
        doneCount,
        todoCount,
        holdCount,
        cancelCount,
      },
      byType,
      byStatus,
      byLevel,
      trend,
      byUser,
      funnel,
      allActivities,
      filterOptions: {
        types: types.map((t) => ({ id: t.satId, label: t.satDescription })),
        levels: levels.map((l) => ({ id: l.salId, label: l.salDescription })),
        statuses: statuses.map((s) => ({ id: s.sasId, label: s.sasDescription })),
      },
      salesUserList,
    })
}

const getData = cachedRoute('sales-activities', compute)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getData(searchParams))
  } catch (error) {
    console.error('Sales activities error:', error)
    return NextResponse.json({ error: 'Failed to load sales activities' }, { status: 500 })
  }
}