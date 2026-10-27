import { getState, addRecord } from "../store.js";
import { lookupBarcode, hydrateVariant, categoryName, brandName } from "../db.js";
import { receiveStock, defaultSite } from "../inventory-engine.js";
import { toBaseQty } from "../units.js";
import { can, currentUser } from "../auth.js";
import { writeAudit } from "../audit.js";
import { field, toast, escapeHtml, formatQty, banner } from "../ui.js";
import { onScan, focusScannerInput, stopCamera } from "../barcode.js";
import { uid, lotPickerHtml, formatLot } from "../utils.js";
import { go } from "../router.js";

let unsub = null;
export async function destroy() {
  if (unsub) unsub();
  await stopCamera();
}

export function render(root, ctx) {
  if (!can("receiving.do")) {
    root.innerHTML = `<p>No permission to add stock.</p>`;
    return;
  }

  const s = getState();
  const activeVariants = (s.variants || []).filter((v) => v.active !== false).map(hydrateVariant);
  const categories = (s.categories || []).filter((c) => c.active !== false);
  const brands = (s.brands || []).filter((b) => b.active !== false);

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Add stock</h1>
        <div class="page-sub">Receive stock or add new product items to catalog</div>
      </div>
    </div>
    <div id="msg"></div>
    <form id="f">
      <div class="panel">
        <div class="panel-h">Stock & Product Details</div>
        <div class="panel-b">
          <div class="form-row">
            <div class="field">
              <label>Product Name</label>
              <input class="scan-input" name="productName" id="productNameInput" placeholder="Enter Product Name" autocomplete="off">
            </div>
            <div class="field">
              <label>Scan Barcode / Type SKU</label>
              <input class="scan-input" name="barcode" id="barcodeInput" data-scanner="true" value="${escapeHtml(
                ctx.query.variant || ""
              )}" placeholder="Scan or enter Barcode / SKU" autocomplete="off">
            </div>
            ${field("Selling Price ($)", "sellingPrice", {
              type: "number",
              value: "",
              extra: 'id="priceInput" step="0.01" min="0" placeholder="0.00"',
            })}
          </div>
          <div class="form-row mt-12">
            <div class="field">
              <label>Category</label>
              <div id="categoryDropdownWrap"></div>
            </div>
            <div class="field">
              <label>Brand</label>
              <div id="brandDropdownWrap"></div>
            </div>
            ${field("Quantity to Add", "qty", { type: "number", value: "", extra: 'min="1" required placeholder="Enter quantity"' })}
          </div>
          <div class="form-row mt-12">
            ${lotPickerHtml({ namePrefix: "lot" })}
          </div>
        </div>
      </div>

      <div class="panel mt-16">
        <div class="panel-h">Media & Specification Sheet</div>
        <div class="panel-b">
          <div class="form-row gap-24">
            <div class="field" style="flex:1">
              <label>Product Image</label>
              <div class="media-upload-card" id="imageUploadCard">
                <input type="file" id="imageFileInput" accept="image/*" style="display:none;">
                <input type="hidden" name="imageUrl" id="imageUrlInput">
                
                <div class="upload-dropzone" id="imageDropzone">
                  <div class="upload-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div class="upload-title">Upload Product Image</div>
                  <div class="upload-sub">PNG, JPG, WEBP (Click or Drag & Drop)</div>
                  <button type="button" class="btn btn-sm mt-8">Browse File</button>
                </div>

                <div class="upload-preview-wrap" id="imagePreviewWrap" style="display:none;">
                  <div class="preview-box">
                    <img id="imagePreview" src="" alt="Product Preview">
                    <button type="button" class="btn-remove-file" id="btnRemoveImage" title="Remove Image">✕</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="field" style="flex:1">
              <label>Specification Sheet (PDF)</label>
              <div class="media-upload-card" id="specsheetUploadCard">
                <input type="file" id="specsheetFileInput" accept="application/pdf" style="display:none;">
                <input type="hidden" name="specsheetUrl" id="specsheetUrlInput">

                <div class="upload-dropzone" id="specsheetDropzone">
                  <div class="upload-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <div class="upload-title">Upload Spec Sheet</div>
                  <div class="upload-sub">PDF Document (Click or Drag & Drop)</div>
                  <button type="button" class="btn btn-sm mt-8">Browse PDF</button>
                </div>

                <div class="upload-preview-wrap" id="specsheetPreviewWrap" style="display:none;">
                  <div class="pdf-file-badge">
                    <div class="pdf-icon">📄</div>
                    <div class="pdf-info">
                      <div class="pdf-name" id="specsheetName">specsheet.pdf</div>
                      <div class="pdf-status">PDF Attached</div>
                    </div>
                    <button type="button" class="btn-remove-file" id="btnRemoveSpecsheet" title="Remove PDF">✕</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-24" style="display: flex; justify-content: flex-end;">
        <button class="btn btn-primary btn-lg" type="submit" style="width: auto; min-width: 240px;">Add to inventory</button>
      </div>
    </form>
  `;

  let hit = null;

  function createCustomDropdown({ container, name, placeholder, options, onSelect }) {
    if (!container) return null;
    const wrap = document.createElement("div");
    wrap.className = "custom-dropdown-wrap";
    wrap.innerHTML = `
      <div class="custom-dropdown-input-group">
        <input type="text" class="scan-input" name="${name}" id="${name}Input" placeholder="${placeholder}" autocomplete="off">
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
      if (q && !options.some((o) => o.label.toLowerCase() === q)) {
        html += `<div class="custom-dropdown-item custom-dropdown-create" data-val="${escapeHtml(filter)}" data-new="true">
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

    return { input, wrap, setValue: (v) => { input.value = v; } };
  }

  const productNameInput = root.querySelector("#productNameInput");

  const categoryDD = createCustomDropdown({
    container: root.querySelector("#categoryDropdownWrap"),
    name: "category",
    placeholder: "Select or type Category",
    options: categories.map((c) => ({ value: c.id, label: c.name })),
  });

  const brandDD = createCustomDropdown({
    container: root.querySelector("#brandDropdownWrap"),
    name: "brand",
    placeholder: "Select or type Brand",
    options: brands.map((b) => ({ value: b.id, label: b.name })),
  });

  function checkProduct(query, source = "barcode") {
    const target = String(query || "").trim();
    if (!target) return;

    const currentVariants = (getState().variants || []).filter((v) => v.active !== false).map(hydrateVariant);

    hit = lookupBarcode(target);
    if (!hit) {
      const targetLower = target.toLowerCase();
      let v = currentVariants.find((x) => x.id === target || x.sku.toLowerCase() === targetLower);
      if (!v)
        v = currentVariants.find(
          (x) => (x.productName && x.productName.toLowerCase() === targetLower) || (x.name && x.name.toLowerCase() === targetLower)
        );
      if (!v)
        v = currentVariants.find(
          (x) =>
            (x.sku && x.sku.toLowerCase().startsWith(targetLower)) ||
            (x.productName && x.productName.toLowerCase().startsWith(targetLower))
        );
      if (!v)
        v = currentVariants.find(
          (x) =>
            (x.sku && x.sku.toLowerCase().includes(targetLower)) ||
            (x.productName && x.productName.toLowerCase().includes(targetLower))
        );
      if (v) hit = { variant: v, qtyInBase: 1, packaging: null, type: "SKU" };
    }

    const barcodeInput = root.querySelector("#barcodeInput");
    const priceInput = root.querySelector("#priceInput");
    const infoEl = root.querySelector("#info");

    if (hit) {
      const pack = hit.qtyInBase > 1 ? ` · ${hit.type || "pack"} = ${hit.qtyInBase} pcs` : "";
      if (infoEl) {
        infoEl.textContent = `Existing Stock: ${hit.variant.sku} · ${hit.variant.productName} · on hand ${formatQty(
          hit.variant.stock
        )}${pack}`;
      }
      root.querySelector("#msg").innerHTML = "";

      if (productNameInput && source !== "product") productNameInput.value = hit.variant.productName || "";
      if (source !== "barcode" && barcodeInput)
        barcodeInput.value = hit.barcode?.barcode || hit.variant.primaryBarcode || hit.variant.sku;
      if (priceInput) priceInput.value = hit.variant.sellingPrice || 0;
      if (categoryDD) categoryDD.setValue(hit.variant.category || categoryName(hit.variant.categoryId) || "");
      if (brandDD) brandDD.setValue(hit.variant.brand || brandName(hit.variant.brandId) || "");
    } else {
      if (infoEl) infoEl.textContent = `New item "${target}" will be created and added to catalog.`;
    }
  }

  const imageDropzone = root.querySelector("#imageDropzone");
  const imageFileInput = root.querySelector("#imageFileInput");
  const imageUrlInput = root.querySelector("#imageUrlInput");
  const imagePreviewWrap = root.querySelector("#imagePreviewWrap");
  const imagePreview = root.querySelector("#imagePreview");
  const btnRemoveImage = root.querySelector("#btnRemoveImage");

  function processImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (imageUrlInput) imageUrlInput.value = dataUrl;
      if (imagePreview) imagePreview.src = dataUrl;
      if (imagePreviewWrap) imagePreviewWrap.style.display = "flex";
      if (imageDropzone) imageDropzone.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  if (imageDropzone && imageFileInput) {
    imageDropzone.onclick = () => imageFileInput.click();
    imageFileInput.onchange = (e) => processImageFile(e.target.files[0]);

    const card = root.querySelector("#imageUploadCard");
    if (card) {
      card.ondragover = (e) => { e.preventDefault(); card.style.borderColor = "var(--black)"; card.style.background = "var(--gray-50)"; };
      card.ondragleave = (e) => { e.preventDefault(); card.style.borderColor = ""; card.style.background = ""; };
      card.ondrop = (e) => {
        e.preventDefault();
        card.style.borderColor = "";
        card.style.background = "";
        if (e.dataTransfer.files?.[0]) processImageFile(e.dataTransfer.files[0]);
      };
    }
  }

  if (btnRemoveImage) {
    btnRemoveImage.onclick = (e) => {
      e.stopPropagation();
      if (imageFileInput) imageFileInput.value = "";
      if (imageUrlInput) imageUrlInput.value = "";
      if (imagePreview) imagePreview.src = "";
      if (imagePreviewWrap) imagePreviewWrap.style.display = "none";
      if (imageDropzone) imageDropzone.style.display = "flex";
    };
  }

  const specsheetDropzone = root.querySelector("#specsheetDropzone");
  const specsheetFileInput = root.querySelector("#specsheetFileInput");
  const specsheetUrlInput = root.querySelector("#specsheetUrlInput");
  const specsheetPreviewWrap = root.querySelector("#specsheetPreviewWrap");
  const specsheetName = root.querySelector("#specsheetName");
  const btnRemoveSpecsheet = root.querySelector("#btnRemoveSpecsheet");

  function processSpecsheetFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (specsheetUrlInput) specsheetUrlInput.value = dataUrl;
      if (specsheetName) specsheetName.textContent = file.name;
      if (specsheetPreviewWrap) specsheetPreviewWrap.style.display = "flex";
      if (specsheetDropzone) specsheetDropzone.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  if (specsheetDropzone && specsheetFileInput) {
    specsheetDropzone.onclick = () => specsheetFileInput.click();
    specsheetFileInput.onchange = (e) => processSpecsheetFile(e.target.files[0]);

    const card = root.querySelector("#specsheetUploadCard");
    if (card) {
      card.ondragover = (e) => { e.preventDefault(); card.style.borderColor = "var(--black)"; card.style.background = "var(--gray-50)"; };
      card.ondragleave = (e) => { e.preventDefault(); card.style.borderColor = ""; card.style.background = ""; };
      card.ondrop = (e) => {
        e.preventDefault();
        card.style.borderColor = "";
        card.style.background = "";
        if (e.dataTransfer.files?.[0]) processSpecsheetFile(e.dataTransfer.files[0]);
      };
    }
  }

  if (btnRemoveSpecsheet) {
    btnRemoveSpecsheet.onclick = (e) => {
      e.stopPropagation();
      if (specsheetFileInput) specsheetFileInput.value = "";
      if (specsheetUrlInput) specsheetUrlInput.value = "";
      if (specsheetName) specsheetName.textContent = "specsheet.pdf";
      if (specsheetPreviewWrap) specsheetPreviewWrap.style.display = "none";
      if (specsheetDropzone) specsheetDropzone.style.display = "flex";
    };
  }

  if (productNameInput) {
    productNameInput.oninput = () => checkProduct(productNameInput.value, "product");
  }

  const barcodeInput = root.querySelector("#barcodeInput");
  if (barcodeInput) {
    barcodeInput.oninput = () => checkProduct(barcodeInput.value, "barcode");
  }

  unsub = onScan(({ code }) => {
    if (barcodeInput) barcodeInput.value = code;
    checkProduct(code, "barcode");
  });

  if (ctx.query.variant) checkProduct(ctx.query.variant, "barcode");
  focusScannerInput();

  root.querySelector("#f").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const typedName = productNameInput?.value.trim() || fd.get("productName")?.trim();
    const typedBarcode = fd.get("barcode")?.trim();
    const typedCategory = fd.get("category")?.trim();
    const typedBrand = fd.get("brand")?.trim();
    const typedPrice = Number(fd.get("sellingPrice") || 0);
    const packQty = Number(fd.get("qty") || 1);
    const lot = formatLot(fd.get("lotNumber"), fd.get("lotMonth"), fd.get("lotYear"));
    if (!lot) {
      toast("Enter lot number, month, and year", "error");
      return;
    }

    const imageUrl = fd.get("imageUrl")?.trim() || "";
    const specsheetUrl = fd.get("specsheetUrl")?.trim() || "";

    if (!typedName && !typedBarcode) {
      toast("Please select a product or enter Product Name / Barcode", "error");
      return;
    }

    if (!hit && typedBarcode) checkProduct(typedBarcode, "barcode");
    if (!hit && typedName) checkProduct(typedName, "product");

    const state = getState();

    // If matching product exists -> update stock
    if (hit) {
      if (imageUrl) hit.variant.imageUrl = imageUrl;
      if (specsheetUrl) hit.variant.specsheetUrl = specsheetUrl;

      const prod = state.products.find((p) => p.id === hit.variant.productId);
      if (prod) {
        if (imageUrl) prod.imageUrl = imageUrl;
        if (specsheetUrl) prod.specsheetUrl = specsheetUrl;
      }

      if (typedPrice >= 0) {
        hit.variant.sellingPrice = typedPrice;
        const vRec = state.variants.find((v) => v.id === hit.variant.id);
        if (vRec) vRec.sellingPrice = typedPrice;
      }

      let categoryId = hit.variant.categoryId;
      if (typedCategory) {
        let existingCat = state.categories.find(
          (c) => c.id === typedCategory || c.name.toLowerCase() === typedCategory.toLowerCase()
        );
        if (!existingCat) {
          existingCat = addRecord("categories", { id: uid("cat"), name: typedCategory, active: true });
          writeAudit({
            userId: currentUser().id,
            action: "CREATE",
            module: "SETTINGS",
            recordType: "categories",
            recordId: existingCat.id,
            newValue: typedCategory,
          });
          toast(`Saved new category "${typedCategory}" to catalog`);
        }
        categoryId = existingCat.id;
      }

      let brandId = hit.variant.brandId;
      if (typedBrand) {
        let existingBrand = state.brands.find(
          (b) => b.id === typedBrand || b.name.toLowerCase() === typedBrand.toLowerCase()
        );
        if (!existingBrand) {
          existingBrand = addRecord("brands", { id: uid("br"), name: typedBrand, active: true });
          writeAudit({
            userId: currentUser().id,
            action: "CREATE",
            module: "SETTINGS",
            recordType: "brands",
            recordId: existingBrand.id,
            newValue: typedBrand,
          });
          toast(`Saved new brand "${typedBrand}" to catalog`);
        }
        brandId = existingBrand.id;
      }

      if (prod) {
        if (categoryId) prod.categoryId = categoryId;
        if (brandId) prod.brandId = brandId;
      }

      try {
        const site = defaultSite();
        const qty = hit.packaging ? toBaseQty(hit.variant.id, packQty, hit.packaging.id) : packQty * (hit.qtyInBase || 1);

        receiveStock({
          variantId: hit.variant.id,
          warehouseId: site.warehouseId,
          locationId: site.locationId,
          lot,
          qty,
          userId: currentUser().id,
          referenceType: "IN",
          referenceId: "",
          reason: "Stock Update",
        });

        writeAudit({
          userId: currentUser().id,
          action: "RECEIVE",
          module: "INVENTORY",
          recordType: "inventory",
          recordId: hit.variant.id,
          newValue: `+${qty} ${hit.variant.sku}${lot ? ` lot ${lot}` : ""}`,
        });

        toast(`Updated stock: +${qty} pcs for "${hit.variant.productName}"${lot ? ` (lot ${lot})` : ""}`);
        go(`/dashboard`);
      } catch (err) {
        toast(err.message, "error");
      }
    } else {
      // Create new product item and receive initial stock
      const sku = `SKU-${Date.now().toString(36).toUpperCase()}`;

      let categoryId = state.categories[0]?.id || "";
      if (typedCategory) {
        let existingCat = state.categories.find(
          (c) => c.id === typedCategory || c.name.toLowerCase() === typedCategory.toLowerCase()
        );
        if (!existingCat) {
          existingCat = addRecord("categories", { id: uid("cat"), name: typedCategory, active: true });
          writeAudit({
            userId: currentUser().id,
            action: "CREATE",
            module: "SETTINGS",
            recordType: "categories",
            recordId: existingCat.id,
            newValue: typedCategory,
          });
          toast(`Saved new category "${typedCategory}" to catalog`);
        }
        categoryId = existingCat.id;
      }

      let brandId = state.brands[0]?.id || "";
      if (typedBrand) {
        let existingBrand = state.brands.find(
          (b) => b.id === typedBrand || b.name.toLowerCase() === typedBrand.toLowerCase()
        );
        if (!existingBrand) {
          existingBrand = addRecord("brands", { id: uid("br"), name: typedBrand, active: true });
          writeAudit({
            userId: currentUser().id,
            action: "CREATE",
            module: "SETTINGS",
            recordType: "brands",
            recordId: existingBrand.id,
            newValue: typedBrand,
          });
          toast(`Saved new brand "${typedBrand}" to catalog`);
        }
        brandId = existingBrand.id;
      }

      const now = new Date().toISOString();
      const productId = uid("p");
      const variantId = uid("v");

      addRecord("products", {
        id: productId,
        name: typedName,
        categoryId,
        brandId,
        imageUrl,
        specsheetUrl,
        description: "",
        baseUnitId: state.units[0]?.id || "u_pcs",
        trackSerial: false,
        trackWarranty: true,
        warrantyMonths: 24,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      addRecord("variants", {
        id: variantId,
        productId,
        sku,
        name: typedName,
        imageUrl,
        specsheetUrl,
        costPrice: 0,
        sellingPrice: typedPrice,
        reorderLevel: 10,
        minStock: 5,
        maxStock: 500,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      if (typedBarcode) {
        const pkId = uid("pk");
        addRecord("packaging", { id: pkId, variantId, unitId: "u_pcs", qtyInBase: 1, label: "INDIVIDUAL" });
        addRecord("barcodes", {
          id: uid("bc"),
          variantId,
          barcode: typedBarcode,
          packagingId: pkId,
          qtyInBase: 1,
          type: "INDIVIDUAL",
        });
      }

      writeAudit({
        userId: currentUser().id,
        action: "CREATE",
        module: "PRODUCTS",
        recordType: "product_variant",
        recordId: variantId,
        newValue: sku,
      });

      try {
        const site = defaultSite();
        receiveStock({
          variantId,
          warehouseId: site.warehouseId,
          locationId: site.locationId,
          lot,
          qty: packQty,
          userId: currentUser().id,
          referenceType: "IN",
          referenceId: "",
          reason: "New Product Initial Stock",
        });

        toast(`Created product "${typedName}" with ${packQty} pcs stock${lot ? ` (lot ${lot})` : ""}`);
        go(`/dashboard`);
      } catch (err) {
        toast(err.message, "error");
      }
    }
  };
}
