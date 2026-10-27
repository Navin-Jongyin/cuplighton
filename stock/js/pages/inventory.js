import { getState, addRecord, persist } from "../store.js";
import { hydrateVariant, categoryName, brandName, deleteVariant } from "../db.js";
import { table, bindTableNav, statusChip, formatQty, formatMoney, pager, escapeHtml, modal, toast, field, icon } from "../ui.js";
import { paginate, stockStatus, uid, lotPickerHtml, formatLot } from "../utils.js";
import { can, currentUser } from "../auth.js";
import { writeAudit } from "../audit.js";
import { adjustStockTotal, receiveStock, defaultSite } from "../inventory-engine.js";

function createCustomDropdown({ container, name, placeholder, options, onSelect, initialValue = "", allowCustom = true }) {
  if (!container) return null;
  const wrap = document.createElement("div");
  wrap.className = "custom-dropdown-wrap";
  wrap.innerHTML = `
    <div class="custom-dropdown-input-group">
      <input type="text" class="scan-input" name="${name}" id="${name}Input" placeholder="${placeholder}" value="${escapeHtml(initialValue)}" autocomplete="off">
      <button type="button" class="custom-dropdown-arrow" aria-label="Toggle dropdown">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </div>
    <div class="custom-dropdown-menu"></div>
  `;

  container.appendChild(wrap);

  const input = wrap.querySelector("input");
  const arrow = wrap.querySelector(".custom-dropdown-arrow");
  const menu = wrap.querySelector(".custom-dropdown-menu");

  function renderMenu(filter = "") {
    const q = filter.trim().toLowerCase();
    const filtered = options.filter(
      (o) => !q || o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q))
    );

    let html = "";
    if (allowCustom && q && !options.some((o) => o.label.toLowerCase() === q)) {
      html += `<div class="custom-dropdown-item custom-dropdown-create" data-val="${escapeHtml(filter)}" data-label="${escapeHtml(filter)}" data-new="true">
        <span>+ Use "${escapeHtml(filter)}" (New)</span>
      </div>`;
    }

    if (filtered.length) {
      html += filtered
        .map(
          (o) => `
        <div class="custom-dropdown-item ${input.value === o.label ? "active" : ""}" data-val="${escapeHtml(
            o.value
          )}" data-label="${escapeHtml(o.label)}">
          <span>${escapeHtml(o.label)}</span>
          ${o.sub ? `<span class="item-sub">${escapeHtml(o.sub)}</span>` : ""}
        </div>
      `
        )
        .join("");
    } else if (!q) {
      html += `<div class="custom-dropdown-item text-muted" style="cursor:default">No options found</div>`;
    }

    menu.innerHTML = html;
  }

  function open() {
    renderMenu(input.value);
    wrap.classList.add("open");
  }
  function close() {
    wrap.classList.remove("open");
  }

  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  arrow.addEventListener("click", (e) => {
    e.stopPropagation();
    if (wrap.classList.contains("open")) close();
    else {
      input.focus();
      open();
    }
  });

  input.addEventListener("input", () => {
    open();
    renderMenu(input.value);
    if (onSelect) onSelect(input.value, false);
  });

  menu.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".custom-dropdown-item");
    if (!item) return;
    const val = item.dataset.val;
    const label = item.dataset.label || val;
    input.value = label;
    close();
    if (onSelect) onSelect(val, true, item.dataset.new === "true", label);
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) close();
  });

  return { input, wrap, getValue: () => input.value.trim(), setValue: (v) => { input.value = v; } };
}

