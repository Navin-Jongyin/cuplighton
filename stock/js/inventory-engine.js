/**
 * Central inventory engine.
 *
 * RULE: no module may write inventory quantities directly.
 * All stock changes must call applyMovement() or a helper below.
 *
 * Flow: validate → create movement → update inventory → audit.
 *
 * Server-side validation is still required when a backend is connected.
 * This frontend is not the security boundary.
 */
import { getState, persist } from "./store.js";
import { uid } from "./utils.js";
import { writeAudit } from "./audit.js";

const DECREASE = new Set([
  "SALE", "PICK", "TRANSFER_OUT", "SUPPLIER_RETURN", "DAMAGE", "LOSS",
]);
const INCREASE = new Set([
  "RECEIVE", "TRANSFER_IN", "CUSTOMER_RETURN", "OPENING_BALANCE",
]);

export class InventoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
  }
}

/** Hidden default bin. UI no longer asks for location. */
export function defaultSite() {
  const s = getState();
  const warehouse = s.warehouses[0];
  if (!warehouse) throw new InventoryError("MISSING_LOCATION", "No warehouse is configured.");
  const location = s.locations.find((l) => l.warehouseId === warehouse.id && l.type === "BIN" && l.active)
    || s.locations.find((l) => l.warehouseId === warehouse.id && l.active)
    || s.locations[0];
  if (!location) throw new InventoryError("MISSING_LOCATION", "No stock location is configured.");
  return { warehouseId: warehouse.id, locationId: location.id };
}

export function normalizeLot(lot) {
  return String(lot || "").trim();
}

export function getInventoryRecord(variantId, warehouseId, locationId, lot = "") {
  const s = getState();
  const lotKey = normalizeLot(lot);
  return s.inventory.find(
    (r) =>
      r.variantId === variantId &&
      r.warehouseId === warehouseId &&
      r.locationId === locationId &&
      normalizeLot(r.lot) === lotKey
  ) || null;
}

export function getOrCreateInventory(variantId, warehouseId, locationId, lot = "") {
  const lotKey = normalizeLot(lot);
  let rec = getInventoryRecord(variantId, warehouseId, locationId, lotKey);
  if (!rec) {
    rec = { id: uid("inv"), variantId, warehouseId, locationId, lot: lotKey, quantity: 0 };
    getState().inventory.push(rec);
  }
  return rec;
}

export function qtyOnHand(variantId, warehouseId = null, lot = null) {
  const lotKey = lot == null ? null : normalizeLot(lot);
  return getState().inventory
    .filter((r) =>
      r.variantId === variantId &&
      (!warehouseId || r.warehouseId === warehouseId) &&
      (lotKey == null || normalizeLot(r.lot) === lotKey)
    )
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
}

export function lotsForVariant(variantId) {
  const map = new Map();
  getState().inventory
    .filter((r) => r.variantId === variantId && Number(r.quantity) !== 0)
    .forEach((r) => {
      const lot = normalizeLot(r.lot);
      map.set(lot, (map.get(lot) || 0) + Number(r.quantity || 0));
    });
  return [...map.entries()].map(([lot, quantity]) => ({ lot, quantity }));
}

export function locationsForVariant(variantId) {
  return getState().inventory
    .filter((r) => r.variantId === variantId && r.quantity !== 0)
    .map((r) => ({ ...r }));
}

function signedQty(type, qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n === 0) {
    throw new InventoryError("INVALID_QTY", "Quantity must be a non-zero number.");
  }
  if (type === "ADJUSTMENT") return n;
  const abs = Math.abs(n);
  if (DECREASE.has(type)) return -abs;
  if (INCREASE.has(type)) return abs;
  throw new InventoryError("INVALID_TYPE", `Unknown movement type: ${type}`);
}

/**
 * Apply a single stock movement. This is the only write path for sellable inventory.
 */
