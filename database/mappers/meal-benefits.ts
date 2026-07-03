import type { MealBenefit, MealBenefitDetail, MealBenefitRelease, MealBenefitEvidence } from '../types'
import { parseNum } from './orders'

// meal_benefits columns:
// 0:mb_id 1:mb_date 2:mb_start_date 3:mb_end_date 4:mb_total_days 5:mb_type
// 6:mb_total_user 7:mb_total 8:mb_approve 9:mb_release_price 10:mb_project_id
// 11:mb_zone 12:mb_city 13:mb_notes 14:mb_request_file 15:mb_remarks 16:mb_status
// 17:mb_print 18:mb_notif 19:mb_user 20:mb_approver 21:mb_approved_at 22:created_by
// 23:updated_by 24:deleted_by 25:created_at 26:updated_at 27:deleted_at
export function mapMealBenefit(row: string[]): MealBenefit {
  return {
    mbId: row[0] || '',
    date: row[1] || '',
    startDate: row[2] || '',
    endDate: row[3] || '',
    totalDays: parseNum(row[4]),
    type: row[5] || '',
    totalUser: parseNum(row[6]),
    total: parseNum(row[7]),
    approve: parseNum(row[8]),
    releasePrice: parseNum(row[9]),
    projectId: row[10] || '',
    zone: row[11] || '',
    city: row[12] || '',
    notes: row[13] || '',
    remarks: row[15] || '',
    status: row[16] || '',
    userId: row[19] || '',
    approver: row[20] || '',
    approvedAt: row[21] || '',
    createdAt: row[25] || '',
    deletedAt: row[27] || '',
  }
}

// meal_benefit_details columns:
// 0:mbd_id 1:mbd_mb_id 2:mbd_start_date 3:mbd_end_date 4:mbd_total_days 5:mbd_amount
// 6:mbd_approved 7:mbd_project_id 8:mbd_notes 9:mbd_city 10:mbd_date 11:mbd_type
// 12:mbd_zones 13:mbd_user 14:mbd_user_name 15:created_by 16:updated_by 17:deleted_by
// 18:created_at 19:updated_at 20:deleted_at
export function mapMealBenefitDetail(row: string[]): MealBenefitDetail {
  return {
    mbdId: row[0] || '',
    mbId: row[1] || '',
    amount: parseNum(row[5]),
    approved: parseNum(row[6]),
    projectId: row[7] || '',
    type: row[11] || '',
    date: row[10] || '',
    userId: row[13] || '',
    userName: row[14] || '',
    deletedAt: row[20] || '',
  }
}

// meal_benefit_releases columns (meal_benefit_releases_db):
// 0:mbr_id 1:mbr_mb_id 2:mbr_amount 3:mbr_file 4:mbr_status 5:mbr_type 6:created_by
// 7:updated_by 8:deleted_by 9:created_at 10:updated_at 11:deleted_at
export function mapMealBenefitRelease(row: string[]): MealBenefitRelease {
  return {
    mbrId: row[0] || '',
    mbId: row[1] || '',
    amount: parseNum(row[2]),
    status: row[4] || '',
    type: row[5] || '',
    createdAt: row[9] || '',
    deletedAt: row[11] || '',
  }
}

// meal_benefit_evidences columns (meal_benefit_evidences_db):
// 0:mbe_id 1:mbe_mb_id 2:mbe_file 3:mbe_amount 4:mbe_status 5:created_by
// 6:updated_by 7:deleted_by 8:created_at 9:updated_at 10:deleted_at
export function mapMealBenefitEvidence(row: string[]): MealBenefitEvidence {
  return {
    mbeId: row[0] || '',
    mbId: row[1] || '',
    file: row[2] || '',
    amount: parseNum(row[3]),
    status: row[4] || '',
    createdAt: row[8] || '',
    deletedAt: row[10] || '',
  }
}
