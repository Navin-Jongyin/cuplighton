import { getState, persist } from "../store.js";
import { toast, escapeHtml, formatMoney, formatDate, table, confirmDialog, icon } from "../ui.js";
import { printSalesDocument } from "./invoice.js";

export function render(root) {
  const s = getState();
  const list = s.taxInvoices || [];

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Tax Invoices</h1>
        <div class="page-sub">Created automatically when an invoice is marked paid</div>
      </div>
    </div>

    ${
      !list.length
        ? `<div class="empty">No tax invoices yet. Mark an invoice as paid to create one.</div>`
        : table({
            columns: [
              { label: "Tax Invoice No", value: (r) => r.number },
              { label: "Invoice", value: (r) => r.invoiceNumber || "—" },
              { label: "Customer", value: (r) => r.customerName || "—" },
              { label: "Date", value: (r) => formatDate(r.invoiceDate) },
              { label: "Total THB", num: true, value: (r) => formatMoney(r.totalAmount || 0) },
              { label: "Amount due", num: true, value: (r) => formatMoney(r.amountDue || 0) },
              {
                label: "Status",
                html: (r) => `<span class="status status-paid">${escapeHtml(r.status || "PAID")}</span>`,
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

  root.querySelectorAll(".btn-print").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const doc = list.find((i) => i.id === btn.dataset.id);
      if (!doc) return;
      printSalesDocument(doc, {
        title: "TAX INVOICE",
        fileLabel: "TaxInvoice",
        dateLabel: "Tax Invoice Date",
        numberLabel: "Tax Invoice No",
      });
    };
  });

  root.querySelectorAll(".btn-del").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const doc = list.find((i) => i.id === btn.dataset.id);
      if (!doc) return;
      const ok = await confirmDialog(`Are you sure you want to delete tax invoice ${doc.number}?`);
      if (!ok) return;
      const idx = s.taxInvoices.findIndex((i) => i.id === doc.id);
      if (idx >= 0) {
        s.taxInvoices.splice(idx, 1);
        const inv = (s.invoices || []).find((i) => i.taxInvoiceId === doc.id);
        if (inv) inv.taxInvoiceId = null;
        persist(true);
        toast("Tax invoice deleted");
        render(root);
      }
    };
  });
}
