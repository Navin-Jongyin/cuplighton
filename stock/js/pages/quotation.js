import { getState, addRecord, updateRecord, persist } from "../store.js";
import { hydrateVariant, lookupSku } from "../db.js";
import { lotsForVariant } from "../inventory-engine.js";
import { currentUser } from "../auth.js";
import { field, toast, escapeHtml, formatMoney, formatDate, table, bindTableNav, confirmDialog, alertDialog, icon } from "../ui.js";
import { uid, lotPickerHtml, formatLot } from "../utils.js";
import { go } from "../router.js";
import { createInvoiceFromQuote, printInvoice } from "./invoice.js";

const DEFAULT_SALES_CONTACT = `Sales Contact :
ถนัดชัย (086-588-2287 / 082-651-4424)
นภนต์ ( 094-953-9423)
อุทิตย์ (082-541-4542) /
E-mail : Thanatchai.cup@gmail.com
info@cuplighton.com`;

const DEFAULT_TERMS = `หมายเหตุ:
1. รับประกันผลิตภัณฑ์ 2 ปีนับจากวันส่งสินค้าการรับประกันนี้จะให้เฉพาะความเสียหายที่เกิดจากผลิตภัณฑ์เอง ( ไม่รวมถึงการติดตั้งไม่ถูกวิธีของหน้างาน ) หลอด LED30,000 ชม.หรือตามอายุการใช้งาน (ยกเว้นประเภทหลอดประหยัดไฟและหลอดไส้ไม่รับประกัน)
2. ไฟเส้นรับประกัน 1 ปี ไม่รวมถึงการติดตั้งไม่ถูกวิธีของหน้างาน
3. Driver รับประกันตาม Supplier1ปี นับจากวันส่งสินค้าหรือตามกำหนดอายุการใช้งานของผู้ผลิตอุปกรณ์ ( ไม่รวมถึงการติดตั้งไม่ถูกวิธีของหน้างาน)
4. กรณียกเลิกหรือลดจำนวนสินค้าหลังจากเปิด PO และเข้า line การผลิตแล้ว ทางบริษัทฯ ขอสงวนสิทธิเรียกเก็บเงินชดเชย 50 % ของมูลค่าสินค้าที่ยกเลิก
5. หากหลังจากได้มีแจ้งกำหนดส่งสินค้าให้ลูกค้าแล้วและบริษัทฯไม่ได้รับการยืนยันกำหนดส่งสินค้าจากลูกค้าภายใน 90 วัน ทางบริษัทฯขอสงวนสิทธิในการดำเนินการทางกฎหมายต่อไป”
6. สินค้าที่ออกจากโรงงานแล้ว ทางโรงงานไม่รับคืนสินค้า
7. รายการดังกล่าวอาจยังไม่รวมค่าขนส่ง ซึ่งบางรายการอาจจะมีค่าขนส่ง กรุณาติดต่อกับพนักงานขายเพื่อขอรายละเอียด
8. เต้าเสียบ ปลั๊ก สวิตช์ กล่องกันน้ำ รับประกัน 1 ปี
9. ราคาดังกล่าวยังไม่รวมค่าจัดส่ง

Delivery Time :30-45วัน หลังจากได้รับใบสั่งซื้อและโอนเงินมัดจำ บางรายการอาจจะมีระยะสั่งผลิตถึง 60 วัน
Valid Within. :
Term Of Payment : 50% เมื่อสั่งซื้อ 50% ก่อนส่งสินค้า

รายละเอียดในการชำระ
BANK NAME : Kasikorn Bank
BANK ACCOUNT : 060-1-62213-0
ACCOUNT NAME : บริษัท คัพ ไลตั้น จำกัด`;

const COMPANY_FOOTER = `Company Registration No: 0105562107502. Registered Office: 88/66 ถนนพุทธมณฑลสาย 2 แขวงบางแคเหนือ, เขตบางแค กรุงเทพมหานคร 10160, Thailand.`;

export function render(root, ctx) {
  const s = getState();
  if (!s.quotations) s.quotations = [];

  const subpath = ctx.path.replace("/quotations", "").replace("/", "");
  if (subpath === "new" || subpath.startsWith("edit") || ctx.query?.id) {
    renderForm(root, ctx);
  } else {
    renderList(root, ctx);
  }
}

