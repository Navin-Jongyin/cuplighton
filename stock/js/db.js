import { getState, addRecord, updateRecord, persist } from "./store.js";
import { stockStatus, tokenize, normalizeBarcode, cmp, paginate } from "./utils.js";
import { PAGE_SIZE } from "./config.js";
import { qtyOnHand, locationsForVariant } from "./inventory-engine.js";

export function variantById(id) {
  return getState().variants.find((v) => v.id === id) || null;
}

export function productById(id) {
  return getState().products.find((p) => p.id === id) || null;
}

export function categoryName(id) {
  return getState().categories.find((c) => c.id === id)?.name || "—";
}

export function brandName(id) {
  return getState().brands.find((b) => b.id === id)?.name || "—";
}

export function unitCode(id) {
  return getState().units.find((u) => u.id === id)?.code || "pcs";
}

export function warehouseName(id) {
  return getState().warehouses.find((w) => w.id === id)?.name || "—";
}

export function locationById(id) {
  return getState().locations.find((l) => l.id === id) || null;
}

export function locationCode(id) {
  return locationById(id)?.code || "—";
}

export function hydrateVariant(v) {
  if (!v) return null;
  const product = productById(v.productId);
  const qty = qtyOnHand(v.id);
  return {
    ...v,
    product,
    productName: product?.name || v.name,
    categoryId: product?.categoryId,
    category: categoryName(product?.categoryId),
    brand: brandName(product?.brandId),
    brandId: product?.brandId,
    unit: unitCode(product?.baseUnitId),
    stock: qty,
    status: stockStatus(qty, v.reorderLevel, v.minStock),
    barcodes: getState().barcodes.filter((b) => b.variantId === v.id),
    packaging: getState().packaging.filter((p) => p.variantId === v.id),
    locations: locationsForVariant(v.id),
    primaryBarcode: getState().barcodes.find((b) => b.variantId === v.id && b.type === "INDIVIDUAL")?.barcode || "",
  };
}

export function lookupBarcode(code) {
  const bar = normalizeBarcode(code);
  if (!bar) return null;
  const rec = getState().barcodes.find((b) => b.barcode === bar);
  if (!rec) return null;
  const variant = hydrateVariant(variantById(rec.variantId));
  const pack = getState().packaging.find((p) => p.id === rec.packagingId);
  return {
    barcode: rec,
    variant,
    packaging: pack,
    qtyInBase: rec.qtyInBase,
    type: rec.type,
  };
}

export function lookupSku(sku) {
  const s = String(sku || "").trim().toLowerCase();
  const v = getState().variants.find((x) => x.sku.toLowerCase() === s);
  return v ? hydrateVariant(v) : null;
}

/**
 * Fast product search. Barcode exact match is tried first.
 */
export function searchVariants(query, { categoryId, brandId, status, activeOnly = true } = {}) {
  const q = String(query || "").trim();
  let list = getState().variants.filter((v) => !activeOnly || v.active);
  if (q) {
    const hit = lookupBarcode(q);
    if (hit) return [hit.variant];
    const skuHit = lookupSku(q);
    if (skuHit) list = [getState().variants.find((v) => v.id === skuHit.id)];
    else {
      const tokens = tokenize(q);
      list = list.filter((v) => {
        const p = productById(v.productId);
        const hay = [
          v.sku, v.name, p?.name, brandName(p?.brandId), categoryName(p?.categoryId),
          ...getState().barcodes.filter((b) => b.variantId === v.id).map((b) => b.barcode),
        ].join(" ").toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
  }
  if (categoryId) list = list.filter((v) => productById(v.productId)?.categoryId === categoryId);
  if (brandId) list = list.filter((v) => productById(v.productId)?.brandId === brandId);
  const hydrated = list.map(hydrateVariant);
  if (status) return hydrated.filter((v) => v.status === status);
  return hydrated;
}

export function listVariantsPaged(opts = {}) {
  const { sort = "sku", dir = "asc", page = 1, size = PAGE_SIZE } = opts;
  let rows = searchVariants(opts.q, opts);
  rows.sort((a, b) => cmp(a[sort], b[sort]) * (dir === "desc" ? -1 : 1));
  return { ...paginate(rows, page, size), rowsUnpaged: rows };
}

export function lowStockVariants() {
  return getState().variants
    .filter((v) => v.active)
    .map(hydrateVariant)
    .filter((v) => v.status === "LOW" || v.status === "OUT")
    .sort((a, b) => a.stock - b.stock);
}

export function movementsFor(variantId) {
  return getState().movements
    .filter((m) => !variantId || m.variantId === variantId)
    .slice()
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export function binLocations(warehouseId) {
  return getState().locations.filter((l) => l.active && l.type === "BIN" && (!warehouseId || l.warehouseId === warehouseId));
}

export function allLocations(warehouseId) {
  return getState().locations.filter((l) => l.active && (!warehouseId || l.warehouseId === warehouseId));
}

export function deleteVariant(variantId) {
  const s = getState();
  const v = s.variants.find((x) => x.id === variantId);
  if (!v) return false;

  const productId = v.productId;

  s.variants = s.variants.filter((x) => x.id !== variantId);

  if (Array.isArray(s.barcodes)) {
    s.barcodes = s.barcodes.filter((b) => b.variantId !== variantId);
  }

  if (Array.isArray(s.packaging)) {
    s.packaging = s.packaging.filter((p) => p.variantId !== variantId);
  }

  if (Array.isArray(s.inventory)) {
    s.inventory = s.inventory.filter((i) => i.variantId !== variantId);
  }

  if (productId && Array.isArray(s.products)) {
    const remaining = s.variants.some((x) => x.productId === productId);
    if (!remaining) {
      s.products = s.products.filter((p) => p.id !== productId);
    }
  }

  persist(true);
  return true;
}

export { paginate, PAGE_SIZE, addRecord, updateRecord, getState };
