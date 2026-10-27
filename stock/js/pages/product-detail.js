import { getState } from "../store.js";
import { hydrateVariant, movementsFor } from "../db.js";
import { can } from "../auth.js";
import { userName } from "../auth.js";
import { table, bindTableNav, statusChip, formatMoney, formatQty, signQty, formatDateTime, escapeHtml, toast } from "../ui.js";
import { formatDate } from "../utils.js";

export function render(root, ctx) {
  const v = hydrateVariant(getState().variants.find((x) => x.id === ctx.params.id));
  if (!v) {
    root.innerHTML = `<p>Product not found.</p>`;
    return;
  }
  const product = v.product;
  const tab = ctx.query.tab || "overview";
  const siblings = getState().variants.filter((x) => x.productId === v.productId);

  const tabs = [
    ["overview", "Overview"],
    ["specs", "Specifications"],
    ["movements", "Movements"],
    ["barcode", "Barcode"],
  ];

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(v.name || v.productName)}</h1>
        <div class="page-sub">${escapeHtml(v.sku)} · ${statusChip(v.status)}</div>
      </div>
      <div class="flex gap-8">
        <a class="btn btn-primary" href="#/add-stock?variant=${v.id}">Add stock</a>
        ${can("products.edit") ? `<a class="btn" href="#/products/${v.id}/edit">Edit</a>` : ""}
      </div>
    </div>
    ${siblings.length > 1 ? `<p class="mb-12">Variants: ${siblings.map((s) => `<a class="chip" href="#/products/${s.id}">${escapeHtml(s.sku)}</a>`).join(" ")}</p>` : ""}
    <div class="tabs">
      ${tabs.map(([id, label]) => `<a class="tab ${tab === id ? "active" : ""}" href="#/products/${v.id}?tab=${id}">${label}</a>`).join("")}
    </div>
    <div id="tab-body"></div>
  `;
  const body = root.querySelector("#tab-body");
  if (tab === "overview") body.innerHTML = overview(v, product);
  if (tab === "specs") body.innerHTML = specs(v);
  if (tab === "movements") body.innerHTML = movements(v);
  if (tab === "barcode") body.innerHTML = barcodes(v);

  bindTableNav(body);
  if (tab === "barcode") drawBars(body);
}

function overview(v, product) {
  const imageUrl = v.imageUrl || product.imageUrl;
  const specsheetUrl = v.specsheetUrl || product.specsheetUrl;

  return `
    <div class="split">
      <div class="panel"><div class="panel-h">Product</div><div class="panel-b">
        ${
          imageUrl
            ? `<div class="mb-16" style="text-align: center;">
                <img src="${imageUrl}" alt="${escapeHtml(v.name)}" style="max-height: 180px; max-width: 100%; object-fit: contain; border: 1px solid var(--black); border-radius: 6px; padding: 6px; background: #fff;">
              </div>`
            : ""
        }
        <dl class="kv">
          <dt>SKU</dt><dd>${escapeHtml(v.sku)}</dd>
          <dt>Barcode</dt><dd class="mono">${escapeHtml(v.primaryBarcode)}</dd>
          <dt>Category</dt><dd>${escapeHtml(v.category)}</dd>
          <dt>Brand</dt><dd>${escapeHtml(v.brand)}</dd>
          ${can("products.cost") ? `<dt>Cost</dt><dd>${formatMoney(v.costPrice)}</dd>` : ""}
          <dt>Selling price</dt><dd>${formatMoney(v.sellingPrice)}</dd>
          <dt>Stock</dt><dd>${formatQty(v.stock)}</dd>
          <dt>Reorder</dt><dd>${formatQty(v.reorderLevel)}</dd>
          <dt>Min / max</dt><dd>${v.minStock} / ${v.maxStock}</dd>
          ${
            specsheetUrl
              ? `<dt>Spec Sheet</dt><dd><a href="${specsheetUrl}" target="_blank" download="specsheet.pdf" class="btn btn-sm">📄 View Spec Sheet (PDF)</a></dd>`
              : ""
          }
          <dt>Active</dt><dd>${product.active && v.active ? "Yes" : "No"}</dd>
          <dt>Serial tracking</dt><dd>${v.trackSerial ? "Yes" : "No"}</dd>
          <dt>Warranty</dt><dd>${product.trackWarranty ? `${product.warrantyMonths} months` : "Off"}</dd>
          <dt>Created</dt><dd>${formatDate(v.createdAt)}</dd>
        </dl>
      </div></div>
      <div class="panel"><div class="panel-h">Notes</div><div class="panel-b">
        <p class="text-muted">${escapeHtml(product.description || "No description.")}</p>
      </div></div>
    </div>
  `;
}

function specs(v) {
  const rows = v.specs || [];
  return `<div class="panel"><div class="panel-h">Specifications</div><div class="panel-b">
    ${rows.length ? `<dl class="spec-list">${rows.map((s) => `<dt>${escapeHtml(s.key)}</dt><dd>${escapeHtml(s.value)}</dd>`).join("")}</dl>` : `<p class="text-muted">No specifications.</p>`}
  </div></div>`;
}

function movements(v) {
  const rows = movementsFor(v.id).slice(0, 100);
  return table({
    columns: [
      { label: "Date", value: (m) => formatDateTime(m.timestamp) },
      { label: "Type", value: (m) => m.type },
      { label: "Qty", num: true, html: (m) => signQty(m.qty) },
      { label: "Before", num: true, value: (m) => m.qtyBefore },
      { label: "After", num: true, value: (m) => m.qtyAfter },
      { label: "User", value: (m) => userName(m.userId) },
      { label: "Reference", value: (m) => m.referenceId || m.reason || "—" },
    ],
    rows,
    empty: "No movements.",
  });
}

function barcodes(v) {
  return `
    <div class="panel"><div class="panel-h">Barcodes & packaging</div><div class="panel-b">
      ${table({
        columns: [
          { label: "Type", value: (b) => b.type },
          { label: "Barcode", value: (b) => b.barcode },
          { label: "Qty in base", num: true, value: (b) => b.qtyInBase },
        ],
        rows: v.barcodes,
      })}
      <div class="label-sheet mt-16" id="bc-preview"></div>
    </div></div>
  `;
}

function drawBars(root) {
  const v = hydrateVariant(getState().variants.find((x) => location.hash.includes(x.id)));
  if (!v) return;
  const sheet = root.querySelector("#bc-preview");
  if (!sheet) return;
  sheet.innerHTML = v.barcodes.map((b, i) => `
    <div class="label-card">
      <div class="name">${escapeHtml(v.productName)}</div>
      <div class="spec">${escapeHtml(b.type)} · ${b.qtyInBase} pcs</div>
      <svg id="bc_${i}"></svg>
      <div class="sku">SKU: ${escapeHtml(v.sku)}</div>
    </div>`).join("");
  v.barcodes.forEach((b, i) => {
    try {
      if (typeof JsBarcode !== "undefined") {
        JsBarcode(`#bc_${i}`, b.barcode, { format: "CODE128", width: 1.4, height: 48, fontSize: 12, margin: 0, background: "#FFFFFF", lineColor: "#000000" });
      } else {
        renderFallbackBarcode(`#bc_${i}`, b.barcode);
      }
    } catch {
      renderFallbackBarcode(`#bc_${i}`, b.barcode);
    }
  });
}