export function render(root, ctx) {
  const s = getState();
  const q = (ctx.query.q || "").toLowerCase().trim();
  const selectedCategory = ctx.query.category || "";
  const selectedBrand = ctx.query.brand || "";

  const categories = (s.categories || []).filter((c) => c.active !== false);
  const brands = (s.brands || []).filter((b) => b.active !== false);

  const grouped = new Map();
  s.inventory.forEach((r) => {
    if (!r.quantity) return;
    const lot = String(r.lot || "").trim();
    const cur = grouped.get(r.variantId) || { variantId: r.variantId, quantity: 0, lots: [] };
    const existing = cur.lots.find((l) => l.lot === lot);
    if (existing) existing.quantity += r.quantity;
    else cur.lots.push({ lot, quantity: r.quantity });
    cur.quantity += r.quantity;
    grouped.set(r.variantId, cur);
  });

  const allRows = [...grouped.values()]
    .map((r) => {
      const v = hydrateVariant(s.variants.find((x) => x.id === r.variantId));
      return { ...r, v, lots: r.lots.sort((a, b) => String(a.lot).localeCompare(String(b.lot))) };
    })
    .filter((r) => r.v);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Stock</h1>
        <div class="page-sub">Current catalog stock levels & inventory list</div>
      </div>
      <div class="flex gap-8">
        <a class="btn" href="#/inventory/history">Movement history</a>
        ${can("receiving.do") ? `<a class="btn btn-primary" href="#/add-stock">+ Add New</a>` : ""}
      </div>
    </div>

    <form class="filter-bar" id="filter-form">
      <input name="q" id="qInput" value="${escapeHtml(ctx.query.q || "")}" placeholder="Search SKU / Name / Barcode" autocomplete="off">
      
      <div id="catFilterWrap" style="flex: 0 1 200px;"></div>
      <div id="brandFilterWrap" style="flex: 0 1 200px;"></div>

      <button type="button" class="btn" id="btnResetFilter">Reset Filter</button>
    </form>

    <div id="table-area"></div>
  `;

  const qInput = root.querySelector("#qInput");

  const catDD = createCustomDropdown({
    container: root.querySelector("#catFilterWrap"),
    name: "category",
    placeholder: "Filter Category",
    initialValue: "",
    allowCustom: false,
    options: categories.map((c) => ({ value: c.id, label: c.name })),
    onSelect: () => updateFilteredView(1),
  });

  const brandDD = createCustomDropdown({
    container: root.querySelector("#brandFilterWrap"),
    name: "brand",
    placeholder: "Filter Brand",
    initialValue: "",
    allowCustom: false,
    options: brands.map((b) => ({ value: b.id, label: b.name })),
    onSelect: () => updateFilteredView(1),
  });

  function updateFilteredView(pageNumber = 1) {
    const qVal = (qInput ? qInput.value : "").toLowerCase().trim();
    const catVal = (catDD ? catDD.getValue() : "").toLowerCase();
    const brandVal = (brandDD ? brandDD.getValue() : "").toLowerCase();

    let filtered = [...allRows];

    if (qVal) {
      filtered = filtered.filter((r) =>
        `${r.v.sku} ${r.v.productName} ${r.v.primaryBarcode} ${(r.lots || []).map((l) => l.lot).join(" ")}`.toLowerCase().includes(qVal)
      );
    }

    if (catVal) {
      filtered = filtered.filter((r) => {
        const cName = (categoryName(r.v.categoryId) || r.v.category || "").toLowerCase();
        return r.v.categoryId.toLowerCase() === catVal || cName.includes(catVal);
      });
    }

    if (brandVal) {
      filtered = filtered.filter((r) => {
        const bName = (brandName(r.v.brandId) || r.v.brand || "").toLowerCase();
        return r.v.brandId.toLowerCase() === brandVal || bName.includes(brandVal);
      });
    }

    const currentPaged = paginate(filtered, pageNumber, 50);
    const tableArea = root.querySelector("#table-area");

    if (tableArea) {
      tableArea.innerHTML = `${stockTableHtml(currentPaged.items)}${pager(currentPaged)}`;
      bindStockTable(tableArea, root, ctx);
      tableArea.querySelectorAll(".pager-btns button[data-page]").forEach((btn) => {
        btn.onclick = () => updateFilteredView(Number(btn.dataset.page));
      });
    }
  }

  // Reset Filter Button
  const btnReset = root.querySelector("#btnResetFilter");
  if (btnReset) {
    btnReset.onclick = () => {
      if (qInput) qInput.value = "";
      if (catDD) catDD.setValue("");
      if (brandDD) brandDD.setValue("");
      updateFilteredView(1);
      toast("Filters reset");
    };
  }

  // Instant Auto-Filter Event Listener for typing in search
  if (qInput) {
    qInput.addEventListener("input", () => updateFilteredView(1));
  }

  root.querySelector("#filter-form").onsubmit = (e) => {
    e.preventDefault();
    updateFilteredView(1);
  };

  updateFilteredView(Number(ctx.query.page || 1));
}

function stockTableHtml(rows) {
  if (!rows.length) {
    return `<div class="empty">No inventory items found matching your filters.</div>`;
  }
  const body = rows.map((r) => {
    const multi = (r.lots || []).length > 1;
    const lotLabel = multi ? `${r.lots.length} lots` : (r.lots[0]?.lot ? `Lot No. ${r.lots[0].lot}` : "—");
    const lotRows = multi
      ? r.lots.map((l) => `
        <tr class="stock-lot-row hidden" data-lots-for="${r.variantId}">
          <td></td>
          <td>${l.lot ? `Lot No. ${escapeHtml(l.lot)}` : "—"}</td>
          <td></td>
          <td></td>
          <td></td>
          <td class="num">${formatQty(l.quantity)}</td>
          <td></td>
          <td></td>
          <td></td>
          <td>
            <div class="flex gap-8 stock-actions">
              ${can("receiving.do") ? `<span class="btn btn-sm btn-primary stock-action-spacer">Fill stock</span>` : ""}
              <button class="btn btn-sm btn-edit-stock" data-id="${r.variantId}" data-lot="${escapeHtml(l.lot || "")}">Edit</button>
            </div>
          </td>
          <td></td>
        </tr>
      `).join("")
      : "";
    const defaultLot = r.lots[0]?.lot || "";
    return `
      <tr>
        <td>${escapeHtml(r.v.sku)}</td>
        <td>${escapeHtml(r.v.productName)}</td>
        <td>${escapeHtml(lotLabel)}</td>
        <td>${escapeHtml(categoryName(r.v.categoryId) || r.v.category || "—")}</td>
        <td>${escapeHtml(brandName(r.v.brandId) || r.v.brand || "—")}</td>
        <td class="num">${formatQty(r.quantity)}</td>
        <td class="num">${formatMoney(r.v.sellingPrice || 0)}</td>
        <td class="num">${can("products.cost") ? formatMoney(r.v.costPrice || 0) : "—"}</td>
        <td>${statusChip(stockStatus(r.quantity, r.v.reorderLevel, r.v.minStock))}</td>
        <td>
          <div class="flex gap-8 stock-actions">
            ${can("receiving.do") ? `<button class="btn btn-sm btn-primary btn-fill-stock" data-id="${r.variantId}" data-lot="${escapeHtml(defaultLot)}" data-name="${escapeHtml(r.v.productName)}" data-sku="${escapeHtml(r.v.sku)}">Fill stock</button>` : ""}
            <button class="btn btn-sm btn-edit-stock" data-id="${r.variantId}" data-lot="${escapeHtml(defaultLot)}">Edit</button>
            ${can("products.edit") ? `<button class="btn btn-sm btn-icon-del btn-delete-stock" data-id="${r.variantId}" data-name="${escapeHtml(r.v.productName)}" data-sku="${escapeHtml(r.v.sku)}" aria-label="Delete" title="Delete">${icon("trash")}</button>` : ""}
          </div>
        </td>
        <td class="lot-arrow-cell">
          ${multi ? `<button type="button" class="lot-toggle" data-expand="${r.variantId}" aria-expanded="false" aria-label="Show lots"><svg class="lot-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>` : ""}
        </td>
      </tr>
      ${lotRows}
    `;
  }).join("");

  return `<div class="table-wrap"><table class="data-table stock-table">
    <thead><tr>
      <th>SKU</th><th>Product Name</th><th>Lot</th><th>Category</th><th>Brand</th>
      <th class="num">Qty</th><th class="num">Price</th><th class="num">Cost</th><th>Status</th><th>Action</th><th></th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function bindStockTable(tableArea, root, ctx) {
  tableArea.querySelectorAll(".lot-toggle").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.expand;
      const details = tableArea.querySelectorAll(`[data-lots-for="${id}"]`);
      if (!details.length) return;
      const willHide = !details[0].classList.contains("hidden");
      details.forEach((row) => row.classList.toggle("hidden", willHide));
      btn.setAttribute("aria-expanded", willHide ? "false" : "true");
      btn.classList.toggle("open", !willHide);
    };
  });
  tableArea.querySelectorAll(".btn-fill-stock").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openFillStockModal(btn.dataset.id, root, ctx, btn.dataset.lot || "", btn.dataset.name, btn.dataset.sku);
    };
  });
  tableArea.querySelectorAll(".btn-edit-stock").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id, root, ctx, btn.dataset.lot || "");
    };
  });
  tableArea.querySelectorAll(".btn-delete-stock").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      confirmAndDeleteProduct(btn.dataset.id, btn.dataset.name, btn.dataset.sku, root, ctx);
    };
  });
}

