import { getState, addRecord, updateRecord } from "../store.js";
import { hydrateVariant } from "../db.js";
import { qtyOnHand, adjustStockTotal, defaultSite } from "../inventory-engine.js";
import { can, currentUser } from "../auth.js";
import { writeAudit } from "../audit.js";
import { toast, escapeHtml, formatQty, confirmDialog } from "../ui.js";
import { onScan, focusScannerInput, stopCamera } from "../barcode.js";
import { uid, nextNumber } from "../utils.js";
import { go } from "../router.js";

let unsub = null;
export async function destroy() { if (unsub) unsub(); await stopCamera(); }

export function render(root, ctx) {
  if (!can("stockcount.do")) { root.innerHTML = `<p>No permission.</p>`; return; }
  const s = getState();
  if (ctx.params.id && ctx.params.id !== "new") return drawCount(root, ctx.params.id);
  if (ctx.path.endsWith("/new") || ctx.params.id === "new") return startForm(root);
  const rows = [...s.stockCounts].reverse();
  root.innerHTML = `
    <div class="page-header">
      <div><h1>Stock count</h1><div class="page-sub">Physical counts do not change inventory until confirmed</div></div>
      <a class="btn btn-primary" href="#/stock-count/new">New count</a>
    </div>
    ${rows.map((c) => `
      <a class="panel" href="#/stock-count/${c.id}" style="display:block;text-decoration:none;margin-bottom:8px">
        <div class="panel-b"><strong>${escapeHtml(c.number)}</strong> · ${escapeHtml(c.status)}
        <div class="text-muted">${escapeHtml(c.countedAt ? new Date(c.countedAt).toLocaleString() : "")}</div></div>
      </a>`).join("") || `<div class="empty">No counts.</div>`}
  `;
}

function startForm(root) {
  root.innerHTML = `
    <div class="page-header"><div><h1>New stock count</h1><div class="page-sub">Count every SKU with stock on hand</div></div></div>
    <form id="f">
      <button class="btn btn-primary" type="submit">Start count</button>
    </form>
  `;
  root.querySelector("#f").onsubmit = (e) => {
    e.preventDefault();
    const s = getState();
    const site = defaultSite();
    const sc = addRecord("stockCounts", {
      id: uid("sc"),
      number: nextNumber(s.stockCounts, "SC-"),
      warehouseId: site.warehouseId,
      locationId: site.locationId,
      status: "IN_PROGRESS",
      countedBy: currentUser().id,
      countedAt: new Date().toISOString(),
      confirmedBy: null,
      notes: "",
    });
    const totals = new Map();
    s.inventory.forEach((r) => {
      if (!r.quantity) return;
      totals.set(r.variantId, (totals.get(r.variantId) || 0) + r.quantity);
    });
    totals.forEach((qty, variantId) => {
      addRecord("stockCountItems", {
        id: uid("sci"), countId: sc.id, variantId,
        systemQty: qty, physicalQty: 0, difference: -qty, confirmed: false,
      });
    });
    go(`/stock-count/${sc.id}`);
  };
}

function drawCount(root, id) {
  if (unsub) unsub();
  const s = getState();
  const sc = s.stockCounts.find((c) => c.id === id);
  const items = s.stockCountItems.filter((i) => i.countId === id).map((i) => ({
    ...i, v: hydrateVariant(s.variants.find((x) => x.id === i.variantId)),
  })).filter((i) => i.v);
  const diffs = items.filter((i) => i.difference !== 0);
  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(sc.number)}</h1>
        <div class="page-sub">${escapeHtml(sc.status)}</div>
      </div>
    </div>
    <div id="msg"></div>
    ${sc.status !== "CONFIRMED" ? `<form class="toolbar"><input class="scan-input grow" data-scanner="true" placeholder="Scan product" autocomplete="off"></form>` : ""}
    ${items.map((i) => `
      <div class="pick-item ${i.difference ? "" : "done"}">
        <div class="flex justify-between">
          <div><strong>${escapeHtml(i.v.sku)}</strong><div>${escapeHtml(i.v.productName)}</div></div>
          <div class="text-right">
            <div>System: ${formatQty(i.systemQty)}</div>
            <div>Physical: <input type="number" data-id="${i.id}" value="${i.physicalQty}" style="width:80px" ${sc.status === "CONFIRMED" ? "disabled" : ""}></div>
            <div>Difference: ${i.difference}</div>
          </div>
        </div>
      </div>`).join("")}
    <p class="mt-12"><strong>${diffs.length} discrepancies found</strong></p>
    ${sc.status !== "CONFIRMED" && can("inventory.adjust") ? `<button class="btn btn-primary" id="review">Review / confirm adjustments</button>` : ""}
    ${sc.status !== "CONFIRMED" ? `<p class="text-muted">Counts do not change inventory until you confirm.</p>` : `<div class="banner">Count confirmed.</div>`}
  `;

  root.querySelectorAll("[data-id]").forEach((inp) => {
    inp.onchange = () => {
      const item = s.stockCountItems.find((x) => x.id === inp.dataset.id);
      const physical = Number(inp.value);
      updateRecord("stockCountItems", item.id, { physicalQty: physical, difference: physical - item.systemQty });
      drawCount(root, id);
    };
  });

  unsub = onScan(({ code, hit }) => {
    if (!hit) { toast("Unknown barcode", "error"); return; }
    let item = s.stockCountItems.find((i) => i.countId === id && i.variantId === hit.variant.id);
    const systemQty = qtyOnHand(hit.variant.id);
    if (!item) {
      item = addRecord("stockCountItems", {
        id: uid("sci"), countId: id, variantId: hit.variant.id,
        systemQty, physicalQty: 0, difference: 0, confirmed: false,
      });
    }
    const add = hit.qtyInBase || 1;
    const physical = item.physicalQty + add;
    updateRecord("stockCountItems", item.id, { physicalQty: physical, difference: physical - item.systemQty });
    toast(`${hit.variant.sku} physical ${physical}`);
    drawCount(root, id);
  });
  focusScannerInput();

  root.querySelector("#review")?.addEventListener("click", async () => {
    const fresh = getState().stockCountItems.filter((i) => i.countId === id);
    const d = fresh.filter((i) => i.difference !== 0);
    const ok = await confirmDialog(`${d.length} discrepancies. Confirming will post ADJUSTMENT movements. Continue?`);
    if (!ok) return;
    try {
      d.forEach((i) => {
        adjustStockTotal({
          variantId: i.variantId,
          newQty: i.physicalQty,
          userId: currentUser().id,
          reason: "Counting Error",
          notes: sc.number,
        });
        updateRecord("stockCountItems", i.id, { confirmed: true });
      });
      updateRecord("stockCounts", sc.id, { status: "CONFIRMED", confirmedBy: currentUser().id });
      writeAudit({ userId: currentUser().id, action: "CONFIRM", module: "STOCK_COUNT", recordType: "stock_count", recordId: sc.id, newValue: sc.number });
      toast("Count confirmed");
      drawCount(root, id);
    } catch (err) {
      toast(err.message, "error");
    }
  });
}
