import { getState } from "../store.js";
import { inventoryValue, totalUnits } from "../inventory-engine.js";
import { lowStockVariants, movementsFor } from "../db.js";
import { kpi, table, bindTableNav, statusChip, formatMoney, formatQty, signQty, formatDateTime } from "../ui.js";
import { userName, can } from "../auth.js";

export function render(root) {
  const s = getState();
  const products = s.products.filter((p) => p.active).length;
  const variants = s.variants.filter((v) => v.active).length;
  const low = lowStockVariants();
  const recent = movementsFor().slice(0, 12);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Stock</h1>
        <div class="page-sub">Count, add, manage</div>
      </div>
      <div class="flex gap-8">
        ${can("receiving.do") ? `<a class="btn btn-primary" href="#/add-stock">Add stock</a>` : ""}
      </div>
    </div>
    <div class="kpi-grid">
      ${kpi("Products", products.toLocaleString(), `${variants} SKUs`)}
      ${kpi("On hand", totalUnits().toLocaleString(), "pcs")}
      ${kpi("Value", formatMoney(inventoryValue()), "standard cost")}
      ${kpi("Low stock", String(low.length), "at or below reorder")}
    </div>

    <div class="panel">
      <div class="panel-h"><span>Low stock</span></div>
      <div class="panel-b" style="padding:0">
        ${table({
          columns: [
            { label: "SKU", value: (r) => r.sku },
            { label: "Product", value: (r) => r.productName },
            { label: "Current stock", num: true, html: (r) => formatQty(r.stock, r.unit) },
            { label: "Reorder level", num: true, html: (r) => formatQty(r.reorderLevel, r.unit) },
            { label: "Status", html: (r) => statusChip(r.status) },
          ],
          rows: low.slice(0, 10),
          rowHref: (r) => `/products/${r.id}`,
          empty: "No low-stock items.",
        })}
      </div>
    </div>

    <div class="panel">
      <div class="panel-h"><span>Recent movements</span></div>
      <div class="panel-b" style="padding:0">
        ${table({
          columns: [
            { label: "Date/time", value: (m) => formatDateTime(m.timestamp) },
            { label: "User", value: (m) => userName(m.userId) },
            { label: "SKU", value: (m) => s.variants.find((v) => v.id === m.variantId)?.sku },
            { label: "Product", value: (m) => s.variants.find((v) => v.id === m.variantId)?.name },
            { label: "Type", value: (m) => m.type },
            { label: "Quantity", num: true, html: (m) => signQty(m.qty) },
          ],
          rows: recent,
          empty: "No movements yet.",
        })}
      </div>
    </div>
  `;
  bindTableNav(root);
}