function renderList(root, ctx) {
  const s = getState();
  const list = s.quotations || [];

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Quotations</h1>
        <div class="page-sub">Create, manage, and export sales price quotations as PDF</div>
      </div>
      <a class="btn btn-primary" href="#/quotations/new">+ Create Quotation</a>
    </div>

    ${
      !list.length
        ? `<div class="empty">No quotations created yet. Click "+ Create Quotation" to get started.</div>`
        : table({
            columns: [
              { label: "Quote No", value: (r) => r.number },
              { label: "Customer", value: (r) => r.customerName || "—" },
              { label: "Project", value: (r) => r.projectName || "—" },
              { label: "Date", value: (r) => formatDate(r.createdAt) },
              { label: "Expiry", value: (r) => formatDate(r.validUntil) },
              { label: "Total THB", num: true, value: (r) => formatMoney(r.totalAmount || 0) },
              {
                label: "Status",
                html: (r) => {
                  const st = r.status || "PENDING";
                  return `<span class="status status-${st.toLowerCase()}">${escapeHtml(st)}</span>`;
                },
              },
              {
                label: "Actions",
                html: (r) => {
                  const st = r.status || "PENDING";
                  const pending = st === "PENDING";
                  return `
                  <div class="flex gap-8">
                    ${pending ? `<a class="btn btn-sm" href="#/quotations/edit?id=${r.id}">Edit</a>` : ""}
                    ${pending ? `<button class="btn btn-sm btn-primary btn-approve" data-id="${r.id}">Approve</button>` : ""}
                    ${pending ? `<button class="btn btn-sm btn-decline" data-id="${r.id}">Decline</button>` : ""}
                    <button class="btn btn-sm btn-print" data-id="${r.id}">Export</button>
                    <button class="btn btn-sm btn-icon-del btn-del" data-id="${r.id}" aria-label="Delete" title="Delete">${icon("trash")}</button>
                  </div>`;
                },
              },
            ],
            rows: list,
          })
    }
  `;

  root.querySelectorAll(".btn-print").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      printQuotation(btn.dataset.id);
    };
  });

  root.querySelectorAll(".btn-approve").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const quote = s.quotations.find((q) => q.id === btn.dataset.id);
      if (!quote || (quote.status && quote.status !== "PENDING")) return;
      const ok = await confirmDialog(`Approve quotation ${quote.number}? This will create an invoice for the customer.`);
      if (!ok) return;
      const invoice = createInvoiceFromQuote(quote);
      quote.status = "APPROVED";
      quote.approvedAt = new Date().toISOString();
      quote.invoiceId = invoice.id;
      persist(true);
      toast(`Approved ${quote.number}. Invoice ${invoice.number} created.`);
      printInvoice(invoice.id);
      go("/invoices");
    };
  });

  root.querySelectorAll(".btn-decline").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const quote = s.quotations.find((q) => q.id === btn.dataset.id);
      if (!quote || (quote.status && quote.status !== "PENDING")) return;
      const ok = await confirmDialog(`Decline quotation ${quote.number}?`);
      if (!ok) return;
      quote.status = "DECLINED";
      quote.declinedAt = new Date().toISOString();
      persist(true);
      toast(`Declined ${quote.number}`);
      renderList(root, ctx);
    };
  });

  root.querySelectorAll(".btn-del").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const quote = s.quotations.find((q) => q.id === id);
      if (!quote) return;
      const ok = await confirmDialog(`Are you sure you want to delete quotation ${quote.number}? This cannot be undone.`);
      if (!ok) return;
      const idx = s.quotations.findIndex((q) => q.id === id);
      if (idx >= 0) {
        s.quotations.splice(idx, 1);
        persist(true);
        toast("Quotation deleted");
        renderList(root, ctx);
      }
    };
  });
}

function renderForm(root, ctx) {
  const s = getState();
  const activeVariants = (s.variants || []).filter((v) => v.active !== false).map(hydrateVariant);

  const editId = ctx.query?.id;
  const existingQuote = editId ? (s.quotations || []).find((q) => q.id === editId) : null;

  const quoteNo = existingQuote ? existingQuote.number : `QU-${Math.floor(2000 + Math.random() * 8000)}`;
  const today = existingQuote ? existingQuote.createdAt : new Date().toISOString().split("T")[0];
  const validUntil = existingQuote ? existingQuote.validUntil : new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const refVal = existingQuote ? existingQuote.reference || "" : "";
  const custNameVal = existingQuote ? existingQuote.customerName || "" : "";
  const custNameThVal = existingQuote ? existingQuote.customerNameTh || "" : "";
  const custTaxIdVal = existingQuote ? existingQuote.customerTaxId || "" : "";
  const custAddrVal = existingQuote ? existingQuote.customerAddress || "" : "";
  const projNameVal = existingQuote ? existingQuote.projectName || "" : "";
  const salesContactVal = existingQuote ? existingQuote.salesContact || DEFAULT_SALES_CONTACT : DEFAULT_SALES_CONTACT;
  const termsVal = existingQuote ? existingQuote.terms || DEFAULT_TERMS : DEFAULT_TERMS;

  let items = existingQuote && existingQuote.items && existingQuote.items.length
    ? JSON.parse(JSON.stringify(existingQuote.items))
    : [
        {
          sku: "",
          name: "",
          description: "",
          lot: "",
          qty: 1,
          price: 0,
          discountPercent: 0,
          taxPercent: 7,
        },
      ];

  function drawForm() {
    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${existingQuote ? `Edit Quotation (${escapeHtml(existingQuote.number)})` : "Create Quotation"}</h1>
          <div class="page-sub">${existingQuote ? "Modify quotation details and line items" : "Generate official sales quotation PDF"}</div>
        </div>
        <a class="btn" href="#/quotations">← Back to Quotations</a>
      </div>

      <form id="q-form">
        <div class="panel">
          <div class="panel-h">Document & Customer Details</div>
          <div class="panel-b">
            <div class="form-row">
              <div class="field">
                <label>Quote Number</label>
                <input class="scan-input" name="number" value="${escapeHtml(quoteNo)}" required>
              </div>
              <div class="field">
                <label>Reference Code</label>
                <input class="scan-input" name="reference" value="${escapeHtml(refVal)}">
              </div>
              <div class="field">
                <label>Quote Date</label>
                <input type="date" name="createdAt" value="${today}" required>
              </div>
              <div class="field">
                <label>Expiry Date</label>
                <input type="date" name="validUntil" value="${validUntil}" required>
              </div>
            </div>
            <div class="form-row mt-12">
              <div class="field">
                <label>Customer Name (English)</label>
                <input class="scan-input" name="customerName" value="${escapeHtml(custNameVal)}" required>
              </div>
              <div class="field">
                <label>Customer Name (Thai)</label>
                <input class="scan-input" name="customerNameTh" value="${escapeHtml(custNameThVal)}">
              </div>
              <div class="field">
                <label>Tax ID / Tax Number</label>
                <input class="scan-input" name="customerTaxId" value="${escapeHtml(custTaxIdVal)}">
              </div>
            </div>
            <div class="form-row mt-12">
              <div class="field" style="flex:2">
                <label>Customer Address</label>
                <input class="scan-input" name="customerAddress" value="${escapeHtml(custAddrVal)}">
              </div>
              <div class="field" style="flex:1">
                <label>Project Name</label>
                <input class="scan-input" name="projectName" value="${escapeHtml(projNameVal)}">
              </div>
            </div>
            <div class="form-row mt-12">
              <div class="field" style="flex:1">
                <label>Sales Contact Info</label>
                <textarea name="salesContact" rows="4">${escapeHtml(salesContactVal)}</textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="panel mt-16">
          <div class="panel-h">
            <span>Line Items</span>
            <button type="button" class="btn btn-sm" id="btn-add-item">+ Add Item</button>
          </div>
          <div class="panel-b">
            <div class="table-wrap">
              <table class="data-table items-editor-tbl">
                <thead>
                  <tr>
                    <th style="width: 12%">Item</th>
                    <th style="width: 22%">Description</th>
                    <th style="width: 18%">Lot</th>
                    <th style="width: 10%" class="num">Quantity</th>
                    <th style="width: 12%" class="num">Unit Price</th>
                    <th style="width: 9%" class="num">Discount %</th>
                    <th style="width: 6%" class="num">Tax %</th>
                    <th style="width: 13%" class="num">Amount THB</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="items-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel mt-16">
          <div class="panel-h">Terms, Notes & Payment Info</div>
          <div class="panel-b">
            <div class="two-col">
              <div class="field">
                <label>Terms & Conditions</label>
                <textarea name="terms" rows="10" style="font-size:12px; font-family:monospace;">${escapeHtml(DEFAULT_TERMS)}</textarea>
              </div>
              <div class="q-summary-card">
                <div class="q-summary-row">
                  <span class="lbl">Subtotal <small>(includes discount)</small></span>
                  <span class="val" id="lbl-subtotal">฿0.00</span>
                </div>
                <div class="q-summary-row">
                  <span class="lbl">Discount Total</span>
                  <span class="val text-danger" id="lbl-discount">฿0.00</span>
                </div>
                <div class="q-summary-row">
                  <span class="lbl">TOTAL TAX 7%</span>
                  <span class="val" id="lbl-tax">฿0.00</span>
                </div>
                <div class="q-summary-row grand">
                  <span class="lbl">TOTAL THB</span>
                  <span class="val" id="lbl-total">฿0.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="action-row flex gap-12 mt-24">
          <button class="btn btn-lg" type="submit" style="background: var(--white); color: var(--black); border: 1px solid var(--black);">Export</button>
          <a class="btn btn-lg" href="#/quotations">Cancel</a>
        </div>
      </form>
    `;

    renderItemRows();
    bindEvents();
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".q-custom-dropdown").forEach((el) => el.remove());
  }

  function showCustomDropdown(inputEl, query) {
    closeAllDropdowns();
    if (!inputEl) return;
    const idx = Number(inputEl.dataset.idx);
    if (isNaN(idx) || !items[idx]) return;

    const q = (query || "").trim().toLowerCase();
    const catalog = activeVariants.flatMap((v) => {
      const lots = lotsForVariant(v.id);
      if (!lots.length) return [{ ...v, lot: "", stock: Number(v.stock || 0) }];
      return lots.map((l) => ({ ...v, lot: l.lot, stock: l.quantity }));
    });
    const matches = catalog.filter((v) => {
      if (!q) return true;
      return (
        (v.sku || "").toLowerCase().includes(q) ||
        (v.productName || "").toLowerCase().includes(q) ||
        (v.lot || "").toLowerCase().includes(q) ||
        (v.barcodes || []).some((b) => String(b.barcode || b).toLowerCase().includes(q))
      );
    }).slice(0, 12);

    if (!matches.length) return;

    const rect = inputEl.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "custom-dropdown-menu q-custom-dropdown";
    menu.style.display = "block";
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 2}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${Math.max(rect.width, 320)}px`;
    menu.style.zIndex = "999999";
    menu.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.25)";

    menu.innerHTML = matches
      .map(
        (v) => `
      <div class="custom-dropdown-item" data-id="${v.id}" data-lot="${escapeHtml(v.lot || "")}">
        <div>
          <strong style="font-size:13px; color:inherit;">${escapeHtml(v.sku)}</strong>
          <div class="item-sub" style="font-size:11px; margin-top:2px;">${escapeHtml(v.productName)}${v.lot ? ` · Lot ${escapeHtml(v.lot)}` : ""} · ${v.stock} pcs</div>
        </div>
        <div style="font-weight:700; font-size:13px;">฿${formatMoney(v.sellingPrice || 0)}</div>
      </div>
    `
      )
      .join("");

    menu.onmousedown = (e) => {
      const itemEl = e.target.closest(".custom-dropdown-item");
      if (!itemEl) return;
      e.preventDefault();
      const vId = itemEl.dataset.id;
      const hit = activeVariants.find((x) => x.id === vId);
      if (hit) {
        items[idx].sku = hit.sku;
        items[idx].name = hit.productName || hit.name || "";
        items[idx].price = hit.sellingPrice || 0;
        items[idx].lot = itemEl.dataset.lot || "";
        closeAllDropdowns();
        renderItemRows();
        warnIfOverStock(idx);
      }
    };

    document.body.appendChild(menu);
  }

  function syncInputsFromDOM() {
    const tbody = root.querySelector("#items-body");
    if (!tbody) return;
    tbody.querySelectorAll("tr").forEach((tr, idx) => {
      if (!items[idx]) return;
      const skuEl = tr.querySelector(".item-sku");
      const nameEl = tr.querySelector(".item-name");
      const qtyEl = tr.querySelector(".item-qty");
      const priceEl = tr.querySelector(".item-price");
      const discEl = tr.querySelector(".item-disc");
      if (skuEl) items[idx].sku = skuEl.value;
      if (nameEl) items[idx].name = nameEl.value;
      items[idx].lot = formatLot(
        tr.querySelector(".item-lot-number")?.value,
        tr.querySelector(".item-lot-month")?.value,
        tr.querySelector(".item-lot-year")?.value
      );
      if (qtyEl) items[idx].qty = Number(qtyEl.value || 0);
      if (priceEl) items[idx].price = Number(priceEl.value || 0);
      if (discEl) items[idx].discountPercent = Number(discEl.value || 0);
    });
  }

  function renderItemRows() {
    const tbody = root.querySelector("#items-body");
    if (!tbody) return;

    tbody.innerHTML = items
      .map((it, idx) => {
        const rawAmt = Number(it.qty || 0) * Number(it.price || 0);
        const discAmt = rawAmt * (Number(it.discountPercent || 0) / 100);
        const lineAmt = rawAmt - discAmt;

        return `
      <tr>
        <td>
          <input type="text" class="scan-input item-sku fw-bold" data-idx="${idx}" value="${escapeHtml(it.sku)}" autocomplete="off">
        </td>
        <td>
          <input type="text" class="scan-input item-name" data-idx="${idx}" value="${escapeHtml(it.name || it.description || "")}" autocomplete="off">
        </td>
        <td>${lotPickerHtml({ value: it.lot || "", idx, namePrefix: `lot_${idx}`, compact: true })}</td>
        <td class="num"><input type="number" step="1" min="1" class="scan-input item-qty num" data-idx="${idx}" value="${it.qty || 1}"></td>
        <td class="num"><input type="number" step="0.01" min="0" class="scan-input item-price num" data-idx="${idx}" value="${it.price}"></td>
        <td class="num"><input type="number" step="0.01" min="0" max="100" class="scan-input item-disc num" data-idx="${idx}" value="${it.discountPercent || 0}"></td>
        <td class="num"><div class="tax-badge">7%</div></td>
        <td class="num"><span class="item-subtotal-val" id="subtotal-${idx}">${formatMoney(lineAmt)}</span></td>
        <td style="text-align: center;"><button type="button" class="btn btn-sm btn-danger btn-remove" data-idx="${idx}">×</button></td>
      </tr>
    `;
      })
      .join("");

    updateTotals();
  }

  function calculateSummary() {
    let rawTotal = 0;
    let discountTotal = 0;
    let subtotal = 0;

    items.forEach((it) => {
      const r = Number(it.qty || 0) * Number(it.price || 0);
      const d = r * (Number(it.discountPercent || 0) / 100);
      rawTotal += r;
      discountTotal += d;
      subtotal += (r - d);
    });

    const taxTotal = subtotal * 0.07;
    const totalAmount = subtotal + taxTotal;

    return { rawTotal, discountTotal, subtotal, taxTotal, totalAmount };
  }

  function updateTotals() {
    const { discountTotal, subtotal, taxTotal, totalAmount } = calculateSummary();

    const lblSub = root.querySelector("#lbl-subtotal");
    const lblDisc = root.querySelector("#lbl-discount");
    const lblTax = root.querySelector("#lbl-tax");
    const lblTot = root.querySelector("#lbl-total");

    if (lblSub) lblSub.textContent = formatMoney(subtotal);
    if (lblDisc) lblDisc.textContent = formatMoney(discountTotal);
    if (lblTax) lblTax.textContent = formatMoney(taxTotal);
    if (lblTot) lblTot.textContent = formatMoney(totalAmount);
  }

  function updateRowSubtotal(idx) {
    if (!items[idx]) return;
    const rawAmt = Number(items[idx].qty || 0) * Number(items[idx].price || 0);
    const discAmt = rawAmt * (Number(items[idx].discountPercent || 0) / 100);
    const lineAmt = rawAmt - discAmt;

    const subEl = root.querySelector(`#subtotal-${idx}`);
    if (subEl) subEl.textContent = formatMoney(lineAmt);
    updateTotals();
  }

  function stockForItem(it) {
    if (!it?.sku) return null;
    const sku = String(it.sku).trim().toLowerCase();
    const hit = activeVariants.find((x) => String(x.sku || "").toLowerCase() === sku);
    if (!hit) return null;
    const lot = String(it.lot || "").trim();
    if (lot) {
      const lots = lotsForVariant(hit.id);
      const match = lots.find((l) => l.lot === lot);
      return match ? Number(match.quantity || 0) : 0;
    }
    return Number(hit.stock ?? 0);
  }

  function warnIfOverStock(idx) {
    const it = items[idx];
    const stock = stockForItem(it);
    if (stock == null) return;
    const qty = Number(it.qty || 0);
    if (qty <= stock) return;
    const label = it.name || it.sku;
    const capped = Math.max(0, stock);
    it.qty = capped;
    const qtyEl = root.querySelector(`.item-qty[data-idx="${idx}"]`);
    if (qtyEl) qtyEl.value = capped;
    updateRowSubtotal(idx);
    alertDialog(
      `Quantity ${qty} is more than stock on hand (${capped} pcs) for ${label}. Quantity was set to ${capped}.`,
      { title: "Not enough stock" }
    );
  }

  function bindEvents() {
    const addItemBtn = root.querySelector("#btn-add-item");
    if (addItemBtn) {
      addItemBtn.onclick = () => {
        syncInputsFromDOM();
        items.push({
          sku: "",
          name: "",
          description: "",
          lot: "",
          qty: 1,
          price: 0,
          discountPercent: 0,
          taxPercent: 7,
        });
        renderItemRows();
      };
    }

    const tbody = root.querySelector("#items-body");
    if (tbody) {
      tbody.onmousedown = (e) => {
        if (e.target.classList.contains("item-sku") || e.target.classList.contains("item-name")) {
          showCustomDropdown(e.target, e.target.value);
        }
      };

      tbody.onfocusin = (e) => {
        if (e.target.classList.contains("item-sku") || e.target.classList.contains("item-name")) {
          showCustomDropdown(e.target, e.target.value);
        }
      };

      tbody.onchange = (e) => {
        const idx = Number(e.target.dataset.idx);
        if (isNaN(idx) || !items[idx]) return;

        if (e.target.classList.contains("item-sku")) {
          items[idx].sku = e.target.value;
        } else if (e.target.classList.contains("item-name")) {
          items[idx].name = e.target.value;
        } else if (e.target.classList.contains("item-lot-number") || e.target.classList.contains("item-lot-month") || e.target.classList.contains("item-lot-year")) {
          const tr = e.target.closest("tr");
          items[idx].lot = formatLot(
            tr?.querySelector(".item-lot-number")?.value,
            tr?.querySelector(".item-lot-month")?.value,
            tr?.querySelector(".item-lot-year")?.value
          );
        } else if (e.target.classList.contains("item-qty")) {
          items[idx].qty = Number(e.target.value || 0);
          updateRowSubtotal(idx);
          warnIfOverStock(idx);
        } else if (e.target.classList.contains("item-price")) {
          items[idx].price = Number(e.target.value || 0);
          updateRowSubtotal(idx);
        } else if (e.target.classList.contains("item-disc")) {
          items[idx].discountPercent = Number(e.target.value || 0);
          updateRowSubtotal(idx);
        }
      };

      tbody.oninput = (e) => {
        const idx = Number(e.target.dataset.idx);
        if (isNaN(idx) || !items[idx]) return;

        if (e.target.classList.contains("item-sku")) {
          items[idx].sku = e.target.value;
          showCustomDropdown(e.target, e.target.value);
        } else if (e.target.classList.contains("item-name")) {
          items[idx].name = e.target.value;
          showCustomDropdown(e.target, e.target.value);
        } else if (e.target.classList.contains("item-lot-number") || e.target.classList.contains("item-lot-month") || e.target.classList.contains("item-lot-year")) {
          const tr = e.target.closest("tr");
          items[idx].lot = formatLot(
            tr?.querySelector(".item-lot-number")?.value,
            tr?.querySelector(".item-lot-month")?.value,
            tr?.querySelector(".item-lot-year")?.value
          );
        } else if (e.target.classList.contains("item-qty")) {
          items[idx].qty = Number(e.target.value || 0);
          updateRowSubtotal(idx);
        } else if (e.target.classList.contains("item-price")) {
          items[idx].price = Number(e.target.value || 0);
          updateRowSubtotal(idx);
        } else if (e.target.classList.contains("item-disc")) {
          items[idx].discountPercent = Number(e.target.value || 0);
          updateRowSubtotal(idx);
        }
      };

      tbody.onclick = (e) => {
        const btn = e.target.closest(".btn-remove");
        if (!btn) return;
        const idx = Number(btn.dataset.idx);
        if (items.length > 1) {
          syncInputsFromDOM();
          items.splice(idx, 1);
          renderItemRows();
        } else {
          toast("Quotation must have at least one product", "error");
        }
      };
    }

    document.onclick = (e) => {
      if (!e.target.closest(".q-custom-dropdown") && !e.target.closest(".item-sku") && !e.target.closest(".item-name")) {
        closeAllDropdowns();
      }
    };

    window.addEventListener("scroll", closeAllDropdowns, { capture: true, passive: true });

    const form = root.querySelector("#q-form");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const customerName = fd.get("customerName")?.trim();
        if (!customerName) {
          toast("Please enter Customer Name", "error");
          return;
        }

        const summary = calculateSummary();
        const processedItems = items.map((it) => {
          const raw = Number(it.qty || 0) * Number(it.price || 0);
          const disc = raw * (Number(it.discountPercent || 0) / 100);
          const amt = raw - disc;
          return {
            ...it,
            amount: amt,
          };
        });

        const quotePayload = {
          number: fd.get("number")?.trim() || quoteNo,
          reference: fd.get("reference")?.trim() || "",
          customerName,
          customerNameTh: fd.get("customerNameTh")?.trim() || "",
          customerAddress: fd.get("customerAddress")?.trim() || "",
          customerTaxId: fd.get("customerTaxId")?.trim() || "",
          projectName: fd.get("projectName")?.trim() || "",
          salesContact: fd.get("salesContact")?.trim() || DEFAULT_SALES_CONTACT,
          createdAt: fd.get("createdAt") || today,
          validUntil: fd.get("validUntil") || validUntil,
          terms: fd.get("terms")?.trim() || DEFAULT_TERMS,
          items: processedItems,
          discountTotal: summary.discountTotal,
          subtotal: summary.subtotal,
          taxTotal: summary.taxTotal,
          totalAmount: summary.totalAmount,
          userId: currentUser().id,
          status: existingQuote?.status || "PENDING",
        };

        if (existingQuote) {
          const idx = s.quotations.findIndex((q) => q.id === existingQuote.id);
          if (idx >= 0) {
            s.quotations[idx] = {
              ...existingQuote,
              ...quotePayload,
            };
          }
          persist(true);
          toast(`Updated quotation ${quotePayload.number}`);
          printQuotation(existingQuote.id);
          location.hash = "/quotations";
        } else {
          const newQuote = {
            id: uid("qt"),
            ...quotePayload,
          };
          if (!s.quotations) s.quotations = [];
          s.quotations.push(newQuote);
          persist(true);
          toast(`Saved quotation ${newQuote.number}`);
          printQuotation(newQuote.id);
          location.hash = "/quotations";
        }
      };
    }
  }

  drawForm();
}

