import { loadStore } from "./store.js";
import { ensureSession, can } from "./auth.js";
import { register, start, go } from "./router.js";
import { startHardwareScanner, onScan, focusScannerInput } from "./barcode.js";
import { escapeHtml, icon, toast } from "./ui.js";
import { lookupBarcode } from "./db.js";

const isEmbed = new URLSearchParams(location.search).get("embed") === "1";

loadStore();
ensureSession();

register("/dashboard", () => import("./pages/dashboard.js"));
register("/scan", () => import("./pages/scan.js"));
register("/products", () => import("./pages/products.js"));
register("/products/new", () => import("./pages/product-edit.js"));
register("/products/:id/edit", () => import("./pages/product-edit.js"));
register("/products/:id", () => import("./pages/product-detail.js"));
register("/add-stock", () => import("./pages/add-stock.js"));
register("/stock-count", () => import("./pages/stock-count.js"));
register("/stock-count/new", () => import("./pages/stock-count.js"));
register("/stock-count/:id", () => import("./pages/stock-count.js"));
register("/quotations", () => import("./pages/quotation.js"));
register("/quotations/new", () => import("./pages/quotation.js"));
register("/quotations/:id", () => import("./pages/quotation.js"));
register("/invoices", () => import("./pages/invoice.js"));
register("/tax-invoices", () => import("./pages/tax-invoice.js"));
register("/adjustments", () => import("./pages/adjustments.js"));
register("/settings", () => import("./pages/settings.js"));

const NAV = [
  { href: "/dashboard", label: "Home", perm: "inventory.view", icon: "grid" },
  { href: "/quotations", label: "Quotation", perm: "inventory.view", icon: "doc" },
  { href: "/invoices", label: "Invoice", perm: "inventory.view", icon: "invoice" },
  { href: "/tax-invoices", label: "Tax Invoice", perm: "inventory.view", icon: "tax" },
  { href: "/settings", label: "Settings", perm: "settings.edit", icon: "gear" },
];

function brandHtml() {
  return `<img src="../images/logo/Logo.png" alt="Cuplighton" class="brand-logo">`;
}

function isActive(path, href) {
  return path === href || (href !== "/dashboard" && path.startsWith(href));
}

function renderAppShell(page, ctx) {
  const user = ensureSession();
  const path = ctx.path;

  if (isEmbed) {
    const app = document.getElementById("app");
    app.innerHTML = `<main class="app-main app-main-embed"><div class="page page-embed" id="page-root"></div></main>`;
    document.body.classList.add("stock-embed");
    return page.render(document.getElementById("page-root"), ctx);
  }

  const sideNav = NAV.map((item) => {
    if (item.perm && !can(item.perm)) return "";
    return `<a class="nav-link ${isActive(path, item.href) ? "active" : ""}" href="#${item.href}">${icon(item.icon || "box")}<span>${escapeHtml(item.label)}</span></a>`;
  }).join("");

  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="app-shell" id="shell">
      <header class="app-header">
        <button class="sidebar-toggle" id="btn-sidebar" aria-label="Menu">${icon("menu")}</button>
        <a class="brand" href="#/dashboard">${brandHtml()}</a>
        <div class="header-actions">
          <a class="stock-back-site" href="../index.html">← Back to site</a>
          <div class="header-user">
            <div class="name">${escapeHtml(user?.name || "Staff")}</div>
            <div class="role">${escapeHtml(user?.role || "")}</div>
          </div>
        </div>
      </header>
      <aside class="app-sidebar" id="sidebar"><nav>${sideNav}</nav></aside>
      <main class="app-main"><div class="page" id="page-root"></div></main>
    </div>
    <div class="overlay" id="overlay"></div>
  `;

  document.getElementById("btn-sidebar").onclick = () => {
    document.getElementById("shell").classList.toggle("sidebar-open");
    document.getElementById("overlay").classList.toggle("show");
  };
  document.getElementById("overlay").onclick = () => {
    document.getElementById("shell").classList.remove("sidebar-open");
    document.getElementById("overlay").classList.remove("show");
  };

  return page.render(document.getElementById("page-root"), ctx);
}

startHardwareScanner();
onScan(({ code, hit }) => {
  const hash = location.hash;
  if (hash.startsWith("#/scan") || hash.startsWith("#/stock-count") || hash.startsWith("#/adjustments") || hash.startsWith("#/add-stock")) return;
  if (document.querySelector("[data-scanner='true']:focus")) return;
  if (hit) go(`/scan?code=${encodeURIComponent(code)}`);
  else toast(`Unknown barcode: ${code}`, "error");
});

start(async (ctx) => {
  ensureSession();
  if (ctx.path === "/login" || ctx.path.startsWith("/inventory")) {
    go("/dashboard");
    return;
  }
  await renderAppShell(ctx.page, ctx);
  focusScannerInput();
});

window.addEventListener("unhandledrejection", (e) => {
  toast(e.reason?.message || "Unexpected error", "error");
});