export function applyMovement(input) {
  const s = getState();
  const {
    type,
    variantId,
    warehouseId,
    locationId,
    qty,
    userId,
    referenceType = "",
    referenceId = "",
    reason = "",
    notes = "",
    stockKind = "sellable",
    lot = "",
  } = input;
  const lotKey = normalizeLot(lot);

  if (!variantId) throw new InventoryError("INVALID_SKU", "Product variant is required.");
  if (!warehouseId) throw new InventoryError("MISSING_LOCATION", "Warehouse is required.");
  if (!locationId) throw new InventoryError("MISSING_LOCATION", "Location is required.");
  if (!userId) throw new InventoryError("NO_USER", "User is required for every stock movement.");
  if (!s.variants.some((v) => v.id === variantId)) {
    throw new InventoryError("INVALID_SKU", "Unknown product variant.");
  }

  const delta = signedQty(type, qty);
  let rec;
  let before;
  let after;

  if (stockKind === "damaged") {
    rec = s.damagedStock.find(
      (r) => r.variantId === variantId && r.warehouseId === warehouseId && r.locationId === locationId && normalizeLot(r.lot) === lotKey
    );
    if (!rec) {
      rec = { id: uid("dmg"), variantId, warehouseId, locationId, lot: lotKey, quantity: 0, reason: "", userId, createdAt: new Date().toISOString(), notes: "" };
      s.damagedStock.push(rec);
    }
    before = rec.quantity;
    after = before + delta;
  } else {
    rec = getOrCreateInventory(variantId, warehouseId, locationId, lotKey);
    before = rec.quantity;
    after = before + delta;
  }

  if (after < 0 && !s.settings.allowNegativeStock) {
    throw new InventoryError(
      "INSUFFICIENT_STOCK",
      `Insufficient stock. Available ${before} pcs at this location.`
    );
  }

  rec.quantity = after;

  const movement = {
    id: uid("mv"),
    type,
    variantId,
    warehouseId,
    locationId,
    qty: delta,
    qtyBefore: before,
    qtyAfter: after,
    userId,
    timestamp: new Date().toISOString(),
    referenceType,
    referenceId,
    reason,
    notes,
    stockKind,
    lot: lotKey,
  };
  s.movements.push(movement);

  writeAudit({
    userId,
    action: type,
    module: "INVENTORY",
    recordType: "inventory_movement",
    recordId: movement.id,
    oldValue: String(before),
    newValue: String(after),
  });

  persist();
  return movement;
}

export function receiveStock(opts) {
  return applyMovement({ ...opts, type: "RECEIVE" });
}

export function pickStock(opts) {
  return applyMovement({ ...opts, type: "PICK" });
}

export function saleStock(opts) {
  return applyMovement({ ...opts, type: "SALE" });
}

export function transferStock({
  variantId, qty, userId, fromWarehouseId, fromLocationId, toWarehouseId, toLocationId, referenceId, notes,
}) {
  if (fromWarehouseId === toWarehouseId && fromLocationId === toLocationId) {
    throw new InventoryError("INVALID_LOCATION", "Source and destination locations must differ.");
  }
  const outMv = applyMovement({
    type: "TRANSFER_OUT",
    variantId,
    warehouseId: fromWarehouseId,
    locationId: fromLocationId,
    qty,
    userId,
    referenceType: "TR",
    referenceId,
    reason: "Transfer out",
    notes,
  });
  const inMv = applyMovement({
    type: "TRANSFER_IN",
    variantId,
    warehouseId: toWarehouseId,
    locationId: toLocationId,
    qty,
    userId,
    referenceType: "TR",
    referenceId,
    reason: "Transfer in",
    notes,
  });
  return { outMv, inMv };
}

export function adjustStock({ variantId, warehouseId, locationId, newQty, userId, reason, notes, lot = "" }) {
  if (!reason) throw new InventoryError("REASON_REQUIRED", "Stock adjustments require a reason.");
  const rec = getOrCreateInventory(variantId, warehouseId, locationId, lot);
  const diff = Number(newQty) - rec.quantity;
  if (diff === 0) throw new InventoryError("NO_CHANGE", "New quantity equals current stock.");
  return applyMovement({
    type: "ADJUSTMENT",
    variantId,
    warehouseId,
    locationId,
    lot,
    qty: diff,
    userId,
    referenceType: "ADJ",
    referenceId: "",
    reason,
    notes,
  });
}

