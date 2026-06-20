import type { Lead, Opportunity } from '../types'

// leads sheet columns (0-based):
// 0:lead_id 1:name 2:company 3:contact_person 4:phone 5:email
// 6:address 7:notes 8:status 9:source 10:assigned_to
// 11:created_at 12:updated_at 13:deleted_at

export function mapLead(row: string[]): Lead {
  return {
    leadId: row[0] || '',
    name: row[1] || '',
    company: row[2] || '',
    contactPerson: row[3] || '',
    phone: row[4] || '',
    email: row[5] || '',
    address: row[6] || '',
    notes: row[7] || '',
    status: row[8] || '',
    source: row[9] || '',
    assignedTo: row[10] || '',
    createdAt: row[11] || '',
    updatedAt: row[12] || '',
    deletedAt: row[13] || '',
  }
}

// opportunities sheet columns (0-based):
// 0:o_id 1:lead_id 2:name 3:description 4:company 5:value
// 6:stage 7:probability 8:close_date 9:assigned_to 10:status
// 11:created_at 12:updated_at 13:deleted_at

export function mapOpportunity(row: string[]): Opportunity {
  return {
    oId: row[0] || '',
    leadId: row[1] || '',
    name: row[2] || '',
    description: row[3] || '',
    company: row[4] || '',
    value: parseFloat(row[5]) || 0,
    stage: row[6] || '',
    probability: parseFloat(row[7]) || 0,
    closeDate: row[8] || '',
    assignedTo: row[9] || '',
    status: row[10] || '',
    createdAt: row[11] || '',
    updatedAt: row[12] || '',
    deletedAt: row[13] || '',
  }
}
