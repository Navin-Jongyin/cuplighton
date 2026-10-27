import { escapeHtml, formatDate, formatDateTime, formatMoney, formatQty, signQty } from "./utils.js";

export function icon(name) {
  const paths = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    box: '<rect x="4" y="8" width="16" height="12"/><path d="M4 8l8-4 8 4"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>',
    scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-3 4-5 7-5s5.5 2 7 5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    building: '<path d="M4 21V5l8-2 8 2v16"/><path d="M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/>',
    in: '<path d="M12 3v12M8 11l4 4 4-4M4 21h16"/>',
    doc: '<path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5"/>',
    cart: '<circle cx="8" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l2-7H7"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    move: '<path d="M7 7h10v10M7 17l10-10"/>',
    count: '<rect x="4" y="4" width="16" height="16"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h8"/>',
    truck: '<path d="M3 7h11v10H3zM14 11h5l2 3v3h-7"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    back: '<path d="M9 6l-6 6 6 6M3 12h18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    tag: '<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1"/>',
    log: '<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    invoice: '<path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5M9 13h8M9 17h5"/>',
    tax: '<path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5M9 12h6M9 16h6"/><path d="M10 8h2"/>',
  };
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.box}</svg>`;
}

export function toast(message, type = "info") {
  let root = document.querySelector(".toast-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), type === "error" ? 5000 : 2800);
}

export function banner(text, type = "") {
  return `<div class="banner ${type}">${escapeHtml(text)}</div>`;
}

export function statusChip(status) {
  const s = String(status || "").toUpperCase();
  const cls = s === "OUT" ? "status-out" : s === "LOW" ? "status-low" : s === "OK" ? "status-ok" : "";
  const label = s === "OUT" ? "Out" : s === "LOW" ? "Low" : s === "OK" ? "In stock" : s;
  return `<span class="status ${cls}">${escapeHtml(label)}</span>`;
}

export function table({ columns, rows, rowHref, onRowAttr, empty = "No records." }) {
  if (!rows.length) {
    return `<div class="empty">${escapeHtml(empty)}</div>`;
  }
  const head = columns.map((c) =>
    `<th class="${c.num ? "num" : ""} ${c.sortKey ? "sortable" : ""}" data-sort="${c.sortKey || ""}">${escapeHtml(c.label)}</th>`
  ).join("");
  const body = rows.map((row) => {
    const href = rowHref ? rowHref(row) : "";
    const cells = columns.map((c) => {
      const raw = c.html ? c.html(row) : escapeHtml(c.value(row) ?? "—");
      return `<td class="${c.num ? "num" : ""}">${raw}</td>`;
    }).join("");
    const extra = onRowAttr ? onRowAttr(row) : "";
    return `<tr class="${href ? "clickable" : ""}" ${href ? `data-href="${escapeHtml(href)}"` : ""} ${extra}>${cells}</tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function bindTableNav(root) {
  root.querySelectorAll("tr[data-href]").forEach((tr) => {
    tr.addEventListener("click", () => { location.hash = tr.dataset.href; });
  });
}

export function pager({ page, pages, total, size }, id = "page") {
  return `<div class="pager">
    <div>${total.toLocaleString()} records · page ${page} of ${pages}</div>
    <div class="pager-btns">
      <button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Prev</button>
      <button class="btn btn-sm" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button>
    </div>
  </div>`;
}

export function field(label, name, { type = "text", value = "", options = null, required = false, disabled = false, hint = "", extra = "" } = {}) {
  let control;
  if (options) {
    control = `<select name="${name}" ${required ? "required" : ""} ${disabled ? "disabled" : ""}>
      ${options.map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
    </select>`;
  } else if (type === "textarea") {
    control = `<textarea name="${name}" ${required ? "required" : ""} ${disabled ? "disabled" : ""}>${escapeHtml(value)}</textarea>`;
  } else {
    control = `<input type="${type}" name="${name}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${disabled ? "disabled" : ""} ${extra}>`;
  }
  return `<div class="field"><label>${escapeHtml(label)}</label>${control}${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ""}</div>`;
}

export function modal({ title, body, actions = [], wide = false }) {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "modal-root";
    root.innerHTML = `<div class="modal ${wide ? "modal-lg" : ""}" role="dialog">
      <div class="modal-h"><span>${escapeHtml(title)}</span><button class="btn btn-sm" data-act="close">Close</button></div>
      <div class="modal-b">${body}</div>
      <div class="modal-f">${actions.map((a) => `<button class="btn ${a.primary ? "btn-primary" : ""} ${a.danger ? "btn-danger" : ""}" data-act="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`).join("")}</div>
    </div>`;
    const close = (val) => { root.remove(); document.removeEventListener("keydown", onKey); resolve(val); };
    const onKey = (e) => {
      if (e.key === "Escape") close(null);
    };
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", (e) => {
      if (e.target === root) close(null);
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "close") close(null);
      else close({ action: btn.dataset.act, form: root.querySelector("form") });
    });
    document.body.appendChild(root);
    const first = root.querySelector("input, select, textarea, button.btn-primary");
    if (first) first.focus();
  });
}

export function confirmDialog(message, { confirmLabel = "Confirm" } = {}) {
  return modal({
    title: "Confirm",
    body: `<p>${escapeHtml(message)}</p>`,
    actions: [{ id: "ok", label: confirmLabel, primary: true }, { id: "cancel", label: "Cancel" }],
  }).then((r) => r?.action === "ok");
}

export function alertDialog(message, { title = "Alert" } = {}) {
  return modal({
    title,
    body: `<p>${escapeHtml(message)}</p>`,
    actions: [{ id: "ok", label: "OK", primary: true }],
  });
}

export function formValues(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  return data;
}

export function optionList(items, valueKey = "id", labelKey = "name", includeBlank = false) {
  const opts = items.map((i) => ({ value: i[valueKey], label: typeof labelKey === "function" ? labelKey(i) : i[labelKey] }));
  if (includeBlank) opts.unshift({ value: "", label: "—" });
  return opts;
}

export function kpi(label, value, sub = "") {
  return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ""}</div>`;
}

export function emptyState({ title, body, href, cta }) {
  return `<div class="empty-hero">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(body)}</p>
    ${href ? `<a class="btn btn-primary btn-lg" href="#${href}">${escapeHtml(cta)}</a>` : ""}
  </div>`;
}

export function actionTile({ href, icon: iconName, title, body }) {
  return `<a class="action-tile" href="#${href}">
    <span class="action-tile-icon">${icon(iconName)}</span>
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(body)}</span>
  </a>`;
}

export { escapeHtml, formatDate, formatDateTime, formatMoney, formatQty, signQty };
