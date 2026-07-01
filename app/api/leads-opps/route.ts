import { NextRequest, NextResponse } from 'next/server'
import { getAllLeads, getAllOpportunities, getSalesUserNamesForLeadsOpps } from '@/database/repos/leads-opps'
import { parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { parseDashboardParams } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const status = parseMulti(searchParams, 'status')
    const assignedTo = parseMulti(searchParams, 'assignedTo')
    const source = parseMulti(searchParams, 'source')
    const stage = parseMulti(searchParams, 'stage')

    const [leadsRaw, opportunitiesRaw] = await Promise.all([
      getAllLeads(),
      getAllOpportunities(),
    ])

    const userNameMap = await getSalesUserNamesForLeadsOpps(leadsRaw, opportunitiesRaw)

    // Parse date helpers
    const parseDate = (d: string): Date | null => {
      if (!d) return null
      const p = new Date(d)
      return isNaN(p.getTime()) ? null : p
    }

    let leads = filterDataByDateRange(leadsRaw, (l) => l.leadDate, dateFrom, dateTo)
    let opportunities = filterDataByDateRange(opportunitiesRaw, (o) => o.createdAt, dateFrom, dateTo)

    if (status.length) {
      leads = leads.filter((l: any) => status.includes(l.status))
    }
    if (assignedTo.length) {
      leads = leads.filter((l: any) => assignedTo.includes(l.assignedTo))
      opportunities = opportunities.filter((o: any) => assignedTo.includes(o.assignedTo))
    }
    if (source.length) {
      leads = leads.filter((l: any) => source.includes(l.source))
    }
    if (stage.length) {
      opportunities = opportunities.filter((o: any) => stage.includes(o.stage))
    }

    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      if (cType === 'leadStatus') leads = leads.filter((l: any) => l.status === cVal)
      if (cType === 'oppStage') opportunities = opportunities.filter((o: any) => o.stage === cVal)
      if (cType === 'oppStatus') opportunities = opportunities.filter((o: any) => o.status === cVal)
      if (cType === 'leadMonth') {
        leads = leads.filter((l: any) => {
          const d = parseDate(l.leadDate)
          if (!d) return false
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          return key === cVal
        })
      }
      if (cType === 'oppMonth') {
        opportunities = opportunities.filter((o: any) => {
          const d = parseDate(o.createdAt)
          if (!d) return false
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          return key === cVal
        })
      }
    }

    // KPIs
    const totalLeads = leads.length
    const totalOpportunities = opportunities.length
    const totalOppValue = opportunities.reduce((s: number, o: any) => s + (o.value || 0), 0)
    const leadsWithOpp = new Set(opportunities.map((o: any) => o.leadId).filter(Boolean))
    const conversionRate = totalLeads > 0 ? Math.round((leadsWithOpp.size / totalLeads) * 1000) / 10 : 0

    // Leads by status (rating)
    const leadStatusMap: Record<string, number> = {}
    for (const l of leads) {
      const label = l.status || '(Blank)'
      leadStatusMap[label] = (leadStatusMap[label] || 0) + 1
    }
    const byLeadStatus = Object.entries(leadStatusMap).map(([name, value]) => ({ name, value }))

    // Opportunities by stage (type)
    const oppStageMap: Record<string, number> = {}
    for (const o of opportunities) {
      const label = o.stage || '(Blank)'
      oppStageMap[label] = (oppStageMap[label] || 0) + 1
    }
    const byOppStage = Object.entries(oppStageMap).map(([name, value]) => ({ name, value }))

    // Opportunities by status (stage)
    const oppStatusMap: Record<string, number> = {}
    for (const o of opportunities) {
      const label = o.status || '(Blank)'
      oppStatusMap[label] = (oppStatusMap[label] || 0) + 1
    }
    const byOppStatus = Object.entries(oppStatusMap).map(([name, value]) => ({ name, value }))

    // Lead trend by month stacked by rating
    const leadTrendMap: Record<string, Record<string, number>> = {}
    for (const l of leads) {
      const d = parseDate(l.leadDate)
      if (!d) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!leadTrendMap[key]) {
        leadTrendMap[key] = {}
      }
      const rating = l.status || '(Blank)'
      leadTrendMap[key][rating] = (leadTrendMap[key][rating] || 0) + 1
    }
    const leadTrend = Object.entries(leadTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, ratingsCount]) => ({
        name,
        ...ratingsCount,
      }))

    // Opportunity value trend by month
    const oppTrendMap: Record<string, number> = {}
    for (const o of opportunities) {
      const d = parseDate(o.createdAt)
      if (!d) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      oppTrendMap[key] = (oppTrendMap[key] || 0) + (o.value || 0)
    }
    const oppValueTrend = Object.entries(oppTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value: Math.round(value) }))

    // Top opportunities by value
    const topOpps = [...opportunities]
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      .slice(0, 10)
      .map((o: any) => ({
        oId: o.oId,
        name: o.name,
        company: o.company,
        value: o.value || 0,
        stage: o.stage,
        status: o.status,
        assignedName: userNameMap.get(o.assignedTo) || o.assignedTo || '-',
      }))

    // Sales user list
    const activeUserIds = new Set<string>()
    for (const l of leads) { if (l.assignedTo) activeUserIds.add(l.assignedTo) }
    for (const o of opportunities) { if (o.assignedTo) activeUserIds.add(o.assignedTo) }
    const salesUserList = Array.from(activeUserIds)
      .map(id => ({ id, name: userNameMap.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Filter options
    const leadStatuses = [...new Set(leadsRaw.map((l: any) => l.status).filter(Boolean))].sort()
    const oppStages = [...new Set(opportunitiesRaw.map((o: any) => o.stage).filter(Boolean))].sort()
    const oppStatuses = [...new Set(opportunitiesRaw.map((o: any) => o.status).filter(Boolean))].sort()
    const sources = [...new Set(leadsRaw.map((l: any) => l.source).filter(Boolean))].sort()

    // Resolve assigned names for table data
    const resolveName = (id: string) => userNameMap.get(id) || id || '-'

    const result = {
      leads: leads.map((l: any) => ({
        leadId: l.leadId,
        name: l.name,
        company: l.company,
        contactPerson: l.contactPerson,
        phone: l.phone,
        email: l.email,
        status: l.status,
        source: l.source,
        assignedTo: l.assignedTo,
        assignedName: resolveName(l.assignedTo),
        createdAt: l.createdAt,
        leadDate: l.leadDate,
        notes: l.notes,
      })),
      opportunities: opportunities.map((o: any) => ({
        oId: o.oId,
        leadId: o.leadId,
        name: o.name,
        description: o.description,
        company: o.company,
        value: o.value,
        stage: o.stage,
        probability: o.probability,
        closeDate: o.closeDate,
        status: o.status,
        assignedTo: o.assignedTo,
        assignedName: resolveName(o.assignedTo),
        createdAt: o.createdAt,
        contactPerson: o.contactPerson,
        phone: o.phone,
        email: o.email,
      })),
      kpis: { totalLeads, totalOpportunities, totalOppValue, conversionRate },
      byLeadStatus,
      byOppStage,
      byOppStatus,
      leadTrend,
      oppValueTrend,
      topOpps,
      salesUserList,
      filterOptions: { leadStatuses, oppStages, oppStatuses, sources },
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Leads & Opportunities error:', error)
    return NextResponse.json({ error: 'Failed to load leads and opportunities' }, { status: 500 })
  }
}
