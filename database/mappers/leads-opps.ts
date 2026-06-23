import type { Lead, Opportunity, LeadRating } from '../types'

// leads sheet columns (0-based):
// 0: lead_id
// 1: lead_c_id (company id)
// 2: lead_picc_id (pic id)
// 3: lead_date
// 4: lead_rating (status)
// 5: lead_industry
// 6: lead_source
// 7: lead_remarks (notes)
// 8: lead_owner (assigned to)
// 9: created_by
// 10: created_at
// 11: updated_by
// 12: updated_at
// 13: deleted_at

export function mapLead(
  row: string[],
  companyName: string,
  picData: { name: string; contact: string; email: string },
  ratingLabel: string
): Lead {
  return {
    leadId: row[0] || '',
    name: picData.name || '',
    company: companyName || '',
    contactPerson: picData.name || '',
    phone: picData.contact || '',
    email: picData.email || '',
    address: '',
    notes: row[7] || '',
    status: ratingLabel || row[4] || '',
    source: row[6] || '',
    assignedTo: row[8] || '',
    createdAt: row[10] || '',
    updatedAt: row[12] || '',
    deletedAt: row[13] || '',
    leadDate: row[3] || '',
  }
}

export function mapLeadRating(row: string[]): LeadRating {
  return {
    lrId: row[0] || '',
    lrDescription: row[1] || '',
  }
}

// opportunities sheet columns (0-based):
// 0: o_id
// 1: o_lead_id
// 2: o_name
// 3: o_c_id (company id)
// 4: o_picc_id
// 5: o_currency
// 6: o_estimated_value
// 7: o_close_date
// 8: o_type (stage)
// 9: o_probability
// 10: o_status
// 11: o_file
// 12: o_remarks (description)
// 13: o_owner (assigned to)
// 14: created_by
// 15: created_at
// 16: updated_by
// 17: updated_at
// 18: deleted_at

export function mapOpportunity(
  row: string[],
  companyName: string,
  stageLabel: string,
  picData: { name: string; contact: string; email: string }
): Opportunity {
  return {
    oId: row[0] || '',
    leadId: row[1] || '',
    name: row[2] || '',
    description: row[12] || '',
    company: companyName || '',
    value: parseFloat(row[6]) || 0,
    stage: stageLabel || row[8] || '',
    probability: parseFloat(row[9]) || 0,
    closeDate: row[7] || '',
    assignedTo: row[13] || '',
    status: row[10] || '',
    createdAt: row[15] || '',
    updatedAt: row[17] || '',
    deletedAt: row[18] || '',
    contactPerson: picData.name || '',
    phone: picData.contact || '',
    email: picData.email || '',
  }
}
