import { getState } from "../store.js";
import { table, pager, formatDateTime, signQty, escapeHtml } from "../ui.js";
import { userName } from "../auth.js";
import { paginate } from "../utils.js";
import { MOVEMENT_TYPES } from "../config.js";

export function render(root, ctx) {
  const s = getState();
  const q = ctx.query;
  let rows = [...s.movements].sort((a, b) => String(b.timestamp).localeCompare(a.timestamp));
  if (q.type) rows = rows.filter((m) => m.type === q.type);
  if (q.user) rows = rows.filter((m) => m.userId === q.user);
  if (q.q) {
    const n = q.q.toLowerCase();
    rows = rows.filter((m) => {
      const v = s.variants.find((x) => x.id === m.variantId);
      return `${v?.sku} ${v?.name} ${m.referenceId} ${m.reason}`.toLowerCase().includes(n);
    });
  }
  const paged = paginate(rows, Number(q.page || 1), 50);
  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Stock movement history</h1>
        <div class="page-sub">Movements are never deleted</div>
      </div>
        <a class="btn" href="#/inventory">Back to stock</a>
    </div>
    <form class="filter-bar" id="f">
      <input name="q" value="${escapeHtml(q.q || "")}" placeholder="SKU, product, reference">
      <select name="type">
        <option value="">All types</option>
        ${MOVEMENT_TYPES.map((t) => `<option ${t === q.type ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <select name="user">
        <option value="">All users</option>
        ${s.users.map((u) => `<option value="${u.id}" ${u.id === q.user ? "selected" : ""}>${escapeHtml(u.name)}</option>`).join("")}
      </select>
      <button class="btn btn-primary">Filter</button>
    </form>
    ${table({
      columns: [
        { label: "Date", value: (m) => formatDateTime(m.timestamp) },
        { label: "User", value: (m) => userName(m.userId) },
        { label: "Product", value: (m) => s.variants.find((v) => v.id === m.variantId)?.name },
        { label: "SKU", value: (m) => s.variants.find((v) => v.id === m.variantId)?.sku },
        { label: "Lot", value: (m) => m.lot || "—" },
        { label: "Type", value: (m) => m.type },
        { label: "Qty", num: true, html: (m) => signQty(m.qty) },
        { label: "Before", num: true, value: (m) => m.qtyBefore },
        { label: "After", num: true, value: (m) => m.qtyAfter },
        { label: "Reference", value: (m) => m.referenceId || "—" },
        { label: "Reason", value: (m) => m.reason || "—" },
      ],
      rows: paged.items,
    })}
    ${pager(paged)}
  `;
  root.querySelector("#f").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams();
    for (const [k, v] of fd) if (v) p.set(k, v);
    location.hash = `/inventory/history?${p}`;
  };
}
