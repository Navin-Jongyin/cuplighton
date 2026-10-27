/**
 * Empty starting store — add categories, products, and stock via the UI.
 */
import { SCHEMA_VERSION, DEFAULT_SETTINGS } from "./config.js";

export function buildSeed() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    session: null,
    users: [
      { id: "u_admin", pin: "123456", username: "admin", name: "Admin", role: "ADMIN", active: true },
    ],
    units: [],
    categories: [],
    brands: [],
    warehouses: [
      { id: "wh_main", code: "MAIN", name: "Warehouse", address: "Main Warehouse", active: true },
    ],
    locations: [
      { id: "loc_stock", warehouseId: "wh_main", code: "STOCK", name: "Stock Location", parentId: null, type: "BIN", active: true },
    ],
    suppliers: [],
    customers: [],
    products: [],
    variants: [],
    packaging: [],
    barcodes: [],
    serials: [],
    inventory: [],
    damagedStock: [],
    movements: [],
    purchaseOrders: [],
    purchaseOrderItems: [],
    goodsReceipts: [],
    goodsReceiptItems: [],
    salesOrders: [],
    salesOrderItems: [],
    pickLists: [],
    pickListItems: [],
    stockTransfers: [],
    stockTransferItems: [],
    stockAdjustments: [],
    stockCounts: [],
    stockCountItems: [],
    returns: [],
    auditLogs: [],
    invoices: [],
    taxInvoices: [],
    quotations: [],
  };
}
