import { fetchAllRows } from '../client'
import { GOOGLE_CONFIG } from '../config'
import { mapMealBenefit, mapMealBenefitDetail, mapMealBenefitRelease } from '../mappers/meal-benefits'
import type { MealBenefit, MealBenefitDetail, MealBenefitRelease } from '../types'

const cfg = GOOGLE_CONFIG.payroll
const ssId = cfg.spreadsheetId
const sheets = cfg.sheets

export async function getAllMealBenefits(): Promise<MealBenefit[]> {
  const { rows } = await fetchAllRows(ssId, sheets.mealBenefits)
  // drop header echo + soft-deleted rows (deleted_at at index 27)
  return rows.filter((r) => r[0] && r[0] !== 'mb_id' && !r[27]).map(mapMealBenefit)
}

export async function getMealBenefitDetails(): Promise<MealBenefitDetail[]> {
  const { rows } = await fetchAllRows(ssId, sheets.mealBenefitDetails)
  return rows.filter((r) => r[0] && r[0] !== 'mbd_id' && !r[20]).map(mapMealBenefitDetail)
}

export async function getMealBenefitReleases(): Promise<MealBenefitRelease[]> {
  const { rows } = await fetchAllRows(cfg.mealReleasesSpreadsheetId, sheets.mealReleases)
  return rows.filter((r) => r[0] && r[0] !== 'mbr_id' && !r[11]).map(mapMealBenefitRelease)
}

// ── Reference maps (meal types, release types) ──
let mbTypeMap: Map<string, string> | null = null
let mbrTypeMap: Map<string, { name: string; positive: boolean }> | null = null

export async function loadMealRefMaps(): Promise<void> {
  if (mbTypeMap) return
  const [tRows, rRows] = await Promise.all([
    fetchAllRows(ssId, sheets.mbTypes),
    fetchAllRows(cfg.mealReleasesSpreadsheetId, sheets.mbrTypes),
  ])
  mbTypeMap = new Map()
  for (const r of tRows.rows) if (r[0] && r[0] !== 'mbt_id') mbTypeMap.set(r[0], r[1] || r[0])
  mbrTypeMap = new Map()
  for (const r of rRows.rows) {
    if (r[0] && r[0] !== 'mbrt_id') mbrTypeMap.set(r[0], { name: r[1] || r[0], positive: String(r[2]).toUpperCase() === 'TRUE' })
  }
}

export function getMbTypeLabel(id: string): string {
  return mbTypeMap?.get(id) || id || '-'
}
export function getMbrTypeInfo(id: string): { name: string; positive: boolean } {
  return mbrTypeMap?.get(id) || { name: id || '-', positive: true }
}