/** Set on-hand total for a SKU. Location is not shown in the UI. */
export function adjustStockTotal({ variantId, newQty, userId, reason, notes, lot = null }) {
  if (!reason) throw new InventoryError("REASON_REQUIRED", "Stock adjustments require a reason.");
  const total = qtyOnHand(variantId, null, lot);
  const diff = Number(newQty) - total;
  if (diff === 0) throw new InventoryError("NO_CHANGE", "New quantity equals current stock.");
  const site = defaultSite();
  const lotKey = lot == null ? "" : normalizeLot(lot);
  if (diff > 0) {
    return applyMovement({
      type: "ADJUSTMENT",
      variantId,
      warehouseId: site.warehouseId,
      locationId: site.locationId,
      lot: lotKey,
      qty: diff,
      userId,
      referenceType: "ADJ",
      referenceId: "",
      reason,
      notes,
    });
  }
  let remaining = -diff;
  let last = null;
  const recs = getState().inventory
    .filter((r) =>
      r.variantId === variantId &&
      r.quantity > 0 &&
      (lot == null || normalizeLot(r.lot) === normalizeLot(lot))
    )
    .sort((a, b) => b.quantity - a.quantity);
  for (const rec of recs) {
    if (remaining <= 0) break;
    const take = Math.min(rec.quantity, remaining);
    last = applyMovement({
      type: "ADJUSTMENT",
      variantId,
      warehouseId: rec.warehouseId,
      locationId: rec.locationId,
      lot: rec.lot,
      qty: -take,
      userId,
      referenceType: "ADJ",
      referenceId: "",
      reason,
      notes,
    });
    remaining -= take;
  }
  if (remaining > 0) {
    last = applyMovement({
      type: "ADJUSTMENT",
      variantId,
      warehouseId: site.warehouseId,
      locationId: site.locationId,
      lot: lotKey,
      qty: -remaining,
      userId,
      referenceType: "ADJ",
      referenceId: "",
      reason,
      notes,
    });
  }
  return last;
}

export function damageStock({ variantId, warehouseId, locationId, qty, userId, reason, notes }) {
  const out = applyMovement({
    type: "DAMAGE",
    variantId,
    warehouseId,
    locationId,
    qty,
    userId,
    referenceType: "DMG",
    reason,
    notes,
  });
  const dmgLoc = getState().locations.find((l) => l.warehouseId === warehouseId && l.code === "DMG")
    || { id: locationId, warehouseId };
  applyMovement({
    type: "RECEIVE",
    variantId,
    warehouseId: dmgLoc.warehouseId,
    locationId: dmgLoc.id,
    qty,
    userId,
    referenceType: "DMG",
    referenceId: out.id,
    reason,
    notes: "Moved to damaged stock",
    stockKind: "damaged",
  });
  const rec = getState().damagedStock.find((r) => r.id && r.variantId === variantId && r.locationId === dmgLoc.id);
  if (rec) {
    rec.reason = reason;
    rec.notes = notes || "";
    rec.userId = userId;
  }
  persist();
  return out;
}

export function customerReturn({ variantId, warehouseId, locationId, qty, userId, condition, reason, notes, referenceId }) {
  if (condition === "GOOD") {
    return applyMovement({
      type: "CUSTOMER_RETURN",
      variantId,
      warehouseId,
      locationId,
      qty,
      userId,
      referenceType: "RMA",
      referenceId,
      reason,
      notes,
    });
  }
  return applyMovement({
    type: "CUSTOMER_RETURN",
    variantId,
    warehouseId,
    locationId,
    qty,
    userId,
    referenceType: "RMA",
    referenceId,
    reason,
    notes: `${notes || ""} [${condition} — not sellable]`.trim(),
    stockKind: "damaged",
  });
}

export function supplierReturn(opts) {
  return applyMovement({ ...opts, type: "SUPPLIER_RETURN" });
}

export function inventoryValue() {
  const s = getState();
  const cost = new Map(s.variants.map((v) => [v.id, Number(v.costPrice) || 0]));
  return s.inventory.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (cost.get(r.variantId) || 0), 0);
}

export function totalUnits() {
  return getState().inventory.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
}
