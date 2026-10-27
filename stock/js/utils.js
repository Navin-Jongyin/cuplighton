export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

export function parseDate(d) {
  return d instanceof Date ? d : new Date(d);
}

export function formatDate(d) {
  if (!d) return "—";
  const dt = parseDate(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

export function formatTime(d) {
  const dt = parseDate(d);
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function formatDateTime(d) {
  if (!d) return "—";
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function formatMoney(n) {
  const v = Number(n) || 0;
  return `฿${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatQty(n, unit = "pcs") {
  const v = Number(n) || 0;
  return `${v.toLocaleString("en-US")} ${unit}`;
}

export function signQty(n, unit = "pcs") {
  const v = Number(n) || 0;
  const s = v > 0 ? "+" : "";
  return `${s}${v.toLocaleString("en-US")} ${unit}`;
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

export function dateISO(y, m, day, h = 9, min = 0) {
  return new Date(y, m - 1, day, h, min, 0).toISOString();
}

export function nextNumber(list, prefix, field = "number") {
  let max = 0;
  for (const row of list) {
    const n = String(row[field] || "");
    const m = n.match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

export function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function paginate(items, page = 1, size = 25) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: p,
    pages,
    total,
    size,
  };
}

export function downloadCsv(filename, rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvCell(c.value(row))).join(","))
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function stockStatus(qty, reorder, min) {
  const q = Number(qty) || 0;
  if (q <= 0) return "OUT";
  if (q <= (min || 0) || q <= (reorder || 0)) return "LOW";
  return "OK";
}

export function normalizeBarcode(s) {
  return String(s || "").trim().replace(/\s+/g, "");
}

export function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

export function formatLot(number, month, year) {
  const n = String(number || "").replace(/\D/g, "");
  const m = String(month || "").padStart(2, "0");
  const y = String(year || "");
  if (!n || !m || m === "00" || !/^\d{4}$/.test(y)) return "";
  return `${n.padStart(2, "0")}-${m}${y}`;
}

export function parseLot(lot) {
  const s = String(lot || "").trim();
  const match = s.match(/^(\d+)-(\d{2})(\d{4})$/);
  if (!match) return { number: "", month: "", year: "" };
  return { number: match[1], month: match[2], year: match[3] };
}

export function lotYearOptions() {
  const y = new Date().getFullYear();
  const years = [];
  for (let i = y - 3; i <= y + 5; i++) years.push(String(i));
  return years;
}

export function lotMonthOptions() {
  return Array.from({ length: 12 }, (_, i) => pad(i + 1));
}

export function lotPickerHtml({ value = "", idx = null, namePrefix = "lot", compact = false } = {}) {
  const parsed = parseLot(value);
  const now = new Date();
  const month = parsed.month || pad(now.getMonth() + 1);
  const year = parsed.year || String(now.getFullYear());
  const dataIdx = idx == null ? "" : `data-idx="${idx}"`;
  const months = lotMonthOptions()
    .map((m) => `<option value="${m}" ${m === month ? "selected" : ""}>${m}</option>`)
    .join("");
  const years = lotYearOptions()
    .map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`)
    .join("");
  return `
    <div class="lot-fields ${compact ? "lot-fields-compact" : ""}">
      <div class="field">
        <label>Lot number</label>
        <input name="${namePrefix}Number" class="item-lot-number" ${dataIdx} value="${escapeHtml(parsed.number)}" placeholder="01" inputmode="numeric" maxlength="4">
      </div>
      <div class="field">
        <label>Month</label>
        <select name="${namePrefix}Month" class="item-lot-month" ${dataIdx}>${months}</select>
      </div>
      <div class="field">
        <label>Year</label>
        <select name="${namePrefix}Year" class="item-lot-year" ${dataIdx}>${years}</select>
      </div>
    </div>
  `;
}
