import { lookupBarcode } from "../db.js";
import { onScan, startCamera, stopCamera, submitBarcode, focusScannerInput } from "../barcode.js";
import { formatQty, formatMoney, toast, escapeHtml, banner } from "../ui.js";

let unsub = null;

export async function destroy() {
  if (unsub) unsub();
  unsub = null;
  await stopCamera();
}

export function render(root, ctx) {
  const preset = ctx.query.code || "";
  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Scan barcode</h1>
        <div class="page-sub">Camera, USB scanner, or manual entry</div>
      </div>
    </div>
    <div class="split">
      <div>
        <div class="scan-stage" id="cam-box"><div class="text-muted" id="cam-placeholder">Camera off</div><div id="qr-reader" class="hidden"></div></div>
        <div class="action-row">
          <button class="btn btn-lg btn-primary" id="btn-cam">Start camera</button>
          <button class="btn btn-lg" id="btn-cam-stop" disabled>Stop camera</button>
        </div>
        <form id="manual" class="toolbar mt-16">
          <div class="grow field" style="margin:0">
            <label class="sr-only">Barcode</label>
            <input class="scan-input" name="code" data-scanner="true" placeholder="Enter barcode" value="${escapeHtml(preset)}" autocomplete="off">
          </div>
          <button class="btn btn-primary btn-lg" type="submit">Search</button>
        </form>
        <p class="text-muted">Hardware scanners: leave this field focused and scan. Enter submits.</p>
        <div id="scan-error"></div>
      </div>
      <div id="result"><div class="empty">Scan or enter a barcode.</div></div>
    </div>
  `;

  const show = (code) => {
    const hit = lookupBarcode(code) || null;
    const err = root.querySelector("#scan-error");
    if (!hit) {
      err.innerHTML = banner(`Unknown barcode: ${code}`, "error");
      root.querySelector("#result").innerHTML = `<div class="empty">No product for ${escapeHtml(code)}</div>`;
      toast("Unknown barcode", "error");
      return;
    }
    err.innerHTML = "";
    renderResult(root.querySelector("#result"), hit);
  };

  unsub = onScan(({ code, hit }) => {
    root.querySelector("[name=code]").value = code;
    if (!hit) {
      show(code);
      return;
    }
    root.querySelector("#scan-error").innerHTML = "";
    renderResult(root.querySelector("#result"), hit);
  });

  root.querySelector("#manual").onsubmit = (e) => {
    e.preventDefault();
    submitBarcode(new FormData(e.target).get("code"));
  };

  root.querySelector("#btn-cam").onclick = async () => {
    try {
      root.querySelector("#cam-placeholder").classList.add("hidden");
      root.querySelector("#qr-reader").classList.remove("hidden");
      await startCamera("qr-reader");
      root.querySelector("#btn-cam-stop").disabled = false;
    } catch (err) {
      toast(err.message || "Camera could not start. Allow camera permission.", "error");
    }
  };
  root.querySelector("#btn-cam-stop").onclick = async () => {
    await stopCamera();
    root.querySelector("#qr-reader").classList.add("hidden");
    root.querySelector("#cam-placeholder").classList.remove("hidden");
  };

  if (preset) show(preset);
  focusScannerInput();
}

function renderResult(el, hit) {
  const v = hit.variant;
  const pack = hit.type && hit.type !== "SKU"
    ? `<div class="banner">Packaging: ${escapeHtml(hit.type)} · ${hit.qtyInBase} pcs per scan</div>`
    : "";
  el.innerHTML = `
    <div class="panel scan-result">
      <div class="panel-h">Scan result</div>
      <div class="panel-b">
        ${pack}
        <h2>${escapeHtml(v.productName)}</h2>
        <dl class="kv">
          <dt>SKU</dt><dd>${escapeHtml(v.sku)}</dd>
          <dt>Barcode</dt><dd class="mono">${escapeHtml(hit.barcode.barcode)}</dd>
          <dt>Brand</dt><dd>${escapeHtml(v.brand)}</dd>
          <dt>Category</dt><dd>${escapeHtml(v.category)}</dd>
          <dt>Cost</dt><dd>${formatMoney(v.costPrice)}</dd>
          <dt>Selling price</dt><dd>${formatMoney(v.sellingPrice)}</dd>
          <dt>Stock</dt><dd>${formatQty(v.stock)}</dd>
        </dl>
        <div class="stack-btns mt-16">
          <a class="btn btn-primary" href="#/add-stock?variant=${v.id}">Add stock</a>
          <a class="btn" href="#/stock-count/new">Count</a>
          <a class="btn" href="#/adjustments?variant=${v.id}">Adjust</a>
          <a class="btn" href="#/products/${v.id}">Product details</a>
        </div>
      </div>
    </div>
  `;
}
