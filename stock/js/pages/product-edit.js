import { getState, addRecord, updateRecord, persist } from "../store.js";
import { hydrateVariant } from "../db.js";
import { can, currentUser, requirePermission } from "../auth.js";
import { writeAudit } from "../audit.js";
import { field, toast, escapeHtml, formValues, optionList } from "../ui.js";
import { uid } from "../utils.js";
import { go } from "../router.js";

export function render(root, ctx) {
  if (!can("products.edit")) {
    root.innerHTML = `<p>You cannot edit products.</p>`;
    return;
  }
  const isNew = !ctx.params.id;
  const variant = isNew ? null : getState().variants.find((v) => v.id === ctx.params.id);
  const product = variant ? getState().products.find((p) => p.id === variant.productId) : null;
  const s = getState();
  const specs = variant?.specs?.length ? [...variant.specs] : [{ key: "Wattage", value: "" }, { key: "CCT", value: "" }];
  const barcodes = variant ? s.barcodes.filter((b) => b.variantId === variant.id) : [
    { type: "INDIVIDUAL", barcode: "", qtyInBase: 1 },
    { type: "BOX", barcode: "", qtyInBase: 20 },
    { type: "CARTON", barcode: "", qtyInBase: 100 },
  ];

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${isNew ? "Add product" : "Edit product"}</h1>
        <div class="page-sub">${isNew ? "New SKU" : escapeHtml(variant.sku)}</div>
      </div>
    </div>
    <form id="pf">
      <div class="panel"><div class="panel-h">Identity</div><div class="panel-b">
        <div class="form-row">
          ${field("Product name", "name", { value: product?.name || "", required: true })}
          ${field("SKU", "sku", { value: variant?.sku || "", required: true })}
          ${field("Category", "categoryId", { value: product?.categoryId || "", options: optionList(s.categories.filter((c) => c.active)) })}
          ${field("Brand", "brandId", { value: product?.brandId || "", options: optionList(s.brands.filter((b) => b.active)) })}
        </div>
        ${field("Description", "description", { type: "textarea", value: product?.description || "" })}
      </div></div>
      <div class="panel"><div class="panel-h">Pricing & stock levels</div><div class="panel-b">
        <div class="form-row">
          ${field("Cost price", "costPrice", { type: "number", value: variant?.costPrice ?? "", extra: 'step="0.01"', disabled: !can("products.cost") })}
          ${field("Selling price", "sellingPrice", { type: "number", value: variant?.sellingPrice ?? "", extra: 'step="0.01"' })}
          ${field("Reorder level", "reorderLevel", { type: "number", value: variant?.reorderLevel ?? "" })}
          ${field("Minimum stock", "minStock", { type: "number", value: variant?.minStock ?? "" })}
          ${field("Maximum stock", "maxStock", { type: "number", value: variant?.maxStock ?? "" })}
        </div>
      </div></div>
      <div class="panel"><div class="panel-h">Dimensions</div><div class="panel-b">
        <div class="form-row">
          ${field("Weight kg", "weight", { type: "number", value: variant?.weight ?? "", extra: 'step="0.01"' })}
          ${field("Length cm", "length", { type: "number", value: variant?.length ?? "" })}
          ${field("Width cm", "width", { type: "number", value: variant?.width ?? "" })}
          ${field("Height cm", "height", { type: "number", value: variant?.height ?? "" })}
        </div>
      </div></div>
      <div class="panel"><div class="panel-h">Flexible specifications</div><div class="panel-b">
        <div id="specs">${specRows(specs)}</div>
        <button type="button" class="btn btn-sm" id="add-spec">Add specification</button>
      </div></div>
      <div class="panel"><div class="panel-h">Barcodes (unique per packaging)</div><div class="panel-b">
        <div id="bcs">${bcRows(barcodes)}</div>
      </div></div>
      <div class="panel"><div class="panel-h">Flags</div><div class="panel-b">
        <label><input type="checkbox" name="active" ${product?.active !== false ? "checked" : ""}> Active</label>
        <label class="ml-8"><input type="checkbox" name="trackSerial" ${variant?.trackSerial ? "checked" : ""}> Serial tracking</label>
      </div></div>
      <div class="action-row">
        <button class="btn btn-primary" type="submit">Save</button>
        <a class="btn" href="#/products">Cancel</a>
        ${!isNew ? `<button type="button" class="btn btn-danger" id="disable">Disable product</button>` : ""}
      </div>
    </form>
  `;

  root.querySelector("#add-spec").onclick = () => {
    root.querySelector("#specs").insertAdjacentHTML("beforeend", specRows([{ key: "", value: "" }]));
  };

  root.querySelector("#disable")?.addEventListener("click", () => {
    requirePermission("products.edit");
    updateRecord("variants", variant.id, { active: false });
    updateRecord("products", product.id, { active: false });
    writeAudit({ userId: currentUser().id, action: "DISABLE", module: "PRODUCTS", recordType: "product_variant", recordId: variant.id, newValue: variant.sku });
    toast("Product disabled");
    go("/products");
  });

  root.querySelector("#pf").onsubmit = (e) => {
    e.preventDefault();
    try {
      save(formValues(e.target), { isNew, variant, product, form: e.target });
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

function specRows(specs) {
  return specs.map((s) => `
    <div class="form-row spec-row">
      <div class="field"><label>Key</label><input name="specKey" value="${escapeHtml(s.key)}"></div>
      <div class="field"><label>Value</label><input name="specVal" value="${escapeHtml(s.value)}"></div>
    </div>`).join("");
}

function bcRows(list) {
  return list.map((b) => `
    <div class="form-row">
      <div class="field"><label>Type</label><input name="bcType" value="${escapeHtml(b.type)}"></div>
      <div class="field"><label>Barcode</label><input name="bcCode" value="${escapeHtml(b.barcode || "")}"></div>
      <div class="field"><label>Qty in base</label><input name="bcQty" type="number" value="${b.qtyInBase || 1}"></div>
    </div>`).join("");
}

function save(data, { isNew, variant, product, form }) {
  requirePermission("products.edit");
  const s = getState();
  const sku = data.sku.trim();
  if (!sku) throw new Error("SKU is required.");
  const skuDup = s.variants.find((v) => v.sku.toLowerCase() === sku.toLowerCase() && v.id !== variant?.id);
  if (skuDup) throw new Error("Duplicate SKU.");

  const specKeys = [...form.querySelectorAll("[name=specKey]")].map((i) => i.value.trim());
  const specVals = [...form.querySelectorAll("[name=specVal]")].map((i) => i.value.trim());
  const specs = specKeys.map((k, i) => ({ key: k, value: specVals[i] })).filter((x) => x.key);

  const types = [...form.querySelectorAll("[name=bcType]")].map((i) => i.value.trim());
  const codes = [...form.querySelectorAll("[name=bcCode]")].map((i) => i.value.trim());
  const qtys = [...form.querySelectorAll("[name=bcQty]")].map((i) => Number(i.value) || 1);
  const bcList = types.map((t, i) => ({ type: t, barcode: codes[i], qtyInBase: qtys[i] })).filter((b) => b.barcode);
  for (const b of bcList) {
    const dup = s.barcodes.find((x) => x.barcode === b.barcode && x.variantId !== variant?.id);
    if (dup) throw new Error(`Duplicate barcode: ${b.barcode}`);
  }

  const user = currentUser();
  const now = new Date().toISOString();
  let productId = product?.id;
  let variantId = variant?.id;

  if (isNew) {
    productId = uid("p");
    variantId = uid("v");
    addRecord("products", {
      id: productId, name: data.name, categoryId: data.categoryId, brandId: data.brandId,
      description: data.description, baseUnitId: "u_pcs", trackSerial: !!data.trackSerial,
      trackWarranty: true, warrantyMonths: 24, active: !!data.active, createdAt: now, updatedAt: now,
    });
    addRecord("variants", {
      id: variantId, productId, sku, name: `${data.name}`, costPrice: Number(data.costPrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0, reorderLevel: Number(data.reorderLevel) || 0,
      minStock: Number(data.minStock) || 0, maxStock: Number(data.maxStock) || 0,
      weight: Number(data.weight) || 0, length: Number(data.length) || 0, width: Number(data.width) || 0, height: Number(data.height) || 0,
      specs, trackSerial: !!data.trackSerial, active: !!data.active, createdAt: now, updatedAt: now,
    });
    bcList.forEach((b, i) => {
      const pkId = uid("pk");
      addRecord("packaging", { id: pkId, variantId, unitId: i === 0 ? "u_pcs" : i === 1 ? "u_box" : "u_carton", qtyInBase: b.qtyInBase, label: b.type });
      addRecord("barcodes", { id: uid("bc"), variantId, barcode: b.barcode, packagingId: pkId, qtyInBase: b.qtyInBase, type: b.type });
    });
    writeAudit({ userId: user.id, action: "CREATE", module: "PRODUCTS", recordType: "product_variant", recordId: variantId, newValue: sku });
  } else {
    const oldCost = variant.costPrice;
    updateRecord("products", productId, {
      name: data.name, categoryId: data.categoryId, brandId: data.brandId,
      description: data.description, active: !!data.active, trackSerial: !!data.trackSerial,
    });
    const patch = {
      sku, name: data.name, sellingPrice: Number(data.sellingPrice) || 0,
      reorderLevel: Number(data.reorderLevel) || 0, minStock: Number(data.minStock) || 0, maxStock: Number(data.maxStock) || 0,
      weight: Number(data.weight) || 0, length: Number(data.length) || 0, width: Number(data.width) || 0, height: Number(data.height) || 0,
      specs, trackSerial: !!data.trackSerial, active: !!data.active,
    };
    if (can("products.cost")) patch.costPrice = Number(data.costPrice) || 0;
    updateRecord("variants", variantId, patch);
    s.barcodes = s.barcodes.filter((b) => b.variantId !== variantId);
    s.packaging = s.packaging.filter((p) => p.variantId !== variantId);
    bcList.forEach((b, i) => {
      const pkId = uid("pk");
      s.packaging.push({ id: pkId, variantId, unitId: i === 0 ? "u_pcs" : i === 1 ? "u_box" : "u_carton", qtyInBase: b.qtyInBase, label: b.type });
      s.barcodes.push({ id: uid("bc"), variantId, barcode: b.barcode, packagingId: pkId, qtyInBase: b.qtyInBase, type: b.type });
    });
    persist();
    if (can("products.cost") && Number(data.costPrice) !== oldCost) {
      writeAudit({ userId: user.id, action: "UPDATE", module: "PRODUCTS", recordType: "product_variant", recordId: variantId, oldValue: `cost=${oldCost}`, newValue: `cost=${data.costPrice}` });
    } else {
      writeAudit({ userId: user.id, action: "UPDATE", module: "PRODUCTS", recordType: "product_variant", recordId: variantId, newValue: sku });
    }
  }
  toast("Product saved");
  go(`/products/${variantId}`);
}
