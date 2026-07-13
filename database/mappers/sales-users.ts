import type { SalesUser, SalesRole, Departement } from '../types'

// users sheet columns:
// 0:user_id 1:user_email 2:user_name 3:user_status_id 4:user_departement_id
// 5:user_site_id 6:user_division_id 7:user_team_id 8:user_role_id
// 9:user_working_hour_id 10:user_phone 11:user_nik 12:user_birth_date
// 13:user_birth_place ... 19:user_formal_email 20:user_photo 21:user_occupation_id

export function mapSalesUser(row: string[]): SalesUser {
  return {
    userId: row[0] || '',
    email: row[1] || '',
    name: row[2] || '',
    statusId: row[3] || '',
    departementId: row[4] || '',
    siteId: row[5] || '',
    divisionId: row[6] || '',
    teamId: row[7] || '',
    roleId: row[8] || '',
    phone: row[10] || '',
    nik: row[11] || '',
    formalEmail: row[19] || '',
    photo: row[20] || '',
    jobStatus: row[22] || '',
  }
}

export function mapSalesRole(row: string[]): SalesRole {
  const level = parseInt(row[2])
  return { roleId: row[0] || '', roleName: row[1] || '', roleLevel: isNaN(level) ? 0 : level }
}

export function mapDepartement(row: string[]): Departement {
  return { departementId: row[0] || '', departementName: row[1] || '' }
}
