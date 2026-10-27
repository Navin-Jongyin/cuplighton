import { getState, addRecord } from "../store.js";
import { lookupBarcode, hydrateVariant } from "../db.js";
import { qtyOnHand, adjustStockTotal, defaultSite } from "../inventory-engine.js";
import { can, currentUser } from "../auth.js";
import { writeAudit } from "../audit.js";
import { field, toast, escapeHtml, formatQty, table, formatDateTime } from "../ui.js";
import { ADJUST_REASONS } from "../config.js";
import { uid, nextNumber } from "../utils.js";
import { onScan, focusScannerInput } from "../barcode.js";

let unsub = null;
export function destroy() { if (unsub) unsub(); }

export function render(root, ctx) {
  if (!can("inventory.adjust")) { root.innerHTML = `<p>No permission to adjust stock.</p>`; return; }
  const s = getState();
  root.innerHTML = `
    <div class="page-header"><div><h1>Stock adjustment</h1><div class="page-sub">Requires a reason. Creates an ADJUSTMENT movement.</div></div></div>
    <form id="f">
      <div class="form-row">
        <div class="field"><label>Product</label><input class="scan-input" name="code" data-scanner="true" value="${escapeHtml(ctx.query.variant || "")}" placeholder="Scan or SKU" autocomplete="off"></div>
      </div>
      <dl class="kv" id="info"><dt>System stock</dt><dd>—</dd></dl>
      <div class="form-row">
        ${field("Actual stock", "actual", { type: "number", value: "" })}
        ${field("Reason", "reason", { options: [{ value: "", label: "-- Select Reason --" }].concat(ADJUST_REASONS.map((r) => ({ value: r, label: r }))) })}
      </div>
      ${field("Notes", "notes", { type: "textarea" })}
      <p>Difference: <strong id="diff">—</strong></p>
      <button class="btn btn-primary" type="submit">Confirm adjustment</button>
    </form>
    <h2 class="mt-16">Recent adjustments</h2>
    ${table({
      columns: [
        { label: "Number", value: (r) => r.number },
        { label: "SKU", value: (r) => s.variants.find((v) => v.id === r.variantId)?.sku },
        { label: "Before", num: true, value: (r) => r.qtyBefore },
        { label: "After", num: true, value: (r) => r.qtyAfter },
        { label: "Diff", num: true, value: (r) => r.qtyDiff },
        { label: "Reason", value: (r) => r.reason },
        { label: "Date", value: (r) => formatDateTime(r.createdAt) },
      ],
      rows: [...s.stockAdjustments].reverse(),
    })}
  `;
  let hit = null;
  const refreshInfo = () => {
    if (!hit) return;
    const qty = qtyOnHand(hit.variant.id);
    root.querySelector("#info").innerHTML = `<dt>Product</dt><dd>${escapeHtml(hit.variant.sku)} ${escapeHtml(hit.variant.productName)}</dd><dt>System stock</dt><dd>${formatQty(qty)}</dd>`;
    const actual = Number(root.querySelector("[name=actual]").value);
    if (Number.isFinite(actual)) root.querySelector("#diff").textContent = String(actual - qty);
    hit._qty = qty;
  };
  const apply = (code) => {
    hit = lookupBarcode(code);
    if (!hit) {
      const v = hydrateVariant(s.variants.find((x) => x.id === code || x.sku === code));
      if (v) hit = { variant: v };
    }
    if (!hit) { toast("Unknown barcode / SKU", "error"); return; }
    refreshInfo();
  };
  unsub = onScan(({ code }) => apply(code));
  if (ctx.query.variant) apply(ctx.query.variant);
  root.querySelector("[name=actual]").oninput = refreshInfo;
  focusScannerInput();
  root.querySelector("#f").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!hit) apply(fd.get("code"));
    if (!hit) return;
    refreshInfo();
    try {
      const site = defaultSite();
      const mv = adjustStockTotal({
        variantId: hit.variant.id,
        newQty: Number(fd.get("actual")),
        userId: currentUser().id,
        reason: fd.get("reason"),
        notes: fd.get("notes"),
      });
      addRecord("stockAdjustments", {
        id: uid("adj"),
        number: nextNumber(s.stockAdjustments, "ADJ-"),
        variantId: hit.variant.id,
        warehouseId: site.warehouseId,
        locationId: site.locationId,
        qtyBefore: hit._qty,
        qtyAfter: Number(fd.get("actual")),
        qtyDiff: Number(fd.get("actual")) - hit._qty,
        reason: fd.get("reason"),
        notes: fd.get("notes"),
        userId: currentUser().id,
        createdAt: mv.timestamp,
      });
      writeAudit({ userId: currentUser().id, action: "ADJUST", module: "INVENTORY", recordType: "stock_adjustment", recordId: mv.id, oldValue: String(hit._qty), newValue: fd.get("actual") });
      toast("Adjustment posted");
      render(root, ctx);
    } catch (err) {
      toast(err.message, "error");
    }
  };
}
