import type { PurchaseOrder, PoLine, ProcItem } from '../types'
import { parseNum } from './orders'

// POs columns (subset used):
// 0:PO_Number 1:PO_Date 2:po_currency 3:PO_Company_ID_FK 4:PO_Company_Name
// 11:PO_PaymentTypes_ID_FK 12:PO_DPPercent 13:PO_DPTotal 15:PO_PaymentProgress
// 16:PO_AmountPayment 18:PO_PaymentDueDate 19:PO_Gross 20:PO_Discount 21:PO_Net
// 22:po_ppn 23:po_pph 24:PO_Amount 31:PO_DeliveryDate 32:PO_ReceivedDate
// 37:PO_Status 38:PO_WStatus 39:PO_P_User_ID_FK 41:PO_P_User_Name
// Percentages arrive like "100.00%" — parseNum strips the "%".
export function mapPurchaseOrder(row: string[]): PurchaseOrder {
  return {
    poNumber: row[0] || '',
    poDate: row[1] || '',
    poCurrency: (row[2] || 'IDR').trim(),
    poCompanyId: row[3] || '',
    poCompanyName: row[4] || '',
    poPaymentType: row[11] || '',
    poDpPercent: parseNum(row[12]),
    poDpTotal: parseNum(row[13]),
    poPaymentProgress: parseNum(row[15]),
    poAmountPayment: parseNum(row[16]),
    poPaymentDueDate: row[18] || '',
    poGross: parseNum(row[19]),
    poDiscount: parseNum(row[20]),
    poNet: parseNum(row[21]),
    poPpn: parseNum(row[22]),
    poPph: parseNum(row[23]),
    poAmount: parseNum(row[24]),
    poDeliveryDate: row[31] || '',
    poReceivedDate: row[32] || '',
    poStatus: row[37] || '',
    poWStatus: row[38] || '',
    poUserId: row[39] || '',
    poUserName: row[41] || '',
  }
}

// POLists columns (subset used):
// 0:POL_ID 1:POL_PO_Number_FK 2:POL_Company_ID_FK 3:pol_pr_id 6:POL_Item_ID_FK
// 7:POL_Item_Name 9:POL_ItemType_ID_FK 15:POL_ItemQty 16:POL_ItemPrice
// 24:POL_Total 26:POL_PRJ_ID_FK 29:POL_Location_ID_FK 31:POL_DeletedAt
export function mapPoLine(row: string[]): PoLine {
  return {
    polId: row[0] || '',
    polPoNumber: row[1] || '',
    polVendorId: row[2] || '',
    polPrId: row[3] || '',
    polItemId: row[6] || '',
    polItemName: row[7] || '',
    polItemTypeId: row[9] || '',
    polQty: parseNum(row[15]),
    polPrice: parseNum(row[16]),
    polTotal: parseNum(row[24]),
    polPrjId: row[26] || '',
    polLocationId: row[29] || '',
    deletedAt: row[31] || '',
  }
}

// Items columns:
// 0:Item_ID 1:Item_ItemType_ID_FK 3:Item_Name 4:item_brand 5:item_category
// 8:Item_ItemUnit_ID_FK 13:Item_DeletedAt
export function mapProcItem(row: string[]): ProcItem {
  return {
    itemId: row[0] || '',
    itemTypeId: row[1] || '',
    itemName: row[3] || '',
    itemBrand: row[4] || '',
    itemCategory: row[5] || '',
    itemUnit: row[8] || '',
  }
}