async function openFillStockModal(variantId, root, ctx, existingLot = "", productName = "", sku = "") {
  const s = getState();
  const vRec = s.variants.find((x) => x.id === variantId);
  if (!vRec) {
    toast("Product not found", "error");
    return;
  }
  const name = productName || vRec.name || sku || vRec.sku;

  const res = await modal({
    title: "Fill stock",
    body: `
      <form id="fill-stock-form" class="stack-form">
        <p class="mb-12"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(vRec.sku)}</p>
        ${field("Quantity to add", "qty", { type: "number", value: "", extra: 'min="1" required placeholder="Enter quantity"' })}
        <div class="mt-12">${lotPickerHtml({ value: existingLot, namePrefix: "lot" })}</div>
      </form>
    `,
    actions: [
      { id: "save", label: "Fill stock", primary: true },
      { id: "cancel", label: "Cancel" },
    ],
  });

  if (res?.action !== "save" || !res.form) return;
  const fd = new FormData(res.form);
  const qty = Number(fd.get("qty") || 0);
  const lot = formatLot(fd.get("lotNumber"), fd.get("lotMonth"), fd.get("lotYear"));
  if (!qty || qty < 1) {
    toast("Enter a quantity to add", "error");
    return;
  }
  if (!lot) {
    toast("Enter lot number, month, and year", "error");
    return;
  }
  try {
    const site = defaultSite();
    receiveStock({
      variantId: vRec.id,
      warehouseId: site.warehouseId,
      locationId: site.locationId,
      lot,
      qty,
      userId: currentUser().id,
      referenceType: "IN",
      referenceId: "",
      reason: "Fill stock",
    });
    writeAudit({
      userId: currentUser().id,
      action: "RECEIVE",
      module: "INVENTORY",
      recordType: "inventory",
      recordId: vRec.id,
      newValue: `+${qty} ${vRec.sku} lot ${lot}`,
    });
    toast(`Filled +${qty} pcs for "${name}" (lot ${lot})`);
    render(root, ctx);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function openEditModal(variantId, root, ctx, lot = "") {
  const s = getState();
  const vRec = s.variants.find((x) => x.id === variantId);
  if (!vRec) {
    toast("Variant not found", "error");
    return;
  }

  const pRec = s.products.find((x) => x.id === vRec.productId) || {};
  const categories = (s.categories || []).filter((c) => c.active !== false);
  const brands = (s.brands || []).filter((b) => b.active !== false);
  const lotKey = String(lot || "").trim();

  const curCatName = categoryName(pRec.categoryId) || pRec.category || "";
  const curBrandName = brandName(pRec.brandId) || pRec.brand || "";
  const curStockQty = s.inventory
    .filter((r) => r.variantId === vRec.id && String(r.lot || "").trim() === lotKey)
    .reduce((acc, r) => acc + (r.quantity || 0), 0);

  const modalBody = `
    <form id="edit-stock-form" class="stack-form">
      <div class="form-row">
        ${field("Product Name", "name", { value: pRec.name || vRec.name || "", required: true })}
        ${field("SKU", "sku", { value: vRec.sku || "", required: true })}
      </div>
      <div class="form-row mt-12">
        <div class="field">
          <label>Category</label>
          <div id="modalCatWrap"></div>
        </div>
        <div class="field">
          <label>Brand</label>
          <div id="modalBrandWrap"></div>
        </div>
      </div>
      <div class="mt-12">${lotPickerHtml({ value: lotKey, namePrefix: "lot" })}</div>
      <div class="form-row mt-12">
        ${field("Stock Quantity (On Hand)", "stockQty", { type: "number", value: curStockQty, extra: 'min="0" required' })}
        ${field("Selling Price ($)", "sellingPrice", { type: "number", value: vRec.sellingPrice || 0, extra: 'step="0.01" min="0"' })}
        ${field("Cost Price ($)", "costPrice", { type: "number", value: vRec.costPrice || 0, extra: 'step="0.01" min="0"' })}
      </div>
      <div class="form-row mt-12">
        ${field("Reorder Level", "reorderLevel", { type: "number", value: vRec.reorderLevel || 10, extra: 'min="0"' })}
        ${field("Min Stock", "minStock", { type: "number", value: vRec.minStock || 5, extra: 'min="0"' })}
      </div>
    </form>
  `;

  // Attach modal elements and initialize custom dropdowns
  const modalPromise = modal({
    title: `Edit Stock Item: ${vRec.sku}`,
    body: modalBody,
    wide: true,
    actions: [
      { id: "save", label: "Save Changes", primary: true },
      ...(can("products.edit") ? [{ id: "delete", label: "Delete Product", danger: true }] : []),
      { id: "cancel", label: "Cancel" },
    ],
  });

  const modalCatDD = createCustomDropdown({
    container: document.querySelector("#modalCatWrap"),
    name: "category",
    placeholder: "Select or type Category",
    initialValue: curCatName,
    options: categories.map((c) => ({ value: c.id, label: c.name })),
  });

  const modalBrandDD = createCustomDropdown({
    container: document.querySelector("#modalBrandWrap"),
    name: "brand",
    placeholder: "Select or type Brand",
    initialValue: curBrandName,
    options: brands.map((b) => ({ value: b.id, label: b.name })),
  });

  const res = await modalPromise;

  if (res?.action === "delete") {
    await confirmAndDeleteProduct(vRec.id, pRec.name || vRec.name || "", vRec.sku, root, ctx);
    return;
  }

  if (res?.action === "save" && res.form) {
    const fd = new FormData(res.form);
    const newName = fd.get("name")?.trim();
    const newSku = fd.get("sku")?.trim();
    const newCat = modalCatDD ? modalCatDD.getValue() : fd.get("category")?.trim();
    const newBrand = modalBrandDD ? modalBrandDD.getValue() : fd.get("brand")?.trim();
    const newSellingPrice = Number(fd.get("sellingPrice") || 0);
    const newCostPrice = Number(fd.get("costPrice") || 0);
    const newReorderLevel = Number(fd.get("reorderLevel") || 10);
    const newMinStock = Number(fd.get("minStock") || 5);
    const newStockQtyStr = fd.get("stockQty");
    const editedLot = formatLot(fd.get("lotNumber"), fd.get("lotMonth"), fd.get("lotYear")) || lotKey;

    if (!newName || !newSku) {
      toast("Product Name and SKU are required", "error");
      return;
    }

    // Process Stock Quantity Update if modified
    if (newStockQtyStr !== null && newStockQtyStr !== undefined && newStockQtyStr !== "") {
      const newStockQty = Number(newStockQtyStr);
      if (Number.isFinite(newStockQty) && newStockQty >= 0 && (newStockQty !== curStockQty || editedLot !== lotKey)) {
        try {
          if (editedLot !== lotKey && curStockQty > 0) {
            try {
              adjustStockTotal({
                variantId: vRec.id,
                newQty: 0,
                userId: currentUser().id,
                reason: "Manual Edit",
                notes: "Lot changed via Edit Modal",
                lot: lotKey,
              });
            } catch (_) { /* old lot already empty */ }
          }
          adjustStockTotal({
            variantId: vRec.id,
            newQty: newStockQty,
            userId: currentUser().id,
            reason: "Manual Edit",
            notes: "Stock updated via Edit Modal",
            lot: editedLot,
          });
          toast(`Stock adjusted: ${curStockQty} -> ${newStockQty} pcs`);
        } catch (err) {
          toast(err.message, "error");
        }
      }
    }

    // Resolve Category
    let categoryId = pRec.categoryId || "";
    if (newCat) {
      let existingCat = s.categories.find(
        (c) => c.id === newCat || c.name.toLowerCase() === newCat.toLowerCase()
      );
      if (!existingCat) {
        existingCat = addRecord("categories", { id: uid("cat"), name: newCat, active: true });
        toast(`Saved new category "${newCat}"`);
      }
      categoryId = existingCat.id;
    }

    // Resolve Brand
    let brandId = pRec.brandId || "";
    if (newBrand) {
      let existingBrand = s.brands.find(
        (b) => b.id === newBrand || b.name.toLowerCase() === newBrand.toLowerCase()
      );
      if (!existingBrand) {
        existingBrand = addRecord("brands", { id: uid("br"), name: newBrand, active: true });
        toast(`Saved new brand "${newBrand}"`);
      }
      brandId = existingBrand.id;
    }

    // Update Product Record
    pRec.name = newName;
    if (categoryId) pRec.categoryId = categoryId;
    if (brandId) pRec.brandId = brandId;

    // Update Variant Record
    vRec.name = newName;
    vRec.sku = newSku;
    vRec.sellingPrice = newSellingPrice;
    vRec.costPrice = newCostPrice;
    vRec.reorderLevel = newReorderLevel;
    vRec.minStock = newMinStock;

    persist(true);

    writeAudit({
      userId: currentUser().id,
      action: "UPDATE",
      module: "INVENTORY",
      recordType: "product_variant",
      recordId: vRec.id,
      newValue: `${newName} (${newSku})`,
    });

    toast(`Updated "${newName}"`);
    render(root, ctx);
  }
}

async function confirmAndDeleteProduct(variantId, productName, sku, root, ctx) {
  if (!can("products.edit")) {
    toast("You do not have permission to delete products.", "error");
    return;
  }
  const confirmRes = await modal({
    title: "Delete Product",
    body: `<p>Are you sure you want to delete product <strong>"${escapeHtml(productName)}"</strong> (SKU: ${escapeHtml(sku)})?</p>
           <p class="text-danger mt-8">This action cannot be undone and will permanently remove this item, its stock levels, and associated barcodes.</p>`,
    actions: [
      { id: "confirm", label: "Delete Product", danger: true },
      { id: "cancel", label: "Cancel" },
    ],
  });

  if (confirmRes?.action === "confirm") {
    const success = deleteVariant(variantId);
    if (success) {
      writeAudit({
        userId: currentUser().id,
        action: "DELETE",
        module: "INVENTORY",
        recordType: "product_variant",
        recordId: variantId,
        newValue: `${productName} (${sku})`,
      });
      toast(`Deleted product "${productName}"`);
      render(root, ctx);
    } else {
      toast("Failed to delete product", "error");
    }
  }
}
