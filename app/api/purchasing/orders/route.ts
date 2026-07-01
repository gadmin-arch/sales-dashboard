import { NextRequest, NextResponse } from 'next/server'
import {
  getAllPurchaseOrders, getAllPoLines, getAllOrders,
  getPoStatusLabel, getPaymentTypeLabel, getItemTypeLabel, loadProcurementRefMaps,
} from '@/database'
import { parseDashboardParams } from '@/lib/api-helpers'
import { parseDate, formatMonth, sortByPeriod, parseMulti, filterDataByDateRange } from '@/lib/utils-date-currency'
import { distinct, makeProjectLabeler, makeVendorNamer, makeNamer } from '@/lib/purchasing-helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { dateFrom, dateTo } = parseDashboardParams(searchParams)
    const vendor = parseMulti(searchParams, 'vendor')
    const project = parseMulti(searchParams, 'project')
    const paymentType = parseMulti(searchParams, 'paymentType')
    const status = parseMulti(searchParams, 'status')
    const itemType = parseMulti(searchParams, 'itemType')
    const user = parseMulti(searchParams, 'user')

    const [pos, lines, orders] = await Promise.all([
      getAllPurchaseOrders(),
      getAllPoLines(),
      getAllOrders(),
    ])
    await loadProcurementRefMaps()

    const proj = makeProjectLabeler(orders)
    const projectName = proj.label
    const vendorName = makeVendorNamer(pos)
    const userName = makeNamer(pos, (p) => p.poUserId, (p) => p.poUserName)
    // PO number -> purchaser (user) id, for attributing line items to a user.
    const poUserByNumber = new Map<string, string>()
    for (const p of pos) if (p.poNumber) poUserByNumber.set(p.poNumber, p.poUserId)

    // PO number -> line-derived sets (projects, item types)
    const projectsByPo = new Map<string, Set<string>>()
    const itemTypesByPo = new Map<string, Set<string>>()
    for (const l of lines) {
      if (!l.polPoNumber) continue
      if (l.polPrjId) {
        let s = projectsByPo.get(l.polPoNumber); if (!s) projectsByPo.set(l.polPoNumber, (s = new Set()))
        s.add(l.polPrjId)
      }
      if (l.polItemTypeId) {
        let s = itemTypesByPo.get(l.polPoNumber); if (!s) itemTypesByPo.set(l.polPoNumber, (s = new Set()))
        s.add(l.polItemTypeId)
      }
    }

    // ── Filter POs ──
    let filtered = filterDataByDateRange(pos, (p) => p.poDate, dateFrom, dateTo)
    if (vendor.length) filtered = filtered.filter((p) => vendor.includes(p.poCompanyId))
    if (paymentType.length) filtered = filtered.filter((p) => paymentType.includes(p.poPaymentType))
    if (status.length) filtered = filtered.filter((p) => status.includes(p.poStatus))
    if (user.length) filtered = filtered.filter((p) => user.includes(p.poUserId))
    if (project.length) filtered = filtered.filter((p) => { const s = projectsByPo.get(p.poNumber); return s ? project.some((x) => s.has(x)) : false })
    if (itemType.length) filtered = filtered.filter((p) => { const s = itemTypesByPo.get(p.poNumber); return s ? itemType.some((x) => s.has(x)) : false })

    // ── Per-row derived ──
    const rows = filtered.map((p) => {
      const prjSet = projectsByPo.get(p.poNumber)
      const projects = prjSet ? [...prjSet].map(projectName).join(', ') : '-'
      const progress = Math.min(100, Math.max(0, p.poPaymentProgress))
      return {
        poNumber: p.poNumber,
        poDate: p.poDate,
        vendorId: p.poCompanyId,
        vendor: vendorName(p.poCompanyId),
        userId: p.poUserId,
        user: userName(p.poUserId),
        projects,
        projectIds: prjSet ? [...prjSet] : [],
        itemTypeIds: itemTypesByPo.get(p.poNumber) ? [...itemTypesByPo.get(p.poNumber)!] : [],
        gross: p.poGross,
        discount: p.poDiscount,
        net: p.poNet,
        ppn: p.poPpn,
        pph: p.poPph,
        amount: p.poAmount,
        paymentType: p.poPaymentType,
        paymentTypeLabel: getPaymentTypeLabel(p.poPaymentType),
        dpPercent: p.poDpPercent,
        paymentProgress: progress,
        deliveryDate: p.poDeliveryDate,
        status: p.poStatus,
        statusLabel: getPoStatusLabel(p.poStatus),
      }
    })

    // ── Cross-filter ──
    let finalRows = rows
    const cType = searchParams.get('cType')
    const cVal = searchParams.get('cVal')
    if (cType && cVal) {
      finalRows = finalRows.filter((r) => {
        if (cType === 'spendMonth') return formatMonth(r.poDate) === cVal
        if (cType === 'vendor') return r.vendor === cVal
        if (cType === 'user') return r.user === cVal
        if (cType === 'paymentType') return r.paymentTypeLabel === cVal
        if (cType === 'status') return r.statusLabel === cVal
        if (cType === 'project') return r.projectIds.includes(cVal)
        if (cType === 'itemType') return r.itemTypeIds.map(getItemTypeLabel).includes(cVal)
        return true
      })
    }
    const finalPoSet = new Set(finalRows.map((r) => r.poNumber))

    // ── KPIs ──
    const totalSpend = finalRows.reduce((s, r) => s + r.amount, 0)
    const poCount = finalRows.length
    const avgPO = poCount > 0 ? totalSpend / poCount : 0
    const vendorCount = new Set(finalRows.map((r) => r.vendorId).filter(Boolean)).size
    const totalNet = finalRows.reduce((s, r) => s + r.net, 0)
    const totalPpn = finalRows.reduce((s, r) => s + r.ppn, 0)
    const totalPph = finalRows.reduce((s, r) => s + r.pph, 0)
    const approvedCount = finalRows.filter((r) => r.status === 'A').length
    const waitingCount = finalRows.filter((r) => r.status === 'W').length

    // ── Spend trend (monthly, by PO date) ──
    const trendAgg: Record<string, number> = {}
    for (const r of finalRows) { const k = formatMonth(r.poDate); if (!k) continue; trendAgg[k] = (trendAgg[k] || 0) + r.amount }
    const spendTrend = sortByPeriod(trendAgg, 'monthly').map(([name, v]) => ({ name, value: Math.round(v) }))

    // ── Spend by vendor (top 10) ──
    const vendorAgg: Record<string, number> = {}
    for (const r of finalRows) vendorAgg[r.vendor] = (vendorAgg[r.vendor] || 0) + r.amount
    const spendByVendor = Object.entries(vendorAgg)
      .map(([name, value]) => ({ name, value: Math.round(value) })).filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value).slice(0, 10)

    // ── Payment type & status mix (donut, by spend) ──
    const ptAgg: Record<string, number> = {}
    for (const r of finalRows) ptAgg[r.paymentTypeLabel] = (ptAgg[r.paymentTypeLabel] || 0) + r.amount
    const paymentTypeMix = Object.entries(ptAgg).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)

    const stAgg: Record<string, number> = {}
    for (const r of finalRows) stAgg[r.statusLabel] = (stAgg[r.statusLabel] || 0) + r.amount
    const statusMix = Object.entries(stAgg).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)

    // ── Project & item-type spend + line count per purchaser (lines scoped to filtered POs) ──
    const projSpend: Record<string, number> = {}
    const itemTypeSpend: Record<string, number> = {}
    const userLineAgg: Record<string, number> = {} // keyed by purchaser userId
    let lineCount = 0 // total POLists line items belonging to the filtered POs
    for (const l of lines) {
      if (!finalPoSet.has(l.polPoNumber)) continue
      lineCount++
      const luid = poUserByNumber.get(l.polPoNumber)
      if (luid) userLineAgg[luid] = (userLineAgg[luid] || 0) + 1
      if (l.polPrjId) projSpend[l.polPrjId] = (projSpend[l.polPrjId] || 0) + l.polTotal
      // Skip the stray lowercase 'c' item type (data noise, not a real ItemType).
      if (l.polItemTypeId && l.polItemTypeId !== 'c') {
        const itLabel = getItemTypeLabel(l.polItemTypeId)
        itemTypeSpend[itLabel] = (itemTypeSpend[itLabel] || 0) + l.polTotal
      }
    }
    // axis = project id, tooltip = name
    const spendByProject = Object.entries(projSpend)
      .map(([id, value]) => ({ id, name: proj.bare(id), value: Math.round(value) })).filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value).slice(0, 10)
    const spendByItemType = Object.entries(itemTypeSpend)
      .map(([name, value]) => ({ name, value: Math.round(value) })).filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)

    // ── By purchaser (PO_P_User_ID_FK): net spend, PO count, PO-line count ──
    const userNetAgg: Record<string, number> = {}
    const userPoAgg: Record<string, number> = {}
    for (const r of finalRows) {
      if (!r.userId) continue
      userNetAgg[r.userId] = (userNetAgg[r.userId] || 0) + r.net
      userPoAgg[r.userId] = (userPoAgg[r.userId] || 0) + 1
    }
    const topByUser = (m: Record<string, number>) => Object.entries(m)
      .map(([uid, value]) => ({ name: userName(uid), value: Math.round(value) }))
      .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 12)
    const netByUser = topByUser(userNetAgg)
    const poByUser = topByUser(userPoAgg)
    const lineByUser = topByUser(userLineAgg)

    // ── Filter options ──
    const vendorList = distinct(pos.map((p) => p.poCompanyId).filter(Boolean))
      .map((id) => ({ value: id, label: vendorName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const paymentTypeList = distinct(pos.map((p) => p.poPaymentType).filter(Boolean))
      .map((id) => ({ value: id, label: getPaymentTypeLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const statusList = distinct(pos.map((p) => p.poStatus).filter(Boolean))
      .map((id) => ({ value: id, label: getPoStatusLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const itemTypeList = distinct(lines.map((l) => l.polItemTypeId).filter((id) => id && id !== 'c'))
      .map((id) => ({ value: id, label: getItemTypeLabel(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const projectList = distinct(lines.map((l) => l.polPrjId).filter(Boolean))
      .map((id) => ({ value: id, label: projectName(id) })).sort((a, b) => a.label.localeCompare(b.label))
    const userList = distinct(pos.map((p) => p.poUserId).filter(Boolean))
      .map((id) => ({ value: id, label: userName(id) })).sort((a, b) => a.label.localeCompare(b.label))

    const tableRows = [...finalRows].sort(
      (a, b) => (parseDate(b.poDate)?.getTime() || 0) - (parseDate(a.poDate)?.getTime() || 0)
    )

    return NextResponse.json({
      kpis: { totalSpend, poCount, lineCount, avgPO, vendorCount, totalNet, totalPpn, totalPph, approvedCount, waitingCount },
      spendTrend,
      spendByVendor,
      spendByProject,
      spendByItemType,
      paymentTypeMix,
      statusMix,
      netByUser,
      poByUser,
      lineByUser,
      orders: tableRows,
      totalRows: finalRows.length,
      filterOptions: { vendorList, projectList, paymentTypeList, statusList, itemTypeList, userList },
    })
  } catch (error) {
    console.error('Purchasing orders API error:', error)
    return NextResponse.json({ error: 'Failed to load purchase orders' }, { status: 500 })
  }
}
