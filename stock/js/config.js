/**
 * Application configuration.
 *
 * INVENTORY VALUATION METHOD
 * --------------------------
 * Method: STANDARD COST
 * Formula: inventory_value = sum(quantity_on_hand * variant.costPrice)
 * across all sellable inventory records (excludes damaged stock).
 *
 * Cost price is stored on each product variant and is updated by
 * authorized users (ADMIN/MANAGER). This frontend is not the
 * authority for cost or stock; a backend must re-validate.
 *
 * Currency: Thai Baht (THB), displayed with ฿.
 */
export const APP_NAME = "Cuplighton Stock";
export const STORAGE_KEY = "cuplighton_wms_v1";
export const SCHEMA_VERSION = 6;
export const CURRENCY = "THB";
export const CURRENCY_SYMBOL = "฿";
export const PAGE_SIZE = 25;
export const SCANNER_CHAR_MS = 40;
export const SCANNER_MIN_LEN = 4;

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  WAREHOUSE: "WAREHOUSE",
  SALES: "SALES",
  VIEWER: "VIEWER",
};

export const PERMISSIONS = {
  "products.view": ["ADMIN", "MANAGER", "WAREHOUSE", "SALES", "VIEWER"],
  "products.edit": ["ADMIN", "MANAGER", "WAREHOUSE"],
  "products.cost": ["ADMIN", "MANAGER"],
  "inventory.view": ["ADMIN", "MANAGER", "WAREHOUSE", "SALES", "VIEWER"],
  "inventory.adjust": ["ADMIN", "MANAGER", "WAREHOUSE"],
  "receiving.do": ["ADMIN", "MANAGER", "WAREHOUSE"],
  "stockcount.do": ["ADMIN", "MANAGER", "WAREHOUSE"],
  "settings.edit": ["ADMIN"],
  "users.edit": ["ADMIN"],
  "scan.do": ["ADMIN", "MANAGER", "WAREHOUSE"],
};

export const MOVEMENT_TYPES = [
  "RECEIVE",
  "SALE",
  "PICK",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "DAMAGE",
  "LOSS",
  "ADJUSTMENT",
  "OPENING_BALANCE",
];

export const COUNT_STATUSES = ["DRAFT", "IN_PROGRESS", "REVIEW", "CONFIRMED", "CANCELLED"];
export const ADJUST_REASONS = ["Damaged", "Lost", "Counting Error", "Unknown", "Other"];

export const DEFAULT_SETTINGS = {
  companyName: "Cuplighton Lighting Co., Ltd.",
  allowNegativeStock: false,
  currency: "THB",
  scannerCharMs: SCANNER_CHAR_MS,
  defaultWarehouseId: "wh_main",
};
