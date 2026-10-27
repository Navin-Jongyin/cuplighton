import { getState, persist } from "../store.js";
import { currentUser } from "../auth.js";
import { toast, escapeHtml, formatMoney, formatDate, table, confirmDialog, icon } from "../ui.js";
import { uid } from "../utils.js";
import { go } from "../router.js";

const COMPANY_NAME = "Cup lighton Co.,Ltd.";
const COMPANY_ADDR = `88/66 ถ.พุทธมณฑลสาย 2
แขวงบางแคเหนือ เขตบางแค
กรุงเทพมหานคร 10160`;
const COMPANY_TAX = "0105562107502";
const COMPANY_FOOTER = `Company Registration No: 0105562107502. Registered Office: 88/66 ถนนพุทธมณฑลสาย 2 แขวงบางแคเหนือ, เขตบางแค กรุงเทพมหานคร 10160, Thailand.`;
const BANK_BLOCK = `รายละเอียดในการชำระ
BANK NAME : Kasikorn Bank
BANK ACCOUNT : 060-1-62213-0
ACCOUNT NAME : บริษัท คัพ ไลตั้น จำกัด`;

function addDays(dateStr, days) {
  const d = new Date(dateStr || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatInvoiceDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function nextInvoiceNumber() {
  const s = getState();
  const nums = (s.invoices || [])
    .map((inv) => parseInt(String(inv.number || "").replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}

export function createInvoiceFromQuote(quote) {
  const s = getState();
  if (!s.invoices) s.invoices = [];
  if (quote.invoiceId) {
    return s.invoices.find((inv) => inv.id === quote.invoiceId) || null;
  }
  const today = new Date().toISOString().split("T")[0];
  const items = JSON.parse(JSON.stringify(quote.items || []));
  const subtotal = Number(quote.subtotal || 0);
  const taxTotal = Number(quote.taxTotal || 0);
  const totalAmount = Number(quote.totalAmount || 0);
  const invoice = {
    id: uid("invc"),
    number: nextInvoiceNumber(),
    quotationId: quote.id,
    quotationNumber: quote.number,
    reference: quote.reference || "",
    customerName: quote.customerName || "",
    customerNameTh: quote.customerNameTh || "",
    customerAddress: quote.customerAddress || "",
    customerTaxId: quote.customerTaxId || "",
    projectName: quote.projectName || "",
    salesContact: quote.salesContact || "",
    terms: quote.terms || "",
    items,
    discountTotal: Number(quote.discountTotal || 0),
    subtotal,
    taxTotal,
    totalAmount,
    amountPaid: 0,
    amountDue: totalAmount,
    invoiceDate: today,
    dueDate: addDays(today, 30),
    status: "UNPAID",
    createdAt: new Date().toISOString(),
    userId: currentUser()?.id,
  };
  s.invoices.push(invoice);
  persist(true);
  return invoice;
}

export function nextTaxInvoiceNumber() {
  const s = getState();
  const nums = (s.taxInvoices || [])
    .map((inv) => parseInt(String(inv.number || "").replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `TAX-${String(next).padStart(4, "0")}`;
}

export function createTaxInvoiceFromInvoice(invoice) {
  const s = getState();
  if (!s.taxInvoices) s.taxInvoices = [];
  if (invoice.taxInvoiceId) {
    return s.taxInvoices.find((t) => t.id === invoice.taxInvoiceId) || null;
  }
  const today = new Date().toISOString().split("T")[0];
  const totalAmount = Number(invoice.totalAmount || 0);
  const tax = {
    id: uid("tax"),
    number: nextTaxInvoiceNumber(),
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    quotationId: invoice.quotationId,
    quotationNumber: invoice.quotationNumber,
    reference: invoice.reference || invoice.number,
    customerName: invoice.customerName || "",
    customerNameTh: invoice.customerNameTh || "",
    customerAddress: invoice.customerAddress || "",
    customerTaxId: invoice.customerTaxId || "",
    projectName: invoice.projectName || "",
    salesContact: invoice.salesContact || "",
    terms: invoice.terms || "",
    items: JSON.parse(JSON.stringify(invoice.items || [])),
    discountTotal: Number(invoice.discountTotal || 0),
    subtotal: Number(invoice.subtotal || 0),
    taxTotal: Number(invoice.taxTotal || 0),
    totalAmount,
    amountPaid: totalAmount,
    amountDue: 0,
    invoiceDate: today,
    dueDate: invoice.dueDate || today,
    status: "PAID",
    createdAt: new Date().toISOString(),
    userId: currentUser()?.id,
  };
  s.taxInvoices.push(tax);
  persist(true);
  return tax;
}

export function render(root) {
  const s = getState();
  const list = s.invoices || [];

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Invoices</h1>
        <div class="page-sub">Created automatically when a quotation is approved</div>
      </div>
    </div>

    ${
      !list.length
        ? `<div class="empty">No invoices yet. Approve a quotation to create one.</div>`
        : table({
            columns: [
              { label: "Invoice No", value: (r) => r.number },
              { label: "Quote", value: (r) => r.quotationNumber || "—" },
              { label: "Customer", value: (r) => r.customerName || "—" },
              { label: "Date", value: (r) => formatDate(r.invoiceDate) },
              { label: "Due", value: (r) => formatDate(r.dueDate) },
              { label: "Total THB", num: true, value: (r) => formatMoney(r.totalAmount || 0) },
              { label: "Amount due", num: true, value: (r) => formatMoney(r.amountDue || 0) },
              {
                label: "Paid",
                html: (r) => {
                  const paid = r.status === "PAID";
                  return `<label class="paid-check"><input type="checkbox" class="chk-paid" data-id="${r.id}" ${paid ? "checked disabled" : ""}> Paid</label>`;
                },
              },
              {
                label: "Status",
                html: (r) => `<span class="status status-${String(r.status || "UNPAID").toLowerCase()}">${escapeHtml(r.status || "UNPAID")}</span>`,
              },
              {
                label: "Actions",
                html: (r) => `
                  <div class="flex gap-8">
                    <button class="btn btn-sm btn-print" data-id="${r.id}">Export</button>
                    <button class="btn btn-sm btn-icon-del btn-del" data-id="${r.id}" aria-label="Delete" title="Delete">${icon("trash")}</button>
                  </div>
                `,
              },
            ],
            rows: list.slice().reverse(),
          })
    }
  `;

  root.querySelectorAll(".chk-paid").forEach((chk) => {
    chk.onchange = async (e) => {
      e.stopPropagation();
      if (!chk.checked) return;
      const inv = list.find((i) => i.id === chk.dataset.id);
      if (!inv || inv.status === "PAID") return;
      const ok = await confirmDialog(`Mark invoice ${inv.number} as paid? This will create a tax invoice.`);
      if (!ok) {
        chk.checked = false;
        return;
      }
      const total = Number(inv.totalAmount || 0);
      inv.status = "PAID";
      inv.amountPaid = total;
      inv.amountDue = 0;
      inv.paidAt = new Date().toISOString();
      const tax = createTaxInvoiceFromInvoice(inv);
      inv.taxInvoiceId = tax.id;
      persist(true);
      toast(`Invoice ${inv.number} paid. Tax invoice ${tax.number} created.`);
      printSalesDocument(tax, {
        title: "TAX INVOICE",
        fileLabel: "TaxInvoice",
        dateLabel: "Tax Invoice Date",
        numberLabel: "Tax Invoice No",
      });
      go("/tax-invoices");
    };
  });

  root.querySelectorAll(".btn-print").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      printInvoice(btn.dataset.id);
    };
  });

  root.querySelectorAll(".btn-del").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const inv = list.find((i) => i.id === btn.dataset.id);
      if (!inv) return;
      const ok = await confirmDialog(`Are you sure you want to delete invoice ${inv.number}?`);
      if (!ok) return;
      const idx = s.invoices.findIndex((i) => i.id === inv.id);
      if (idx >= 0) {
        s.invoices.splice(idx, 1);
        const quote = (s.quotations || []).find((q) => q.invoiceId === inv.id);
        if (quote) quote.invoiceId = null;
        persist(true);
        toast("Invoice deleted");
        render(root);
      }
    };
  });
}

export function printInvoice(id) {
  const s = getState();
  const inv = (s.invoices || []).find((x) => x.id === id);
  if (!inv) {
    toast("Invoice not found", "error");
    return;
  }
  printSalesDocument(inv, {
    title: "INVOICE",
    fileLabel: "Invoice",
    dateLabel: "Invoice Date",
    numberLabel: "Invoice Number",
  });
}

export function printSalesDocument(inv, {
  title = "INVOICE",
  fileLabel = "Invoice",
  dateLabel = "Invoice Date",
  numberLabel = "Invoice Number",
} = {}) {
  if (!inv.quotationNumber) {
    const s = getState();
    const fromInvoice = inv.invoiceId ? (s.invoices || []).find((i) => i.id === inv.invoiceId) : null;
    const fromQuote = inv.quotationId ? (s.quotations || []).find((q) => q.id === inv.quotationId) : null;
    inv.quotationNumber = fromInvoice?.quotationNumber || fromQuote?.number || "";
  }
  const printWin = window.open("", "_blank", "width=900,height=1000");
  if (!printWin) {
    toast("Popups blocked. Please allow popups to export PDF.", "error");
    return;
  }

  const rowsHtml = (inv.items || [])
    .map((it) => {
      const qtyVal = Number.isInteger(Number(it.qty || 0)) ? String(Number(it.qty || 0)) : Number(it.qty || 0).toFixed(2);
      const unitPriceVal = formatMoney(it.price || 0);
      const lineAmt = formatMoney(it.amount || (Number(it.qty || 0) * Number(it.price || 0) * (1 - (Number(it.discountPercent || 0) / 100))));
      const taxVal = Number(it.taxPercent || 7) > 0 ? `${Number(it.taxPercent || 7)}%` : "Tax Exempt";
      let descFull = escapeHtml(it.name || it.description || "").replace(/\n/g, "<br>");
      if (it.lot) {
        descFull += `<br><span class="item-desc">Lot: ${escapeHtml(it.lot)}</span>`;
      }
      if (it.description && it.description !== it.name) {
        descFull += `<br><span class="item-desc">${escapeHtml(it.description).replace(/\n/g, "<br>")}</span>`;
      }
      return `
        <tr>
          <td class="col-desc">${descFull}</td>
          <td class="col-qty num">${qtyVal}</td>
          <td class="col-price num">${unitPriceVal}</td>
          <td class="col-tax num">${taxVal}</td>
          <td class="col-amount num">${lineAmt}</td>
        </tr>`;
    })
    .join("");

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(fileLabel)}_${escapeHtml(inv.number)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Prompt:wght@400;500;600;700&display=swap');
        @page { size: A4 portrait; margin: 12mm 15mm 20mm 15mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Prompt', 'Helvetica Neue', Arial, sans-serif;
          color: #000; background: #525659; margin: 0; padding: 0;
          font-size: 13px; line-height: 1.45;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .pdf-toolbar {
          position: sticky; top: 0; height: 52px; background: #323639; color: #f1f5f9;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px; z-index: 10000;
        }
        .pdf-title { font-weight: 600; font-size: 14px; }
        .pdf-btn {
          display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 4px;
          font-size: 13px; font-weight: 600; cursor: pointer; border: none;
        }
        .pdf-viewer-wrap { display: flex; flex-direction: column; align-items: center; padding: 32px 16px; }
        .a4-page {
          background: #fff; width: 210mm; min-height: 297mm;
          padding: 15mm 18mm 25mm 18mm; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          position: relative; margin-bottom: 24px;
        }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .logo-box img { height: 52px; width: auto; object-fit: contain; }
        .company-info { text-align: right; font-size: 12.5px; line-height: 1.4; }
        .company-info strong { font-size: 14px; }
        .doc-title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .doc-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 14px; line-height: 1; }
        .customer-box { max-width: 520px; font-size: 13px; }
        .cust-name-en { font-weight: 700; font-size: 13.5px; text-transform: uppercase; }
        .cust-name-th { font-weight: 600; margin-top: 2px; }
        .cust-addr { margin-top: 4px; }
        .cust-tax { margin-top: 4px; font-weight: 500; }
        .meta-box { width: 240px; font-size: 13px; }
        .meta-item { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .meta-item .lbl { font-weight: 700; }
        .project-title { font-size: 17px; font-weight: 800; margin: 0 0 16px; }
        table.items-tbl { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        table.items-tbl th {
          border-top: 2px solid #000; border-bottom: 2px solid #000;
          padding: 8px 4px; font-size: 12px; font-weight: 700; text-align: left;
        }
        table.items-tbl th.num, table.items-tbl td.num { text-align: right; }
        table.items-tbl td { padding: 10px 4px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 12.5px; }
        table.items-tbl tr:last-child td { border-bottom: 2px solid #000; }
        .col-desc { width: 46%; }
        .col-qty { width: 12%; }
        .col-price { width: 14%; }
        .col-tax { width: 12%; }
        .col-amount { width: 16%; font-weight: 600; }
        .item-desc { display: block; margin-top: 2px; color: #333; font-size: 12px; }
        .summary-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totals-table { width: 400px; font-size: 13px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .totals-row.grand {
          border-top: 2px solid #000; border-bottom: 3px double #000;
          font-size: 15px; font-weight: 800; padding: 8px 0; margin-top: 6px;
        }
        .due-date { font-weight: 700; margin: 8px 0 20px; }
        .terms-body { font-size: 11.5px; line-height: 1.5; white-space: pre-line; }
        .doc-footer {
          position: absolute; bottom: 12mm; left: 18mm; right: 18mm;
          padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #333;
        }
        .advice-title { font-size: 22px; font-weight: 800; letter-spacing: 0.08em; margin: 0 0 20px; }
        .advice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .advice-box { font-size: 13px; line-height: 1.5; }
        .advice-box strong { display: block; margin-bottom: 6px; }
        .advice-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
        .enclosed { margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; font-weight: 700; }
        .bank-block { white-space: pre-line; font-size: 13px; line-height: 1.5; }
        @media print {
          body { background: #fff !important; }
          .no-print, .pdf-toolbar { display: none !important; }
          .pdf-viewer-wrap { padding: 0 !important; }
          .a4-page { width: 100% !important; box-shadow: none !important; padding: 0 !important; margin: 0 0 12mm !important; }
          .doc-footer { position: relative; bottom: auto; left: auto; right: auto; margin-top: 28px; }
        }
      </style>
    </head>
    <body>
      <div class="pdf-toolbar no-print">
        <div class="pdf-title">${escapeHtml(fileLabel)}_${escapeHtml(inv.number)}.pdf</div>
        <div>
          <button class="pdf-btn" onclick="window.print()" style="background:#fff;color:#000;border:1px solid #000;">Export</button>
          <button class="pdf-btn" onclick="window.close()" style="background:rgba(255,255,255,0.1);color:#fff;margin-left:8px;">Close</button>
        </div>
      </div>
      <div class="pdf-viewer-wrap">
        <div class="a4-page">
          <div class="header-top">
            <div class="logo-box"><img src="assets/logo.png" alt="CupLighton"></div>
            <div class="company-info">
              <strong>${COMPANY_NAME}</strong><br>
              ${COMPANY_ADDR.replace(/\n/g, "<br>")}<br>
              TAX ID : ${COMPANY_TAX}
            </div>
          </div>
          <div class="doc-title-row">
            <div class="customer-box">
              <h1 class="doc-title">${escapeHtml(title)}</h1>
              ${title === "TAX INVOICE" ? `<div class="cust-name-th">ใบกำกับภาษี</div>` : ""}
              <div class="cust-name-en">${escapeHtml(inv.customerName)}</div>
              ${inv.customerNameTh ? `<div class="cust-name-th">${escapeHtml(inv.customerNameTh)}</div>` : ""}
              ${inv.customerAddress ? `<div class="cust-addr">${escapeHtml(inv.customerAddress)}</div>` : ""}
              ${inv.customerTaxId ? `<div class="cust-tax">Tax Number: ${escapeHtml(inv.customerTaxId)}</div>` : ""}
            </div>
            <div class="meta-box">
              <div class="meta-item"><span class="lbl">${escapeHtml(dateLabel)}</span><span>${formatInvoiceDate(inv.invoiceDate)}</span></div>
              <div class="meta-item"><span class="lbl">${escapeHtml(numberLabel)}</span><span>${escapeHtml(inv.number)}</span></div>
              ${inv.quotationNumber ? `<div class="meta-item"><span class="lbl">Quotation Number</span><span>${escapeHtml(inv.quotationNumber)}</span></div>` : ""}
              ${inv.invoiceNumber && title === "TAX INVOICE" ? `<div class="meta-item"><span class="lbl">Invoice Number</span><span>${escapeHtml(inv.invoiceNumber)}</span></div>` : ""}
              <div class="meta-item"><span class="lbl">Reference</span><span>${escapeHtml(inv.reference || inv.invoiceNumber || inv.quotationNumber || "—")}</span></div>
            </div>
          </div>
          ${inv.projectName ? `<h2 class="project-title">${escapeHtml(inv.projectName)}</h2>` : ""}
          <table class="items-tbl">
            <thead>
              <tr>
                <th class="col-desc">Item Description</th>
                <th class="col-qty num">Quantity</th>
                <th class="col-price num">Unit Price</th>
                <th class="col-tax num">Tax</th>
                <th class="col-amount num">Amount THB</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="summary-section">
            <div class="totals-table">
              <div class="totals-row"><span>Subtotal</span><span>${formatMoney(inv.subtotal || 0)}</span></div>
              <div class="totals-row"><span>TOTAL TAX 7%</span><span>${formatMoney(inv.taxTotal || 0)}</span></div>
              <div class="totals-row grand"><span>TOTAL THB</span><span>${formatMoney(inv.totalAmount || 0)}</span></div>
              <div class="totals-row"><span>Less Amount Paid</span><span>${formatMoney(inv.amountPaid || 0)}</span></div>
              <div class="totals-row grand"><span>AMOUNT DUE THB</span><span>${formatMoney(inv.amountDue || 0)}</span></div>
            </div>
          </div>
          <div class="due-date">Due Date: ${formatInvoiceDate(inv.dueDate)}</div>
          <div class="terms-body">${escapeHtml(inv.terms || "")}</div>
          <div class="doc-footer">${COMPANY_FOOTER}</div>
        </div>
        <div class="a4-page">
          <h2 class="advice-title">PAYMENT ADVICE</h2>
          <div class="advice-grid">
            <div class="advice-box">
              <strong>To: ${COMPANY_NAME}</strong>
              ${COMPANY_ADDR.replace(/\n/g, "<br>")}<br>
              TAX ID : ${COMPANY_TAX}
            </div>
            <div class="advice-box">
              <div class="advice-row"><span>Customer</span><span>${escapeHtml(inv.customerName)}</span></div>
              <div class="advice-row"><span>${escapeHtml(numberLabel)}</span><span>${escapeHtml(inv.number)}</span></div>
              ${inv.quotationNumber ? `<div class="advice-row"><span>Quotation Number</span><span>${escapeHtml(inv.quotationNumber)}</span></div>` : ""}
              <div class="advice-row"><span>Amount Due</span><span>${formatMoney(inv.amountDue || 0)}</span></div>
              <div class="advice-row"><span>Due Date</span><span>${formatInvoiceDate(inv.dueDate)}</span></div>
              <div class="enclosed">Amount Enclosed<br><small>Enter the amount you are paying above</small></div>
            </div>
          </div>
          <div class="bank-block">${escapeHtml(BANK_BLOCK)}</div>
          <div class="doc-footer">${COMPANY_FOOTER}</div>
        </div>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
}