function renderFallbackBarcode(target, code) {
  const svg = typeof target === "string" ? document.querySelector(target) : target;
  if (!svg) return;
  const str = String(code || "").trim();
  if (!str) return;

  const PATTERNS = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142411","241112","134111","111242","121142","121241",
    "114212","124112","124211","411212","421112","421211","212141","214121","412121","111143",
    "111341","131141","114113","114311","411113","411311","113141","114131","311141","411131",
    "211412","211214","211232","2331112"
  ];

  let sum = 104;
  let codeStr = PATTERNS[104];

  for (let i = 0; i < str.length; i++) {
    const codeVal = str.charCodeAt(i) - 32;
    if (codeVal >= 0 && codeVal < 95) {
      sum += codeVal * (i + 1);
      codeStr += PATTERNS[codeVal];
    }
  }

  const checksum = sum % 103;
  codeStr += PATTERNS[checksum];
  codeStr += PATTERNS[106];

  let x = 10;
  let rects = "";
  for (let i = 0; i < codeStr.length; i++) {
    const width = parseInt(codeStr[i], 10);
    if (i % 2 === 0) {
      rects += `<rect x="${x}" y="5" width="${width * 1.6}" height="42" fill="#000"/>`;
    }
    x += width * 1.6;
  }

  const totalWidth = x + 10;
  svg.setAttribute("viewBox", `0 0 ${totalWidth} 65`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "65");
  svg.innerHTML = `
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${rects}
    <text x="${totalWidth / 2}" y="58" text-anchor="middle" font-family="monospace" font-size="11" fill="#333333">${escapeHtml(str)}</text>
  `;
}