function printQuotation(id) {
  const s = getState();
  const q = (s.quotations || []).find((x) => x.id === id);
  if (!q) {
    toast("Quotation not found", "error");
    return;
  }

  const printWin = window.open("", "_blank", "width=900,height=1000");
  if (!printWin) {
    toast("Popups blocked. Please allow popups to export quotation PDF.", "error");
    return;
  }

  // Recalculate totals for display
  let discountTotal = Number(q.discountTotal || 0);
  let subtotal = Number(q.subtotal || 0);
  if (!subtotal) {
    (q.items || []).forEach((it) => {
      const r = Number(it.qty || 0) * Number(it.price || 0);
      const d = r * (Number(it.discountPercent || 0) / 100);
      discountTotal += d;
      subtotal += (r - d);
    });
  }
  const taxTotal = q.taxTotal || (subtotal * 0.07);
  const grandTotal = q.totalAmount || (subtotal + taxTotal);

  const rowsHtml = (q.items || [])
    .map((it) => {
      const qtyVal = Number.isInteger(Number(it.qty || 0)) ? String(Number(it.qty || 0)) : Number(it.qty || 0).toFixed(2);
      const unitPriceVal = formatMoney(it.price || 0);
      const discVal = Number(it.discountPercent || 0) > 0 ? `${Number(it.discountPercent).toFixed(2)}%` : "";
      const taxVal = "7%";
      const lineAmt = formatMoney(it.amount || (it.qty * it.price * (1 - (it.discountPercent || 0) / 100)));

      let descFull = escapeHtml(it.name || it.description || "").replace(/\n/g, "<br>");
      if (it.lot) {
        descFull += `<br><span class="item-desc">Lot: ${escapeHtml(it.lot)}</span>`;
      }
      if (it.description && it.description !== it.name) {
        descFull += `<br><span class="item-desc">${escapeHtml(it.description).replace(/\n/g, "<br>")}</span>`;
      }

      return `
      <tr>
        <td class="col-item">${escapeHtml(it.sku || "—")}</td>
        <td class="col-desc">${descFull}</td>
        <td class="col-qty num">${qtyVal}</td>
        <td class="col-price num">${unitPriceVal}</td>
        <td class="col-disc num">${discVal}</td>
        <td class="col-tax num">${taxVal}</td>
        <td class="col-amount num">${lineAmt}</td>
      </tr>
    `;
    })
    .join("");

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation_${escapeHtml(q.number)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Prompt:wght@400;500;600;700&display=swap');

        @page {
          size: A4 portrait;
          margin: 12mm 15mm 20mm 15mm;
        }

        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Prompt', 'Helvetica Neue', Arial, sans-serif;
          color: #000;
          background: #525659;
          margin: 0;
          padding: 0;
          font-size: 13px;
          line-height: 1.45;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .pdf-toolbar {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 52px;
          background: #323639;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .pdf-title {
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pdf-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pdf-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
          text-decoration: none;
        }

        .pdf-btn-primary {
          background: #0ea5e9;
          color: #ffffff;
        }
        .pdf-btn-primary:hover {
          background: #0284c7;
        }

        .pdf-btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .pdf-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .pdf-viewer-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 16px;
          min-height: calc(100vh - 52px);
        }

        .a4-page {
          background: #ffffff;
          width: 210mm;
          min-height: 297mm;
          padding: 15mm 18mm 25mm 18mm;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          position: relative;
          margin-bottom: 24px;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .logo-box img {
          height: 52px;
          width: auto;
          object-fit: contain;
        }

        .company-info {
          text-align: right;
          font-size: 12.5px;
          color: #000;
          line-height: 1.4;
        }
        .company-info strong {
          font-size: 14px;
          font-weight: 700;
        }

        .doc-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .doc-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0 0 14px 0;
          line-height: 1;
        }

        .customer-box {
          max-width: 520px;
          font-size: 13px;
        }
        .cust-name-en {
          font-weight: 700;
          font-size: 13.5px;
          text-transform: uppercase;
        }
        .cust-name-th {
          font-weight: 600;
          margin-top: 2px;
        }
        .cust-addr {
          margin-top: 4px;
          color: #000;
        }
        .cust-tax {
          margin-top: 4px;
          font-weight: 500;
        }

        .meta-box {
          width: 220px;
          font-size: 13px;
        }
        .meta-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .meta-item .lbl {
          font-weight: 700;
          color: #000;
        }
        .meta-item .val {
          color: #000;
        }

        .project-section {
          margin-bottom: 24px;
        }
        .project-title {
          font-size: 17px;
          font-weight: 800;
          margin: 0 0 8px 0;
        }
        .sales-contact {
          font-size: 13px;
          white-space: pre-line;
          line-height: 1.45;
        }

        table.items-tbl {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        table.items-tbl th {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 8px 4px;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          background: #fff;
        }
        table.items-tbl th.num { text-align: right; }
        table.items-tbl td {
          padding: 10px 4px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
          font-size: 12.5px;
        }
        table.items-tbl td.num { text-align: right; }
        table.items-tbl tr:last-child td { border-bottom: 2px solid #000; }

        .col-item { width: 14%; font-weight: 700; }
        .col-desc { width: 38%; }
        .col-qty { width: 10%; }
        .col-price { width: 12%; }
        .col-disc { width: 9%; }
        .col-tax { width: 5%; }
        .col-amount { width: 12%; font-weight: 600; }

        .item-desc {
          display: block;
          margin-top: 2px;
          color: #333;
          font-size: 12px;
          line-height: 1.35;
        }

        .summary-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-table {
          width: 400px;
          font-size: 13px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
        }
        .totals-row.grand {
          border-top: 2px solid #000;
          border-bottom: 3px double #000;
          font-size: 15px;
          font-weight: 800;
          padding: 8px 0;
          margin-top: 6px;
        }

        .terms-section {
          margin-top: 30px;
          page-break-inside: avoid;
        }
        .terms-header {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 6px 0;
        }
        .terms-hr {
          border: none;
          border-top: 1px solid #000;
          margin: 0 0 12px 0;
        }
        .terms-body {
          font-size: 11.5px;
          line-height: 1.5;
          white-space: pre-line;
          color: #000;
        }

        .doc-footer {
          position: absolute;
          bottom: 12mm;
          left: 18mm;
          right: 18mm;
          padding-top: 8px;
          border-top: 1px solid #cbd5e1;
          font-size: 10px;
          color: #333;
          text-align: left;
          background: #fff;
        }

        @media print {
          body { background: #ffffff !important; }
          .no-print, .pdf-toolbar { display: none !important; }
          .pdf-viewer-wrap { padding: 0 !important; }
          .a4-page {
            width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .doc-footer { position: fixed; bottom: 0; left: 0; right: 0; }
        }
      </style>
    </head>
    <body>
      <div class="pdf-toolbar no-print">
        <div class="pdf-title">
          📄 <span>Quotation_${escapeHtml(q.number)}.pdf</span>
        </div>
        <div class="pdf-actions">
          <button class="pdf-btn" onclick="window.print()" style="background: #ffffff; color: #000000; border: 1px solid #000000;">
            Export
          </button>
          <button class="pdf-btn pdf-btn-secondary" onclick="window.close()">
            ✕ Close
          </button>
        </div>
      </div>

      <div class="pdf-viewer-wrap">
        <div class="a4-page">
          <div class="header-top">
            <div class="logo-box">
              <img src="assets/logo.png" alt="CupLighton">
            </div>
            <div class="company-info">
              <strong>Cup lighton Co.,Ltd.</strong><br>
              88/66 ถ.พุทธมณฑลสาย 2<br>
              แขวงบางแคเหนือ เขตบางแค<br>
              กรุงเทพมหานคร 10160<br>
              TAX ID : 0105562107502
            </div>
          </div>

          <div class="doc-title-row">
            <div class="customer-box">
              <h1 class="doc-title">QUOTATION</h1>
              <div class="cust-name-en">${escapeHtml(q.customerName)}</div>
              ${q.customerNameTh ? `<div class="cust-name-th">${escapeHtml(q.customerNameTh)}</div>` : ""}
              ${q.customerAddress ? `<div class="cust-addr">${escapeHtml(q.customerAddress)}</div>` : ""}
              ${q.customerTaxId ? `<div class="cust-tax">Tax Number: ${escapeHtml(q.customerTaxId)}</div>` : ""}
            </div>

            <div class="meta-box">
              <div class="meta-item"><span class="lbl">Date</span><span class="val">${formatDate(q.createdAt)}</span></div>
              <div class="meta-item"><span class="lbl">Expiry</span><span class="val">${formatDate(q.validUntil)}</span></div>
              <div class="meta-item"><span class="lbl">Quote Number</span><span class="val">${escapeHtml(q.number)}</span></div>
              <div class="meta-item"><span class="lbl">Reference</span><span class="val">${escapeHtml(q.reference || "—")}</span></div>
            </div>
          </div>

          <div class="project-section">
            ${q.projectName ? `<h2 class="project-title">${escapeHtml(q.projectName)}</h2>` : ""}
            <div class="sales-contact">${escapeHtml(q.salesContact || DEFAULT_SALES_CONTACT)}</div>
          </div>

          <table class="items-tbl">
            <thead>
              <tr>
                <th class="col-item">Item</th>
                <th class="col-desc">Description</th>
                <th class="col-qty num">Quantity</th>
                <th class="col-price num">Unit Price</th>
                <th class="col-disc num">Discount</th>
                <th class="col-tax num">Tax</th>
                <th class="col-amount num">Amount THB</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="totals-table">
              <div class="totals-row">
                <span>Subtotal (includes a discount of ${formatMoney(discountTotal)})</span>
                <span>${formatMoney(subtotal)}</span>
              </div>
              <div class="totals-row">
                <span>TOTAL TAX 7%</span>
                <span>${formatMoney(taxTotal)}</span>
              </div>
              <div class="totals-row grand">
                <span>TOTAL THB</span>
                <span>${formatMoney(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div class="terms-section">
            <h3 class="terms-header">Terms</h3>
            <hr class="terms-hr">
            <div class="terms-body">${escapeHtml(q.terms || DEFAULT_TERMS)}</div>
          </div>

          <div class="doc-footer">
            ${COMPANY_FOOTER}
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
}
