import { getState } from "./store.js";
import { InventoryError } from "./inventory-engine.js";

export function packagingFor(variantId) {
  return getState().packaging.filter((p) => p.variantId === variantId);
}

export function unitById(id) {
  return getState().units.find((u) => u.id === id) || { code: "pcs", name: "Piece" };
}

export function toBaseQty(variantId, qty, packagingId) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 0) throw new InventoryError("INVALID_QTY", "Invalid quantity.");
  if (!packagingId) return n;
  const pack = getState().packaging.find((p) => p.id === packagingId && p.variantId === variantId);
  if (!pack) throw new InventoryError("INVALID_QTY", "Unknown packaging unit.");
  return n * pack.qtyInBase;
}

export function formatPackDisplay(baseQty, variantId) {
  const packs = packagingFor(variantId).slice().sort((a, b) => b.qtyInBase - a.qtyInBase);
  const carton = packs.find((p) => p.qtyInBase >= 50);
  const box = packs.find((p) => p.qtyInBase > 1 && p.qtyInBase < 50) || packs.find((p) => p.qtyInBase > 1);
  if (box && baseQty >= box.qtyInBase && baseQty % box.qtyInBase === 0) {
    const boxes = baseQty / box.qtyInBase;
    const unit = unitById(box.unitId).code;
    return `${boxes} ${unit}${boxes === 1 ? "" : "s"} / ${baseQty} pcs`;
  }
  if (carton && baseQty >= carton.qtyInBase) {
    return `${Math.floor(baseQty / carton.qtyInBase)} carton / ${baseQty} pcs`;
  }
  return `${baseQty} pcs`;
}
