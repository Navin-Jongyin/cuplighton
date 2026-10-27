import { getState } from "../store.js";
import { listVariantsPaged } from "../db.js";
import { table, bindTableNav, pager, statusChip, formatQty, escapeHtml } from "../ui.js";
import { can } from "../auth.js";

export function render(root, ctx) {
  const q = ctx.query;
  const state = {
    q: q.q || "",
    categoryId: q.category || "",
    brandId: q.brand || "",
    status: q.status || "",
    sort: q.sort || "sku",
    dir: q.dir || "asc",
    page: Number(q.page || 1),
  };
  draw(root, state);
}

function draw(root, state) {
  const s = getState();
  const result = listVariantsPaged(state);
  const cats = s.categories.filter((c) => c.active);
  const brands = s.brands.filter((b) => b.active);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Products</h1>
        <div class="page-sub">${result.total} SKUs</div>
      </div>
      ${can("products.edit") ? `<a class="btn btn-primary" href="#/products/new">Add product</a>` : ""}
    </div>
    <form class="filter-bar" id="filters">
      <input name="q" value="${escapeHtml(state.q)}" placeholder="Name, SKU, barcode, brand, category" style="flex:1;min-width:180px">
      <select name="categoryId">
        <option value="">All categories</option>
        ${cats.map((c) => `<option value="${c.id}" ${c.id === state.categoryId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
      </select>
      <select name="brandId">
        <option value="">All brands</option>
        ${brands.map((b) => `<option value="${b.id}" ${b.id === state.brandId ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}
      </select>
      <select name="status">
        <option value="">All stock</option>
        ${["OK", "LOW", "OUT"].map((x) => `<option ${x === state.status ? "selected" : ""}>${x}</option>`).join("")}
      </select>
      <button class="btn btn-primary" type="submit">Filter</button>
    </form>
    ${table({
      columns: [
        { label: "SKU", sortKey: "sku", value: (r) => r.sku },
        { label: "Product", sortKey: "productName", value: (r) => r.productName },
        { label: "Barcode", value: (r) => r.primaryBarcode },
        { label: "Category", value: (r) => r.category },
        { label: "Brand", value: (r) => r.brand },
        { label: "Unit", value: (r) => r.unit },
        { label: "Stock", num: true, sortKey: "stock", html: (r) => formatQty(r.stock, r.unit) },
        { label: "Status", html: (r) => statusChip(r.status) },
        { label: "Actions", html: (r) => `
          <a class="btn btn-sm" href="#/products/${r.id}">View</a>
          ${can("products.edit") ? `<a class="btn btn-sm" href="#/products/${r.id}/edit">Edit</a>` : ""}
        ` },
      ],
      rows: result.items,
      rowHref: (r) => `/products/${r.id}`,
      empty: "No products match.",
    })}
    ${pager(result)}
  `;
  bindTableNav(root);
  root.querySelector("#filters").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Object.assign(state, { q: fd.get("q"), categoryId: fd.get("categoryId"), brandId: fd.get("brandId"), status: fd.get("status"), page: 1 });
    draw(root, state);
  };
  root.querySelectorAll("[data-page]").forEach((b) => {
    b.onclick = () => { state.page = Number(b.dataset.page); draw(root, state); };
  });
  root.querySelectorAll("th.sortable").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.sort;
      state.dir = state.sort === k && state.dir === "asc" ? "desc" : "asc";
      state.sort = k;
      draw(root, state);
    };
  });
}
