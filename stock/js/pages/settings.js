import { getState, addRecord, updateSettings, resetStore, persist } from "../store.js";
import { can, currentUser } from "../auth.js";
import { writeAudit } from "../audit.js";
import { field, toast, confirmDialog, table, escapeHtml } from "../ui.js";
import { uid } from "../utils.js";
import { ROLES } from "../config.js";

export function render(root, ctx = {}, activeTab = null) {
  if (!can("settings.edit")) { root.innerHTML = `<p>Only administrators can change settings.</p>`; return; }
  const s = getState();
  const st = s.settings;
  const currentTab = activeTab || ctx.query?.tab || "general";

  root.innerHTML = `
    <div class="page-header"><div><h1>Settings</h1><div class="page-sub">Master data · categories, brands, units & permissions</div></div></div>
    <div class="tabs" id="tabs">
      ${[["general","General"],["categories","Categories"],["brands","Brands"],["units","Units"],["users","Users"]].map(([id,l])=>`<button class="tab ${id === currentTab ? "active" : ""}" data-t="${id}">${l}</button>`).join("")}
    </div>
    <div id="pane"></div>
  `;
  const pane = root.querySelector("#pane");
  const show = (t) => {
    root.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.t === t));
    if (t === "general") pane.innerHTML = general(st);
    if (t === "categories") pane.innerHTML = simpleList("categories", ["name"]);
    if (t === "brands") pane.innerHTML = simpleList("brands", ["name"]);
    if (t === "units") pane.innerHTML = simpleList("units", ["code", "name"]);
    if (t === "users") pane.innerHTML = users();
    bind(pane, t, root, ctx);
    pane.querySelector("[name=pin]")?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });
  };
  root.querySelectorAll(".tab").forEach((b) => b.onclick = () => show(b.dataset.t));
  show(currentTab);
}

function general(st) {
  return `
    <div class="panel settings-panel">
      <div class="panel-h">General</div>
      <div class="panel-b settings-panel-b">
        <form id="gf" class="settings-form">
          ${field("Company name", "companyName", { value: st.companyName })}
          <div class="field field-checkbox">
            <label class="checkbox-label">
              <input type="checkbox" name="allowNegativeStock" ${st.allowNegativeStock ? "checked" : ""}>
              <span>Allow negative stock (admin only)</span>
            </label>
          </div>
          <p class="hint text-muted settings-hint">Inventory valuation method: STANDARD COST (qty × variant cost price). Damaged stock is excluded from sellable value.</p>
          <div class="action-row settings-actions">
            <button class="btn btn-primary" type="submit">Save</button>
            <button class="btn btn-danger" type="button" id="reset">Clear all data</button>
          </div>
        </form>
      </div>
    </div>`;
}

function simpleList(col, fields) {
  const rows = getState()[col] || [];
  const columns = fields.map((f) => ({ label: f, value: (r) => r[f] }));
  columns.push({ label: "Active", value: (r) => (r.active === false ? "No" : "Yes") });
  columns.push({
    label: "Action",
    html: (r) => `<button type="button" class="btn btn-sm btn-danger btn-remove-item" data-col="${col}" data-id="${r.id}" data-name="${escapeHtml(r.name || r.code || "")}">Delete</button>`,
  });

  return `
    <div class="panel settings-list-panel">
      <div class="panel-b settings-list-wrap">
      ${table({ columns, rows })}
      <form class="settings-add-toolbar" id="add">
        ${fields.map((f) => `<div class="field settings-add-field"><label>${escapeHtml(f)}</label><input name="${f}" placeholder="${escapeHtml(f)}" required></div>`).join("")}
        <button class="btn btn-primary settings-add-btn" type="submit">Add</button>
      </form>
      </div>
    </div>
  `;
}

function users() {
  const s = getState();
  return `
    <div class="panel settings-list-panel">
      <div class="panel-b settings-list-wrap">
    ${table({
      columns: [
        { label: "Code", value: (r) => r.pin || "—" },
        { label: "Name", value: (r) => r.name },
        { label: "Role", value: (r) => r.role },
        { label: "Active", value: (r) => (r.active ? "Yes" : "No") },
        {
          label: "Action",
          html: (r) =>
            r.id === "u_admin"
              ? ""
              : `<button type="button" class="btn btn-sm btn-danger btn-remove-item" data-col="users" data-id="${r.id}" data-name="${escapeHtml(r.name || r.pin)}">Delete</button>`,
        },
      ],
      rows: s.users,
    })}
      </div>
    </div>
    <div class="panel settings-panel settings-users-add">
      <div class="panel-h">Add user</div>
      <div class="panel-b">
        <form id="add" class="settings-form settings-form-wide">
          <div class="form-row settings-user-fields">
            ${field("6-digit code", "pin", { required: true, extra: 'inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="000000"' })}
            ${field("Name", "name", { required: true })}
            ${field("Role", "role", { options: Object.keys(ROLES).map((r) => ({ value: r, label: r })) })}
          </div>
          <div class="action-row settings-actions">
            <button class="btn btn-primary" type="submit">Add user</button>
          </div>
        </form>
        <p class="hint text-muted settings-hint">Each person signs in with only their 6-digit code.</p>
      </div>
    </div>
  `;
}

function bind(pane, t, root, ctx) {
  if (t === "general") {
    pane.querySelector("#gf").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      updateSettings({ companyName: fd.get("companyName"), allowNegativeStock: !!e.target.allowNegativeStock.checked });
      writeAudit({ userId: currentUser().id, action: "UPDATE", module: "SETTINGS", recordType: "settings", recordId: "app", newValue: fd.get("companyName") });
      toast("Settings saved");
    };
    pane.querySelector("#reset").onclick = async () => {
      const ok = await confirmDialog("Clear all products, stock, and history in this browser? This cannot be undone.");
      if (!ok) return;
      resetStore();
      toast("Data cleared");
      location.reload();
    };
    return;
  }

  pane.querySelectorAll(".btn-remove-item").forEach((btn) => {
    btn.onclick = async () => {
      const colName = btn.dataset.col;
      const recId = btn.dataset.id;
      const itemName = btn.dataset.name;

      const ok = await confirmDialog(`Are you sure you want to remove "${itemName}"?`);
      if (!ok) return;

      const list = getState()[colName];
      const idx = list.findIndex((r) => r.id === recId);
      if (idx >= 0) {
        list.splice(idx, 1);
        persist(true);
        writeAudit({
          userId: currentUser().id,
          action: "DELETE",
          module: "SETTINGS",
          recordType: colName,
          recordId: recId,
          newValue: itemName,
        });
        toast(`Removed "${itemName}"`);
        render(root, ctx, t);
      }
    };
  });

  pane.querySelector("#add")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rec = { id: uid(t.slice(0, 3)), active: true };
    fd.forEach((v, k) => { rec[k] = v; });
    const col = t === "users" ? "users" : t;
    if (t === "users") {
      rec.pin = String(rec.pin || "").replace(/\D/g, "");
      if (!/^\d{6}$/.test(rec.pin)) {
        toast("Code must be 6 digits", "error");
        return;
      }
      if (getState().users.some((u) => u.pin === rec.pin)) {
        toast("That code is already in use", "error");
        return;
      }
      rec.username = rec.name;
    }
    addRecord(col, rec);
    writeAudit({ userId: currentUser().id, action: "CREATE", module: "SETTINGS", recordType: t, recordId: rec.id, newValue: rec.name || rec.code || rec.pin });
    toast("Saved");
    render(root, ctx, t);
  });
}
